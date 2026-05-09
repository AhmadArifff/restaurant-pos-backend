const db = require('../config/db');

// Daftar satuan lengkap
const UNITS = [
  // Bahan utama
  'Lembar','Pak','Kilogram','Gram','Butir','Buah','Ikat','Kiloan','Kaleng',
  // Saus & bumbu
  'Liter','Botol','Pouch','Sachet','Blok',
  // Packaging
  'Pcs','Lusin',
];

exports.getUnits = (req, res) => {
  res.json(UNITS);
};

// exports.getAll = async (req, res) => {
//   try {
//     const [rows] = await db.query(`
//       SELECT *, 
//         CASE WHEN stock > 0 
//           THEN ROUND(total_price / stock, 2) 
//           ELSE 0 
//         END AS price_per_unit
//       FROM stock_items 
//       ORDER BY name ASC
//     `);
//     res.json(rows);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

exports.getAll = async (req, res) => {
  try {
    // ✅ Pakai price_per_unit dari kolom langsung (sudah diupdate recalcStockItem)
    const [rows] = await db.query(`
      SELECT * FROM stock_items ORDER BY name ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, unit, stock = 0, min_stock = 5, total_price = 0 } = req.body;
    if (!name) return res.status(400).json({ message: 'Nama bahan wajib diisi' });

    const price_per_unit = stock > 0 ? total_price / stock : 0;

    const [result] = await db.query(
      `INSERT INTO stock_items 
        (name, unit, stock, min_stock, total_price, price_per_unit) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, unit || 'Pcs', stock, min_stock, total_price, price_per_unit]
    );
    res.status(201).json({ message: 'Bahan baku ditambahkan', id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { name, unit, min_stock, total_price, stock } = req.body;

    // Ambil stok saat ini kalau tidak dikirim
    const [cur] = await db.query('SELECT stock FROM stock_items WHERE id = ?', [req.params.id]);
    const currentStock  = stock !== undefined ? Number(stock) : cur[0]?.stock ?? 0;
    const currentTotal  = total_price !== undefined ? Number(total_price) : 0;
    const price_per_unit = currentStock > 0 ? currentTotal / currentStock : 0;

    await db.query(
      `UPDATE stock_items 
       SET name=?, unit=?, min_stock=?, total_price=?, price_per_unit=?
       WHERE id=?`,
      [name, unit, min_stock, currentTotal, price_per_unit, req.params.id]
    );
    res.json({ message: 'Bahan baku diupdate' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM stock_items WHERE id = ?', [req.params.id]);
    if (!result.affectedRows)
      return res.status(404).json({ message: 'Bahan tidak ditemukan' });
    res.json({ message: 'Bahan baku dihapus' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.stockIn = async (req, res) => {
  try {
    const { stock_item_id, qty, reference, total_price_added } = req.body;
    if (!stock_item_id || !qty)
      return res.status(400).json({ message: 'stock_item_id dan qty wajib diisi' });

    // Hitung total harga baru (akumulasi)
    const [cur] = await db.query(
      'SELECT stock, total_price FROM stock_items WHERE id = ?',
      [stock_item_id]
    );
    const newStock      = cur[0].stock + Number(qty);
    const newTotal      = Number(cur[0].total_price) + Number(total_price_added || 0);
    const price_per_unit = newStock > 0 ? newTotal / newStock : 0;

    await db.query(
      `UPDATE stock_items 
       SET stock=?, total_price=?, price_per_unit=? 
       WHERE id=?`,
      [newStock, newTotal, price_per_unit, stock_item_id]
    );
    await db.query(
      `INSERT INTO stock_item_movements 
        (stock_item_id, type, qty, reference) 
       VALUES (?, 'IN', ?, ?)`,
      [stock_item_id, qty, reference || 'Manual IN']
    );
    res.json({
      message: `Stok berhasil ditambah ${qty}`,
      price_per_unit: price_per_unit.toLocaleString('id-ID'),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const { stock_item_id } = req.query;
    let sql = `
      SELECT m.*, s.name AS item_name, s.unit, s.price_per_unit
      FROM stock_item_movements m
      LEFT JOIN stock_items s ON m.stock_item_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (stock_item_id) { sql += ' AND m.stock_item_id = ?'; params.push(stock_item_id); }
    sql += ' ORDER BY m.created_at DESC LIMIT 100';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};