-- ------------------------------------------------------------
-- CODIHA 初期スキーマ
-- ------------------------------------------------------------
-- 適用方法（例）:
--   mysql -h 127.0.0.1 -P 3306 -u codiha -p codiha < 001_init.sql
-- または docker compose 経由:
--   docker compose exec -T db mysql -u codiha -pcodiha codiha < Application/SQL/001_init.sql
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL COMMENT '品目名',
  reading VARCHAR(100) NOT NULL COMMENT '読み仮名（50音順ソート用）',
  category VARCHAR(50) NOT NULL COMMENT '分別区分',
  disposal_method TEXT COMMENT '出し方・注意事項',
  requires_dropoff BOOLEAN NOT NULL DEFAULT FALSE COMMENT '持込先が必要な品目か',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_items_reading (reading)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dropoff_sites (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL COMMENT '施設名',
  address VARCHAR(255) NOT NULL COMMENT '住所',
  latitude DECIMAL(10, 7) NOT NULL COMMENT '緯度',
  longitude DECIMAL(10, 7) NOT NULL COMMENT '経度',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 品目と持込先候補地の中間テーブル（多対多）
CREATE TABLE IF NOT EXISTS item_dropoff_sites (
  item_id INT UNSIGNED NOT NULL,
  dropoff_site_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (item_id, dropoff_site_id),
  CONSTRAINT fk_ids_item
    FOREIGN KEY (item_id) REFERENCES items(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ids_site
    FOREIGN KEY (dropoff_site_id) REFERENCES dropoff_sites(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
