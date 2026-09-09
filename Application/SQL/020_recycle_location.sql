CREATE TABLE IF NOT EXISTS recycle_location(
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL COMMENT '施設名',
    address VARCHAR(255) NOT NULL COMMENT '住所',
    latitude DECIMAL(10, 7) NOT NULL COMMENT '緯度',
    longitude DECIMAL(10, 7) NOT NULL COMMENT '経度',
    business_hours TEXT COMMENT '営業時間',
    battery BOOLEAN NOT NULL DEFAULT FALSE COMMENT '充電池を回収可能か指定',
    phone BOOLEAN NOT NULL DEFAULT FALSE COMMENT '携帯電話・タブレットパソコンを回収可能か指定',
    other_electronics BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'その他の電子機器を回収可能か指定',
    ward VARCHAR(100) NOT NULL COMMENT '区名',
    reading VARCHAR(255) NOT NULL COMMENT '読み仮名',
    link TEXT COMMENT '施設の地図URL',
    INDEX idx_recycle_location_reading (reading), -- 索引の作成
    PRIMARY KEY (id)
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;