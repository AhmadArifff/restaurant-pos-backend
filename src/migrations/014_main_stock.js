exports.up = async (db) => {
  // Tabel stok master/gudang
  await db.query(`
    CREATE TABLE IF NOT EXISTS main_stock (
      id            INT PRIMARY KEY AUTO_INCREMENT,
      stock_item_id INT NOT NULL,
      qty           DECIMAL(10,2) NOT NULL DEFAULT 0,
      cost_per_unit DECIMAL(15,2) NOT NULL DEFAULT 0,
      total_cost    DECIMAL(15,2) GENERATED ALWAYS AS (qty * cost_per_unit) STORED,
      type          ENUM('in','out') NOT NULL,
      source        ENUM('purchase','request','adjustment') NOT NULL DEFAULT 'purchase',
      reference_id  INT NULL COMMENT 'stock_request_id jika source=request',
      note          TEXT NULL,
      created_by    INT NOT NULL,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by)    REFERENCES users(id),
      INDEX idx_type (type),
      INDEX idx_source (source),
      INDEX idx_created_at (created_at),
      INDEX idx_stock_item (stock_item_id)
      )
      `);
      

  // Pengajuan stok harian kasir
  await db.query(`
    CREATE TABLE IF NOT EXISTS stock_requests (
      id           INT PRIMARY KEY AUTO_INCREMENT,
      user_id      INT NOT NULL,
      date         DATE NOT NULL,
      status       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      note         TEXT NULL,
      approved_by  INT NULL,
      approved_at  TIMESTAMP NULL,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (approved_by) REFERENCES users(id),
      // UNIQUE KEY unique_user_date (user_id, date),
      INDEX idx_status (status),
      INDEX idx_date (date)
    )
  `);

  // Detail item pengajuan
  await db.query(`
    CREATE TABLE IF NOT EXISTS stock_request_items (
      id               INT PRIMARY KEY AUTO_INCREMENT,
      request_id       INT NOT NULL,
      stock_item_id    INT NOT NULL,
      qty_requested    DECIMAL(10,2) NOT NULL,
      qty_approved     DECIMAL(10,2) NULL,
      cost_per_unit    DECIMAL(15,2) NOT NULL DEFAULT 0,
      created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (request_id)    REFERENCES stock_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE CASCADE
    )
  `);
  // Detail item pengajuan
  await db.query(`
    ALTER TABLE stock_requests
      ADD COLUMN created_by_admin INT NULL AFTER note,
      ADD FOREIGN KEY fk_created_by_admin (created_by_admin) REFERENCES users(id);
  `);
};