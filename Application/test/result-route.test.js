const test = require('node:test');
const assert = require('node:assert/strict');

const { renderResultPage } = require('../app');

function createResponse() {
  return {
    statusCode: 200,
    view: null,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    render(view, data) {
      this.view = view;
      this.data = data;
      return this;
    },
  };
}

test('正しいitemIdではプレースホルダーを使って品目を取得する', async () => {
  const calls = [];
  const databasePool = {
    async query(sql, parameters) {
      calls.push({ sql, parameters });
      return [[{
        id: 7,
        name: 'モバイルバッテリー',
        category: '小型家電',
        dispose_method: ' 回収ボックスへ出してください。 ',
        caution: ' 発火に注意してください。 ',
        battery: 1,
        phone: 0,
        other_electronics: 0,
      }]];
    },
  };
  const response = createResponse();

  await renderResultPage(
    { query: { itemId: '7' } },
    response,
    databasePool,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.view, 'result');
  assert.match(calls[0].sql, /WHERE id = \?/);
  assert.deepEqual(calls[0].parameters, [7]);
  assert.equal(response.data.item.name, 'モバイルバッテリー');
  assert.equal(response.data.item.dispose_method, '回収ボックスへ出してください。');
  assert.equal(response.data.item.caution, '発火に注意してください。');
  assert.deepEqual(response.data.badges, ['小型家電', '充電式電池']);
  assert.equal(response.data.state, 'pending-location');
});

test('回収場所がない品目ではempty状態で出し方を表示する', async () => {
  const calls = [];
  const databasePool = {
    async query(sql, parameters) {
      calls.push({ sql, parameters });
      return [[{
        id: 12,
        name: 'アイスピック',
        category: '不燃ごみ',
        dispose_method: ' 紙で包み｢危険｣と書いて不燃ごみ指定袋へ ',
        caution: null,
        battery: 0,
        phone: 0,
        other_electronics: 0,
      }]];
    },
  };
  const response = createResponse();

  await renderResultPage(
    { query: { itemId: '12' } },
    response,
    databasePool,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.view, 'result');
  assert.match(calls[0].sql, /dispose_method/);
  assert.equal(response.data.pageState, 'success');
  assert.equal(response.data.state, 'empty');
  assert.equal(
    response.data.item.dispose_method,
    '紙で包み｢危険｣と書いて不燃ごみ指定袋へ',
  );
  assert.deepEqual(response.data.badges, ['不燃ごみ']);
});

test('不正なitemIdではMySQLへ問い合わせず400を返す', async () => {
  const databasePool = {
    async query() {
      assert.fail('不正なitemIdでMySQLへ問い合わせてはいけません');
    },
  };
  const invalidValues = [
    undefined,
    'abc',
    '1.5',
    '0',
    '-1',
    '4294967296',
  ];

  for (const itemId of invalidValues) {
    const response = createResponse();
    await renderResultPage({ query: { itemId } }, response, databasePool);

    assert.equal(response.statusCode, 400);
    assert.equal(response.data.pageState, 'not-found');
  }
});

test('存在しない品目では404を返す', async () => {
  const databasePool = {
    async query() {
      return [[]];
    },
  };
  const response = createResponse();

  await renderResultPage(
    { query: { itemId: '999' } },
    response,
    databasePool,
  );

  assert.equal(response.statusCode, 404);
  assert.equal(response.data.pageState, 'not-found');
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

  await renderResultPage(
    { query: { itemId: '1' } },
    response,
    databasePool,
  );

  assert.equal(response.statusCode, 500);
  assert.equal(response.data.pageState, 'error');
  assert.equal(response.data.retryUrl, '/result?itemId=1');
  assert.doesNotMatch(JSON.stringify(response.data), /secret connection detail/);
});

test('画面確認用URLはMySQLへ問い合わせず従来の状態を表示する', async () => {
  const databasePool = {
    async query() {
      assert.fail('画面確認用URLでMySQLへ問い合わせてはいけません');
    },
  };
  const response = createResponse();

  await renderResultPage(
    { query: { state: 'no-location' } },
    response,
    databasePool,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.data.pageState, 'preview');
  assert.equal(response.data.state, 'no-location');
});
