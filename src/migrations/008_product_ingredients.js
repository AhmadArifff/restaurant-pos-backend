exports.up = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS product_ingredients (
      id            INT PRIMARY KEY AUTO_INCREMENT,
      product_id    INT NOT NULL,
      stock_item_id INT NOT NULL,
      qty           INT NOT NULL DEFAULT 1,
      FOREIGN KEY (product_id)    REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE CASCADE,
      UNIQUE KEY unique_ingredient (product_id, stock_item_id)
    )
  `);
};