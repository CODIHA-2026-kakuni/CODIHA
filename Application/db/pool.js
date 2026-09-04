// ------------------------------------------------------------
// MySQL 接続プール
// ------------------------------------------------------------
// 環境変数（.env / docker compose の environment）から接続情報を取得する。
// 各ルート/モデルからは `const pool = require('../db/pool');` で読み込み、
// `const [rows] = await pool.query('SELECT ...');` のように利用する。
// ------------------------------------------------------------

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'codiha',
  password: process.env.DB_PASSWORD || 'codiha',
  database: process.env.DB_NAME || 'codiha',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
