exports.up = async (db) => {
  // Tambahkan 'transaction' ke ENUM source di main_stock
  // Ini diperlukan untuk tracking stok yang berkurang saat transaksi POS
  await db.query(`
    ALTER TABLE main_stock
    MODIFY COLUMN source ENUM('purchase','request','adjustment','transaction') NOT NULL DEFAULT 'purchase'
  `);
};

exports.down = async (db) => {
  // Rollback: kembalikan ke ENUM yang lama
  await db.query(`
    ALTER TABLE main_stock
    MODIFY COLUMN source ENUM('purchase','request','adjustment') NOT NULL DEFAULT 'purchase'
  `);
};
