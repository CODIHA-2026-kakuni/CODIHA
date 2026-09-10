const RECOVERY_TYPE_COLUMNS = ['battery', 'phone', 'other_electronics'];

// 位置情報がない場合に使用する区の表示順。
const WARD_ORDER = ['稲毛区', '中央区', '花見川区', '緑区', '美浜区', '若葉区'];

// Haversine式で使用する地球の平均半径（km）。
const EARTH_RADIUS_KM = 6371;

// 読み仮名の並び替えは品目検索画面（item-search.js）と同じ規則にそろえる。
const japaneseCollator = new Intl.Collator('ja', {
  sensitivity: 'base',
  numeric: true,
});

/**
 * 品目のtrueになっている回収種別（battery/phone/other_electronics）だけを返す。
 */
function getRecoveryTypes(item) {
  return RECOVERY_TYPE_COLUMNS.filter(
    (columnName) => item[columnName] === true || item[columnName] === 1,
  );
}

/**
 * クエリの緯度・経度を検証する。
 * 両方省略時は位置情報なしとして扱い、片方だけの指定や範囲外の値はnullを返す。
 */
function parseCoordinates(query) {
  const hasLat = query.lat !== undefined;
  const hasLng = query.lng !== undefined;

  if (!hasLat && !hasLng) {
    return { hasLocation: false, latitude: null, longitude: null };
  }

  // 緯度・経度の片方だけが指定された場合は不正な入力とする。
  if (!hasLat || !hasLng) {
    return null;
  }

  if (typeof query.lat !== 'string' || typeof query.lng !== 'string') {
    return null;
  }

  if (query.lat.trim() === '' || query.lng.trim() === '') {
    return null;
  }

  const latitude = Number(query.lat);
  const longitude = Number(query.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  // 緯度・経度として取り得る範囲か確認する。
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return { hasLocation: true, latitude, longitude };
}

// 三角関数で扱うため、角度を度数法からラジアンへ変換する。
function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * 2地点間の直線距離をHaversine式でキロメートル単位で計算する。
 */
function calculateDistanceKm(latitudeA, longitudeA, latitudeB, longitudeB) {
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);

  const a = (
    Math.sin(deltaLatitude / 2) ** 2 + Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) * Math.sin(deltaLongitude / 2) ** 2
  );

  // 2地点が地球の中心に対して作る角度を求める。
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // 中心角に地球の半径を掛け、2地点間の大円距離を求める。
  return EARTH_RADIUS_KM * c;
}

function roundToThreeDecimals(value) {
  // APIで扱いやすいよう、小数第3位までに丸める。
  return Math.round(value * 1000) / 1000;
}

/**
 * recycle_locationの行を、位置情報の有無に応じて並び替え、レスポンス形式に変換する。
 */
function buildSiteList(rows, coordinates) {
  const sites = rows.map((row) => ({
    id: row.id,
    name: row.name,
    reading: row.reading,
    ward: row.ward,
    address: row.address,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    businessHours: row.business_hours,
    // 位置情報がない場合は距離を表示しないためnullを返す。
    distanceKm: coordinates.hasLocation
      ? roundToThreeDecimals(
        calculateDistanceKm(
          coordinates.latitude,
          coordinates.longitude,
          Number(row.latitude),
          Number(row.longitude),
        ),
      )
      : null,
  }));

  if (coordinates.hasLocation) {
    sites.sort((siteA, siteB) => (
        siteA.distanceKm - siteB.distanceKm
        || japaneseCollator.compare(siteA.reading, siteB.reading)
      )
    );
  } else {
    sites.sort((siteA, siteB) => (
      WARD_ORDER.indexOf(siteA.ward) - WARD_ORDER.indexOf(siteB.ward)
      || japaneseCollator.compare(siteA.reading, siteB.reading)
    ));
  }

  return sites;
}

module.exports = {
  RECOVERY_TYPE_COLUMNS,
  WARD_ORDER,
  getRecoveryTypes,
  parseCoordinates,
  calculateDistanceKm,
  buildSiteList,
};
