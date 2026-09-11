const RECOVERY_TYPE_LABELS = [
  ['battery', '充電式電池'],
  ['phone', '携帯・タブレット・パソコン'],
  ['other_electronics', 'その他小型家電'],
];

// item.id は MySQL の INT UNSIGNED なので、保存できる最大値も検証する。
const MAX_UNSIGNED_INT = 4294967295;

// 廃棄方法にURLが含まれている場合は、画面へ直接表示しない。
const URL_PATTERN = /https?:\/\/[a-z0-9./?&=#_%:+~-]+/giu;

/**
 * URLから受け取った値を、MySQLで検索できる正の整数へ変換する。
 */
function parseItemId(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return null;
  }

  const itemId = Number(value);

  if (
    !Number.isSafeInteger(itemId)
    || itemId <= 0
    || itemId > MAX_UNSIGNED_INT
  ) {
    return null;
  }

  return itemId;
}

/**
 * 分別区分と、trueになっている回収種別だけを表示用バッジにする。
 */
function buildItemBadges(item) {
  const badges = [];

  if (typeof item?.category === 'string' && item.category.trim() !== '') {
    badges.push(item.category.trim());
  }

  for (const [columnName, label] of RECOVERY_TYPE_LABELS) {
    if (item?.[columnName] === true || item?.[columnName] === 1) {
      badges.push(label);
    }
  }

  return badges;
}

/**
 * 未入力の項目は表示せず、文章がある場合は前後の空白だけを取り除く。
 */
function normalizeOptionalText(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const text = value.trim();
  return text === '' ? null : text;
}

/**
 * 空の注意事項は表示せず、文章がある場合は前後の空白だけを取り除く。
 */
function normalizeCaution(value) {
  return normalizeOptionalText(value);
}

/**
 * 空の廃棄方法は表示せず、文章がある場合は前後の空白だけを取り除く。
 */
function normalizeDisposeMethod(value) {
  const text = normalizeOptionalText(value);

  if (text === null) {
    return null;
  }

  const methodWithoutUrls = text
    .replace(URL_PATTERN, '')
    .split('／')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .join('／');

  return methodWithoutUrls === '' ? null : methodWithoutUrls;
}

module.exports = {
  buildItemBadges,
  normalizeCaution,
  normalizeDisposeMethod,
  parseItemId,
};
