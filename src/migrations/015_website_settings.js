const db = require('../config/db');

module.exports = {
  up: async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS website_settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value LONGTEXT NOT NULL,
        data_type ENUM('string','number','boolean','json') DEFAULT 'string',
        updated_by INT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_setting_key (setting_key)
      )
    `);

    console.log('✅ Migration 015_website_settings completed');
  },

  down: async () => {
    await db.query('DROP TABLE IF EXISTS website_settings');
    console.log('✅ Rollback migration 015_website_settings completed');
  },
};
