exports.up = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS transaction_items (
      id              INT PRIMARY KEY AUTO_INCREMENT,
      transaction_id  INT NOT NULL,
      product_id      INT NOT NULL,
      price           DECIMAL(10,2) NOT NULL,
      qty             INT NOT NULL,
      subtotal        DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id)     REFERENCES products(id)
    )
  `);
};