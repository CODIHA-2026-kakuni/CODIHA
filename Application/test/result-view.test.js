const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ejs = require('ejs');

const resultTemplate = path.join(__dirname, '..', 'views', 'result.ejs');

function renderResult(overrides = {}) {
  return ejs.renderFile(resultTemplate, {
    title: 'モバイルバッテリー | 小型家電回収ナビ',
    pageState: 'success',
    state: 'loading',
    item: {
      id: 1,
      name: 'モバイルバッテリー',
      caution: '発火防止のため、一般ごみには混ぜないでください。',
    },
    badges: ['小型家電', '充電式電池'],
    retryUrl: '/result?itemId=1',
    ...overrides,
  });
}

test('選択した品目、バッジ、注意事項を表示する', async () => {
  const html = await renderResult();

  assert.match(html, /<h1 class="result-item-title">モバイルバッテリー<\/h1>/);
  assert.match(html, />小型家電<\/span>/);
  assert.match(html, />充電式電池<\/span>/);
  assert.match(html, /発火防止のため、一般ごみには混ぜないでください。/);
});

test('注意事項がない品目では注意事項欄を表示しない', async () => {
  const html = await renderResult({
    item: {
      id: 2,
      name: '電子辞書',
      caution: null,
    },
  });

  assert.doesNotMatch(html, /id="caution-heading"/);
});

test('品目が見つからない場合は検索画面へ戻れる', async () => {
  const html = await renderResult({
    title: '品目が見つかりません | 小型家電回収ナビ',
    pageState: 'not-found',
    item: null,
    badges: [],
  });

  assert.match(html, /品目が見つかりません。/);
  assert.match(html, /href="\/">品目検索へ戻る<\/a>/);
});

test('画面確認用loadingでは従来の骨組みを表示する', async () => {
  const html = await renderResult({
    title: '小型家電回収ナビ | 回収場所',
    pageState: 'preview',
    item: null,
    badges: [],
    retryUrl: '/result?state=loading',
  });

  assert.match(html, /品目情報を読み込み中です。/);
  assert.match(html, /回収場所を読み込み中です。/);
});

test('通常の品目結果では現在地と回収場所の確認表示とスクリプトを用意する', async () => {
  const html = await renderResult({ state: 'pending-location' });

  assert.match(html, /現在地と回収場所を確認しています。/);
  assert.match(html, /src="\/js\/result\.js"/);
  assert.match(html, /leaflet@1\.9\.4/);
});

test('loading以外の画面確認用状態を読み込み中とは案内しない', async () => {
  const html = await renderResult({
    title: '小型家電回収ナビ | 回収場所',
    pageState: 'preview',
    state: 'no-location',
    item: null,
    badges: [],
  });

  assert.match(html, /<span class="visually-hidden">選択した品目<\/span>/);
  assert.doesNotMatch(html, /品目情報を読み込み中です。/);
});

test('取得エラーでは再試行と検索画面へ戻る操作を表示する', async () => {
  const html = await renderResult({
    pageState: 'error',
    state: 'error',
    item: null,
    badges: [],
  });

  assert.match(html, /href="\/result\?itemId=1">再試行<\/a>/);
  assert.match(html, /href="\/">品目検索へ戻る<\/a>/);
});

test('回収場所がない品目では捨て方だけを表示する', async () => {
  const html = await renderResult({
    title: 'アイスピック | 小型家電回収ナビ',
    state: 'no-site',
    item: {
      id: 12,
      name: 'アイスピック',
      dispose_method: '紙で包み｢危険｣と書いて不燃ごみ指定袋へ',
      caution: null,
    },
    badges: ['不燃ごみ'],
  });

  assert.match(html, /小型家電回収ボックスでは回収できません。/);
  assert.match(html, /紙で包み｢危険｣と書いて不燃ごみ指定袋へ/);
  assert.doesNotMatch(html, /id="map-heading"/);
  assert.doesNotMatch(html, /id="sites-heading"/);
  assert.doesNotMatch(html, /\/js\/result\.js/);
});

test('捨て方が登録されていない品目では捨て方欄を表示しない', async () => {
  const html = await renderResult({
    title: 'アイスノン（保冷剤） | 小型家電回収ナビ',
    state: 'no-site',
    item: {
      id: 13,
      name: 'アイスノン（保冷剤）',
      dispose_method: null,
      caution: null,
    },
    badges: ['可燃ごみ'],
  });

  assert.match(html, /小型家電回収ボックスでは回収できません。/);
  assert.doesNotMatch(html, /id="dispose-heading"/);
});
