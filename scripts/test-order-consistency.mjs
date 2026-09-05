import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deriveOrderStateFromPayment } from '../src/worker.js';
import { toAdminDate } from '../src/admin/dateUtils.js';

const derive = (orderStatus, paymentStatus, fulfillmentStatus = 'not_ready', deliveryMethod = 'download_package') => (
  deriveOrderStateFromPayment({ orderStatus, paymentStatus, fulfillmentStatus, deliveryMethod })
);

assert.deepEqual(
  derive('failed', 'waiting'),
  { orderStatus: 'awaiting_payment', fulfillmentStatus: 'not_ready', changed: true },
  'an active gateway invoice must recover a false/manual failed order',
);

assert.equal(
  toAdminDate('2026-09-02 04:08:11')?.toISOString(),
  '2026-09-02T04:08:11.000Z',
  'timezone-less D1 timestamps must be interpreted as UTC',
);
assert.equal(
  toAdminDate('2026-09-02T04:08:11.000Z')?.toISOString(),
  '2026-09-02T04:08:11.000Z',
  'timezone-aware ISO timestamps must not be modified',
);

assert.deepEqual(
  derive('awaiting_payment', 'confirmed'),
  { orderStatus: 'paid', fulfillmentStatus: 'fulfillment_pending', changed: true },
  'confirmed payment must unlock downloadable fulfillment',
);

assert.deepEqual(
  derive('awaiting_payment', 'finished', 'not_ready', 'geelark_setup'),
  { orderStatus: 'paid', fulfillmentStatus: 'setup_pending', changed: true },
  'confirmed payment must unlock setup fulfillment',
);

assert.deepEqual(
  derive('completed', 'confirmed', 'package_delivered'),
  { orderStatus: 'completed', fulfillmentStatus: 'package_delivered', changed: false },
  'duplicate callbacks must not regress a completed order or delivered package',
);

assert.deepEqual(
  derive('processing', 'expired', 'package_preparing'),
  { orderStatus: 'processing', fulfillmentStatus: 'package_preparing', changed: false },
  'a late expiry must not regress an already-paid order',
);

assert.deepEqual(
  derive('awaiting_payment', 'expired'),
  { orderStatus: 'failed', fulfillmentStatus: 'not_ready', changed: true },
  'an expired unpaid invoice must fail the order',
);

assert.deepEqual(
  derive('cancelled', 'paid'),
  { orderStatus: 'paid', fulfillmentStatus: 'fulfillment_pending', changed: true },
  'money received after cancellation must surface as paid rather than be abandoned',
);

assert.deepEqual(
  derive('refunded', 'confirmed', 'package_delivered'),
  { orderStatus: 'refunded', fulfillmentStatus: 'package_delivered', changed: false },
  'duplicate confirmation must not undo a recorded refund',
);

const workerSource = fs.readFileSync('src/worker.js', 'utf8');
const detailSource = fs.readFileSync('src/admin/pages/AdminOrderDetail.jsx', 'utf8');

assert.match(workerSource, /awaiting_payment:\s*\['cancelled'\]/, 'generic admin transitions must not settle or fail payments');
assert.match(workerSource, /Fulfillment is locked while order status/, 'server must lock fulfillment on inconsistent/unpaid orders');
assert.match(workerSource, /ORDER_STATUS_RECONCILED/, 'gateway reconciliation must be audit logged');
assert.match(detailSource, /Invoice Total \(Unpaid\)/, 'unpaid invoices must not be labeled as paid');
assert.match(detailSource, /Status mismatch:/, 'admin detail must visibly flag cross-record mismatches');
assert.match(detailSource, /Locked until both records confirm settlement/, 'admin fulfillment controls must explain their lock');

console.log('Order/payment consistency and fulfillment lock tests passed.');
