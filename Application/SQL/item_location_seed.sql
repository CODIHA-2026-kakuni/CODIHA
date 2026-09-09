SELECT r.*
FROM recycle_location r, item i
WHERE i.id = ?
  AND (
    (i.battery = TRUE AND r.battery = TRUE) OR
    (i.phone = TRUE AND r.phone = TRUE) OR
    (i.other_electronics = TRUE AND r.other_electronics = TRUE)
  );