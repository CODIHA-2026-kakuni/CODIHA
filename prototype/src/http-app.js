import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import {
  calculateDistanceKm,
  isValidCoordinatePair,
  roundDistance,
} from "./distance.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDirectory, "..");

const DATA_ERROR_MESSAGE =
  "回収場所データを取得できませんでした。時間をおいて、もう一度お試しください。";

function parseOrigin(query) {
  const hasLatitude = query.lat !== undefined;
  const hasLongitude = query.lng !== undefined;

  if (!hasLatitude && !hasLongitude) {
    return { origin: null };
  }

  if (!hasLatitude || !hasLongitude) {
    return { error: "緯度と経度は両方指定してください。" };
  }

  if (
    typeof query.lat !== "string" ||
    typeof query.lng !== "string" ||
    query.lat.trim() === "" ||
    query.lng.trim() === ""
  ) {
    return { error: "緯度または経度の値が正しくありません。" };
  }

  const latitude = Number(query.lat);
  const longitude = Number(query.lng);

  if (!isValidCoordinatePair(latitude, longitude)) {
    return { error: "緯度または経度の値が正しくありません。" };
  }

  return { origin: { latitude, longitude } };
}

export function createHttpApp({ repository, logger = console }) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());
  app.use(
    "/vendor/leaflet",
    express.static(path.join(projectRoot, "node_modules", "leaflet", "dist")),
  );
  app.use(express.static(path.join(projectRoot, "public")));

  app.get("/api/sites", async (request, response) => {
    const parsed = parseOrigin(request.query);
    if (parsed.error) {
      return response.status(400).json({ error: parsed.error });
    }

    try {
      const sites = await repository.listSites();
      const responseSites = parsed.origin
        ? sites
            .map((site) => ({
              site,
              distanceKm: calculateDistanceKm(parsed.origin, {
                latitude: site.latitude,
                longitude: site.longitude,
              }),
            }))
            .sort(
              (first, second) =>
                first.distanceKm - second.distanceKm ||
                first.site.displayOrder - second.site.displayOrder,
            )
            .map(({ site, distanceKm }) => ({
              ...site,
              distanceKm: roundDistance(distanceKm),
            }))
        : sites;

      return response.json({
        count: responseSites.length,
        origin: parsed.origin,
        sites: responseSites,
      });
    } catch (error) {
      logger.error("Failed to list collection sites", error);
      return response.status(503).json({ error: DATA_ERROR_MESSAGE });
    }
  });

  app.get("/api/health", async (_request, response) => {
    try {
      await repository.ping();
      return response.json({ status: "ok", web: "ok", database: "connected" });
    } catch (error) {
      logger.error("Database health check failed", error);
      return response
        .status(503)
        .json({ status: "error", web: "ok", database: "unavailable" });
    }
  });

  app.use((request, response, next) => {
    if (request.path.startsWith("/api/")) {
      return response.status(404).json({ error: "APIが見つかりません。" });
    }
    return next();
  });

  return app;
}
