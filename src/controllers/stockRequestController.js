const db = require('../config/db');

// ── Kasir: buat pengajuan (pilih bahan + qty) ─────────────────
exports.submitRequest = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { items, note } = req.body;
    const today  = new Date().toISOString().split('T')[0];
    const userId = req.user.id;

    if (!items?.length) {
      await conn.rollback();
      return res.status(400).json({ message: 'Minimal 1 item' });
    }

    // Cek sudah ada pengajuan pending hari ini
    // Cek HANYA pending — bukan rejected/approved
    const [[existing]] = await conn.query(
      'SELECT id, status FROM stock_requests WHERE user_id = ? AND date = ? AND status = "pending"',
      [userId, today]
    );

    let requestId;
    if (existing) {
      // Update existing pending
      await conn.query(
        'UPDATE stock_requests SET note = ? WHERE id = ?',
        [note || null, existing.id]
      );
      await conn.query(
        'DELETE FROM stock_request_items WHERE request_id = ?',
        [existing.id]
      );
      requestId = existing.id;
    } else {
      const [r] = await conn.query(
        'INSERT INTO stock_requests (user_id, date, note, status) VALUES (?, ?, ?, "pending")',
        [userId, today, note || null]
      );
      requestId = r.insertId;
    }

    // Insert items — cost_per_unit ambil dari stock_items (price_per_unit)
    for (const item of items) {
      const [[si]] = await conn.query(
        'SELECT price_per_unit FROM stock_items WHERE id = ?',
        [item.stock_item_id]
      );
      await conn.query(`
        INSERT INTO stock_request_items
          (request_id, stock_item_id, qty_requested, cost_per_unit)
        VALUES (?, ?, ?, ?)
      `, [requestId, item.stock_item_id, item.qty, si?.price_per_unit || 0]);
    }

    await conn.commit();
    res.json({ message: 'Pengajuan berhasil', request_id: requestId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
};

// ── Kasir: hapus pengajuan (hanya jika masih pending) ─────────
exports.deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [[req_]] = await db.query(
      'SELECT id, status, user_id FROM stock_requests WHERE id = ?', [id]
    );
    if (!req_) return res.status(404).json({ message: 'Tidak ditemukan' });

    // Kasir hanya bisa hapus miliknya sendiri
    if (req.user.role !== 'admin' && req_.user_id !== userId) {
      return res.status(403).json({ message: 'Bukan milik Anda' });
    }
    if (req_.status !== 'pending') {
      return res.status(400).json({ message: 'Sudah diproses, tidak bisa dihapus' });
    }

    await db.query('DELETE FROM stock_request_items WHERE request_id = ?', [id]);
    await db.query('DELETE FROM stock_requests WHERE id = ?', [id]);

    res.json({ message: 'Pengajuan dihapus' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllRequests = async (req, res) => {
  try {
    const { date_from, date_to, status } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (date_from) { where += ' AND sr.date >= ?'; params.push(date_from); }
    if (date_to)   { where += ' AND sr.date <= ?'; params.push(date_to); }
    if (status)    { where += ' AND sr.status = ?'; params.push(status); }
    where += ' AND EXISTS (SELECT 1 FROM stock_request_items sri WHERE sri.request_id = sr.id)';

    const [requests] = await db.query(`
      SELECT
        sr.*,
        u.name  AS user_name,
        a.name  AS approved_by_name,
        ca.name AS created_by_admin_name
      FROM stock_requests sr
      JOIN users u          ON sr.user_id = u.id
      LEFT JOIN users a     ON sr.approved_by = a.id
      LEFT JOIN users ca    ON sr.created_by_admin = ca.id
      ${where}
      ORDER BY sr.created_at DESC
    `, params);

    for (const r of requests) {
      const [items] = await db.query(`
        SELECT sri.*, si.name AS item_name, si.unit
        FROM stock_request_items sri
        JOIN stock_items si ON sri.stock_item_id = si.id
        WHERE sri.request_id = ?
      `, [r.id]);
      r.items = items;
    }
    res.json(requests);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Kasir: lihat pengajuan sendiri ────────────────────────────
exports.getMyRequests = async (req, res) => {
  try {
    const { status } = req.query;
    let where = 'WHERE sr.user_id = ?';
    const params = [req.user.id];
    if (status) { where += ' AND sr.status = ?'; params.push(status); }

    // Hanya yang punya items
    where += ' AND EXISTS (SELECT 1 FROM stock_request_items sri WHERE sri.request_id = sr.id)';

    const [requests] = await db.query(`
      SELECT sr.*, u.name AS user_name, a.name AS approved_by_name
      FROM stock_requests sr
      JOIN users u ON sr.user_id = u.id
      LEFT JOIN users a ON sr.approved_by = a.id
      ${where}
      ORDER BY sr.created_at DESC
      LIMIT 30
    `, params);

    for (const r of requests) {
      const [items] = await db.query(`
        SELECT sri.*, si.name AS item_name, si.unit
        FROM stock_request_items sri
        JOIN stock_items si ON sri.stock_item_id = si.id
        WHERE sri.request_id = ?
      `, [r.id]);
      r.items = items;
    }
    res.json(requests);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Admin: approve / reject ───────────────────────────────────
exports.approveRequest = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { action, approved_items } = req.body;

    const [[request]] = await conn.query(
      'SELECT * FROM stock_requests WHERE id = ?', [id]
    );
    if (!request) {
      await conn.rollback();
      return res.status(404).json({ message: 'Tidak ditemukan' });
    }
    if (request.status !== 'pending') {
      await conn.rollback();
      return res.status(400).json({ message: 'Sudah diproses' });
    }

    const status = action === 'approve' ? 'approved' : 'rejected';
    await conn.query(`
      UPDATE stock_requests
      SET status = ?, approved_by = ?, approved_at = NOW()
      WHERE id = ?
    `, [status, req.user.id, id]);

    if (action === 'approve' && approved_items?.length) {
      for (const ai of approved_items) {
        await conn.query(
          'UPDATE stock_request_items SET qty_approved = ? WHERE id = ?',
          [ai.qty_approved, ai.request_item_id]
        );

        const [[item]] = await conn.query(
          'SELECT * FROM stock_request_items WHERE id = ?',
          [ai.request_item_id]
        );

        if (item && Number(ai.qty_approved) > 0) {
          // Catat keluar dari main_stock
          await conn.query(`
            INSERT INTO main_stock
              (stock_item_id, qty, cost_per_unit, type, source, reference_id, note, created_by)
            VALUES (?, ?, ?, 'out', 'request', ?, ?, ?)
          `, [
            item.stock_item_id, ai.qty_approved, item.cost_per_unit,
            id, `Pengajuan #${id}`, req.user.id
          ]);

          // Kurangi stock_items
          await conn.query(
            'UPDATE stock_items SET stock = GREATEST(0, stock - ?) WHERE id = ?',
            [ai.qty_approved, item.stock_item_id]
          );
        }
      }
    }

    await conn.commit();
    res.json({ message: `Pengajuan ${status}` });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
};

// // ── Kasir: ajukan stok hari ini ───────────────────────────────
// exports.submitRequest = async (req, res) => {
//   const conn = await db.getConnection();
//   try {
//     await conn.beginTransaction();
//     const { items, note } = req.body;
//     const today = new Date().toISOString().split('T')[0];
//     const userId = req.user.id;

//     // Cek sudah ada pengajuan hari ini
//     const [[existing]] = await conn.query(
//       'SELECT id, status FROM stock_requests WHERE user_id = ? AND date = ?',
//       [userId, today]
//     );

//     let requestId;
//     if (existing) {
//       if (existing.status === 'approved') {
//         await conn.rollback();
//         return res.status(400).json({ message: 'Pengajuan hari ini sudah disetujui' });
//       }
//       // Update yang pending
//       await conn.query(
//         'UPDATE stock_requests SET note = ? WHERE id = ?',
//         [note || null, existing.id]
//       );
//       await conn.query(
//         'DELETE FROM stock_request_items WHERE request_id = ?',
//         [existing.id]
//       );
//       requestId = existing.id;
//     } else {
//       const [r] = await conn.query(
//         'INSERT INTO stock_requests (user_id, date, note) VALUES (?, ?, ?)',
//         [userId, today, note || null]
//       );
//       requestId = r.insertId;
//     }

//     // Insert items
//     for (const item of items) {
//       // Ambil cost_per_unit dari stock_items
//       const [[si]] = await conn.query(
//         'SELECT price_per_unit FROM stock_items WHERE id = ?',
//         [item.stock_item_id]
//       );
//       await conn.query(`
//         INSERT INTO stock_request_items
//           (request_id, stock_item_id, qty_requested, cost_per_unit)
//         VALUES (?, ?, ?, ?)
//       `, [requestId, item.stock_item_id, item.qty, si?.price_per_unit || 0]);
//     }

//     await conn.commit();
//     res.json({ message: 'Pengajuan berhasil', request_id: requestId });
//   } catch (err) {
//     await conn.rollback();
//     res.status(500).json({ message: err.message });
//   } finally {
//     conn.release();
//   }
// };

// // ── Admin: lihat semua pengajuan ──────────────────────────────
// exports.getAllRequests = async (req, res) => {
//   try {
//     const { date, status } = req.query;
//     let where = 'WHERE 1=1';
//     const params = [];
//     if (date)   { where += ' AND sr.date = ?';     params.push(date); }
//     if (status) { where += ' AND sr.status = ?';   params.push(status); }

//     const [requests] = await db.query(`
//       SELECT sr.*, u.name AS user_name,
//              a.name AS approved_by_name
//       FROM stock_requests sr
//       JOIN users u ON sr.user_id = u.id
//       LEFT JOIN users a ON sr.approved_by = a.id
//       ${where}
//       ORDER BY sr.created_at DESC
//     `, params);

//     // Attach items
//     for (const req_ of requests) {
//       const [items] = await db.query(`
//         SELECT sri.*, si.name AS item_name, si.unit
//         FROM stock_request_items sri
//         JOIN stock_items si ON sri.stock_item_id = si.id
//         WHERE sri.request_id = ?
//       `, [req_.id]);
//       req_.items = items;
//     }

//     res.json(requests);
//   } catch (err) { res.status(500).json({ message: err.message }); }
// };

// // ── Kasir: lihat pengajuan sendiri ────────────────────────────
// exports.getMyRequest = async (req, res) => {
//   try {
//     const today = req.query.date || new Date().toISOString().split('T')[0];
//     const [[request]] = await db.query(`
//       SELECT sr.*, u.name AS user_name
//       FROM stock_requests sr
//       JOIN users u ON sr.user_id = u.id
//       WHERE sr.user_id = ? AND sr.date = ?
//     `, [req.user.id, today]);

//     if (!request) return res.json(null);

//     const [items] = await db.query(`
//       SELECT sri.*, si.name AS item_name, si.unit
//       FROM stock_request_items sri
//       JOIN stock_items si ON sri.stock_item_id = si.id
//       WHERE sri.request_id = ?
//     `, [request.id]);
//     request.items = items;

//     res.json(request);
//   } catch (err) { res.status(500).json({ message: err.message }); }
// };

// // ── Admin: approve / reject pengajuan ─────────────────────────
// exports.approveRequest = async (req, res) => {
//   const conn = await db.getConnection();
//   try {
//     await conn.beginTransaction();
//     const { id } = req.params;
//     const { action, approved_items, note } = req.body;
//     // action: 'approve' | 'reject'
//     // approved_items: [{ request_item_id, qty_approved }]

//     const [[request]] = await conn.query(
//       'SELECT * FROM stock_requests WHERE id = ?', [id]
//     );
//     if (!request) {
//       await conn.rollback();
//       return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
//     }
//     if (request.status !== 'pending') {
//       await conn.rollback();
//       return res.status(400).json({ message: 'Pengajuan sudah diproses' });
//     }

//     const status = action === 'approve' ? 'approved' : 'rejected';
//     await conn.query(`
//       UPDATE stock_requests
//       SET status = ?, approved_by = ?, approved_at = NOW(), note = COALESCE(?, note)
//       WHERE id = ?
//     `, [status, req.user.id, note || null, id]);

//     if (action === 'approve' && approved_items?.length) {
//       for (const ai of approved_items) {
//         // Update qty_approved di items
//         await conn.query(
//           'UPDATE stock_request_items SET qty_approved = ? WHERE id = ?',
//           [ai.qty_approved, ai.request_item_id]
//         );

//         // Ambil detail item
//         const [[item]] = await conn.query(
//           'SELECT * FROM stock_request_items WHERE id = ?',
//           [ai.request_item_id]
//         );

//         if (item && ai.qty_approved > 0) {
//           // Catat keluar dari main_stock
//           await conn.query(`
//             INSERT INTO main_stock
//               (stock_item_id, qty, cost_per_unit, type, source, reference_id, note, created_by)
//             VALUES (?, ?, ?, 'out', 'request', ?, ?, ?)
//           `, [item.stock_item_id, ai.qty_approved, item.cost_per_unit,
//               id, `Pengajuan #${id}`, req.user.id]);

//           // Kurangi stock_items (main stock)
//           await conn.query(
//             'UPDATE stock_items SET stock = GREATEST(0, stock - ?) WHERE id = ?',
//             [ai.qty_approved, item.stock_item_id]
//           );
//         }
//       }
//     }

//     await conn.commit();
//     res.json({ message: `Pengajuan ${status}` });
//   } catch (err) {
//     await conn.rollback();
//     res.status(500).json({ message: err.message });
//   } finally {
//     conn.release();
//   }
// };

// ── Auto-submit saat login (jika belum ada) ───────────────────
exports.autoRequestOnLogin = async (userId, db) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [[existing]] = await db.query(
      'SELECT id FROM stock_requests WHERE user_id = ? AND date = ?',
      [userId, today]
    );
    if (!existing) {
      await db.query(
        'INSERT INTO stock_requests (user_id, date, status) VALUES (?, ?, "pending")',
        [userId, today]
      );
    }
  } catch (_) {}
};

exports.resubmitRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const [[request]] = await db.query(
      'SELECT id, status, user_id FROM stock_requests WHERE id = ?', [id]
    );

    if (!request) {
      return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
    }
    if (request.status !== 'rejected') {
      return res.status(400).json({ message: 'Hanya pengajuan yang ditolak yang bisa diajukan ulang' });
    }
    // Kasir hanya bisa resubmit miliknya sendiri
    if (req.user.role !== 'admin' && request.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Bukan milik Anda' });
    }

    await db.query(
      'UPDATE stock_requests SET status = "pending", approved_by = NULL, approved_at = NULL WHERE id = ?',
      [id]
    );

    res.json({ message: 'Pengajuan berhasil diajukan ulang' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};