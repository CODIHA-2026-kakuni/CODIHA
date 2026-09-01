import process from "node:process";
import mysql from "mysql2/promise";
import { createHttpApp } from "./http-app.js";
import { createSiteRepository } from "./site-repository.js";

const port = Number(process.env.PORT ?? 3000);

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "codiha",
  password: process.env.DB_PASSWORD ?? "codiha_dev",
  database: process.env.DB_NAME ?? "codiha",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
  charset: "utf8mb4",
  dateStrings: true,
});

const repository = createSiteRepository(pool);
const app = createHttpApp({ repository });
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`CODIHA prototype is available on http://localhost:${port}`);
});

async function shutDown(signal) {
  console.log(`${signal} received. Shutting down...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutDown("SIGTERM"));
process.on("SIGINT", () => shutDown("SIGINT"));
