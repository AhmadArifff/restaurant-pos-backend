// const { GoogleGenAI } = require('@google/genai');
// const db = require('../config/db');

// // Initialize dengan SDK baru - otomatis detect GEMINI_API_KEY dari env
// const ai = new GoogleGenAI({
//   apiKey: process.env.GEMINI_API_KEY,
// });

// /**
//  * SYSTEM PROMPT dengan Database Schema untuk AI Intelligence
//  * Includes: Flow menu admin, Table schema, Query patterns
//  */
// const SYSTEM_PROMPT = `Anda adalah AI Assistant untuk Sistem POS Restaurant Kebab. 
// Tugas Anda membantu Admin menganalisis data penjualan, stok, dan operasional.

// === DATABASE SCHEMA ===
// users: id, name, email, role(admin|kasir), created_at
// products: id, name, price, stock, category_id, created_at, image_url
// categories: id, name
// transactions: id, invoice_number, total_price, payment_method(cash|qris|transfer), created_by, source_user_id, created_at
// transaction_items: id, transaction_id, product_id, quantity, unit_price
// stock_items: id, name, price_per_unit (bahan baku/ingredients)
// product_ingredients: product_id, stock_item_id, qty (resep produk)
// stock_movements: id, stock_item_id, type(in|out), quantity, reference_id, created_at
// main_stock: id, transaction_type, item_name, quantity, price_per_unit, total_cost, created_at
// attendance: id, user_id, date, login_at, logout_at
// website_settings: id, setting_key, setting_value

// === ADMIN MENU WORKFLOW ===
// 1. Dashboard: Lihat ringkasan penjualan hari ini, revenue, best-selling
// 2. POS: Input transaksi penjualan
// 3. Products: CRUD produk & kategori
// 4. Reports: Laporan penjualan by periode, HPP (Cost of Goods), profit margin
// 5. Stock: Manajemen bahan baku & persediaan produk
// 6. Users: Kelola kasir & admin
// 7. Settings: Konfigurasi website & toko

// === TIPE QUERY YANG BISA ANDA TANGANI ===
// - Sales Analytics: Transaksi hari ini, minggu ini, bulan ini, range tanggal
// - Financial: Revenue, profit, HPP (harga pokok penjualan)
// - Product Performance: Best-sellers, slow-movers, profit per produk
// - Stock Status: Stok rendah, reorder needed, ingredient level
// - Staff: Attendance, sales by kasir
// - Trend: Comparison month-to-month, growth trends

// === RESPONSE STRATEGY ===
// Berikan jawaban:
// 1. Analisis singkat tapi insightful (max 2-3 kalimat)
// 2. Data penting dalam format yang jelas
// 3. Rekomendasi aksi jika ada
// 4. Hindari jargon teknis, gunakan bahasa bisnis sederhana`;

// /**
//  * Detect intent dari user message (Stage 1)
//  */
// function detectIntent(userMessage) {
//   const lower = userMessage.toLowerCase();
  
//   // Sales intent
//   if (lower.match(/penjualan|revenue|omset|pendapatan|terjual|transaksi|penjual|berapa.*jual/i)) {
//     return { type: 'sales', period: extractPeriod(lower) };
//   }
  
//   // Financial intent
//   if (lower.match(/keuntungan|profit|hpp|biaya|margin|untung|rugi|laba|modal|kost/i)) {
//     return { type: 'financial', period: extractPeriod(lower) };
//   }
  
//   // Product intent
//   if (lower.match(/produk|menu|best selling|laris|favorit|makanan|terlaris|paling laku/i)) {
//     return { type: 'product', period: extractPeriod(lower) };
//   }
  
//   // Stock intent
//   if (lower.match(/stok|persediaan|bahan|ingredient|habis|reorder|supply|berapa stok/i)) {
//     return { type: 'stock', period: extractPeriod(lower) };
//   }
  
//   // Staff intent
//   if (lower.match(/kasir|karyawan|staff|tim|absensi|attendance|penjualan kasir/i)) {
//     return { type: 'staff', period: extractPeriod(lower) };
//   }
  
//   return { type: 'other', period: 'today' };
// }

// /**
//  * Extract time period dari message
//  */
// function extractPeriod(message) {
//   if (message.match(/hari ini|today|harian/i)) return 'today';
//   if (message.match(/minggu ini|minggu|weekly|week/i)) return 'week';
//   if (message.match(/bulan ini|bulan|monthly|month/i)) return 'month';
//   if (message.match(/tahun ini|tahunan|yearly|year/i)) return 'year';
//   return 'today';
// }

