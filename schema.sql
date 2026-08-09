
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'Starter',
  active INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'customer',
  payment_method TEXT DEFAULT 'Bank transfer / IBAN',
  iban TEXT DEFAULT '',
  bank_name TEXT DEFAULT '',
  payment_status TEXT NOT NULL DEFAULT 'UNPAID',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
