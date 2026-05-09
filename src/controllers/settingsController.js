const fs = require('fs');
const path = require('path');
const db = require('../config/db');

// Ensure table exists on startup
const ensureTableExists = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS website_settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value LONGTEXT,
        data_type ENUM('string','number','boolean','json') DEFAULT 'string',
        updated_by INT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_setting_key (setting_key)
      )
    `;
    await db.query(query);
    console.log('✅ website_settings table ready');
  } catch (error) {
    console.error('❌ Error creating website_settings table:', error.message);
    throw error;
  }
};

// Initialize table on module load
ensureTableExists().catch(err => {
  console.error('Failed to initialize settings table:', err);
});

module.exports = {
  // Get all settings
  getAll: async (req, res) => {
    try {
      await ensureTableExists();
      const [rows] = await db.query('SELECT setting_key, setting_value FROM website_settings ORDER BY setting_key');
      
      // Transform array to object for easier access
      const settings = {};
      if (Array.isArray(rows)) {
        rows.forEach(row => {
          settings[row.setting_key] = row.setting_value;
        });
      }

      res.json(settings);
    } catch (err) {
      console.error('❌ Error fetching settings:', err.message);
      res.status(500).json({ error: 'Gagal mengambil settings', details: err.message });
    }
  },

  // Get specific setting by key
  getByKey: async (req, res) => {
    try {
      await ensureTableExists();
      const { key } = req.params;
      const [rows] = await db.query(
        'SELECT setting_value FROM website_settings WHERE setting_key = ?',
        [key]
      );

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.json({ value: null });
      }

      res.json({ value: rows[0].setting_value });
    } catch (err) {
      console.error('❌ Error fetching setting by key:', err.message);
      res.status(500).json({ error: 'Gagal mengambil setting', details: err.message });
    }
  },

  // Update single setting
  update: async (req, res) => {
    try {
      await ensureTableExists();
      const { setting_key, setting_value } = req.body;
      
      if (!setting_key) {
        return res.status(400).json({ error: 'setting_key diperlukan' });
      }

      const updated_by = req.user?.id || 1;

      await db.query(
        `INSERT INTO website_settings (setting_key, setting_value, updated_by)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
        [setting_key, setting_value, updated_by]
      );

      res.json({ 
        message: 'Setting berhasil disimpan',
        setting_key,
        setting_value
      });
    } catch (err) {
      console.error('❌ Error updating setting:', err.message);
      res.status(500).json({ error: 'Gagal menyimpan setting', details: err.message });
    }
  },

  // Update with file upload
  updateWithFile: async (req, res) => {
    try {
      await ensureTableExists();
      const { setting_key } = req.body;
      
      if (!setting_key || !req.file) {
        return res.status(400).json({ error: 'setting_key dan file diperlukan' });
      }

      // Create branding directory if not exists
      const brandingDir = path.join(__dirname, '../../public/images/branding');
      if (!fs.existsSync(brandingDir)) {
        fs.mkdirSync(brandingDir, { recursive: true });
      }

      // Generate filename
      const ext = path.extname(req.file.originalname);
      const filename = `${setting_key}-${Date.now()}${ext}`;
      const filepath = path.join(brandingDir, filename);

      // Save file
      fs.writeFileSync(filepath, req.file.buffer);

      // Get old file path to delete
      const [oldRows] = await db.query(
        'SELECT setting_value FROM website_settings WHERE setting_key = ?',
        [setting_key]
      );

      if (Array.isArray(oldRows) && oldRows.length > 0 && oldRows[0].setting_value) {
        const oldPath = oldRows[0].setting_value;
        if (oldPath.includes('/images/branding/')) {
          const safeOldPath = oldPath.replace(/^\/+/, '');
          const fullOldPath = path.join(__dirname, '../../public', safeOldPath);
          try {
            if (fs.existsSync(fullOldPath)) {
              fs.unlinkSync(fullOldPath);
            }
          } catch (e) {
            console.log('⚠️ Warning: Could not delete old file:', e.message);
          }
        }
      }

      // Update database
      const setting_value = `/images/branding/${filename}`;
      const updated_by = req.user?.id || 1;

      await db.query(
        `INSERT INTO website_settings (setting_key, setting_value, updated_by)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
        [setting_key, setting_value, updated_by]
      );

      res.json({
        message: 'File berhasil diunggah',
        setting_key,
        setting_value,
        file_url: setting_value,
        filename
      });
    } catch (err) {
      console.error('❌ Error uploading file:', err.message);
      res.status(500).json({ error: 'Gagal mengunggah file', details: err.message });
    }
  },

  // Bulk update multiple settings
  bulkUpdate: async (req, res) => {
    try {
      await ensureTableExists();
      const settings = Array.isArray(req.body) ? req.body : req.body?.settings;
      
      if (!Array.isArray(settings)) {
        return res.status(400).json({ error: 'Body harus berupa array settings' });
      }

      const updated_by = req.user?.id || 1;

      for (const setting of settings) {
        const { setting_key, setting_value } = setting;
        
        if (!setting_key) continue;

        await db.query(
          `INSERT INTO website_settings (setting_key, setting_value, updated_by)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
          [setting_key, setting_value, updated_by]
        );
      }

      res.json({ message: 'Semua setting berhasil disimpan' });
    } catch (err) {
      console.error('❌ Error bulk updating settings:', err.message);
      res.status(500).json({ error: 'Gagal menyimpan settings', details: err.message });
    }
  }
};
