const test = require('node:test');
const assert = require('node:assert/strict');

const { renderSearchPage } = require('../app');

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

test('検索画面は小型家電に限定せず全品目を取得する', async () => {
  const calls = [];
  const databasePool = {
    async query(sql) {
      calls.push(sql);
      return [[
        {
          id: 2,
          name: 'モバイルバッテリー',
          reading: 'もばいるばってりー',
          category: '小型家電',
        },
        {
          id: 1,
          name: '生ごみ',
          reading: 'なまごみ',
          category: '可燃ごみ',
        },
      ]];
    },
  };
  const response = createResponse();

  await renderSearchPage({ query: {} }, response, databasePool);

  assert.equal(response.statusCode, 200);
  assert.equal(response.view, 'index');
  assert.doesNotMatch(calls[0], /\bWHERE\b/i);
  assert.deepEqual(
    response.data.items.map((item) => item.id),
    [1, 2],
  );
});
