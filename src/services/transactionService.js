// const db = require('../config/db');

// exports.createTransaction = async ({ items, payment_method, userId }) => {
//   const conn = await db.getConnection();
//   try {
//     await conn.beginTransaction();

//     const total_price    = items.reduce((sum, i) => sum + i.price * i.qty, 0);
//     const invoice_number = `INV-${Date.now()}`;

//     // 1. Cek stok bahan baku semua item dulu sebelum proses
//     for (const item of items) {
//       const [ings] = await conn.query(`
//         SELECT pi.qty AS needed, si.id, si.name, si.stock
//         FROM product_ingredients pi
//         JOIN stock_items si ON pi.stock_item_id = si.id
//         WHERE pi.product_id = ?
//       `, [item.product_id]);

//       for (const ing of ings) {
//         const totalNeeded = ing.needed * item.qty;
//         if (ing.stock < totalNeeded) {
//           throw new Error(
//             `Bahan "${ing.name}" tidak cukup. Stok: ${ing.stock}, butuh: ${totalNeeded}`
//           );
//         }
//       }
//     }

//     // 2. Insert transaksi
//     const [txResult] = await conn.query(
//       'INSERT INTO transactions (invoice_number, total_price, payment_method, created_by) VALUES (?, ?, ?, ?)',
//       [invoice_number, total_price, payment_method, userId]
//     );
//     const transactionId = txResult.insertId;

//     // 3. Insert items + kurangi bahan baku
//     for (const item of items) {
//       await conn.query(
//         'INSERT INTO transaction_items (transaction_id, product_id, price, qty, subtotal) VALUES (?, ?, ?, ?, ?)',
//         [transactionId, item.product_id, item.price, item.qty, item.price * item.qty]
//       );

//       // Ambil resep produk
//       const [ings] = await conn.query(`
//         SELECT pi.qty AS needed, si.id AS stock_item_id
//         FROM product_ingredients pi
//         JOIN stock_items si ON pi.stock_item_id = si.id
//         WHERE pi.product_id = ?
//       `, [item.product_id]);

//       // Kurangi tiap bahan baku sesuai qty transaksi
//       for (const ing of ings) {
//         const totalOut = ing.needed * item.qty;
//         await conn.query(
//           'UPDATE stock_items SET stock = stock - ? WHERE id = ?',
//           [totalOut, ing.stock_item_id]
//         );
//         await conn.query(
//           "INSERT INTO stock_item_movements (stock_item_id, type, qty, reference) VALUES (?, 'OUT', ?, ?)",
//           [ing.stock_item_id, totalOut, invoice_number]
//         );
//       }
//     }

//     await conn.commit();
//     return { transactionId, invoice_number, total_price };
//   } catch (err) {
//     await conn.rollback();
//     throw err;
//   } finally {
//     conn.release();
//   }
// };
// Di services/transactionService.js — tambah pengurangan stok kasir


// const db = require('../config/db');

// exports.createTransaction = async ({ items, payment_method, userId, sourceUserId }) => {
//   const conn = await db.getConnection();
//   try {
//     await conn.beginTransaction();

//     // sourceUserId = stok dari user mana yang dipakai
//     // Kalau tidak dikirim, pakai userId (kasir sendiri)
//     const stockOwnerId = sourceUserId || userId;

//     let total = 0;
//     const invoiceNumber = `INV-${Date.now()}`;

//     // Hitung total transaksi
//     for (const item of items) {
//       total += Number(item.price) * Number(item.qty);
//     }

//     // Validasi stok per item SEBELUM insert
//     for (const item of items) {
//       const [ings] = await conn.query(`
//         SELECT pi.*, si.name AS ing_name, si.unit
//         FROM product_ingredients pi
//         JOIN stock_items si ON si.id = pi.stock_item_id
//         WHERE pi.product_id = ?
//       `, [item.product_id]);

//       for (const ing of ings) {
//         // Total approved untuk stockOwner
//         const [[approved]] = await conn.query(`
//           SELECT COALESCE(SUM(sri.qty_approved), 0) AS total
//           FROM stock_requests sr
//           JOIN stock_request_items sri ON sri.request_id = sr.id
//           WHERE sr.user_id = ?
//             AND sr.status = 'approved'
//             AND sri.stock_item_id = ?
//             AND sri.qty_approved IS NOT NULL
//         `, [stockOwnerId, ing.stock_item_id]);

//         // Total sudah dipakai di transaksi sebelumnya oleh stockOwner
//         // Pakai source_user_id untuk tracking stok kasir
//         const [[used]] = await conn.query(`
//           SELECT COALESCE(SUM(ti.qty * pi.qty), 0) AS total
//           FROM transaction_items ti
//           JOIN transactions t ON ti.transaction_id = t.id
//           JOIN product_ingredients pi
//             ON pi.product_id = ti.product_id
//             AND pi.stock_item_id = ?
//           WHERE t.source_user_id = ?
//         `, [ing.stock_item_id, stockOwnerId]);

//         const remaining = Math.max(0, Number(approved.total) - Number(used.total));
//         const needed    = Number(ing.qty) * Number(item.qty);

//         if (remaining < needed) {
//           await conn.rollback();
//           throw new Error(
//             `Stok ${ing.ing_name} tidak cukup ` +
//             `(tersisa: ${remaining} ${ing.unit}, butuh: ${needed} ${ing.unit})`
//           );
//         }
//       }
//     }

//     // Insert transaksi
//     const [txResult] = await conn.query(`
//       INSERT INTO transactions
//         (invoice_number, total_price, payment_method, created_by, source_user_id)
//       VALUES (?, ?, ?, ?, ?)
//     `, [invoiceNumber, total, payment_method, userId, stockOwnerId]);

//     const transactionId = txResult.insertId;

