# GeeLark Flows — Privacy & Data Processing Map

> **Document Version**: 1.2.0 (Security-Hardened Baseline)
> **Last Updated**: 2026-09-02
> **Applicability**: Public Storefront, Checkout Engine, Custom Requests, Inbound/Outbound Email, and Admin Operations.

---

## 1. Overview & Data Philosophy

This document maps all personal and operational data processed by GeeLark Flows based strictly on the verified production codebase (`src/worker.js`, `schema.sql`, `src/App.jsx`, `src/pages/CheckoutPage.jsx`, and `src/context/CartContext.jsx`).

- **No Third-Party Ad Trackers or Marketing Pixels**: GeeLark Flows does not load third-party marketing SDKs, tracking pixels, or cross-site behavioral analytics.
- **Client-Side Telemetry Minimization**: User agents and IP addresses are not retained for public storefront browsing.
- **Strict Server Authoritative Processing**: Financial and workflow calculations are executed server-side.

---

## 2. Comprehensive Data Inventory by Category

### A. Checkout & Orders (`orders`, `crypto_payments`)

| Data Field | Purpose | Source | Storage System | External Processor | Retention Status | Customer Disclosure | Owner Decision Needed |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Customer Email** (`customer_email`) | Order confirmation, fulfillment dispatch, customer support matching | Customer input at `/checkout` | Cloudflare D1 (`orders`) | Resend (outbound email delivery) | Undefined in code (persists until manual DB purge) | **Required** (Core contract fulfillment) | Define standard operational retention duration (e.g. 7 years for tax/accounting vs 2 years). |
| **Pseudonymous Checkout IP Hash** (`api_rate_limits.key`) | Limits invoice creation to 10 attempts per 15 minutes per Cloudflare client IP | SHA-256 hash of `cf-connecting-ip`; raw public customer IP is not stored | Cloudflare D1 (`api_rate_limits`) | None | Rate-limit row persists until operational cleanup | **Required** (Security / anti-abuse) | Define cleanup schedule for expired rate-limit rows. |
| **Order ID** (`id`, format `ord_...`) | Order identification and fulfillment tracking | Server-generated (`crypto.getRandomValues`) | Cloudflare D1 (`orders`, `crypto_payments`) | NOWPayments, Resend | Retained with order record | **Required** | None (operational identifier). |
| **Workflow Selections & Quantities** (`items`) | Contract scope, packaging, delivery | Server-resolved catalog snapshot from cart | Cloudflare D1 (`orders.items` JSON) | None | Retained with order record | **Required** | None. |
| **Workflow Subtotal, Setup Fee, Total USD** | Authoritative accounting and pricing verification | Server calculation | Cloudflare D1 (`orders`) | NOWPayments (invoice USD total) | Retained with order record | **Required** | None. |
| **Delivery Method** (`delivery_method`) | Workflow packaging (`download_package`) vs account provisioning (`geelark_setup`) | Customer selection at `/checkout` | Cloudflare D1 (`orders`) | None | Retained with order record | **Required** | None. |
| **Payment Network** (`currency`) | Crypto blockchain routing (`trc20`, `erc20`, `bep20`, `sol`) | Customer selection | Cloudflare D1 (`crypto_payments`) | NOWPayments | Retained with payment record | **Required** | None. |
| **Receiving Address & Amount Crypto** (`pay_address`, `pay_amount_crypto`) | Unique payment routing per order | NOWPayments API invoice creation | Cloudflare D1 (`crypto_payments`) | NOWPayments | Retained with payment record | **Required** | None. |
| **Blockchain Transaction Hash** (`tx_hash`) | Settlement verification and proof of payment | NOWPayments IPN webhook / blockchain verification | Cloudflare D1 (`crypto_payments`) | NOWPayments | Retained with payment record | **Required** | None. |
| **Order & Fulfillment Status** (`status`, `fulfillment_status`, `fulfillment_notes`) | Lifecycle state machine tracking | Server state machine transitions & Admin actions | Cloudflare D1 (`orders`) | None | Retained with order record | **Required** | None. |
| **Checkout Status Token Hash** (`status_token_hash`) | Authorizes private customer status checks without exposing email | Server-generated 256-bit token; SHA-256 hash stored | Cloudflare D1 (`orders`) | None | Retained with order record; raw token remains only in customer browser | **Required** | None. |
| **Download Token Hash** (`order_download_tokens.token_hash`) | Authorizes seven-day per-order R2 downloads | Server-generated 256-bit token; SHA-256 hash stored | Cloudflare D1 | Cloudflare R2 receives the authorized object request | Expires after seven days; may be revoked on re-delivery | **Required** | Define cleanup schedule for expired token rows. |

