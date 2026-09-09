// GET /api/items/:id/sites を「入力→期待結果→実際の結果→判定」の表としてログに残す
// ブラックボックステストのレポート生成スクリプト。
//
// site-search.test.js / sites-route.test.js が内部実装（Haversine式・並び替え
// アルゴリズム等）を検証する単体・結合テストであるのに対し、こちらは
// local/excelバックアップ/API.md に書かれたAPIの入出力契約だけを見て、
// 実装の詳細には一切触れずに検証する。
const fs = require('fs');
const path = require('path');

const { getItemSites } = require('../app');

const ERROR_MESSAGE = '回収場所を取得できませんでした。';

const ITEM_WITH_OTHER_ELECTRONICS = {
  id: 7, battery: 0, phone: 0, other_electronics: 1,
};
const ITEM_WITH_NO_RECOVERY_TYPE = {
  id: 1, battery: 0, phone: 0, other_electronics: 0,
};

const SITES = [
  {
    id: 1, name: '稲毛区役所', reading: 'いなげくやくしょ', ward: '稲毛区',
    address: '千葉市稲毛区1-1', latitude: '35.63', longitude: '140.13',
    business_hours: '平日9:00～17:00',
  },
  {
    id: 2, name: '中央区役所', reading: 'ちゅうおうくやくしょ', ward: '中央区',
    address: '千葉市中央区1-1', latitude: '35.61', longitude: '140.11',
    business_hours: null,
  },
];

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

function poolThatMustNotBeQueried() {
  return {
    async query() {
      throw new Error('入力チェックで弾かれるべきリクエストがDBへ問い合わせています');
    },
  };
}

function poolWithItemAndSites(item) {
  return {
    async query(sql) {
      if (/FROM item/.test(sql)) {
        return [[item]];
      }
      return [SITES];
    },
  };
}

function poolWithNoSuchItem() {
  return {
    async query() {
      return [[]];
    },
  };
}

// 各ケースは「どんなリクエストを送ったら、何が返るべきか」というAPIの外部仕様だけで定義する。
const CASES = [
  {
    id: 'TC01',
    description: '品目IDが数値でない場合は400を返す',
    request: { params: { id: 'abc' }, query: {} },
    pool: poolThatMustNotBeQueried(),
    expected: '400 / エラーメッセージのみ',
    verify: (res) => res.statusCode === 400 && res.body.message === ERROR_MESSAGE,
  },
  {
    id: 'TC02',
    description: '品目IDが0以下の場合は400を返す',
    request: { params: { id: '0' }, query: {} },
    pool: poolThatMustNotBeQueried(),
    expected: '400 / エラーメッセージのみ',
    verify: (res) => res.statusCode === 400 && res.body.message === ERROR_MESSAGE,
  },
  {
    id: 'TC03',
    description: '緯度だけ指定し経度を省略した場合は400を返す',
    request: { params: { id: '7' }, query: { lat: '35.6' } },
    pool: poolThatMustNotBeQueried(),
    expected: '400 / エラーメッセージのみ',
    verify: (res) => res.statusCode === 400 && res.body.message === ERROR_MESSAGE,
  },
  {
    id: 'TC04',
    description: '緯度が地理上ありえない範囲（91度）の場合は400を返す',
    request: { params: { id: '7' }, query: { lat: '91', lng: '140' } },
    pool: poolThatMustNotBeQueried(),
    expected: '400 / エラーメッセージのみ',
    verify: (res) => res.statusCode === 400 && res.body.message === ERROR_MESSAGE,
  },
  {
    id: 'TC05',
    description: '存在しない品目IDの場合は404を返す',
    request: { params: { id: '999999' }, query: {} },
    pool: poolWithNoSuchItem(),
    expected: '404 / エラーメッセージのみ',
    verify: (res) => res.statusCode === 404 && res.body.message === ERROR_MESSAGE,
  },
  {
    id: 'TC06',
    description: 'どの回収種別にも対応していない品目は200・空配列を返す',
    request: { params: { id: '1' }, query: {} },
    pool: poolWithItemAndSites(ITEM_WITH_NO_RECOVERY_TYPE),
    expected: '200 / sites: []',
    verify: (res) => res.statusCode === 200 && Array.isArray(res.body.sites) && res.body.sites.length === 0,
  },
  {
    id: 'TC07',
    description: '位置情報なしで対応施設がある場合、区の固定順で施設を返す',
    request: { params: { id: '7' }, query: {} },
    pool: poolWithItemAndSites(ITEM_WITH_OTHER_ELECTRONICS),
    expected: '200 / 稲毛区の施設→中央区の施設の順、distanceKmは全てnull',
    verify: (res) => {
      if (res.statusCode !== 200 || res.body.sites.length !== 2) return false;
      const [first, second] = res.body.sites;
      return first.ward === '稲毛区'
        && second.ward === '中央区'
        && first.distanceKm === null
        && second.distanceKm === null;
    },
  },
  {
    id: 'TC08',
    description: '位置情報ありで対応施設がある場合、近い施設から順に返す',
    request: { params: { id: '7' }, query: { lat: '35.611', lng: '140.111' } },
    pool: poolWithItemAndSites(ITEM_WITH_OTHER_ELECTRONICS),
    expected: '200 / 中央区役所(id:2)→稲毛区役所(id:1)の順、distanceKmは数値',
    verify: (res) => {
      if (res.statusCode !== 200 || res.body.sites.length !== 2) return false;
      const [first, second] = res.body.sites;
      return first.id === 2
        && second.id === 1
        && typeof first.distanceKm === 'number'
        && first.distanceKm <= second.distanceKm;
    },
  },
];

