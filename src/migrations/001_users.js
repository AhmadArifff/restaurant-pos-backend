exports.up = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          INT PRIMARY KEY AUTO_INCREMENT,
      name        VARCHAR(100) NOT NULL,
      email       VARCHAR(100) UNIQUE NOT NULL,
      password    VARCHAR(255) NOT NULL,
      role        ENUM('admin', 'kasir') DEFAULT 'kasir',
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};