---

### B. Custom Automation Requests (`custom_automation_requests`)

| Data Field | Purpose | Source | Storage System | External Processor | Retention Status | Customer Disclosure | Owner Decision Needed |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Customer Name** (`customer_name`) | Lead identification and addressing customer | Customer input in modal | Cloudflare D1 (`custom_automation_requests`) | Resend (internal alert) | Persists in D1 until deleted | **Required** | Define lead retention window (e.g. 1 year vs 3 years). |
| **Customer Email** (`customer_email`) | Communicating project scope and quote delivery | Customer input in modal | Cloudflare D1 (`custom_automation_requests`) | Resend (internal alert) | Persists in D1 until deleted | **Required** | Define lead retention window. |
| **Request Type** (`request_type`) | Scoping service category (`flow` or `consulting`) | Customer selection | Cloudflare D1 (`custom_automation_requests`) | Resend (internal alert) | Persists in D1 | **Required** | None. |
| **Project Requirements** (`details`) | Custom engineering requirements | Customer input in modal | Cloudflare D1 (`custom_automation_requests`) | Resend (internal alert) | Persists in D1 | **Required** | Clarify customer confidentiality terms. |
| **Pseudonymous IP Hash** (`ip_hash`) | Rate limiting (max 5 requests / 15 min per IP); stored as 32-char SHA-256 hash slice (`(sha256Hex(clientIp)).slice(0, 32)`). **Note: This is pseudonymous data, NOT anonymous data.** | Hashed `cf-connecting-ip` | Cloudflare D1 (`custom_automation_requests`) | None | Persists with lead record | **Required** | Define whether old IP hashes should be rotated/cleared. |
| **Notification Status & Error** (`internal_notification_status`, `internal_notification_error`) | Reliability monitoring for internal alert dispatch | Server alert handler | Cloudflare D1 (`custom_automation_requests`) | None (sanitized error message) | Persists with lead record | Internal operational | None. |

---

### C. Customer Support & Inbound Email (`inbound_emails`, `email_attachments`)

| Data Field | Purpose | Source | Storage System | External Processor | Retention Status | Customer Disclosure | Owner Decision Needed |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Sender Email & Name** (`from_address`, `from_name`) | Inbound support email correspondence | Inbound email headers via Resend webhook | Cloudflare D1 (`inbound_emails`) | Resend | Persists in D1 | **Required** | Define email retention policy. |
| **Subject, Text Body, HTML Body** | Customer inquiries, setup assistance, order matching | Inbound email payload | Cloudflare D1 (`inbound_emails`) | Resend | Persists in D1 | **Required** | Define email retention policy. |
| **Email Message IDs & References** (`provider_email_id`, `message_id`, `in_reply_to`) | Webhook deduplication and conversation threading | Email RFC headers | Cloudflare D1 (`inbound_emails`) | Resend | Persists in D1 | Technical operational | None. |
| **Attachment Metadata & Provider Reference** (`filename`, `size_bytes`, `storage_reference`) | Processing customer-submitted logs or screenshots | Inbound email attachments | Cloudflare D1; content remains with Resend | Resend | Persists until provider expiry or record deletion | **Required** | Define attachment deletion policy (e.g. purge after 90 days). Admin downloads are authenticated and proxied; raw provider references are not returned to the browser. |

---

### D. Administrative & Security Systems (`admin_users`, `admin_sessions`, `audit_logs`, `login_rate_limits`)

