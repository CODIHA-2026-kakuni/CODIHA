const test = require('node:test');
const assert = require('node:assert/strict');

const { getItemSites } = require('../app');

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

test('位置情報なしでは区の固定順→reading順で200を返す', async () => {
  const calls = [];
  const databasePool = {
    async query(sql, parameters) {
      calls.push({ sql, parameters });

      if (/FROM item/.test(sql)) {
        return [[SAMPLE_ITEM]];
      }

      return [SAMPLE_SITES];
    },
  };
  const response = createResponse();

  await getItemSites({ params: { id: '7' }, query: {} }, response, databasePool);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.sites.map((site) => site.id), [1, 2]);
  assert.ok(response.body.sites.every((site) => site.distanceKm === null));
  assert.equal(response.body.sites[1].businessHours, null);
});

test('位置情報ありでは距離が近い順で200を返す', async () => {
  const databasePool = {
    async query(sql) {
      if (/FROM item/.test(sql)) {
        return [[SAMPLE_ITEM]];
      }

      return [SAMPLE_SITES];
    },
  };
  const response = createResponse();

  await getItemSites(
    { params: { id: '7' }, query: { lat: '35.6', lng: '140.1' } },
    response,
    databasePool,
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.sites.map((site) => site.id), [2, 1]);
  assert.ok(response.body.sites.every((site) => typeof site.distanceKm === 'number'));
});

test('不正な品目IDではMySQLへ問い合わせず400を返す', async () => {
  const databasePool = {
    async query() {
      assert.fail('不正な品目IDでMySQLへ問い合わせてはいけません');
    },
  };
  const invalidValues = ['abc', '1.5', '0', '-1'];

  for (const id of invalidValues) {
    const response = createResponse();
    await getItemSites({ params: { id }, query: {} }, response, databasePool);

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.message, '回収場所を取得できませんでした。');
  }
});

test('不正な緯度・経度ではMySQLへ問い合わせず400を返す', async () => {
  const databasePool = {
    async query() {
      assert.fail('不正な緯度・経度でMySQLへ問い合わせてはいけません');
    },
  };
  const invalidQueries = [
    { lat: '35.6' },
    { lat: '91', lng: '140' },
    { lat: '35', lng: '181' },
    { lat: 'abc', lng: '140' },
  ];

  for (const query of invalidQueries) {
    const response = createResponse();
    await getItemSites({ params: { id: '7' }, query }, response, databasePool);

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.message, '回収場所を取得できませんでした。');
  }
});

test('存在しない品目では404を返す', async () => {
  const databasePool = {
    async query() {
      return [[]];
    },
  };
  const response = createResponse();

  await getItemSites({ params: { id: '999' }, query: {} }, response, databasePool);

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.message, '回収場所を取得できませんでした。');
});

test('回収種別が全てfalseの品目では施設を問い合わせず空配列を返す', async () => {
  const calls = [];
  const databasePool = {
    async query(sql, parameters) {
      calls.push(sql);
      return [[{
        id: 1, battery: 0, phone: 0, other_electronics: 0,
      }]];
    },
  };
  const response = createResponse();

  await getItemSites({ params: { id: '1' }, query: {} }, response, databasePool);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { sites: [] });
  assert.equal(calls.length, 1);
});

test('MySQLの取得失敗では内部情報を含めず500を返す', async (t) => {
  const databasePool = {
    async query() {
      const error = new Error('secret connection detail');
      error.code = 'TEST_DB_ERROR';
      throw error;
    },
  };
  const response = createResponse();
  const originalConsoleError = console.error;
  t.after(() => {
    console.error = originalConsoleError;
  });
  console.error = () => {};

  await getItemSites({ params: { id: '7' }, query: {} }, response, databasePool);

  assert.equal(response.statusCode, 500);
  assert.equal(response.body.message, '回収場所を取得できませんでした。');
  assert.doesNotMatch(JSON.stringify(response.body), /secret connection detail/);
});
