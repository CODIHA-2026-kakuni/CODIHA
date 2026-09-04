// ------------------------------------------------------------
// Express + Node.js セットアップ
// ------------------------------------------------------------
// 事前準備（未実施の場合）:
//   1. package.json がなければ作成:  npm init -y
//   2. Express をインストール:      npm install express ejs
// ------------------------------------------------------------

const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- テンプレートエンジン設定 ----
// Application/views 配下の .ejs テンプレートを描画する
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// ---- ミドルウェア設定 ----
// JSON / URLエンコードされたリクエストボディを扱えるようにする
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- 静的ファイル配信 ----
// Application/CSS 配下のファイルを /css というパスで公開する
// 例: Application/CSS/style.css → http://localhost:3000/css/style.css
app.use('/css', express.static(path.join(__dirname, 'CSS')));

// Application/public 配下は、静的HTML等の置き場として公開する
// 例: Application/public/about.html → http://localhost:3000/about.html
app.use(express.static(path.join(__dirname, 'public')));

// ---- ルーティング（動作確認用） ----
// views/index.ejs を描画して返す
app.get('/', (req, res) => {
  res.render('index', { title: 'CODIHA' });
});

// ---- サーバー起動 ----
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
