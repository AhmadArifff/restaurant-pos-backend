exports.up = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id              INT PRIMARY KEY AUTO_INCREMENT,
      invoice_number  VARCHAR(50) UNIQUE NOT NULL,
      total_price     DECIMAL(10,2) NOT NULL,
      payment_method  ENUM('cash', 'qris', 'transfer') DEFAULT 'cash',
      source_user_id INT NULL AFTER created_by;
      created_by      INT,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (source_user_id) REFERENCES users(id)
    )
  `);
};