//     // Insert items
//     for (const item of items) {
//       await conn.query(`
//         INSERT INTO transaction_items (transaction_id, product_id, qty, price)
//         VALUES (?, ?, ?, ?)
//       `, [transactionId, item.product_id, item.qty, item.price]);
//     }

//     await conn.commit();

//     return {
//       transaction_id:  transactionId,
//       invoice_number:  invoiceNumber,
//       total,
//       kasir_name:      null, // diisi di frontend
//     };
//   } catch (err) {
//     await conn.rollback();
//     throw err;
//   } finally {
//     conn.release();
//   }
// };

// src/services/transactionService.js
// ============================================================
// FIX UTAMA:
// 1. Insert ke main_stock setelah transaksi (source='transaction')
// 2. Update stock_items.stock setelah transaksi
// ============================================================
const db = require('../config/db');

exports.createTransaction = async ({ items, payment_method, userId, sourceUserId }) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const stockOwnerId  = sourceUserId || userId;
    let   total         = 0;
    const invoiceNumber = `INV-${Date.now()}`;

    for (const item of items) {
      total += Number(item.price) * Number(item.qty);
    }

    // ── Validasi stok kasir SEBELUM transaksi ───────────────
    for (const item of items) {
      const [ings] = await conn.query(`
        SELECT pi.stock_item_id,
               pi.qty            AS qty_per_unit,
               si.name           AS ing_name,
               si.unit
        FROM product_ingredients pi
        JOIN stock_items si ON si.id = pi.stock_item_id
        WHERE pi.product_id = ?
      `, [item.product_id]);

      for (const ing of ings) {
        const [[approved]] = await conn.query(`
          SELECT COALESCE(SUM(sri.qty_approved), 0) AS total
          FROM stock_requests sr
          JOIN stock_request_items sri ON sri.request_id = sr.id
          WHERE sr.user_id        = ?
            AND sr.status         = 'approved'
            AND sri.stock_item_id = ?
            AND sri.qty_approved  IS NOT NULL
        `, [stockOwnerId, ing.stock_item_id]);

        const [[used]] = await conn.query(`
          SELECT COALESCE(SUM(ti.qty * pi.qty), 0) AS total
          FROM transaction_items ti
          JOIN transactions t ON ti.transaction_id = t.id
          JOIN product_ingredients pi
            ON pi.product_id     = ti.product_id
            AND pi.stock_item_id = ?
          WHERE t.source_user_id = ?
        `, [ing.stock_item_id, stockOwnerId]);

        const remaining = Math.max(0, Number(approved.total) - Number(used.total));
        const needed    = Number(ing.qty_per_unit) * Number(item.qty);

        if (remaining < needed) {
          await conn.rollback();
          throw new Error(
            `Stok ${ing.ing_name} tidak cukup ` +
            `(tersisa: ${remaining.toFixed(2)} ${ing.unit}, ` +
            `butuh: ${needed.toFixed(2)} ${ing.unit})`
          );
        }
      }
    }

    // ── Insert transaksi ────────────────────────────────────
    const [txResult] = await conn.query(`
      INSERT INTO transactions
        (invoice_number, total_price, payment_method, created_by, source_user_id)
      VALUES (?, ?, ?, ?, ?)
    `, [invoiceNumber, total, payment_method, userId, stockOwnerId]);

    const transactionId = txResult.insertId;

    // ── Insert items + kurangi stok ─────────────────────────
    for (const item of items) {
      const subtotal = Number(item.price) * Number(item.qty);

      await conn.query(`
        INSERT INTO transaction_items
          (transaction_id, product_id, qty, price, subtotal)
        VALUES (?, ?, ?, ?, ?)
      `, [transactionId, item.product_id, item.qty, item.price, subtotal]);

      const [ings] = await conn.query(`
        SELECT pi.stock_item_id,
               pi.qty            AS qty_per_unit,
               si.price_per_unit,
               si.name           AS ing_name,
               si.unit
        FROM product_ingredients pi
        JOIN stock_items si ON si.id = pi.stock_item_id
        WHERE pi.product_id = ?
      `, [item.product_id]);

      for (const ing of ings) {
        const qtyOut      = Number(ing.qty_per_unit) * Number(item.qty);
        const costPerUnit = Number(ing.price_per_unit) || 0;

        // ✅ FIX: Insert ke main_stock type='out' source='transaction'
        // WAJIB jalankan fix-01-database.sql dulu untuk ALTER ENUM!
        await conn.query(`
          INSERT INTO main_stock
            (stock_item_id, qty, cost_per_unit, type, source, reference_id, note, created_by)
          VALUES (?, ?, ?, 'out', 'transaction', ?, ?, ?)
        `, [
          ing.stock_item_id,
          qtyOut,
          costPerUnit,
          transactionId,
          `Transaksi #${invoiceNumber} - ${ing.ing_name} x${item.qty}`,
          userId,
        ]);

        // ✅ Update stock_items.stock langsung
        await conn.query(`
          UPDATE stock_items
          SET stock = GREATEST(0, stock - ?)
          WHERE id = ?
        `, [qtyOut, ing.stock_item_id]);
      }
    }

    await conn.commit();
    return { transaction_id: transactionId, invoice_number: invoiceNumber, total, kasir_name: null };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};


exports.create = async (req, res) => {
  try {
    const { items, payment_method, source_user_id } = req.body;
    if (!items || !items.length)
      return res.status(400).json({ message: 'Items tidak boleh kosong' });

    const result = await createTransaction({
      items,
      payment_method: payment_method || 'cash',
      userId:         req.user.id,
      sourceUserId:   source_user_id || req.user.id, // ← tambah ini
    });

    res.status(201).json({ message: 'Transaksi berhasil', ...result });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};