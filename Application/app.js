// ------------------------------------------------------------
// Express + Node.js セットアップ
// ------------------------------------------------------------
// 事前準備（未実施の場合）:
//   1. package.json がなければ作成:  npm init -y
//   2. Express をインストール:      npm install express ejs
// ------------------------------------------------------------

const path = require('path');
const express = require('express');
const pool = require('./db/pool');
const { filterAndSortItems } = require('./lib/item-search');

const app = express();
const PORT = process.env.PORT || 3000;

// UI確認用に受け付ける画面状態。
// 通常アクセスでは使わず、?state=...を指定した場合だけ表示確認に使う。
const SEARCH_PAGE_STATES = new Set(['loading', 'empty', 'error']);
const RESULT_PAGE_STATES = new Set(['loading', 'empty', 'error', 'no-location']);

function getPreviewState(queryState, allowedStates) {
  if (typeof queryState === 'string' && allowedStates.has(queryState)) {
    return queryState;
  }

  return null;
}

function getPageState(queryState, allowedStates) {
  return getPreviewState(queryState, allowedStates) || 'loading';
}

function getSearchQuery(queryValue) {
  if (typeof queryValue !== 'string') {
    return '';
  }

  return queryValue.trim().slice(0, 100);
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

// ---- 品目検索画面 ----
// 通常はMySQLの品目を表示し、?state=...を指定した場合だけUI確認表示にする。
app.get('/', async (req, res) => {
  const query = getSearchQuery(req.query.q);
  const previewState = getPreviewState(req.query.state, SEARCH_PAGE_STATES);
  const retryUrl = query === '' ? '/' : `/?q=${encodeURIComponent(query)}`;

  if (previewState !== null) {
    return res.render('index', {
      title: '小型家電回収ナビ | 品目検索',
      state: previewState,
      previewState,
      query,
      items: [],
      retryUrl,
    });
  }

  try {
    const [databaseItems] = await pool.query(`
      SELECT id, name, reading, category
      FROM item
    `);
    const items = filterAndSortItems(databaseItems, query);

    let state = 'success';
    if (databaseItems.length === 0) {
      state = 'no-data';
    } else if (items.length === 0) {
      state = 'empty';
    }

    return res.render('index', {
      title: '小型家電回収ナビ | 品目検索',
      state,
      previewState: null,
      query,
      items,
      retryUrl,
    });
  } catch (error) {
    console.error(
      '品目データの取得に失敗しました:',
      error.code || 'UNKNOWN_ERROR',
    );

    return res.status(500).render('index', {
      title: '小型家電回収ナビ | 品目検索',
      state: 'error',
      previewState: null,
      query,
      items: [],
      retryUrl,
    });
  }
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
