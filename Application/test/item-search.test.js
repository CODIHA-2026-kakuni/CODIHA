const test = require('node:test');
const assert = require('node:assert/strict');

const {
  filterAndSortItems,
  normalizeSearchText,
} = require('../lib/item-search');

const items = [
  {
    id: 3,
    name: 'モバイルバッテリー',
    reading: 'もばいるばってりー',
  },
  {
    id: 1,
    name: '携帯電話・スマートフォン',
    reading: 'けいたいでんわ・すまーとふぉん',
  },
  {
    id: 2,
    name: 'ACアダプター',
    reading: 'えーしーあだぷたー',
  },
];

test('検索語の全角・半角、英字の大小、かなの違いをそろえる', () => {
  assert.equal(
    normalizeSearchText('  ＡＣ　ﾊﾞｯﾃﾘｰ  '),
    'ac ばってりー',
  );
  assert.equal(normalizeSearchText('スマートフォン'), 'すまーとふぉん');
});

test('検索語が空なら全品目を読み仮名順で返す', () => {
  const result = filterAndSortItems(items, '　');

  assert.deepEqual(
    result.map((item) => item.id),
    [2, 1, 3],
  );
});

test('品目名を表記の違いを吸収して部分一致検索する', () => {
  const result = filterAndSortItems(items, 'ﾓﾊﾞｲﾙ');

  assert.deepEqual(
    result.map((item) => item.id),
    [3],
  );
});

test('読み仮名を部分一致検索する', () => {
  const result = filterAndSortItems(items, 'すまーと');

  assert.deepEqual(
    result.map((item) => item.id),
    [1],
  );
});

test('該当しない検索語では空配列を返す', () => {
  assert.deepEqual(filterAndSortItems(items, 'テレビ'), []);
});

test('絞り込みと並べ替えで元の配列を変更しない', () => {
  const originalOrder = items.map((item) => item.id);

  filterAndSortItems(items, '');

  assert.deepEqual(
    items.map((item) => item.id),
    originalOrder,
  );
});
