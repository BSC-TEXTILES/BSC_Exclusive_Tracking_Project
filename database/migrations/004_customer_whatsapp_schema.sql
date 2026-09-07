-- ============================================================
-- Migration 004 — Customer portal & WhatsApp schema
-- Adds tables/columns used by chat, whatsapp, search and the
-- admin customer-management features.
-- ============================================================

-- 1. Users: account type + customer link + ban/restriction fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) NOT NULL DEFAULT 'BSC_USER';
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_code VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS restriction_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS restricted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_account_type ON users(account_type);
CREATE INDEX IF NOT EXISTS idx_users_customer_code ON users(customer_code);

-- 2. Customers directory
CREATE TABLE IF NOT EXISTS customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code   VARCHAR(50) NOT NULL UNIQUE,
  name            VARCHAR(200) NOT NULL,
  contact_person  VARCHAR(150),
  email           VARCHAR(150),
  phone           VARCHAR(30),
  whatsapp_number VARCHAR(20),
  address         TEXT,
  city            VARCHAR(100),
  state           VARCHAR(100),
  pincode         VARCHAR(10),
  status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_user ON customers(user_id);

-- 3. WhatsApp contacts
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(200) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  contact_type VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER',
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_id  UUID REFERENCES customers(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_phone ON whatsapp_contacts(phone_number);

-- 4. WhatsApp messages (sent via wa.me integration)
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_number VARCHAR(20) NOT NULL,
  recipient_name   VARCHAR(150),
  recipient_type   VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER',
  template_name    VARCHAR(100),
  message_content  TEXT NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'SENT',
  sent_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  contact_id       UUID REFERENCES whatsapp_contacts(id) ON DELETE SET NULL,
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_id      UUID REFERENCES customers(id) ON DELETE SET NULL,
  delivered_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON whatsapp_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON whatsapp_messages(status);

-- 5. Checkpoints: code + category
ALTER TABLE checkpoints ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE checkpoints ADD COLUMN IF NOT EXISTS category VARCHAR(100);
UPDATE checkpoints SET category = 'Quality' WHERE category IS NULL;

-- 6. Modules: title + code + category (backfilled from existing data)
ALTER TABLE modules ADD COLUMN IF NOT EXISTS title VARCHAR(150);
ALTER TABLE modules ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE modules ADD COLUMN IF NOT EXISTS category VARCHAR(100);
UPDATE modules SET title = name, code = slug, category = 'Process' WHERE title IS NULL;