| Data Field | Purpose | Source | Storage System | External Processor | Retention Status | Customer Disclosure | Owner Decision Needed |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin Identity** (`email`, `name`, `role`) | Operator authentication & RBAC | Seeded/provisioned by owner | Cloudflare D1 (`admin_users`) | None | Retained until admin removal | Internal | None. |
| **Password Verifier** (`password_hash`) | Admin authentication | PBKDF2-SHA256 (100k iterations, random salt; malformed or runtime-incompatible hashes are rejected) | Cloudflare D1 (`admin_users`) | None | Retained with user | Internal | None. |
| **Admin Sessions** (`token_hash`, `user_agent`, `ip_address`) | Session authentication & security monitoring. **Stores raw administrator IP and user-agent.** | Admin login request | Cloudflare D1 (`admin_sessions`) | None | Auto-expires in 12 hours (`expires_at`) | Internal | None. |
| **Audit Logs** (`actor_admin_email`, `actor_ip`, `actor_user_agent`, `action`, `previous_state`, `new_state`) | Append-only traceability of administrative mutations. **Stores raw administrator IP and user-agent.** | Server audit handler | Cloudflare D1 (`audit_logs`) | None | Permanent append-only | Internal | None. |
| **Login Rate Limits** (`key`, `attempts`, `locked_until`) | Brute force defense (locks after 5 failures) | Server rate limiter | Cloudflare D1 (`login_rate_limits`) | None | Overwritten / ephemeral | Internal | None. |

### E. First-Party Storefront Analytics (`storefront_analytics_events`)

| Data Field | Purpose | Source | Storage System | External Processor | Retention Status | Customer Disclosure | Owner Decision Needed |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Anonymous Visitor & Session Hashes** (`visitor_hash`, `session_hash`) | Approximate unique visitor and session measurement | Random first-party browser identifiers, irreversibly hashed before storage | Cloudflare D1 | Cloudflare | Rolling 90 days | Privacy Policy §2 | None. Browser storage clearing can create a new anonymous visitor. |
| **Storefront Events** (`event_type`, `product_id`, `page_path`, `referrer_host`) | Page-view, flow-interest, cart-intent, and traffic-source reporting | Storefront interactions; the original document referrer is reduced in-browser to its hostname (or `Direct` / `Internal`) and retained for the browser session | Cloudflare D1 | Cloudflare | Rolling 90 days | Privacy Policy §2–3 | Full referring URLs, paths, and query strings are not sent or stored. |
| **Coarse Technical Context** (`ip_network`, `ip_hash`, `country_code`, `region`, `city`, `device_type`, `browser_family`, `os_family`) | Abuse controls and aggregate audience context | Cloudflare request metadata and generalized user-agent classification | Cloudflare D1 | Cloudflare | Rolling 90 days | Privacy Policy §2 | Raw visitor IP and full user-agent strings are not stored. GPC/DNT disables collection. |
| **Last-Known Cart State** (`product_ids_json`, `item_count`, `cart_value_cents`, `updated_at`) | Distinguish active carts from historical add-to-cart actions and measure cart value | Product identifiers from the functional browser cart; value recalculated from the server catalog | Cloudflare D1 (`storefront_cart_state`) | Cloudflare | Rolling 90 days | Privacy Policy §2 | No email or direct identity is attached. GPC/DNT disables collection; cleared carts are retained with zero items until expiry. |

### F. In-Site Notifications (`storefront_notifications`, `storefront_notification_receipts`)

| Data Field | Purpose | Source | Storage System | External Processor | Retention Status | Customer Disclosure | Owner Decision Needed |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Campaign Content & Target** (`title`, `message`, `audience_type`, `product_id`, `coupon_id`) | Publish a first-party bell notification to all visitors or an anonymous cart segment | Administrator-created campaign | Cloudflare D1 | Cloudflare | Retained until operational deletion | Privacy Policy §2–3 | Deactivate a campaign to stop delivery; creation and activation changes are audited. |
| **Pseudonymous Delivery State** (`visitor_hash`, `delivered_at`, `read_at`, `dismissed_at`) | Maintain unread badges, prevent dismissed messages from returning, and report aggregate delivery/read counts | Random first-party visitor ID, hashed before storage | Cloudflare D1 | Cloudflare | Rolling 90 days | Privacy Policy §2 and §5 | No customer email or direct identity is attached. GPC/DNT disables the feed and targeting. |
| **Opt-In Push Subscription** (`endpoint`, `p256dh_key`, `auth_key`, `visitor_hash`) | Deliver user-visible browser notifications when the site is closed | Browser Push API after explicit visitor permission | Cloudflare D1 (`storefront_push_subscriptions`) | Browser or operating-system push service | Active until unsubscribe or expiry; revoked record deleted after 90 days | Privacy Policy §2 and §5 | Endpoint is restricted to recognized browser push-service hosts; no email is attached. GPC/DNT disables enrollment. |
| **Push Delivery Result** (`notification_id`, `subscription_id`, `status`, `response_status`) | Prevent duplicate sends and report aggregate delivery outcomes | Server delivery attempt | Cloudflare D1 (`storefront_push_deliveries`) | Browser or operating-system push service | Rolling 90 days | Privacy Policy §2 and §5 | Error text is generic and does not store subscription credentials. |