// /**
//  * Fetch data by intent (Stage 2) - Database queries
//  */
// async function fetchDataByIntent(intent) {
//   try {
//     switch (intent.type) {
//       case 'sales':
//         return await fetchSalesData(intent.period);
//       case 'financial':
//         return await fetchFinancialData(intent.period);
//       case 'product':
//         return await fetchProductData(intent.period);
//       case 'stock':
//         return await fetchStockData();
//       case 'staff':
//         return await fetchStaffData(intent.period);
//       default:
//         return { error: 'Tipe query tidak dikenali' };
//     }
//   } catch (err) {
//     console.error('Data fetch error:', err);
//     return { error: err.message };
//   }
// }

// /**
//  * Fetch sales data
//  */
// async function fetchSalesData(period) {
//   try {
//     let dateFilter = "DATE(created_at) = DATE(NOW())";
    
//     if (period === 'week') {
//       dateFilter = "YEARWEEK(created_at) = YEARWEEK(NOW())";
//     } else if (period === 'month') {
//       dateFilter = "MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())";
//     } else if (period === 'year') {
//       dateFilter = "YEAR(created_at) = YEAR(NOW())";
//     }

//     const [rows] = await db.query(`
//       SELECT 
//         COUNT(*) as total_transactions,
//         SUM(total_price) as total_revenue,
//         AVG(total_price) as avg_transaction,
//         COUNT(DISTINCT created_by) as unique_cashiers
//       FROM transactions
//       WHERE ${dateFilter}
//     `);
    
//     return { type: 'sales', period, data: rows[0] || {} };
//   } catch (err) {
//     console.error('Sales data error:', err);
//     throw err;
//   }
// }

// /**
//  * Fetch financial data
//  */
// async function fetchFinancialData(period) {
//   try {
//     let dateFilter = "DATE(t.created_at) = DATE(NOW())";
    
//     if (period === 'week') {
//       dateFilter = "YEARWEEK(t.created_at) = YEARWEEK(NOW())";
//     } else if (period === 'month') {
//       dateFilter = "MONTH(t.created_at) = MONTH(NOW()) AND YEAR(t.created_at) = YEAR(NOW())";
//     }

//     const [rows] = await db.query(`
//       SELECT 
//         SUM(t.total_price) as gross_revenue,
//         SUM(m.total_cost) as total_cost,
//         (SUM(t.total_price) - COALESCE(SUM(m.total_cost), 0)) as profit,
//         ROUND(((SUM(t.total_price) - COALESCE(SUM(m.total_cost), 0)) / SUM(t.total_price)) * 100, 2) as profit_margin
//       FROM transactions t
//       LEFT JOIN main_stock m ON DATE(m.created_at) = DATE(t.created_at)
//       WHERE ${dateFilter}
//     `);
    
//     return { type: 'financial', period, data: rows[0] || {} };
//   } catch (err) {
//     console.error('Financial data error:', err);
//     throw err;
//   }
// }

// /**
//  * Fetch product data
//  */
// async function fetchProductData(period) {
//   try {
//     let dateFilter = "DATE(ti.created_at) = DATE(NOW())";
    
//     if (period === 'week') {
//       dateFilter = "YEARWEEK(ti.created_at) = YEARWEEK(NOW())";
//     } else if (period === 'month') {
//       dateFilter = "MONTH(ti.created_at) = MONTH(NOW()) AND YEAR(ti.created_at) = YEAR(NOW())";
//     }

//     const [rows] = await db.query(`
//       SELECT 
//         p.name,
//         COUNT(ti.id) as total_sold,
//         SUM(ti.quantity) as total_quantity,
//         SUM(ti.quantity * ti.unit_price) as revenue
//       FROM transaction_items ti
//       JOIN products p ON ti.product_id = p.id
//       WHERE ${dateFilter}
//       GROUP BY p.id, p.name
//       ORDER BY total_sold DESC
//       LIMIT 10
//     `);
    
//     return { type: 'product', period, data: rows };
//   } catch (err) {
//     console.error('Product data error:', err);
//     throw err;
//   }
// }

// /**
//  * Fetch stock data
//  */
// async function fetchStockData() {
//   try {
//     const [rows] = await db.query(`
//       SELECT 
//         id,
//         name,
//         stock,
//         CASE 
//           WHEN stock < 10 THEN 'CRITICAL - Pesan Segera!'
//           WHEN stock < 20 THEN 'LOW - Stok Terbatas'
//           ELSE 'OK'
//         END as status
//       FROM products
//       ORDER BY stock ASC
//       LIMIT 15
//     `);
    
