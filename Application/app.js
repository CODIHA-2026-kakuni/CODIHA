const path = require('path');
const express = require('express');
const pool = require('./db/pool');
const { filterAndSortItems } = require('./lib/item-search');
const {
  buildItemBadges,
  normalizeCaution,
  normalizeDisposeMethod,
  parseItemId,
} = require('./lib/item-result');
// 回収種別、位置情報、施設一覧を処理する関数。
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
const RESULT_PAGE_STATES = new Set([
  'loading',
  'empty',
  'error',
  'no-location',
]);

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

// Application/public 配下のJavaScriptなどを、そのままのパスで公開する
// 例: Application/public/js/result.js → http://localhost:3000/js/result.js
app.use(express.static(path.join(__dirname, 'public')));

// ---- 品目検索画面 ----
async function renderSearchPage(req, res, databasePool = pool) {
  const query = getSearchQuery(req.query.q);
  const previewState = getPreviewState(req.query.state, SEARCH_PAGE_STATES);
  const retryUrl = query === '' ? '/' : `/?q=${encodeURIComponent(query)}`;

  if (previewState !== null) {
    return res.render('index', {
      title: 'ごみ分別・持込ナビ | 品目検索',
      state: previewState,
      previewState,
      query,
      items: [],
      retryUrl,
    });
  }

  try {
    const [databaseItems] = await databasePool.query(`
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
      title: 'ごみ分別・持込ナビ | 品目検索',
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
      title: 'ごみ分別・持込ナビ | 品目検索',
      state: 'error',
      previewState: null,
      query,
      items: [],
      retryUrl,
    });
  }
}

app.get('/', (req, res) => renderSearchPage(req, res));

// ---- 選択した品目の結果画面 ----
async function renderResultPage(req, res, databasePool = pool) {
  const previewState = getPreviewState(req.query.state, RESULT_PAGE_STATES);

  // itemIdがない画面確認用URLでは、骨組みを表示する。
  if (req.query.itemId === undefined && previewState !== null) {
    return res.render('result', {
      title: 'ごみ分別・持込ナビ | 回収場所',
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
      title: '品目が見つかりません | ごみ分別・持込ナビ',
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
          dispose_method,
          caution,
          requires_dropoff,
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
        title: '品目が見つかりません | ごみ分別・持込ナビ',
        pageState: 'not-found',
        state: 'loading',
        item: null,
        badges: [],
        retryUrl: `/result?itemId=${itemId}`,
      });
    }

    const item = {
      ...items[0],
      dispose_method: normalizeDisposeMethod(items[0].dispose_method),
      caution: normalizeCaution(items[0].caution),
      requires_dropoff:
        items[0].requires_dropoff === true || items[0].requires_dropoff === 1,
    };
    // 回収ボックスの対象外（可燃ごみなど）は、案内できる回収場所がない。
    // その場合は地図と回収場所の一覧を出さず、捨て方だけを表示する。
    const hasRecoverySite = getRecoveryTypes(items[0]).length > 0;
    // 回収場所がある場合は位置情報の確認を開始し、ない場合は捨て方だけを表示する。
    // ?state=...を明示した場合は、画面確認用の状態を優先する。
    const state = previewState
      || (hasRecoverySite ? 'pending-location' : 'empty');

    return res.render('result', {
      title: `${item.name} | ごみ分別・持込ナビ`,
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
      title: '情報を読み込めませんでした | ごみ分別・持込ナビ',
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
async function getItemSites(req, res, databasePool = pool) {
  const itemId = parseItemId(req.params.id);

  if (itemId === null) {
    return res.status(400).json({ message: SITE_SEARCH_ERROR_MESSAGE });
  }

  const coordinates = parseCoordinates(req.query);

  if (coordinates === null) {
    return res.status(400).json({ message: SITE_SEARCH_ERROR_MESSAGE });
  }

  try {
    // プレースホルダーを使い、指定されたIDの品目を最大1件取得する。
    const [items] = await databasePool.query(
      `
        SELECT id, battery, phone, other_electronics
        FROM item
        WHERE id = ?
        LIMIT 1
      `,
      [itemId],
    );

    if (items.length === 0) {
      return res.status(404).json({ message: SITE_SEARCH_ERROR_MESSAGE });
    }

    const recoveryTypes = getRecoveryTypes(items[0]);

    if (recoveryTypes.length === 0) {
      return res.status(200).json({ sites: [] });
    }

    // 列名はRECOVERY_TYPE_COLUMNSの許可リストから選ばれる。
    const recoveryConditions = recoveryTypes
      .map((columnName) => `${columnName} = TRUE`)
      .join(' OR ');

    // 選択品目の回収種別に一つでも対応する施設を取得する。
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
// app.jsが直接実行された場合だけ、リクエストの待受を開始する。
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

module.exports = {
  app,
  renderSearchPage,
  renderResultPage,
  getItemSites,
};