---

### G. Browser Storage (Client-Side Persistence)

| Storage Key | Type | Data Stored | Purpose | Lifecycle / Expiration | Customer Disclosure | Owner Decision Needed |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `geelark_cart_items` | `localStorage` | Array of item objects (`id`, `title`, `price`, `quantity`, `platform`) | Preserves customer cart contents between page navigations and refreshes | Persists until customer removes items, clears cart, or clears browser storage | **Required** (Functional / essential storage) | None. |
| `geelark_active_payment` | `localStorage` | Active order snapshot (`orderId`, `paymentId`, private `statusToken`, `payAddress`, `currency`, `totalUsd`, `status`) | Keeps the private payment screen and locally generated QR code accessible after refresh | Cleared on return to marketplace or order dismissal | **Required** (Functional / essential storage) | None. |
| `geelark_pending_coupon` | `localStorage` | Coupon code selected from an in-site notification | Carries the selected offer to checkout for one automatic validation attempt | Removed immediately when checkout reads it | Privacy Policy §2 | None. |
| `geelark_push_sync_at` | `localStorage` | Timestamp of the last successful push-subscription synchronization | Limits background subscription refreshes to once per day | Persists until browser alerts are turned off or browser storage is cleared | Privacy Policy §2 | No endpoint or push keys are stored in this value. |
| `gf_admin_session` | `Cookie` (`HttpOnly`, `Path=/`, `SameSite=Strict`, `Max-Age=43200`, `Secure` on HTTPS) | 32-byte cryptographically random token | Admin authentication for `/admin` management panel | 12 hours | Internal (Admin only) | None. |

---

### H. Infrastructure & Subprocessors

| Processor / Entity | Purpose | Data Transferred | Data Processing Location | Privacy Terms / Agreements |
| :--- | :--- | :--- | :--- | :--- |
| **Cloudflare, Inc.** | Edge compute (Workers), database (D1), static asset hosting (Assets), and asset storage (R2) | Incoming HTTP requests, customer emails, order records, D1 database records | Global Edge Network (Edge nodes & regional D1 storage) | Cloudflare Standard Customer Agreement & DPA |
| **NOWPayments** | Cryptocurrency invoice generation, exchange rate resolution, and IPN payment webhooks | Order total (USD), requested cryptocurrency/network, generated payment address, transaction hash | Third-party payment gateway | NOWPayments Terms of Service & Privacy Policy |
| **Resend, Inc.** | Transactional outbound fulfillment emails and inbound customer email receiving (Svix webhooks) | Customer email address, order details, inbound email subjects, message bodies, attachments | Cloud email delivery infrastructure | Resend Customer Agreement & Privacy Policy |
| **Browser / OS Push Service** | Encrypted browser-push routing after explicit opt-in | Push endpoint plus encrypted notification payload | Vendor-operated push infrastructure selected by the visitor's browser | Applicable browser or operating-system vendor privacy terms |

---

## 3. Data Processing Summary for Policy Drafting

1. **Lawful Basis for Processing**:
   - **Contract Performance**: Processing customer email, order details, and crypto payment parameters to deliver purchased workflows or coordinate account setup.
   - **Legitimate Interests**: Retaining system audit logs, enforcing anti-abuse rate limits on custom requests, and logging inbound support threads.
   - **Legal Compliance**: Retaining financial transaction records for tax, accounting, and anti-fraud verification.
2. **Zero Third-Party Advertising / Data Selling**: Personal data is processed solely for service delivery and operational support; data is not rented, sold, or shared with advertising brokers.
3. **Operational Retention Follow-ups**:
   - Set internal cleanup schedules for expired rate-limit rows and download tokens, completed orders, closed custom-request leads, and archived support mail, while preserving records required for accounting, fraud prevention, disputes, or law.
   - Privacy requests use the approved public address, `support@geelarkflows.com`.
