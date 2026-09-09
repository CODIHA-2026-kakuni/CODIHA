const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { getItemSites } = require('../app');

const ERROR_MESSAGE = '回収場所を取得できませんでした。';

function createResponse() {
  return {
    statusCode: 200,
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

const SAMPLE_ITEM = {
  id: 7, battery: 1, phone: 0, other_electronics: 0,
};

const ITEM_WITHOUT_RECOVERY_TYPE = {
  id: 1, battery: 0, phone: 0, other_electronics: 0,
};

const SAMPLE_SITES = [
  {
    id: 1, name: '稲毛施設', reading: 'いなげしせつ', ward: '稲毛区',
    address: '千葉市稲毛区1-1', latitude: '35.63', longitude: '140.13',
    business_hours: '平日9:00～17:00',
  },
  {
    id: 2, name: '中央施設', reading: 'ちゅうおうしせつ', ward: '中央区',
    address: '千葉市中央区1-1', latitude: '35.61', longitude: '140.11',
    business_hours: null,
  },
];

// 品目・施設ともに返すMySQLの代役。呼ばれたSQLはcallsへ記録する。
function poolReturning(item) {
  return (calls) => ({
    async query(sql, parameters) {
      calls.push({ sql, parameters });

      if (/FROM item/.test(sql)) {
        return [[item]];
      }

      return [SAMPLE_SITES];
    },
  });
}

// 入力チェックで弾かれるべきリクエストが、MySQLへ到達していないことを保証する代役。
function poolThatMustNotBeQueried(message) {
  return () => ({
    async query() {
      assert.fail(message);
    },
  });
}

function poolWithoutMatchingItem() {
  return (calls) => ({
    async query(sql, parameters) {
      calls.push({ sql, parameters });
      return [[]];
    },
  });
}

function poolThatThrows() {
  return () => ({
    async query() {
      const error = new Error('secret connection detail');
      error.code = 'TEST_DB_ERROR';
      throw error;
    },
  });
}

function assertErrorResponse(response, expectedStatus) {
  assert.equal(response.statusCode, expectedStatus);
  assert.equal(response.body.message, ERROR_MESSAGE);
}

// APIの外部仕様（入力→期待する応答）を1箇所にまとめる。
// このテーブルが、テストの合否判定とブラックボックステスト表の両方の元になる。
const CASES = [
  {
    id: 'TC01',
    description: '位置情報なしでは区の固定順→reading順で施設を返す',
    request: { params: { id: '7' }, query: {} },
    createPool: poolReturning(SAMPLE_ITEM),
    expected: '200 / 稲毛区(id:1)→中央区(id:2)の順、distanceKmは全てnull、business_hoursがNULLの施設はbusinessHours:null',
    verify: (response) => {
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.body.sites.map((site) => site.id), [1, 2]);
      assert.ok(response.body.sites.every((site) => site.distanceKm === null));
      assert.equal(response.body.sites[1].businessHours, null);
    },
  },
  {
    id: 'TC02',
    description: '位置情報ありでは距離が近い順で施設を返す',
    request: { params: { id: '7' }, query: { lat: '35.6', lng: '140.1' } },
    createPool: poolReturning(SAMPLE_ITEM),
    expected: '200 / 中央区(id:2)→稲毛区(id:1)の順、distanceKmは数値',
    verify: (response) => {
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.body.sites.map((site) => site.id), [2, 1]);
      assert.ok(response.body.sites.every((site) => typeof site.distanceKm === 'number'));
    },
  },
  {
    id: 'TC03',
    description: '品目IDが数値でない場合はMySQLへ問い合わせず400を返す',
    request: { params: { id: 'abc' }, query: {} },
    createPool: poolThatMustNotBeQueried('不正な品目IDでMySQLへ問い合わせてはいけません'),
    expected: '400 / エラーメッセージのみ',
    verify: (response) => assertErrorResponse(response, 400),
  },
  {
    id: 'TC04',
    description: '品目IDが小数の場合はMySQLへ問い合わせず400を返す',
    request: { params: { id: '1.5' }, query: {} },
    createPool: poolThatMustNotBeQueried('不正な品目IDでMySQLへ問い合わせてはいけません'),
    expected: '400 / エラーメッセージのみ',
    verify: (response) => assertErrorResponse(response, 400),
  },
  {
    id: 'TC05',
    description: '品目IDが0の場合はMySQLへ問い合わせず400を返す',
    request: { params: { id: '0' }, query: {} },
    createPool: poolThatMustNotBeQueried('不正な品目IDでMySQLへ問い合わせてはいけません'),
    expected: '400 / エラーメッセージのみ',
    verify: (response) => assertErrorResponse(response, 400),
  },
  {
    id: 'TC06',
    description: '品目IDが負の数の場合はMySQLへ問い合わせず400を返す',
    request: { params: { id: '-1' }, query: {} },
    createPool: poolThatMustNotBeQueried('不正な品目IDでMySQLへ問い合わせてはいけません'),
    expected: '400 / エラーメッセージのみ',
    verify: (response) => assertErrorResponse(response, 400),
  },
  {
    id: 'TC07',
    description: '緯度だけ指定し経度を省略した場合はMySQLへ問い合わせず400を返す',
    request: { params: { id: '7' }, query: { lat: '35.6' } },
    createPool: poolThatMustNotBeQueried('不正な緯度・経度でMySQLへ問い合わせてはいけません'),
    expected: '400 / エラーメッセージのみ',
    verify: (response) => assertErrorResponse(response, 400),
  },
  {
    id: 'TC08',
    description: '緯度が範囲外(91度)の場合はMySQLへ問い合わせず400を返す',
    request: { params: { id: '7' }, query: { lat: '91', lng: '140' } },
    createPool: poolThatMustNotBeQueried('不正な緯度・経度でMySQLへ問い合わせてはいけません'),
    expected: '400 / エラーメッセージのみ',
    verify: (response) => assertErrorResponse(response, 400),
  },
  {
    id: 'TC09',
    description: '経度が範囲外(181度)の場合はMySQLへ問い合わせず400を返す',
    request: { params: { id: '7' }, query: { lat: '35', lng: '181' } },
    createPool: poolThatMustNotBeQueried('不正な緯度・経度でMySQLへ問い合わせてはいけません'),
    expected: '400 / エラーメッセージのみ',
    verify: (response) => assertErrorResponse(response, 400),
  },
  {
    id: 'TC10',
    description: '緯度が数値でない場合はMySQLへ問い合わせず400を返す',
    request: { params: { id: '7' }, query: { lat: 'abc', lng: '140' } },
    createPool: poolThatMustNotBeQueried('不正な緯度・経度でMySQLへ問い合わせてはいけません'),
    expected: '400 / エラーメッセージのみ',
    verify: (response) => assertErrorResponse(response, 400),
  },
  {
    id: 'TC11',
    description: '存在しない品目IDの場合は404を返す',
    request: { params: { id: '999' }, query: {} },
    createPool: poolWithoutMatchingItem(),
    expected: '404 / エラーメッセージのみ',
    verify: (response) => assertErrorResponse(response, 404),
  },
  {
    id: 'TC12',
    description: 'どの回収種別にも対応しない品目では施設を問い合わせず空配列を返す',
    request: { params: { id: '1' }, query: {} },
    createPool: poolReturning(ITEM_WITHOUT_RECOVERY_TYPE),
    expected: '200 / sites: []（recycle_locationへは問い合わせない）',
    verify: (response, calls) => {
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.body, { sites: [] });
      assert.equal(calls.length, 1);
    },
  },
  {
    id: 'TC13',
    description: 'MySQLの取得に失敗した場合は内部情報を含めず500を返す',
    request: { params: { id: '7' }, query: {} },
    createPool: poolThatThrows(),
    silencesConsoleError: true,
    expected: '500 / エラーメッセージのみ（接続情報やSQLを含まない）',
    verify: (response) => {
      assertErrorResponse(response, 500);
      assert.doesNotMatch(JSON.stringify(response.body), /secret connection detail/);
    },
  },
];

