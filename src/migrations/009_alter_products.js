exports.up = async (db) => {
  // Tambah kolom image_url
  const [cols] = await db.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND COLUMN_NAME = 'image_url'
  `);
  if (!cols.length) {
    await db.query(`
      ALTER TABLE products
      ADD COLUMN image_url VARCHAR(255) NULL AFTER category_id
    `);
  }

  // Hapus kolom stock lama dari products (sudah pindah ke stock_items)
  const [stockCol] = await db.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND COLUMN_NAME = 'stock'
  `);
  if (stockCol.length) {
    await db.query(`ALTER TABLE products DROP COLUMN stock`);
  }
};