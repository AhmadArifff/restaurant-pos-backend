exports.up = async (db) => {
    // Rename tabel lama stock_movements → raw_material_movements nanti
    // Buat tabel bahan baku (menggantikan stock di products)
    await db.query(`
        CREATE TABLE IF NOT EXISTS stock_items (
        id          INT PRIMARY KEY AUTO_INCREMENT,
        name        VARCHAR(150) NOT NULL,
        unit        VARCHAR(20)  NOT NULL DEFAULT 'pcs',
        stock       INT          NOT NULL DEFAULT 0,
        min_stock   INT          NOT NULL DEFAULT 5,
        created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
    `);
};