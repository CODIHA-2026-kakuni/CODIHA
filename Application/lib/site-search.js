const RECOVERY_TYPE_COLUMNS = ['battery', 'phone', 'other_electronics'];

// 区の表示順は固定（Issue #16の仕様どおり）。
const WARD_ORDER = ['稲毛区', '中央区', '花見川区', '緑区', '美浜区', '若葉区'];

//地球の半径
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
  const hasLat = query.lat !== undefined; // 緯度の指定の有無
  const hasLng = query.lng !== undefined; // 経度の指定の有無
  
  // 位置情報なし
  if (!hasLat && !hasLng) {
    return { hasLocation: false, latitude: null, longitude: null };
  }
  
  // 緯度経度の片方のみデータ取得
  if (!hasLat || !hasLng) {
    return null;
  }
  
  // 緯度経度の型が文字列以外
  if (typeof query.lat !== 'string' || typeof query.lng !== 'string') {
    return null;
  }

  // 緯度経度の文字列が空文字
  if (query.lat.trim() === '' || query.lng.trim() === '') {
    return null;
  }

  // 緯度経度の文字列を数値に変換
  const latitude = Number(query.lat);
  const longitude = Number(query.lng);

  // 数値に変換できないものだった場合nullを返す
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  // 緯度経度が地理上ありえない値だった場合nullを返す
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return { hasLocation: true, latitude, longitude };
}

// 緯度経度は基準点からの角度で表現されている．
// 三角関数で扱うため，度数法からラジアンに変換．
function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * 2地点間の直線距離をHaversine式でキロメートル単位で計算する。
 */
function calculateDistanceKm(latitudeA, longitudeA, latitudeB, longitudeB) {
  const deltaLatitude = toRadians(latitudeB - latitudeA);//　緯度の差分（ラジアン）
  const deltaLongitude = toRadians(longitudeB - longitudeA);// 経度の差分（ラジアン）

  //Haversine式の計算
  const a = (
    Math.sin(deltaLatitude / 2) ** 2 + Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) * Math.sin(deltaLongitude / 2) ** 2
  );

  //Haversine式の計算結果は中心角の半分の値が算出される．
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  //円の円周を求める公式を使う
  return EARTH_RADIUS_KM * c;
}

function roundToThreeDecimals(value) {
  //valueは小数点以下が長いため，揺れることがある.
  //1000倍して四捨五入し，1000で割ることで小数点以下3桁に丸める.
  return Math.round(value * 1000) / 1000;
}

/**
 * recycle_locationの行を、位置情報の有無に応じて並び替え、レスポンス形式に変換する。
 */
function buildSiteList(rows, coordinates) {
  //sitesという配列を作る(.mapの機能)
  //rowsはrecycle_locationデータ
  //rowはrows[1]のようにrowsの2次元配列のうちの一つ
  const sites = rows.map((row) => ({
    //　上から順にrowsの各行の値を取得し、オブジェクトに格納する
    id: row.id,
    name: row.name,
    reading: row.reading,
    ward: row.ward,
    address: row.address,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    businessHours: row.business_hours,
    // coordinatesは端末の位置情報．
    // 端末の位置情報がある時に，距離の計算をし，ないのであればnullを返す．
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
    sites.sort((siteA, siteB) => (//.sortの機能で並び替えを行う
        siteA.distanceKm - siteB.distanceKm//距離の昇順で並び替え
        || japaneseCollator.compare(siteA.reading, siteB.reading)//50音順で並び替え
      )
    );
  } else {
    sites.sort((siteA, siteB) => (
      WARD_ORDER.indexOf(siteA.ward) - WARD_ORDER.indexOf(siteB.ward)//区ごとに並び替え
      || japaneseCollator.compare(siteA.reading, siteB.reading)//50音順で並び替え
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
