// 検索時の並び順を、実行環境が変わっても同じ日本語順にする。
const japaneseCollator = new Intl.Collator('ja', {
  sensitivity: 'base',
  numeric: true,
});

/**
 * 検索対象の文字を比較しやすい形にそろえる。
 * 全角・半角、英字の大文字・小文字、ひらがな・カタカナの違いを吸収する。
 */
function normalizeSearchText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('ja')
    .replace(/[ァ-ヶ]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0x60),
    );
}

/**
 * 品目を読み仮名順に並べ、検索語があれば品目名・読み仮名で絞り込む。
 * 元の配列を変更しないよう、配列を複製してから処理する。
 */
function filterAndSortItems(items, query) {
  if (!Array.isArray(items)) {
    return [];
  }

  const normalizedQuery = normalizeSearchText(query);
  const sortedItems = [...items].sort((firstItem, secondItem) => {
    const readingComparison = japaneseCollator.compare(
      normalizeSearchText(firstItem.reading),
      normalizeSearchText(secondItem.reading),
    );

    if (readingComparison !== 0) {
      return readingComparison;
    }

    return Number(firstItem.id) - Number(secondItem.id);
  });

  if (normalizedQuery === '') {
    return sortedItems;
  }

  return sortedItems.filter((item) => {
    const normalizedName = normalizeSearchText(item.name);
    const normalizedReading = normalizeSearchText(item.reading);

    return (
      normalizedName.includes(normalizedQuery) ||
      normalizedReading.includes(normalizedQuery)
    );
  });
}

module.exports = {
  filterAndSortItems,
  normalizeSearchText,
};
