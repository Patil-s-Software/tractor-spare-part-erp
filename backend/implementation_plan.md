# Plan Artifact — Modules 8–12 (Payments, Invoices, Reports, Notifications, Audit Logs)

> **Review this plan and click Proceed to authorize code generation.**  
> Implementation will proceed strictly in module order, one module at a time, with `npx tsc --noEmit` verified after each.

---

## Current Status

| Module | Status |
| :--- | :---: |
| Auth & RBAC | ✅ Implemented |
| Users | ✅ Implemented |
| Master Data (Categories / Companies / Units) | ✅ Implemented |
| Products | ✅ Implemented |
| Inventory | ✅ Implemented |
| Customers | ✅ Implemented |
| Sales (Draft + Finalize + Cancel) | ✅ Implemented |
| **Payments** | 🔲 Next |
| **Invoices** | 🔲 Queued |
| **Reports & Dashboard** | 🔲 Queued |
| **Notifications** | 🔲 Queued |
| **Audit Logs** | 🔲 Queued |

---

## Module 8 — Payments

### Endpoints to implement
| Method | Path | Auth | Role(s) |
| --- | --- | --- | --- |
| `POST` | `/api/v1/payments` | required | ADMIN, SHOPKEEPER, ACCOUNTANT, MANAGER |
| `GET` | `/api/v1/payments` | required | all |
| `GET` | `/api/v1/payments/pending` | required | all |
| `GET` | `/api/v1/payments/completed` | required | all |
| `GET` | `/api/v1/payments/:id` | required | all |
| `POST` | `/api/v1/payments/:id/cancel` | required | ADMIN, ACCOUNTANT |
| `POST` | `/api/v1/payments/:id/refund` | required | ADMIN |

### Files to create / modify

| Action | File |
| --- | --- |
| **CREATE** | `src/modules/payments/validators.ts` |
| **CREATE** | `src/modules/payments/repository.ts` |
| **CREATE** | `src/modules/payments/service.ts` |
| **CREATE** | `src/modules/payments/controller.ts` |
| **CREATE** | `src/modules/payments/routes.ts` |
| **MODIFY** | `src/routes/index.ts` — add `/payments` |
| **CREATE** | `src/middlewares/idempotency.middleware.ts` — idempotency check middleware |
| **MODIFY** | `src/constants/index.ts` — add `PAYMENT_EXCEEDS_PENDING`, `IDEMPOTENCY_KEY_CONFLICT` error codes |

### Key implementation rules
1. `POST /payments` is an **atomic transaction** using `prisma.$transaction`: lock sale row (`FOR UPDATE`) → validate `amount <= pendingAmount` → insert `payments` → insert `payment_allocations` → update `sale.paidAmount`/`pendingAmount` → re-derive `paymentStatus` (`PARTIAL`/`COMPLETED`) → post `PAYMENT_CREDIT` to `customer_ledger` → write `audit_logs` → save idempotency key record.
2. `paymentNumber` generated from `document_sequences` table inside the same transaction.
3. `POST /payments/:id/cancel` reverses `sale.paidAmount`/`pendingAmount`, re-derives `paymentStatus`, and posts `PAYMENT_CANCEL_DEBIT` to `customer_ledger`.
4. `POST /payments/:id/refund` posts `REFUND_CREDIT` to `customer_ledger` and marks payment `REFUNDED`.
5. All three write endpoints require `Idempotency-Key` header.

---

## Module 9 — Invoices

### Endpoints to implement
| Method | Path | Auth | Role(s) |
| --- | --- | --- | --- |
| `GET` | `/api/v1/invoices` | required | all |
| `GET` | `/api/v1/invoices/:id` | required | all |
| `POST` | `/api/v1/invoices/:id/cancel` | required | ADMIN only |

### Files to create / modify

| Action | File |
| --- | --- |
| **CREATE** | `src/modules/invoices/validators.ts` |
| **CREATE** | `src/modules/invoices/repository.ts` |
| **CREATE** | `src/modules/invoices/service.ts` |
| **CREATE** | `src/modules/invoices/controller.ts` |
| **CREATE** | `src/modules/invoices/routes.ts` |
| **MODIFY** | `src/routes/index.ts` — add `/invoices` |

### Key implementation rules
1. `GET /invoices/:id` — line items come from `sale_items`, **never re-joined from `products`**.
2. `POST /invoices/:id/cancel` — atomic transaction: lock invoice → call `applyStockMovement(tx, { movementType: SALE_CANCEL_REVERSAL_IN })` for every `sale_item` → post `REVERSAL` entry to `customer_ledger` → set `invoice.status = CANCELLED`, `sale.saleStatus = CANCELLED`, `sale.paymentStatus = CANCELLED` → write `audit_logs` → save idempotency key.

