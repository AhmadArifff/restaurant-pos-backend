// Migration: Add approval_notes column to stock_requests table
// Purpose: Store admin comments during approval/rejection for audit trail

exports.up = async (db) => {
  // Add approval_notes column to track admin comments
  await db.query(`
    ALTER TABLE stock_requests
    ADD COLUMN approval_notes TEXT NULL DEFAULT NULL AFTER approved_at
  `);

  console.log('✓ Added approval_notes column to stock_requests table');
};

exports.down = async (db) => {
  // Rollback: remove approval_notes column
  await db.query(`
    ALTER TABLE stock_requests
    DROP COLUMN approval_notes
  `);

  console.log('✓ Removed approval_notes column from stock_requests table');
};
