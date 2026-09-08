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

// UI確認用に受け付ける画面状態。
// API実装後は、通信結果に応じてブラウザ側で切り替える予定。
const SEARCH_PAGE_STATES = new Set(['loading', 'empty', 'error']);
const RESULT_PAGE_STATES = new Set(['loading', 'empty', 'error', 'no-location']);

function getPageState(queryState, allowedStates) {
  if (typeof queryState === 'string' && allowedStates.has(queryState)) {
    return queryState;
  }

  return 'loading';
}

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
// 例: Application/CSS/sample.css → http://localhost:3000/css/sample.css
app.use('/css', express.static(path.join(__dirname, 'CSS')));

// Application/public 配下は、静的HTML等の置き場として公開する
// 例: Application/public/about.html → http://localhost:3000/about.html
app.use(express.static(path.join(__dirname, 'public')));

// ---- ルーティング（UI動作確認用） ----
// 例: /?state=empty のように指定すると、各画面状態を確認できる。
app.get('/', (req, res) => {
  res.render('index', {
    title: '小型家電回収ナビ | 品目検索',
    state: getPageState(req.query.state, SEARCH_PAGE_STATES),
  });
});

// 将来は /result?itemId={id} で、選択した品目情報を表示する。
app.get('/result', (req, res) => {
  res.render('result', {
    title: '小型家電回収ナビ | 回収場所',
    state: getPageState(req.query.state, RESULT_PAGE_STATES),
  });
});

// ---- サーバー起動 ----
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
