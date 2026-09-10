const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ejs = require('ejs');

const resultTemplate = path.join(__dirname, '..', 'views', 'result.ejs');

function renderResult(overrides = {}) {
  return ejs.renderFile(resultTemplate, {
    title: 'モバイルバッテリー | ごみ分別・持込ナビ',
    pageState: 'success',
    state: 'loading',
    item: {
      id: 1,
      name: 'モバイルバッテリー',
      dispose_method: '回収ボックスへ出してください。',
      caution: '発火防止のため、一般ごみには混ぜないでください。',
      requires_dropoff: true,
    },
    badges: ['小型家電', '充電式電池'],
    retryUrl: '/result?itemId=1',
    ...overrides,
  });
}

test('選択した品目、バッジ、出し方、注意事項を表示する', async () => {
  const html = await renderResult();

  assert.match(html, /<h1 class="result-item-title">モバイルバッテリー<\/h1>/);
  assert.match(html, />小型家電<\/span>/);
  assert.match(html, />充電式電池<\/span>/);
  assert.match(html, /回収ボックスへ出してください。/);
  assert.match(html, /発火防止のため、一般ごみには混ぜないでください。/);
});

test('注意事項がない品目では注意事項欄を表示しない', async () => {
  const html = await renderResult({
    item: {
      id: 2,
      name: '電子辞書',
      dispose_method: '回収ボックスへ出してください。',
      caution: null,
      requires_dropoff: true,
    },
  });

  assert.doesNotMatch(html, /id="caution-heading"/);
});

test('品目が見つからない場合は検索画面へ戻れる', async () => {
  const html = await renderResult({
    title: '品目が見つかりません | ごみ分別・持込ナビ',
    pageState: 'not-found',
    item: null,
    badges: [],
  });

  assert.match(html, /品目が見つかりません。/);
  assert.match(html, /href="\/">品目検索へ戻る<\/a>/);
});

test('画面確認用loadingでは従来の骨組みを表示する', async () => {
  const html = await renderResult({
    title: 'ごみ分別・持込ナビ | 回収場所',
    pageState: 'preview',
    item: null,
    badges: [],
    retryUrl: '/result?state=loading',
  });

  assert.match(html, /品目情報を読み込み中です。/);
  assert.match(html, /回収場所を読み込み中です。/);
});

test('回収場所がある品目では出し方、地図、施設用スクリプトを表示する', async () => {
  const html = await renderResult({ state: 'pending-location' });

  assert.match(html, /id="dispose-heading"/);
  assert.match(html, /回収ボックスへ出してください。/);
  assert.match(html, /現在地と回収場所を確認しています。/);
  assert.match(html, /src="\/js\/result\.js"/);
  assert.match(html, /leaflet@1\.9\.4/);
});

test('loading以外の画面確認用状態を読み込み中とは案内しない', async () => {
  const html = await renderResult({
    title: 'ごみ分別・持込ナビ | 回収場所',
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

test('回収場所がない品目では案内と出し方を表示し、地図は表示しない', async () => {
  const html = await renderResult({
    title: 'アイスピック | ごみ分別・持込ナビ',
    state: 'empty',
    item: {
      id: 12,
      name: 'アイスピック',
      dispose_method: '紙で包み｢危険｣と書いて不燃ごみ指定袋へ',
      caution: null,
      requires_dropoff: false,
    },
    badges: ['不燃ごみ'],
  });

  assert.match(html, /表示された分別区分に従って出してください。/);
  assert.match(html, />千葉市の案内を確認する<\/a>/);
  assert.match(html, /紙で包み｢危険｣と書いて不燃ごみ指定袋へ/);
  assert.doesNotMatch(html, /id="map-heading"/);
  assert.doesNotMatch(html, /id="sites-heading"/);
  assert.doesNotMatch(html, /\/js\/result\.js/);
});

test('出し方が登録されていない品目では公式ガイドへの案内を表示する', async () => {
  const html = await renderResult({
    title: 'アイスノン（保冷剤） | ごみ分別・持込ナビ',
    state: 'empty',
    item: {
      id: 13,
      name: 'アイスノン（保冷剤）',
      dispose_method: null,
      caution: null,
      requires_dropoff: false,
    },
    badges: ['可燃ごみ'],
  });

  assert.match(html, /表示された分別区分に従って出してください。/);
  assert.match(html, /id="dispose-heading"/);
  assert.match(html, /詳しい出し方は千葉市のごみ分別ガイドで確認してください。/);
  assert.match(html, />千葉市の案内を確認する<\/a>/);
});

test('特別な持込が必要で回収場所がない品目では断定を避けた案内と公式リンクを表示する', async () => {
  const html = await renderResult({
    title: 'エアコン（クーラー） | ごみ分別・持込ナビ',
    state: 'empty',
    item: {
      id: 34,
      name: 'エアコン（クーラー）',
      dispose_method: null,
      caution: null,
      requires_dropoff: true,
    },
    badges: ['家電リサイクル対象'],
  });

  assert.match(html, /通常の家庭ごみとして出せない場合があります。/);
  assert.match(html, />千葉市の案内を確認する<\/a>/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /id="map-heading"/);
  assert.doesNotMatch(html, /id="sites-heading"/);
  assert.doesNotMatch(html, /\/js\/result\.js/);
});

test('特別な持込が必要な品目でも公式ガイドボタンを重複させない', async () => {
  const html = await renderResult({
    state: 'empty',
    item: {
      id: 72,
      name: 'テスト品目',
      dispose_method: null,
      caution: null,
      requires_dropoff: true,
    },
    badges: ['排出禁止物等'],
  });

  assert.equal((html.match(/class="button official-guidance-link"/g) || []).length, 1);
});

test('出し方と注意事項の改行を保ったままHTMLとして安全に表示する', async () => {
  const html = await renderResult({
    state: 'empty',
    item: {
      id: 14,
      name: 'テスト品目',
      dispose_method: '1行目\n2行目<script>',
      caution: '注意1\n注意2',
      requires_dropoff: false,
    },
    badges: ['可燃ごみ'],
  });

  assert.match(html, /1行目\n2行目&lt;script&gt;/);
  assert.match(html, /注意1\n注意2/);
  assert.doesNotMatch(html, /<script>.*<\/script>/s);
});
