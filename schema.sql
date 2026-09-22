
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
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'ISSUED',
  issue_date TEXT NOT NULL DEFAULT (date('now')),
  due_date TEXT NOT NULL,
  email_sent_at TEXT DEFAULT NULL,
  email_provider_id TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);

CREATE TABLE IF NOT EXISTS leads (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, company TEXT DEFAULT '', email TEXT NOT NULL, phone TEXT DEFAULT '', plan TEXT DEFAULT '', message TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);

CREATE TABLE IF NOT EXISTS bot_configs (bot_key TEXT PRIMARY KEY, name TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, greeting TEXT NOT NULL DEFAULT '', instructions TEXT NOT NULL DEFAULT '', reply_question TEXT NOT NULL DEFAULT '', reply_reservation TEXT NOT NULL DEFAULT '', reply_service TEXT NOT NULL DEFAULT '', reply_integrations TEXT NOT NULL DEFAULT '', reply_plans TEXT NOT NULL DEFAULT '', reply_partner TEXT NOT NULL DEFAULT '', reply_help TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT (datetime('now')));