//     return { type: 'stock', data: rows };
//   } catch (err) {
//     console.error('Stock data error:', err);
//     throw err;
//   }
// }

// /**
//  * Fetch staff data
//  */
// async function fetchStaffData(period) {
//   try {
//     let dateFilter = "DATE(t.created_at) = DATE(NOW())";
    
//     if (period === 'week') {
//       dateFilter = "YEARWEEK(t.created_at) = YEARWEEK(NOW())";
//     } else if (period === 'month') {
//       dateFilter = "MONTH(t.created_at) = MONTH(NOW()) AND YEAR(t.created_at) = YEAR(NOW())";
//     }

//     const [rows] = await db.query(`
//       SELECT 
//         u.name,
//         COUNT(t.id) as total_transactions,
//         SUM(t.total_price) as total_sales
//       FROM users u
//       LEFT JOIN transactions t ON u.id = t.created_by AND ${dateFilter}
//       WHERE u.role = 'kasir'
//       GROUP BY u.id, u.name
//       ORDER BY COALESCE(total_sales, 0) DESC
//     `);
    
//     return { type: 'staff', period, data: rows };
//   } catch (err) {
//     console.error('Staff data error:', err);
//     throw err;
//   }
// }
// /**
//  * STAGE 3: Response Generation with AI
//  * Generate natural language response using new SDK pattern
//  */
// async function generateNaturalResponse(userMessage, fetchedData) {
//   const contextSummary = JSON.stringify(fetchedData, null, 2);

//   const responsePrompt = `Anda sudah punya data dari database untuk pertanyaan admin:
// "${userMessage}"

// DATA YANG DITERIMA:
// ${contextSummary}

// INSTRUKSI:
// 1. Berikan jawaban dalam 2-3 kalimat singkat tapi impactful
// 2. Highlight metrik paling penting (revenue, profit, trend)
// 3. Berikan 1-2 rekomendasi aksi konkret jika relevan
// 4. Gunakan bahasa bisnis sederhana, hindari jargon teknis
// 5. Format currency dalam Rupiah (jika ada)
// 6. Total word count: max 200 words`;

//   try {
//     const response = await ai.models.generateContent({
//       model: 'gemini-2.5-flash',
//       contents: { 
//         role: 'user', 
//         parts: [{ text: SYSTEM_PROMPT + '\n\n' + responsePrompt }] 
//       }
//     });

//     const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text;
//     return responseText || 'Maaf, tidak ada response dari AI.';
//   } catch (error) {
//     console.error('Response generation error:', error);
//     return `Maaf, ada error saat memproses: ${error.message}`;
//   }
// }

// /**
//  * Main AI Chat Function - 3-Stage Pipeline
//  */
// async function processAIQuery(userMessage) {
//   try {
//     // STAGE 1: Deteksi Intent (synchronous)
//     const intentData = detectIntent(userMessage);
//     console.log('STAGE 1 - Intent:', intentData);

//     // STAGE 2: Ambil Data dari Database
//     const fetchedData = await fetchDataByIntent(intentData);
//     console.log('STAGE 2 - Data Fetched:', { ...fetchedData, raw: '[...]' });

//     // STAGE 3: Generate Natural Language Response
//     const response = await generateNaturalResponse(userMessage, fetchedData);

//     return {
//       success: true,
//       response,
//       debug: {
//         intent: intentData.type,
//         period: intentData.period,
//         dataFetched: Object.keys(fetchedData)
//       }
//     };
//   } catch (error) {
//     console.error('AI Query Error:', error);
//     return {
//       success: false,
//       response: 'Maaf, ada kesalahan saat memproses pertanyaan. Coba lagi atau rephrase.',
//       error: error.message
//     };
//   }
// }

// module.exports = { processAIQuery };


/**
 * geminiService.js — Fixed version
 *
 * Bugs fixed:
 * 1. Gemini SDK contents format → must be Array, not Object
 * 2. Model name → 'gemini-1.5-flash' (stable, widely available)
 * 3. fetchProductData date filter → join via transactions table (ti has no created_at)
 * 4. Better error logging for easier debugging
 */

const { GoogleGenAI } = require('@google/genai');
const db = require('../config/db');

