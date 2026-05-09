exports.up = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id         INT PRIMARY KEY AUTO_INCREMENT,
      user_id    INT NOT NULL,
      login_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      logout_at  TIMESTAMP NULL,
      date       DATE NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_date (date),
      INDEX idx_user_date (user_id, date)
    )
  `);
};