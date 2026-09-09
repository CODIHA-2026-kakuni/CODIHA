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
const {
  buildItemBadges,
  normalizeCaution,
  parseItemId,
} = require('./lib/item-result');
//lib/site-search.jsの関数を宣言
const {
  getRecoveryTypes,
  parseCoordinates,
  buildSiteList,
} = require('./lib/site-search');

const SITE_SEARCH_ERROR_MESSAGE = '回収場所を取得できませんでした。';

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
      WHERE battery = TRUE
         OR phone = TRUE
         OR other_electronics = TRUE
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

// ---- 選択した品目の結果画面 ----
// databasePoolを引数にすることで、テスト時はMySQLへ接続せず動作を確認できる。
async function renderResultPage(req, res, databasePool = pool) {
  const previewState = getPreviewState(req.query.state, RESULT_PAGE_STATES);

  // itemIdがない画面確認用URLは、従来どおり骨組みを表示する。
  if (req.query.itemId === undefined && previewState !== null) {
    return res.render('result', {
      title: '小型家電回収ナビ | 回収場所',
      pageState: previewState === 'error' ? 'error' : 'preview',
      state: previewState,
      item: null,
      badges: [],
      retryUrl: '/result?state=loading',
    });
  }

  const itemId = parseItemId(req.query.itemId);

  if (itemId === null) {
    return res.status(400).render('result', {
      title: '品目が見つかりません | 小型家電回収ナビ',
      pageState: 'not-found',
      state: 'loading',
      item: null,
      badges: [],
      retryUrl: '/result',
    });
  }

  try {
    const [items] = await databasePool.query(
      `
        SELECT
          id,
          name,
          category,
          caution,
          battery,
          phone,
          other_electronics
        FROM item
        WHERE id = ?
        LIMIT 1
      `,
      [itemId],
    );

    if (items.length === 0) {
      return res.status(404).render('result', {
        title: '品目が見つかりません | 小型家電回収ナビ',
        pageState: 'not-found',
        state: 'loading',
        item: null,
        badges: [],
        retryUrl: `/result?itemId=${itemId}`,
      });
    }

    // このサービスの対象外である小型家電以外の品目は表示しない。
    if (getRecoveryTypes(items[0]).length === 0) {
      return res.status(404).render('result', {
        title: '品目が見つかりません | 小型家電回収ナビ',
        pageState: 'not-found',
        state: 'loading',
        item: null,
        badges: [],
        retryUrl: `/result?itemId=${itemId}`,
      });
    }

    const item = {
      ...items[0],
      caution: normalizeCaution(items[0].caution),
    };
    // 通常表示では後続機能を「読み込み中」のままにせず、未実装だと分かる状態にする。
    // ?state=loading を明示した場合は、引き続き画面確認用の骨組みを表示する。
    const state = previewState || 'pending-location';

    return res.render('result', {
      title: `${item.name} | 小型家電回収ナビ`,
      pageState: state === 'error' ? 'error' : 'success',
      state,
      item,
      badges: buildItemBadges(item),
      retryUrl: `/result?itemId=${itemId}`,
    });
  } catch (error) {
    console.error(
      '品目詳細の取得に失敗しました:',
      error.code || 'UNKNOWN_ERROR',
    );

    return res.status(500).render('result', {
      title: '情報を読み込めませんでした | 小型家電回収ナビ',
      pageState: 'error',
      state: 'error',
      item: null,
      badges: [],
      retryUrl: `/result?itemId=${itemId}`,
    });
  }
}

app.get('/result', (req, res) => renderResultPage(req, res));

// ---- 品目に対応する回収場所API ----
// databasePoolを引数にすることで、テスト時はMySQLへ接続せず動作を確認できる。
async function getItemSites(req, res, databasePool = pool) {
  const itemId = parseItemId(req.params.id);//itemのid取得

  if (itemId === null) {
    return res.status(400).json({ message: SITE_SEARCH_ERROR_MESSAGE });
  }

  const coordinates = parseCoordinates(req.query);//位置情報取得

  if (coordinates === null) {
    return res.status(400).json({ message: SITE_SEARCH_ERROR_MESSAGE });
  }

  //try内でエラーが起きたらcatch内の処理を実行する
  try {
    const [items] = await databasePool.query(//DBのitemテーブルからデータの取得を２回まで
      `
        SELECT id, battery, phone, other_electronics
        FROM item
        WHERE id = ? 
        LIMIT 1
      `,
      [itemId],
    );//[itemId]はSQLの?に入る値を指定

    if (items.length === 0) {
      return res.status(404).json({ message: SITE_SEARCH_ERROR_MESSAGE });
    }

    const recoveryTypes = getRecoveryTypes(items[0]);

    if (recoveryTypes.length === 0) {//回収種別が全てfalseの品目では空配列を返す
      return res.status(200).json({ sites: [] });
    }

    const recoveryConditions = recoveryTypes
      .map((columnName) => `${columnName} = TRUE`)//`battery=TRUE`といった配列の作成
      .join(' OR ');//`battery=TRUE OR phone=TRUE`のように結合
    
    //recoveryConditionsからrecycle_locationのデータを取得する
    const [rows] = await databasePool.query(`
      SELECT id, name, reading, ward, address, latitude, longitude, business_hours
      FROM recycle_location
      WHERE ${recoveryConditions}
    `);

    return res.status(200).json({ sites: buildSiteList(rows, coordinates) });
  } catch (error) {
    console.error(
      '回収場所の取得に失敗しました:',
      error.code || 'UNKNOWN_ERROR',
    );

    return res.status(500).json({ message: SITE_SEARCH_ERROR_MESSAGE });
  }
}

app.get('/api/items/:id/sites', (req, res) => getItemSites(req, res));

// ---- サーバー起動 ----
// テストからapp.jsを読み込んだだけでは、待受を開始しない。
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

module.exports = {
  app,
  renderResultPage,
  getItemSites,
};
