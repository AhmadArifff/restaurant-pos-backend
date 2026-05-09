exports.up = async (db) => {
  const [cols] = await db.query(`
    SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'product_ingredients'
    AND COLUMN_NAME = 'qty'
  `);
  if (cols[0]?.DATA_TYPE === 'int') {
    await db.query(`
      ALTER TABLE product_ingredients
      MODIFY COLUMN qty DECIMAL(10,4) NOT NULL DEFAULT 1
    `);
  }
};