if (!process.env.GEMINI_API_KEY) {
  console.error('[geminiService] ❌ GEMINI_API_KEY tidak ditemukan di .env!');
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const SYSTEM_PROMPT = `Anda adalah AI Assistant untuk Sistem POS Restaurant Kebab. 
Tugas Anda membantu Admin menganalisis data penjualan, stok, dan operasional.

=== DATABASE SCHEMA ===
users: id, name, email, role(admin|kasir), created_at
products: id, name, price, stock, category_id, created_at, image_url
categories: id, name
transactions: id, invoice_number, total_price, payment_method(cash|qris|transfer), created_by, source_user_id, created_at
transaction_items: id, transaction_id, product_id, quantity, unit_price
stock_items: id, name, price_per_unit
product_ingredients: product_id, stock_item_id, qty
stock_movements: id, stock_item_id, type(in|out), quantity, reference_id, created_at
main_stock: id, transaction_type, item_name, quantity, price_per_unit, total_cost, created_at
attendance: id, user_id, date, login_at, logout_at

=== TIPE QUERY ===
- Sales Analytics: transaksi hari ini, minggu, bulan, tahun
- Financial: revenue, profit, HPP, margin
- Product: best-sellers, slow-movers, profit per produk
- Stock: stok rendah, reorder needed
- Staff: attendance, penjualan per kasir

=== RESPONSE STRATEGY ===
1. Analisis singkat tapi insightful (2-3 kalimat)
2. Data penting dalam format yang jelas
3. Rekomendasi aksi jika ada
4. Bahasa bisnis sederhana, currency dalam Rupiah`;

/* ─── Intent Detection ──────────────────────────────────────────────── */

function detectIntent(userMessage) {
  const lower = userMessage.toLowerCase();

  if (lower.match(/penjualan|revenue|omset|pendapatan|terjual|transaksi|berapa.*jual/i)) {
    return { type: 'sales', period: extractPeriod(lower) };
  }
  if (lower.match(/keuntungan|profit|hpp|biaya|margin|untung|rugi|laba|modal/i)) {
    return { type: 'financial', period: extractPeriod(lower) };
  }
  if (lower.match(/produk|menu|best selling|laris|favorit|terlaris|paling laku/i)) {
    return { type: 'product', period: extractPeriod(lower) };
  }
  if (lower.match(/stok|persediaan|bahan|ingredient|habis|reorder|supply/i)) {
    return { type: 'stock', period: 'today' };
  }
  if (lower.match(/kasir|karyawan|staff|tim|absensi|attendance/i)) {
    return { type: 'staff', period: extractPeriod(lower) };
  }

  return { type: 'general', period: 'today' };
}

function extractPeriod(message) {
  if (message.match(/hari ini|today|harian/i))  return 'today';
  if (message.match(/minggu ini|minggu|week/i)) return 'week';
  if (message.match(/bulan ini|bulan|month/i))  return 'month';
  if (message.match(/tahun ini|tahun|year/i))   return 'year';
  return 'today';
}

/* ─── Date Filter Helper ────────────────────────────────────────────── */

function buildDateFilter(tableAlias, period) {
  const col = `${tableAlias}.created_at`;
  switch (period) {
    case 'week':  return `YEARWEEK(${col}) = YEARWEEK(NOW())`;
    case 'month': return `MONTH(${col}) = MONTH(NOW()) AND YEAR(${col}) = YEAR(NOW())`;
    case 'year':  return `YEAR(${col}) = YEAR(NOW())`;
    default:      return `DATE(${col}) = CURDATE()`;
  }
}

/* ─── Database Fetchers ─────────────────────────────────────────────── */

async function fetchSalesData(period) {
  const filter = buildDateFilter('t', period);
  const [rows] = await db.query(`
    SELECT
      COUNT(*)                        AS total_transactions,
      COALESCE(SUM(t.total_price), 0) AS total_revenue,
      COALESCE(AVG(t.total_price), 0) AS avg_transaction,
      COUNT(DISTINCT t.created_by)    AS unique_cashiers
    FROM transactions t
    WHERE ${filter}
  `);
  return { type: 'sales', period, data: rows[0] ?? {} };
}

async function fetchFinancialData(period) {
  const filter = buildDateFilter('t', period);
  const [rows] = await db.query(`
    SELECT
      COALESCE(SUM(t.total_price), 0)                                        AS gross_revenue,
      COALESCE(SUM(m.total_cost), 0)                                         AS total_cost,
      COALESCE(SUM(t.total_price), 0) - COALESCE(SUM(m.total_cost), 0)      AS profit,
      ROUND(
        CASE WHEN SUM(t.total_price) > 0
          THEN ((SUM(t.total_price) - COALESCE(SUM(m.total_cost), 0)) / SUM(t.total_price)) * 100
          ELSE 0
        END, 2
      ) AS profit_margin
    FROM transactions t
    LEFT JOIN main_stock m ON DATE(m.created_at) = DATE(t.created_at)
    WHERE ${filter}
  `);
  return { type: 'financial', period, data: rows[0] ?? {} };
}

async function fetchProductData(period) {
  // ✅ FIX: transaction_items tidak punya created_at
  //    → filter tanggal via JOIN ke tabel transactions
  const filter = buildDateFilter('t', period);
  const [rows] = await db.query(`
    SELECT
      p.name,
      COUNT(ti.id)                      AS total_sold,
      SUM(ti.quantity)                  AS total_quantity,
      SUM(ti.quantity * ti.unit_price)  AS revenue
    FROM transaction_items ti
    JOIN transactions t ON ti.transaction_id = t.id
    JOIN products p     ON ti.product_id     = p.id
    WHERE ${filter}
    GROUP BY p.id, p.name
    ORDER BY total_quantity DESC
    LIMIT 10
  `);
  return { type: 'product', period, data: rows };
}

async function fetchStockData() {
  const [rows] = await db.query(`
    SELECT
      id,
      name,
      stock,
      CASE
        WHEN stock < 10 THEN 'CRITICAL'
        WHEN stock < 20 THEN 'LOW'
        ELSE 'OK'
      END AS status
    FROM products
    ORDER BY stock ASC
    LIMIT 15
  `);
  return { type: 'stock', data: rows };
}

async function fetchStaffData(period) {
  const filter = buildDateFilter('t', period);
  const [rows] = await db.query(`
    SELECT
      u.name,
      COUNT(t.id)                     AS total_transactions,
      COALESCE(SUM(t.total_price), 0) AS total_sales
    FROM users u
    LEFT JOIN transactions t ON u.id = t.created_by AND ${filter}
    WHERE u.role = 'kasir'
    GROUP BY u.id, u.name
    ORDER BY total_sales DESC
  `);
  return { type: 'staff', period, data: rows };
}

async function fetchGeneralSummary() {
  const [rows] = await db.query(`
    SELECT
      COALESCE(SUM(total_price), 0) AS revenue_today,
      COUNT(*)                       AS transactions_today
    FROM transactions
    WHERE DATE(created_at) = CURDATE()
  `);
  return { type: 'general', data: rows[0] ?? {} };
}

async function fetchDataByIntent(intent) {
  try {
    switch (intent.type) {
      case 'sales':     return await fetchSalesData(intent.period);
      case 'financial': return await fetchFinancialData(intent.period);
      case 'product':   return await fetchProductData(intent.period);
      case 'stock':     return await fetchStockData();
      case 'staff':     return await fetchStaffData(intent.period);
      default:          return await fetchGeneralSummary();
    }
  } catch (err) {
    console.error('[geminiService] DB fetch error:', err.message);
    return { type: intent.type, error: err.message, data: [] };
  }
}

/* ─── Gemini Call ───────────────────────────────────────────────────── */

async function generateNaturalResponse(userMessage, fetchedData) {
  const contextSummary = JSON.stringify(fetchedData, null, 2);

  const prompt = `${SYSTEM_PROMPT}

---
PERTANYAAN ADMIN: "${userMessage}"

DATA DARI DATABASE:
${contextSummary}

INSTRUKSI RESPONS:
1. Jawab dalam 2-3 kalimat singkat tapi impactful
2. Highlight metrik paling penting (revenue, profit, trend)
3. Berikan 1-2 rekomendasi aksi konkret jika relevan
4. Gunakan bahasa bisnis sederhana
5. Format currency dalam Rupiah (Rp X.XXX.XXX)
6. Jika data kosong/error, berikan saran umum yang berguna
7. Max 200 kata`;

  // ✅ FIX: contents WAJIB berupa Array
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
      
    ],
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response');
  return text;
}

/* ─── Main Export ───────────────────────────────────────────────────── */

async function processAIQuery(userMessage) {
  try {
    const intentData = detectIntent(userMessage);
    console.log('[AI] Stage 1 - Intent:', intentData);

    const fetchedData = await fetchDataByIntent(intentData);
    console.log('[AI] Stage 2 - Data type:', fetchedData.type,
      '| rows:', Array.isArray(fetchedData.data) ? fetchedData.data.length : 1);

    const response = await generateNaturalResponse(userMessage, fetchedData);
    console.log('[AI] Stage 3 - Response generated ✅');

    return {
      success: true,
      response,
      debug: {
        intent: intentData.type,
        period: intentData.period,
        dataKeys: Object.keys(fetchedData),
      },
    };
  } catch (error) {
    console.error('[AI] processAIQuery error:', error.message);
    return {
      success: false,
      response: 'Maaf, ada kesalahan saat memproses pertanyaan. Coba lagi.',
      error: error.message,
    };
  }
}

module.exports = { processAIQuery };