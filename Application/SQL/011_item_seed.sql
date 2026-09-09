LOAD DATA INFILE '/docker-entrypoint-initdb.d/gomibunbetsujiten.csv'
INTO TABLE item
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(name, reading, category, @dispose_method, @caution, requires_dropoff, battery, phone, other_electronics)
SET dispose_method = NULLIF(@dispose_method, ''), -- 空欄はNULLとして登録する
    caution        = NULLIF(@caution, '');
