const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildItemBadges,
  normalizeCaution,
  normalizeDisposeMethod,
  parseItemId,
} = require('../lib/item-result');

test('正の整数のitemIdを数値へ変換する', () => {
  assert.equal(parseItemId('1'), 1);
  assert.equal(parseItemId('0012'), 12);
});

test('不正なitemIdを受け付けない', () => {
  const invalidValues = [
    undefined,
    '',
    'abc',
    '1.5',
    '0',
    '-1',
    '4294967296',
    '9007199254740992',
  ];

  for (const value of invalidValues) {
    assert.equal(parseItemId(value), null);
  }
});

test('分別区分とtrueの回収種別だけをバッジにする', () => {
  const badges = buildItemBadges({
    category: '小型家電',
    battery: 1,
    phone: 0,
    other_electronics: true,
  });

  assert.deepEqual(badges, [
    '小型家電',
    '充電式電池',
    'その他小型家電',
  ]);
});

test('回収種別がすべてfalseなら分別区分だけを返す', () => {
  const badges = buildItemBadges({
    category: '小型家電',
    battery: 0,
    phone: false,
    other_electronics: 0,
  });

  assert.deepEqual(badges, ['小型家電']);
});

test('空の注意事項をnullにし、文章の前後だけを整える', () => {
  assert.equal(normalizeCaution(null), null);
  assert.equal(normalizeCaution('   '), null);
  assert.equal(normalizeCaution('  発火に注意してください。\n水にぬらさないでください。  '),
    '発火に注意してください。\n水にぬらさないでください。');
});

test('空の廃棄方法をnullにし、文章の前後だけを整える', () => {
  assert.equal(normalizeDisposeMethod(null), null);
  assert.equal(normalizeDisposeMethod('   '), null);
  assert.equal(
    normalizeDisposeMethod('  紙で包み｢危険｣と書いて不燃ごみ指定袋へ  '),
    '紙で包み｢危険｣と書いて不燃ごみ指定袋へ',
  );
});
