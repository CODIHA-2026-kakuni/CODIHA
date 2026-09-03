const path = require("node:path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// public配下（HTML/CSS/JS等の静的ファイル）を配信する
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`CODIHA server listening on http://localhost:${PORT}`);
});
