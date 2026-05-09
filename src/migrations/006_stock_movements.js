exports.up = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id          INT PRIMARY KEY AUTO_INCREMENT,
      product_id  INT NOT NULL,
      type        ENUM('IN', 'OUT') NOT NULL,
      qty         INT NOT NULL,
      reference   VARCHAR(100),
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);
};