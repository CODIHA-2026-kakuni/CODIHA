const SITE_SELECT = `
  SELECT
    id,
    display_order AS displayOrder,
    name,
    ward,
    address,
    hours_text AS hoursText,
    latitude,
    longitude,
    source_url AS sourceUrl,
    source_checked_at AS sourceCheckedAt,
    coordinate_source_url AS coordinateSourceUrl,
    coordinate_checked_at AS coordinateCheckedAt
  FROM collection_sites
  ORDER BY display_order ASC
`;

function normalizeSite(row) {
  return {
    ...row,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    sourceCheckedAt: row.sourceCheckedAt?.toISOString?.().slice(0, 10) ?? row.sourceCheckedAt,
    coordinateCheckedAt:
      row.coordinateCheckedAt?.toISOString?.().slice(0, 10) ?? row.coordinateCheckedAt,
  };
}

export function createSiteRepository(pool) {
  return {
    async listSites() {
      const [rows] = await pool.query(SITE_SELECT);
      return rows.map(normalizeSite);
    },

    async ping() {
      await pool.query("SELECT 1");
      return true;
    },
  };
}
