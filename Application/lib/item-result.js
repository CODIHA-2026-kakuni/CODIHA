const RECOVERY_TYPE_LABELS = [
  ['battery', '充電式電池'],
  ['phone', '携帯・タブレット・パソコン'],
  ['other_electronics', 'その他小型家電'],
];

// item.id は MySQL の INT UNSIGNED なので、保存できる最大値も検証する。
const MAX_UNSIGNED_INT = 4294967295;

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
 * 空の注意事項は表示せず、文章がある場合は前後の空白だけを取り除く。
 */
function normalizeCaution(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const caution = value.trim();
  return caution === '' ? null : caution;
}

module.exports = {
  buildItemBadges,
  normalizeCaution,
  parseItemId,
};
