// Migration: Create stock_request_audit table
// Purpose: Immutable audit log for all stock request approval/rejection actions

exports.up = async (db) => {
  // Create audit log table for tracking approval history
  await db.query(`
    CREATE TABLE IF NOT EXISTS stock_request_audit (
      id INT AUTO_INCREMENT PRIMARY KEY,
      request_id INT NOT NULL,
      action VARCHAR(50) NOT NULL COMMENT 'approved, rejected, modified, resubmitted',
      approved_qty DECIMAL(10, 2) NULL COMMENT 'Qty approved in this action',
      approved_by INT NOT NULL COMMENT 'User ID of admin who approved',
      note TEXT NULL COMMENT 'Admin notes or reason',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (request_id) REFERENCES stock_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE RESTRICT,
      
      INDEX idx_request_id (request_id),
      INDEX idx_action (action),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='Immutable audit trail for stock request approvals'
  `);

  console.log('✓ Created stock_request_audit table');
};

exports.down = async (db) => {
  // Rollback: remove audit log table
  await db.query(`
    DROP TABLE IF EXISTS stock_request_audit
  `);

  console.log('✓ Dropped stock_request_audit table');
};
