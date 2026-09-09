CREATE TABLE IF NOT EXISTS item(
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '品目名',
    reading VARCHAR(100) NOT NULL COMMENT '読み仮名',
    category VARCHAR(100) NOT NULL COMMENT '分別区分',
    dispose_method TEXT COMMENT '廃棄方法',
    caution TEXT COMMENT '注意事項',
    requires_dropoff BOOLEAN NOT NULL DEFAULT FALSE COMMENT '持込が必要な品目か指定',
    battery BOOLEAN NOT NULL DEFAULT FALSE COMMENT '充電池か指定',
    phone BOOLEAN NOT NULL DEFAULT FALSE COMMENT '携帯電話・タブレットパソコンか指定',
    other_electronics BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'その他の電子機器か指定',
    PRIMARY KEY (id),
    INDEX idx_items_reading (reading) -- 索引の作成
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

