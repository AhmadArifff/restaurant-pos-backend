const db = require('../config/db');
const { createTransaction } = require('../services/transactionService');

exports.create = async (req, res) => {
  try {
    const { items, payment_method } = req.body;
    if (!items || !items.length)
      return res.status(400).json({ message: 'Items tidak boleh kosong' });

    const result = await createTransaction({
      items,
      payment_method: payment_method || 'cash',
      userId: req.user.id
    });

    res.status(201).json({ message: 'Transaksi berhasil', ...result });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const { date, limit = 50 } = req.query;
    let sql = `
      SELECT t.*, u.name AS kasir_name
      FROM transactions t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (date) { sql += ' AND DATE(t.created_at) = ?'; params.push(date); }
    sql += ' ORDER BY t.created_at DESC LIMIT ?';
    params.push(Number(limit));

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const [tx] = await db.query(
      `SELECT t.*, u.name AS kasir_name
       FROM transactions t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (!tx.length) return res.status(404).json({ message: 'Transaksi tidak ditemukan' });

    const [items] = await db.query(
      `SELECT ti.*, p.name AS product_name
       FROM transaction_items ti
       LEFT JOIN products p ON ti.product_id = p.id
       WHERE ti.transaction_id = ?`,
      [req.params.id]
    );

    res.json({ ...tx[0], items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};