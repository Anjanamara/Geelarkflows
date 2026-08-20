-- Migration: Custom Automation Requests (Inbound Leads)
-- Safe, additive migration for GeeLark Flows production D1

CREATE TABLE IF NOT EXISTS custom_automation_requests (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  request_type TEXT NOT NULL DEFAULT 'flow',
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  ip_hash TEXT,
  internal_notification_status TEXT NOT NULL DEFAULT 'pending',
  internal_notification_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_custom_requests_created_at ON custom_automation_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_custom_requests_email ON custom_automation_requests(customer_email);
CREATE INDEX IF NOT EXISTS idx_custom_requests_status ON custom_automation_requests(status);
CREATE INDEX IF NOT EXISTS idx_custom_requests_ip_hash ON custom_automation_requests(ip_hash);
