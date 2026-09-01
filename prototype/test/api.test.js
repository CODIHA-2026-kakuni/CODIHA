import assert from "node:assert/strict";
import test from "node:test";
import { createHttpApp } from "../src/http-app.js";

const sites = [
  {
    id: 1,
    displayOrder: 1,
    name: "遠い施設",
    ward: "緑区",
    address: "千葉市緑区",
    hoursText: "9時00分～17時00分",
    latitude: 35.53,
    longitude: 140.27,
  },
  {
    id: 2,
    displayOrder: 2,
    name: "近い施設",
    ward: "中央区",
    address: "千葉市中央区",
    hoursText: "9時00分～17時00分",
    latitude: 35.6074,
    longitude: 140.1066,
  },
];

const silentLogger = { error() {} };

async function withServer(repository, callback) {
  const app = createHttpApp({ repository, logger: silentLogger });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();

  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("位置情報なしでは公式掲載順で全拠点を返す", async () => {
  const repository = { listSites: async () => sites, ping: async () => true };

  await withServer(repository, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/sites`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.count, 2);
    assert.equal(body.origin, null);
    assert.deepEqual(
      body.sites.map((site) => site.id),
      [1, 2],
    );
    assert.equal("distanceKm" in body.sites[0], false);
  });
});

test("位置情報ありでは距離を追加して近い順に返す", async () => {
  const repository = { listSites: async () => sites, ping: async () => true };

  await withServer(repository, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/sites?lat=35.6074&lng=140.1065`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(
      body.sites.map((site) => site.id),
      [2, 1],
    );
    assert.ok(body.sites[0].distanceKm < body.sites[1].distanceKm);
  });
});

test("表示距離が同じでも丸める前の距離で並べる", async () => {
  const closeSites = [
    { ...sites[0], id: 1, displayOrder: 1, latitude: 0, longitude: 0.000044 },
    { ...sites[1], id: 2, displayOrder: 2, latitude: 0, longitude: 0.000041 },
  ];
  const repository = { listSites: async () => closeSites, ping: async () => true };

  await withServer(repository, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/sites?lat=0&lng=0`);
    const body = await response.json();

    assert.deepEqual(
      body.sites.map((site) => site.id),
      [2, 1],
    );
    assert.deepEqual(
      body.sites.map((site) => site.distanceKm),
      [0, 0],
    );
  });
});

test("緯度・経度が片方だけ、空、または範囲外なら400を返す", async () => {
  const repository = { listSites: async () => sites, ping: async () => true };

  await withServer(repository, async (baseUrl) => {
    const missing = await fetch(`${baseUrl}/api/sites?lat=35.6`);
    const empty = await fetch(`${baseUrl}/api/sites?lat=&lng=`);
    const invalid = await fetch(`${baseUrl}/api/sites?lat=95&lng=140`);

    assert.equal(missing.status, 400);
    assert.equal(empty.status, 400);
    assert.equal(invalid.status, 400);
  });
});

test("MySQLへ接続できない場合は503を返す", async () => {
  const repository = {
    listSites: async () => {
      throw new Error("database unavailable");
    },
    ping: async () => {
      throw new Error("database unavailable");
    },
  };

  await withServer(repository, async (baseUrl) => {
    const sitesResponse = await fetch(`${baseUrl}/api/sites`);
    const healthResponse = await fetch(`${baseUrl}/api/health`);

    assert.equal(sitesResponse.status, 503);
    assert.equal(healthResponse.status, 503);
    assert.deepEqual(await healthResponse.json(), {
      status: "error",
      web: "ok",
      database: "unavailable",
    });
  });
});

test("ヘルスチェックはWebとMySQLの状態を返す", async () => {
  const repository = { listSites: async () => sites, ping: async () => true };

  await withServer(repository, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ok",
      web: "ok",
      database: "connected",
    });
  });
});
