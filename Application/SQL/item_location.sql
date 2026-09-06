CREATE TABLE IF NOT EXISTS item_location_table(
    item_id INT UNSIGNED NOT NULL,
    recycle_location_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (item_id, recycle_location_id),
    CONSTRAINT fk_ids_item
        FOREIGN KEY (item_id) REFERENCES item(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_ids_recycle_location
        FOREIGN KEY (recycle_location_id) REFERENCES recycle_location(id)
        ON DELETE CASCADE
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;