> [!IMPORTANT]
> `POST /invoices/:id/cancel` calls the **same** `applyStockMovement()` function from `src/modules/inventory/repository.ts` — not a duplicate implementation.

---

## Module 10 — Reports & Dashboard

### Endpoints to implement
| Method | Path | Auth | Role(s) |
| --- | --- | --- | --- |
| `GET` | `/api/v1/reports/dashboard` | required | ADMIN, MANAGER, ACCOUNTANT |
| `GET` | `/api/v1/reports/sales` | required | ADMIN, MANAGER, ACCOUNTANT |
| `GET` | `/api/v1/reports/stock` | required | ADMIN, MANAGER |
| `GET` | `/api/v1/reports/low-stock` | required | ADMIN, MANAGER |
| `GET` | `/api/v1/reports/pending-payments` | required | ADMIN, MANAGER, ACCOUNTANT |
| `GET` | `/api/v1/reports/profit` | required | ADMIN only |

### Files to create / modify

| Action | File |
| --- | --- |
| **CREATE** | `src/modules/reports/validators.ts` |
| **CREATE** | `src/modules/reports/repository.ts` |
| **CREATE** | `src/modules/reports/service.ts` |
| **CREATE** | `src/modules/reports/controller.ts` |
| **CREATE** | `src/modules/reports/routes.ts` |
| **MODIFY** | `src/routes/index.ts` — add `/reports` |

### Key implementation rules
1. All report endpoints are **read-only** — no writes, no transactions needed.
2. Dashboard endpoint uses `Promise.all([...])` to run 6 aggregate queries in parallel.
3. Profit report: `SUM((sellingPrice - purchasePrice) × quantity)` grouped by product from `sale_items` joined to `products` for `purchasePrice`.
4. Date range params validated: `from <= to`, sane bounds (no future dates for start).

---

## Module 11 — Notifications

### Endpoints to implement
| Method | Path | Auth | Role(s) |
| --- | --- | --- | --- |
| `GET` | `/api/v1/notifications` | required | all |
| `PATCH` | `/api/v1/notifications/:id/read` | required | all |

### Files to create / modify

| Action | File |
| --- | --- |
| **CREATE** | `src/modules/notifications/repository.ts` |
| **CREATE** | `src/modules/notifications/service.ts` |
| **CREATE** | `src/modules/notifications/controller.ts` |
| **CREATE** | `src/modules/notifications/routes.ts` |
| **MODIFY** | `src/routes/index.ts` — add `/notifications` |

### Key implementation rules
1. Notifications are filtered by `target_user_id = req.user.id` OR `target_role_id = req.user.roleId` (role-broadcast notifications).
2. `PATCH /:id/read` only marks the notification as read if it belongs to the current user.

---

## Module 12 — Audit Logs

### Endpoints to implement
| Method | Path | Auth | Role(s) |
| --- | --- | --- | --- |
| `GET` | `/api/v1/audit-logs` | required | ADMIN only |

### Files to create / modify

| Action | File |
| --- | --- |
| **CREATE** | `src/modules/audit/validators.ts` |
| **CREATE** | `src/modules/audit/repository.ts` |
| **CREATE** | `src/modules/audit/service.ts` |
| **CREATE** | `src/modules/audit/controller.ts` |
| **CREATE** | `src/modules/audit/routes.ts` |
| **MODIFY** | `src/routes/index.ts` — add `/audit-logs` |

### Key implementation rules
1. Filterable by: `module`, `action`, `userId`, `recordId`, `from`, `to` date range.
2. Read-only — no writes via this endpoint.

---

## Verification After Each Module

1. `npx tsc --noEmit` — must exit 0 before moving to the next module.
2. Dev server restart test: `npm run dev` — no startup errors.
3. Postman collection updated with new requests for each module.

---

## Non-Negotiables Reminder

- Stock only changes via `applyStockMovement()` with `SELECT ... FOR UPDATE`
- GST always recalculated server-side at finalize time
- `sale_items` snapshots never joined live from `products` for historical display
- Every state-changing write gets an `audit_logs` row in the same transaction
- Idempotency keys required on: `POST /payments`, `POST /payments/:id/cancel`, `POST /payments/:id/refund`, `POST /invoices/:id/cancel`
- Money arithmetic via `decimal.js` only — no native JS float math on currency
