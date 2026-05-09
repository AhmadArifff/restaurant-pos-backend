const mysql = require('mysql2/promise');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const isFresh = process.argv.includes('--fresh');

  // Koneksi TANPA nama database dulu (untuk buat DB kalau belum ada)
  const rootConn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  // Buat database jika belum ada
  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
  console.log(`✅ Database '${process.env.DB_NAME}' siap`);

  if (isFresh) {
    await rootConn.query(`DROP DATABASE \`${process.env.DB_NAME}\``);
    await rootConn.query(`CREATE DATABASE \`${process.env.DB_NAME}\``);
    console.log(`🔄 Fresh migration — database di-reset`);
  }

  await rootConn.end();

  // Koneksi ulang dengan database yang sudah dibuat
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  // Ambil semua file migrasi, urutkan by nomor
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort();

  console.log(`\n📦 Menjalankan ${files.length} migrasi...\n`);

  for (const file of files) {
    const migration = require(path.join(migrationsDir, file));
    try {
      await migration.up(db);
      console.log(`  ✅ ${file}`);
    } catch (err) {
      console.error(`  ❌ ${file} — ${err.message}`);
      await db.end();
      process.exit(1);
    }
  }

  // Jalankan seeder default
  await runSeeders(db);

  await db.end();
  console.log('\n🚀 Migrasi selesai! Backend siap digunakan.\n');
}

async function runSeeders(db) {
  console.log('\n🌱 Menjalankan seeders...\n');

  // Cek apakah admin sudah ada
  const [admins] = await db.query("SELECT id FROM users WHERE email = 'admin@kebab.com'");
  if (!admins.length) {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('admin123', 10);
    await db.query(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')",
      ['Admin', 'admin@kebab.com', hash]
    );
    console.log('  ✅ User admin default dibuat (admin@kebab.com / admin123)');
  } else {
    console.log('  ⏭️  User admin sudah ada, dilewati');
  }

  const [cats] = await db.query('SELECT id FROM categories');
  if (!cats.length) {
    await db.query("INSERT INTO categories (name) VALUES ('Kebab'), ('Minuman'), ('Snack')");
    console.log('  ✅ Kategori default dibuat');
  } else {
    console.log('  ⏭️  Kategori sudah ada, dilewati');
  }
}

runMigrations().catch(err => {
  console.error('❌ Migrasi gagal:', err.message);
  process.exit(1);
});