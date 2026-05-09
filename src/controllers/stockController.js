const db = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.id, p.name, p.stock, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ORDER BY p.stock ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const { product_id } = req.query;
    let sql = `
      SELECT sm.*, p.name AS product_name
      FROM stock_movements sm
      LEFT JOIN products p ON sm.product_id = p.id
      WHERE 1=1
    `;
    const params = [];
    if (product_id) { sql += ' AND sm.product_id = ?'; params.push(product_id); }
    sql += ' ORDER BY sm.created_at DESC LIMIT 100';

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.stockIn = async (req, res) => {
  try {
    const { product_id, qty, reference } = req.body;
    if (!product_id || !qty)
      return res.status(400).json({ message: 'product_id dan qty wajib diisi' });

    await db.query('UPDATE products SET stock = stock + ? WHERE id = ?', [qty, product_id]);
    await db.query(
      "INSERT INTO stock_movements (product_id, type, qty, reference) VALUES (?, 'IN', ?, ?)",
      [product_id, qty, reference || 'Manual IN']
    );

    res.json({ message: `Stok berhasil ditambah ${qty}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};