function summarizeActual(res) {
  if (res.body && Array.isArray(res.body.sites)) {
    const sitesSummary = res.body.sites
      .map((site) => `id:${site.id}(${site.ward}, distanceKm:${site.distanceKm})`)
      .join(', ');
    return `${res.statusCode} / sites: [${sitesSummary}]`;
  }

  return `${res.statusCode} / ${JSON.stringify(res.body)}`;
}

function summarizeRequest(request) {
  const query = new URLSearchParams(request.query).toString();
  return `GET /api/items/${request.params.id}/sites${query ? `?${query}` : ''}`;
}

async function run() {
  const rows = [];

  for (const testCase of CASES) {
    const response = createResponse();
    let judge = 'OK';

    try {
      await getItemSites(testCase.request, response, testCase.pool);
      judge = testCase.verify(response) ? 'OK' : 'NG';
    } catch (error) {
      judge = 'NG';
      response.body = { message: `例外発生: ${error.message}` };
    }

    rows.push({
      id: testCase.id,
      description: testCase.description,
      input: summarizeRequest(testCase.request),
      expected: testCase.expected,
      actual: summarizeActual(response),
      judge,
    });
  }

  return rows;
}

function toMarkdownTable(rows) {
  const header = '| ID | 概要 | 入力 | 期待結果 | 実際の結果 | 判定 |';
  const separator = '| --- | --- | --- | --- | --- | --- |';
  const body = rows.map((row) => (
    `| ${row.id} | ${row.description} | ${row.input} | ${row.expected} | ${row.actual} | ${row.judge} |`
  ));

  return [header, separator, ...body].join('\n');
}

async function main() {
  const rows = await run();
  const failedCount = rows.filter((row) => row.judge === 'NG').length;

  const lines = [
    `実行日時: ${new Date().toISOString()}`,
    '対象: GET /api/items/:id/sites（ブラックボックステスト＝入出力の契約のみで検証）',
    '',
    toMarkdownTable(rows),
    '',
    `合計: ${rows.length}件 / OK: ${rows.length - failedCount}件 / NG: ${failedCount}件`,
  ];

  const logPath = path.join(__dirname, '..', 'blackbox-test.log');
  fs.writeFileSync(logPath, lines.join('\n'));
  console.log(lines.join('\n'));

  process.exit(failedCount === 0 ? 0 : 1);
}

main();
