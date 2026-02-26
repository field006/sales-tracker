import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DATABASE_URL || path.join(__dirname, '..', 'receipts.db')

const db = new Database(dbPath)

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    restaurant_name TEXT NOT NULL,
    date TEXT NOT NULL,
    tax REAL DEFAULT 0,
    service_charge REAL DEFAULT 0,
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS receipt_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_id INTEGER NOT NULL,
    category TEXT DEFAULT 'Uncategorized',
    name TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    price REAL NOT NULL,
    FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, name)
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category_id INTEGER,
    name TEXT NOT NULL,
    default_price REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    UNIQUE(user_id, name)
  );
`)

// Handle migration for users/receipts
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get()

if (userCount.count === 0) {
  console.log('Seeding default admin user...')
  const insertDefault = db.prepare(`
    INSERT INTO users (id, username, password_hash) 
    VALUES (1, 'admin', ?)
  `)
  insertDefault.run(bcrypt.hashSync('password123', 10))

  const receiptCount = db.prepare('SELECT COUNT(*) as count FROM receipts').get()
  if (receiptCount.count > 0) {
    console.log('Migrating existing receipts to admin user...')
    try {
      db.exec('ALTER TABLE receipts ADD COLUMN user_id INTEGER DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE')
    } catch (err) {
      // Column might already exist
    }
  }
} else {
  // Check if admin exists
  const adminExists = db.prepare("SELECT id FROM users WHERE username = 'admin'").get()
  if (!adminExists) {
    // Check if the old dummy user exists
    const dummyExists = db.prepare("SELECT id FROM users WHERE username = 'default_migrated_user'").get()
    if (dummyExists) {
      console.log('Upgrading default dummy user to admin...')
      db.prepare(`UPDATE users SET username = 'admin', password_hash = ? WHERE id = ?`).run(bcrypt.hashSync('password123', 10), dummyExists.id)
    } else {
      console.log('Seeding default admin user...')
      db.prepare(`INSERT INTO users (username, password_hash) VALUES ('admin', ?)`).run(bcrypt.hashSync('password123', 10))
    }
  }

  // Ensure the column exists on subsequent reloads
  try {
    db.exec('ALTER TABLE receipts ADD COLUMN user_id INTEGER DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE')
  } catch (err) {
    // Column already exists
  }
}

// Ensure category column exists in receipt_items (from previous brainstorming)
try {
  db.exec("ALTER TABLE receipt_items ADD COLUMN category TEXT DEFAULT 'Uncategorized'")
} catch (err) {
  // Column already exists
}

export default db
