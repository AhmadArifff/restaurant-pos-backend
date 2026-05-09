exports.up = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id           INT PRIMARY KEY AUTO_INCREMENT,
      name         VARCHAR(150) NOT NULL,
      price        DECIMAL(10,2) NOT NULL,
      stock        INT DEFAULT 0,
      category_id  INT,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    )
  `);
};