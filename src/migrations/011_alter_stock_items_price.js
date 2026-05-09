exports.up = async (db) => {
  const [cols] = await db.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'stock_items'
    AND COLUMN_NAME = 'price_per_unit'
  `);
  if (!cols.length) {
    await db.query(`
      ALTER TABLE stock_items
      ADD COLUMN total_price  DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER stock,
      ADD COLUMN price_per_unit DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER total_price
    `);
  }
};