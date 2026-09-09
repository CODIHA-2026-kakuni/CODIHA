const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getRecoveryTypes,
  parseCoordinates,
  calculateDistanceKm,
  buildSiteList,
} = require('../lib/site-search');

test('getRecoveryTypesはtrueになっている回収種別だけを返す', () => {
  assert.deepEqual(
    getRecoveryTypes({ battery: 1, phone: 0, other_electronics: 0 }),
    ['battery'],
  );
  assert.deepEqual(
    getRecoveryTypes({ battery: true, phone: true, other_electronics: false }),
    ['battery', 'phone'],
  );
  assert.deepEqual(
    getRecoveryTypes({ battery: 0, phone: 0, other_electronics: 0 }),
    [],
  );
});

test('parseCoordinatesは緯度経度が両方省略された場合、位置情報なしとして扱う', () => {
  assert.deepEqual(parseCoordinates({}), {
    hasLocation: false,
    latitude: null,
    longitude: null,
  });
});

test('parseCoordinatesは片方だけの指定をnullにする', () => {
  assert.equal(parseCoordinates({ lat: '35.6' }), null);
  assert.equal(parseCoordinates({ lng: '140.1' }), null);
});

test('parseCoordinatesは数値以外の値をnullにする', () => {
  assert.equal(parseCoordinates({ lat: 'abc', lng: '140.1' }), null);
  assert.equal(parseCoordinates({ lat: '35.6', lng: '' }), null);
});

test('parseCoordinatesは範囲外の緯度・経度をnullにする', () => {
  assert.equal(parseCoordinates({ lat: '90.1', lng: '0' }), null);
  assert.equal(parseCoordinates({ lat: '-90.1', lng: '0' }), null);
  assert.equal(parseCoordinates({ lat: '0', lng: '180.1' }), null);
  assert.equal(parseCoordinates({ lat: '0', lng: '-180.1' }), null);
});

test('parseCoordinatesは妥当な緯度・経度を数値に変換する', () => {
  assert.deepEqual(parseCoordinates({ lat: '35.6074', lng: '140.1065' }), {
    hasLocation: true,
    latitude: 35.6074,
    longitude: 140.1065,
  });
});

test('calculateDistanceKmは同じ地点なら0になる', () => {
  assert.equal(calculateDistanceKm(35.6, 140.1, 35.6, 140.1), 0);
});

test('calculateDistanceKmは既知の距離と概ね一致する', () => {
  // 赤道上で経度1度分はおよそ111.19kmになる。
  const distance = calculateDistanceKm(0, 0, 0, 1);
  assert.ok(Math.abs(distance - 111.19) < 0.01);
});

test('buildSiteListは位置情報がある場合、距離が近い順に並べる', () => {
  const rows = [
    {
      id: 1, name: '遠い施設', reading: 'とおいしせつ', ward: '中央区',
      address: 'A', latitude: '35.7', longitude: '140.2', business_hours: null,
    },
    {
      id: 2, name: '近い施設', reading: 'ちかいしせつ', ward: '中央区',
      address: 'B', latitude: '35.61', longitude: '140.11', business_hours: '9:00-17:00',
    },
  ];
  const coordinates = { hasLocation: true, latitude: 35.6, longitude: 140.1 };

  const sites = buildSiteList(rows, coordinates);

  assert.deepEqual(sites.map((site) => site.id), [2, 1]);
  assert.ok(sites[0].distanceKm < sites[1].distanceKm);
  assert.equal(sites[1].businessHours, null);
  assert.equal(sites[0].businessHours, '9:00-17:00');
});

test('buildSiteListは距離が同じ場合reading順にする', () => {
  const rows = [
    {
      id: 1, name: 'B施設', reading: 'ゆうしせつ', ward: '中央区',
      address: 'A', latitude: '35.61', longitude: '140.11', business_hours: null,
    },
    {
      id: 2, name: 'A施設', reading: 'あいしせつ', ward: '中央区',
      address: 'B', latitude: '35.61', longitude: '140.11', business_hours: null,
    },
  ];
  const coordinates = { hasLocation: true, latitude: 35.6, longitude: 140.1 };

  const sites = buildSiteList(rows, coordinates);

  assert.deepEqual(sites.map((site) => site.id), [2, 1]);
});

test('buildSiteListは位置情報がない場合、区の固定順→reading順に並べ、distanceKmはnullにする', () => {
  const rows = [
    {
      id: 1, name: '若葉施設', reading: 'わかばしせつ', ward: '若葉区',
      address: 'A', latitude: '35.6', longitude: '140.2', business_hours: null,
    },
    {
      id: 2, name: '中央施設い', reading: 'いのしせつ', ward: '中央区',
      address: 'B', latitude: '35.61', longitude: '140.11', business_hours: null,
    },
    {
      id: 3, name: '中央施設あ', reading: 'あのしせつ', ward: '中央区',
      address: 'C', latitude: '35.62', longitude: '140.12', business_hours: null,
    },
    {
      id: 4, name: '稲毛施設', reading: 'いなげしせつ', ward: '稲毛区',
      address: 'D', latitude: '35.63', longitude: '140.13', business_hours: null,
    },
  ];
  const coordinates = { hasLocation: false, latitude: null, longitude: null };

  const sites = buildSiteList(rows, coordinates);

  assert.deepEqual(sites.map((site) => site.id), [4, 3, 2, 1]);
  assert.ok(sites.every((site) => site.distanceKm === null));
});
