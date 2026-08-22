-- Migration: Inbound Customer Emails and Attachments
CREATE TABLE IF NOT EXISTS inbound_emails (
  id TEXT PRIMARY KEY,
  provider_email_id TEXT UNIQUE NOT NULL,
  message_id TEXT,
  in_reply_to TEXT,
  references_header TEXT,
  from_address TEXT NOT NULL,
  from_name TEXT,
  to_addresses TEXT NOT NULL,
  cc_addresses TEXT,
  reply_to TEXT,
  subject TEXT NOT NULL,
  text_body TEXT,
  html_body TEXT,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_read INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  order_id TEXT,
  customer_email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS email_attachments (
  id TEXT PRIMARY KEY,
  inbound_email_id TEXT NOT NULL,
  provider_attachment_id TEXT,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  storage_reference TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inbound_email_id) REFERENCES inbound_emails(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inbound_emails_received_at ON inbound_emails(received_at);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_is_read ON inbound_emails(is_read);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_is_archived ON inbound_emails(is_archived);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_from_address ON inbound_emails(from_address);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_order_id ON inbound_emails(order_id);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_customer ON inbound_emails(customer_email);
CREATE INDEX IF NOT EXISTS idx_email_attachments_email_id ON email_attachments(inbound_email_id);
