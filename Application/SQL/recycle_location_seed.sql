LOAD DATA INFILE '/docker-entrypoint-initdb.d/recycle_location.csv'
INTO TABLE recycle_location
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(name, address, latitude, longitude, @business_hours, battery, phone, other_electronics,ward,reading,link)
SET business_hours = NULLIF(@business_hours, ''); -- 空欄はNULLとして登録する
