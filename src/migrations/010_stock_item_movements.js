exports.up = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS stock_item_movements (
      id            INT PRIMARY KEY AUTO_INCREMENT,
      stock_item_id INT NOT NULL,
      type          ENUM('IN','OUT') NOT NULL,
      qty           INT NOT NULL,
      reference     VARCHAR(100),
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (stock_item_id) REFERENCES stock_items(id)
    )
  `);
};