const reportRows = [];

function describeRequest(request) {
  const query = new URLSearchParams(request.query).toString();
  return `GET /api/items/${request.params.id}/sites${query ? `?${query}` : ''}`;
}

function describeResponse(response) {
  if (response.body && Array.isArray(response.body.sites)) {
    const sites = response.body.sites
      .map((site) => `id:${site.id}(${site.ward}, distanceKm:${site.distanceKm})`)
      .join(', ');
    return `${response.statusCode} / sites: [${sites}]`;
  }

  return `${response.statusCode} / ${JSON.stringify(response.body)}`;
}

for (const testCase of CASES) {
  test(`[${testCase.id}] ${testCase.description}`, async (t) => {
    const calls = [];
    const databasePool = testCase.createPool(calls);
    const response = createResponse();

    // 500のケースはサーバーログ用のconsole.errorが出るため、テスト出力を汚さないよう黙らせる。
    if (testCase.silencesConsoleError) {
      const originalConsoleError = console.error;
      t.after(() => {
        console.error = originalConsoleError;
      });
      console.error = () => {};
    }

    await getItemSites(testCase.request, response, databasePool);

    const row = {
      id: testCase.id,
      description: testCase.description,
      input: describeRequest(testCase.request),
      expected: testCase.expected,
      actual: describeResponse(response),
    };

    try {
      testCase.verify(response, calls);
    } catch (error) {
      reportRows.push({ ...row, judge: 'NG' });
      throw error;
    }

    reportRows.push({ ...row, judge: 'OK' });
  });
}

// 上のテーブルをそのまま「入力・期待結果・実際の結果・判定」のレポートとして書き出す。
test.after(() => {
  const failedCount = reportRows.filter((row) => row.judge === 'NG').length;
  const lines = [
    `実行日時: ${new Date().toISOString()}`,
    '対象: GET /api/items/:id/sites',
    '',
    '| ID | 概要 | 入力 | 期待結果 | 実際の結果 | 判定 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...reportRows.map((row) => (
      `| ${row.id} | ${row.description} | ${row.input} | ${row.expected} | ${row.actual} | ${row.judge} |`
    )),
    '',
    `合計: ${reportRows.length}件 / OK: ${reportRows.length - failedCount}件 / NG: ${failedCount}件`,
    '',
  ];

  fs.writeFileSync(
    path.join(__dirname, '..', 'sites-api-report.log'),
    lines.join('\n'),
  );
});
