const db = require('../config/db');

// Helper: hitung HPP per produk dari bahan baku
async function getProductHPP(productId, conn = null) {
  const q = conn || require('../config/db');
  const [ings] = await q.query(`
    SELECT CAST(pi.qty AS DECIMAL(10,4)) AS qty,
           si.price_per_unit
    FROM product_ingredients pi
    JOIN stock_items si ON pi.stock_item_id = si.id
    WHERE pi.product_id = ?
  `, [productId]);
  return ings.reduce((sum, i) => {
    return sum + (Number(i.price_per_unit) * parseFloat(i.qty));
  }, 0);
}

exports.sales = async (req, res) => {
  try {
    const { period = 'daily', month, year } = req.query;
    const y = year  || new Date().getFullYear();
    const m = month || new Date().getMonth() + 1;

    let sql, params = [y];

    if (period === 'monthly') {
      sql = `
        SELECT MONTH(t.created_at) AS month,
               COUNT(DISTINCT t.id) AS total_trx,
               SUM(t.total_price)   AS revenue
        FROM transactions t
        WHERE YEAR(t.created_at) = ?
        GROUP BY MONTH(t.created_at)
        ORDER BY month ASC
      `;
    } else {
      sql = `
        SELECT DATE(t.created_at)    AS date,
               COUNT(DISTINCT t.id)  AS total_trx,
               SUM(t.total_price)    AS revenue
        FROM transactions t
        WHERE YEAR(t.created_at) = ? AND MONTH(t.created_at) = ?
        GROUP BY DATE(t.created_at)
        ORDER BY date ASC
      `;
      params.push(m);
    }

    const [rows] = await db.query(sql, params);

    for (const row of rows) {
      // Filter per tanggal/bulan
      // ── Build filter per periode ──
      let dateFilter;
      if (period === 'monthly') {
        dateFilter = `YEAR(t.created_at) = ${y} AND MONTH(t.created_at) = ${Number(row.month)}`;
      } else {
        // ← Handle semua kemungkinan format tanggal dari MySQL
        let d;
        if (row.date instanceof Date) {
          // MySQL return Date object
          const yyyy = row.date.getFullYear();
          const mm   = String(row.date.getMonth() + 1).padStart(2, '0');
          const dd   = String(row.date.getDate()).padStart(2, '0');
          d = `${yyyy}-${mm}-${dd}`;
        } else {
          // MySQL return string — ambil bagian tanggal saja
          d = String(row.date).split('T')[0];
        }
        dateFilter = `DATE(t.created_at) = '${d}'`;
      }

      // Ambil semua item transaksi di periode ini
      const [items] = await db.query(`
        SELECT ti.product_id, ti.qty
        FROM transaction_items ti
        JOIN transactions t ON ti.transaction_id = t.id
        WHERE ${dateFilter}
      `);

      // Hitung HPP DULU, baru assign ke row
      let totalHPP = 0;
      for (const item of items) {
        const hpp = await getProductHPP(item.product_id);
        totalHPP += hpp * Number(item.qty);
      }

      // Assign setelah HPP selesai dihitung
      row.hpp    = Math.round(totalHPP);
      row.margin = Math.round(Number(row.revenue) - totalHPP);
      if (isNaN(row.margin)) row.margin = 0;
      if (isNaN(row.hpp))    row.hpp    = 0;
    }

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.todayStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Total transaksi & revenue hari ini
    const [[stat]] = await db.query(`
      SELECT
        COUNT(DISTINCT t.id)  AS total_trx,
        COALESCE(SUM(t.total_price), 0) AS revenue
      FROM transactions t
      WHERE DATE(t.created_at) = ?
    `, [today]);

    // Hitung HPP hari ini
    const [items] = await db.query(`
      SELECT ti.product_id, ti.qty
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.id
      WHERE DATE(t.created_at) = ?
    `, [today]);

    let totalHPP = 0;
    for (const item of items) {
      const hpp = await getProductHPP(item.product_id);
      totalHPP += hpp * item.qty;
    }

    const revenue = Number(stat.revenue);
    const margin  = revenue - totalHPP;

    res.json({
      total_trx:  Number(stat.total_trx),
      revenue:    Math.round(revenue),
      hpp:        Math.round(totalHPP),
      margin:     Math.round(margin),
      margin_pct: revenue > 0 ? Math.round((margin / revenue) * 100) : 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.bestSelling = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const [rows] = await db.query(
      `SELECT p.id, p.name,
              SUM(ti.qty)      AS total_sold,
              SUM(ti.subtotal) AS revenue
       FROM transaction_items ti
       LEFT JOIN products p ON ti.product_id = p.id
       GROUP BY p.id, p.name
       ORDER BY total_sold DESC
       LIMIT ?`,
      [Number(limit)]
    );

    // Tambah HPP & margin per produk
    for (const row of rows) {
      const hpp       = await getProductHPP(row.id);
      row.hpp_per_pcs = Math.round(hpp);
      row.total_hpp   = Math.round(hpp * row.total_sold);
      row.margin      = Math.round(Number(row.revenue) - row.total_hpp);
      row.margin_pct  = Number(row.revenue) > 0
        ? Math.round((row.margin / Number(row.revenue)) * 100) : 0;
    }

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.stockLow = async (req, res) => {
  try {
    const { threshold = 5 } = req.query;

    // Ambil stok bahan baku yang menipis
    const [stockItems] = await db.query(`
      SELECT s.id, s.name, s.stock, s.min_stock, s.unit, s.price_per_unit
      FROM stock_items s
      WHERE s.stock <= ?
      ORDER BY s.stock ASC
    `, [Number(threshold)]);

    // Untuk tiap bahan baku yang menipis, cari produk yang memakainya
    for (const item of stockItems) {
      const [prods] = await db.query(`
        SELECT p.name, pi.qty AS qty_per_produk,
          FLOOR(? / pi.qty) AS estimasi_porsi
        FROM product_ingredients pi
        JOIN products p ON pi.product_id = p.id
        WHERE pi.stock_item_id = ?
        ORDER BY estimasi_porsi ASC
      `, [item.stock, item.id]);
      item.affected_products = prods;
      item.min_porsi = prods.length > 0
        ? Math.min(...prods.map(p => p.estimasi_porsi)) : 0;
    }

    res.json(stockItems);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.yearlyStats = async (req, res) => {
  try {
    const y = req.query.year || new Date().getFullYear();

    const [rows] = await db.query(`
      SELECT MONTH(t.created_at) AS month,
             COUNT(DISTINCT t.id) AS total_trx,
             SUM(t.total_price)   AS revenue
      FROM transactions t
      WHERE YEAR(t.created_at) = ?
      GROUP BY MONTH(t.created_at)
      ORDER BY month ASC
    `, [y]);

    // Hitung HPP & margin per bulan
    for (const row of rows) {
      const [items] = await db.query(`
        SELECT ti.product_id, ti.qty
        FROM transaction_items ti
        JOIN transactions t ON ti.transaction_id = t.id
        WHERE YEAR(t.created_at) = ? AND MONTH(t.created_at) = ?
      `, [y, row.month]);

      let totalHPP = 0;
      for (const item of items) {
        const hpp = await getProductHPP(item.product_id);
        totalHPP += hpp * Number(item.qty);
      }

      row.hpp    = Math.round(totalHPP);
      row.margin = Math.round(Number(row.revenue) - totalHPP);
    }

    // Lengkapi 12 bulan — bulan kosong = 0
    const months = Array.from({ length: 12 }, (_, i) => {
      const found = rows.find(r => Number(r.month) === i + 1);
      return {
        month:     i + 1,
        total_trx: found ? Number(found.total_trx) : 0,
        revenue:   found ? Number(found.revenue)   : 0,
        hpp:       found ? Number(found.hpp)        : 0,
        margin:    found ? Number(found.margin)     : 0,
      };
    });

    res.json(months);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getTransactionYears = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DISTINCT YEAR(created_at) AS year
      FROM transactions
      ORDER BY year DESC
    `);
    const years = rows.map(r => r.year);
    // Kalau belum ada transaksi, return tahun sekarang
    if (years.length === 0) years.push(new Date().getFullYear());
    res.json(years);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.salesByProduct = async (req, res) => {
  try {
    const { period = 'daily', month, year } = req.query;
    const y = year  || new Date().getFullYear();
    const m = month || new Date().getMonth() + 1;

    let groupBy, dateSelect;
    if (period === 'monthly') {
      groupBy    = 'MONTH(t.created_at), ti.product_id';
      dateSelect = 'MONTH(t.created_at) AS period_key';
    } else {
      groupBy    = 'DATE(t.created_at), ti.product_id';
      dateSelect = 'DATE(t.created_at) AS period_key';
    }

    const whereYear  = `YEAR(t.created_at) = ${db.escape ? db.escape(y) : y}`;
    const whereMonth = period === 'daily'
      ? `AND MONTH(t.created_at) = ${db.escape ? db.escape(m) : m}` : '';

    const [rows] = await db.query(`
      SELECT
        ${dateSelect},
        ti.product_id,
        p.name AS product_name,
        SUM(ti.qty)      AS total_qty,
        SUM(ti.subtotal) AS total_revenue
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.id
      JOIN products p     ON ti.product_id = p.id
      WHERE ${whereYear} ${whereMonth}
      GROUP BY ${groupBy}
      ORDER BY period_key ASC, total_qty DESC
    `);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};