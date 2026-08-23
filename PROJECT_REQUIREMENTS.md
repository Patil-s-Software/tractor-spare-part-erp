# Tractor Spare Parts ERP — Backend Architecture & Phase-Wise Implementation Plan

**Document type:** Technical Architecture & Implementation Documentation  
**Target reader:** Backend developer(s) implementing this system  
**Status:** Architecture finalized — ready for Phase 1 implementation  

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Functional Scope](#2-functional-scope)
3. [Non-Functional Requirements](#3-non-functional-requirements)
4. [Recommended Tech Stack](#4-recommended-tech-stack)
5. [High-Level Architecture](#5-high-level-architecture)
6. [Module Breakdown & Folder Structure](#6-module-breakdown--folder-structure)
7. [Core Database Design Principles](#7-core-database-design-principles)
8. [Complete Database Schema](#8-complete-database-schema)
9. [Authentication & Authorization](#10-authentication--authorization)
10. [Product Management](#11-product-management)
11. [Inventory Management](#12-inventory-management)
12. [Customer Management](#13-customer-management)
13. [Sales Management (Draft vs Final)](#14-sales-management-draft-vs-final)
14. [GST Calculation Strategy](#15-gst-calculation-strategy)
15. [Payment Management & State Machine](#16-payment-management--state-machine)
16. [Invoice Management](#17-invoice-management)
17. [Customer Ledger](#18-customer-ledger)
18. [Reports & Dashboard](#19-reports--dashboard)
19. [Notifications](#20-notifications)
20. [Audit Logs](#21-audit-logs)
21. [API Architecture & Response Standard](#22-api-architecture--response-standard)
22. [API Documentation (by module)](#23-api-documentation-by-module)
23. [Validation Rules](#24-validation-rules)
24. [Business Rules](#25-business-rules)
25. [Transaction & Concurrency Strategy](#26-transaction--concurrency-strategy)
26. [Idempotency Strategy](#27-idempotency-strategy)
27. [Error Handling](#28-error-handling)
28. [Security](#29-security)
29. [Testing Strategy](#30-testing-strategy)
30. [Edge Cases](#31-edge-cases)
31. [Phase-Wise Implementation Plan](#32-phase-wise-implementation-plan)
32. [Development Dependency Map](#33-development-dependency-map)
33. [End-to-End Example](#34-end-to-end-example)
34. [Deployment Architecture](#35-deployment-architecture)
35. [Production Checklist](#36-production-checklist)
36. [Future Enhancements](#37-future-enhancements)

---

## 1. Executive Summary

This document defines the complete backend architecture for an internal ERP system for a tractor spare parts business, covering product catalog, inventory/stock movement, customer management, sales (draft → finalized), GST-compliant billing, multi-mode payments with a draft ("rough") → confirmed workflow, immutable invoicing, and a customer ledger for outstanding balances.

### Core Design Philosophy:
1. **Stock is never edited directly.** It only changes through recorded inventory movements.
2. **Money is never trusted from the client.** All pricing, GST, and totals are recalculated server-side.
3. **Finalized financial documents are immutable.** Corrections happen through reversal/cancellation, never in-place edits.
4. **Every state-changing financial action happens inside one atomic database transaction**, with row-level locking to prevent race conditions (e.g., two shopkeepers selling the last unit at once).
5. **A "rough"/draft sale has zero effect on stock, ledger, or reports until it is explicitly finalized.**

Everything below — schema, APIs, state machines, phases — is built around these five rules.

---

## 2. Functional Scope

- **Admin:** Full CRUD on products/categories/companies/customers/users, inventory adjustments, sales oversight, payment verification, invoice finalization/cancellation, full reports, audit trail visibility.
- **Shopkeeper:** Product search/stock lookup, create draft sales, add customer/products/quantities, view live pricing/GST/totals, save as rough payment, edit and finalize, view their own sales/payment history and customer outstanding.
- **Customers:** Admin-managed master data only — no login/portal in v1 (noted as a future enhancement).

---

## 3. Non-Functional Requirements

| Requirement | Approach |
| :--- | :--- |
| **Data consistency** | PostgreSQL ACID transactions for every financial write |
| **Concurrency safety** | Row-level locking (`SELECT ... FOR UPDATE`) on inventory during stock-affecting operations |
| **Auditability** | Every state-changing action on financial tables writes an audit log row |
| **Precision** | All money stored as `NUMERIC`, never `FLOAT`; decimal library used in application code |
| **Availability** | Single-region deployment is sufficient for v1 (single-shop scale); stateless API layer so it can be horizontally scaled later |
| **Maintainability** | Modular, layered codebase (`routes` → `controllers` → `services` → `repositories`) |
| **Security** | JWT auth, RBAC, hashed passwords, rate limiting, input validation on every endpoint |
| **Extensibility** | Schema anticipates future needs (CGST/SGST/IGST columns, multi-branch hooks) without over-building them now |

---

## 4. Recommended Tech Stack

| Layer | Choice | Why |
| :--- | :--- | :--- |
| **Runtime** | Node.js (LTS) | As required |
| **Language** | TypeScript | Strong typing catches real-money bugs at compile time. |
| **Web framework** | Express.js | Minimal, unopinionated, mature, easiest to reason about. |
| **Database** | PostgreSQL | Strong ACID guarantees, native `NUMERIC` type, row-level locking (`FOR UPDATE`), `CHECK` constraints. |
| **ORM / query layer** | Prisma | Type-safe, first-class migrations, supports interactive transactions (`$transaction`) and raw SQL (`$queryRaw`) for `FOR UPDATE` locking queries. |
| **Validation** | Zod | TypeScript-first, composable schemas, integrates cleanly as middleware. |
| **Auth** | JWT + bcrypt / argon2 | Standard stateless tokens with revocable refresh tokens. |
| **Logging** | Pino | Fast structured JSON logging. |
| **API docs** | OpenAPI/Swagger | Standard API contracts documentation. |
| **Testing** | Jest + Supertest | Unit & HTTP-level API testing against a test database. |
| **Containerization** | Docker + docker-compose | Reproducible local/dev/staging environments. |
| **Caching / Rate limiting** | Redis (optional for v1) | Rate limiting, refresh token blacklisting. |
| **Scheduled jobs** | node-cron | Lightweight low-stock scans and pending-payment reminders. |
| **Money arithmetic** | `decimal.js` | Safe precision currency calculations. |

---

## 5. High-Level Architecture

Layered, modular monolith:

```
Client (mobile/web POS)
        │
        ▼
  Express Router  ──▶  Auth Middleware (JWT) ──▶ RBAC Middleware
        │
        ▼
   Validators (Zod schemas per endpoint)
        │
        ▼
    Controllers  (thin — parse request, call service, shape response)
        │
        ▼
     Services    (business logic, orchestrates transactions)
        │
        ▼
   Repositories  (Prisma queries, raw SQL for locking paths)
        │
        ▼
     PostgreSQL
```

Cross-cutting concerns (logging, audit logging, error handling, idempotency check) are implemented as middleware/service-layer helpers invoked from every module.

---

## 6. Module Breakdown & Folder Structure

```
src/
  config/           # env loading, db config, constants config
  modules/
    auth/
    users/
    products/
    categories/
    companies/
    units/
    inventory/
    customers/
    sales/
    payments/
    invoices/
    ledger/
    reports/
    notifications/
    audit/
    (each module: controller.ts, service.ts, repository.ts, routes.ts, validators.ts)
  middlewares/      # auth, rbac, error-handler, idempotency, request-logger
  utils/            # money.ts (decimal helpers), number-generator.ts, response.ts
  constants/        # enums: roles, statuses, movement types, error codes
  jobs/             # cron jobs: low-stock scan, pending-payment reminders
  database/         # prisma schema, migrations, seed scripts
  routes/           # top-level route aggregator → /api/v1
  app.ts            # express app wiring
  server.ts         # entrypoint
```

---

## 7. Core Database Design Principles

1. **Stock changes only through movements, never direct edits.** `products` has no `current_stock` column. `inventory` (1:1 with product) holds the maintained `current_stock`, and it is only ever updated in the same database transaction as an insert into `inventory_movements`. The product-update API cannot touch stock at all — attempting to do so should be rejected at the validator level, not just "discouraged." This gives a complete, replayable history of every stock change and a natural audit trail, and keeps products (catalog data, read-heavy, rarely locked) separate from inventory (write-heavy, frequently locked during sales).

2. **Sale line items snapshot product data.** `sale_items` stores `product_name`, `part_number`, `unit_price`, `gst_percent`, etc. as they were at the moment of sale, even though `products` already has this data. Reasons:
   - **Legal/financial correctness** — an invoice must reflect exactly what was billed, at the price billed, forever — even if the product is later renamed, repriced, recategorized, or deactivated.
   - **Deactivation safety** — a product can be marked `INACTIVE` (can't be sold going forward) without corrupting historical invoices that referenced it.
   - **Deletion safety** — products should never be hard-deleted (only soft-deleted via status), but even if a row were somehow removed, historical invoices remain fully readable from the snapshot alone.
   - **Performance** — reprinting/viewing an old invoice needs no joins back to current product state.

3. **A draft ("rough") sale has zero side effects.** While `sale.sale_status = DRAFT`, no inventory movement, no invoice, no ledger entry, no payment record exists. All of that is created atomically at the moment of finalization. This is what makes "abandoned drafts" harmless by construction.

4. **Finalized invoices are immutable.** Once an invoice exists (`status = FINALIZED`), no field on it or its line items is ever updated. Corrections happen by cancelling the invoice (with automatic stock/ledger reversal) and creating a new corrected sale. This is the standard, audit-safe ERP pattern and avoids an entire class of bugs where "editing an old invoice" silently breaks previously reconciled reports.

---

## 8. Complete Database Schema

All monetary columns are `NUMERIC(12,2)`. All percentage columns are `NUMERIC(5,2)`. All timestamps are `TIMESTAMPTZ`. Primary keys are `BIGINT GENERATED ALWAYS AS IDENTITY` unless noted.

### 8.1 Lookup / Master Tables
- **roles**: `id` (SMALLINT PK), `name` (VARCHAR(30) UNIQUE NOT NULL), `description` (TEXT), `created_at` (TIMESTAMPTZ)
- **companies**: `id` (BIGINT PK), `name` (VARCHAR(120) UNIQUE NOT NULL), `status` (VARCHAR(10) DEFAULT 'ACTIVE'), `created_at`, `updated_at`
- **categories**: `id` (BIGINT PK), `name` (VARCHAR(120) UNIQUE NOT NULL), `parent_category_id` (BIGINT FK → categories.id), `status` (VARCHAR(10) DEFAULT 'ACTIVE'), `created_at`, `updated_at`
- **units**: `id` (BIGINT PK), `name` (VARCHAR(30) UNIQUE NOT NULL), `short_code` (VARCHAR(10))
- **document_sequences**: `id` (BIGINT PK), `doc_type` (VARCHAR(20) NOT NULL), `prefix` (VARCHAR(10) NOT NULL), `financial_year` (VARCHAR(9) NOT NULL), `last_number` (INT DEFAULT 0), `updated_at`, UNIQUE(`doc_type`, `financial_year`)

### 8.2 Users & Auth
- **users**: `id` (BIGINT PK), `name` (VARCHAR(120)), `email` (VARCHAR(150) UNIQUE), `phone` (VARCHAR(15)), `password_hash` (VARCHAR(255)), `role_id` (SMALLINT FK → roles.id), `status` (VARCHAR(10) DEFAULT 'ACTIVE'), `last_login_at`, `created_at`, `updated_at`
- **refresh_tokens**: `id` (BIGINT PK), `user_id` (BIGINT FK → users.id), `token_hash` (VARCHAR(255)), `user_agent` (TEXT), `expires_at`, `revoked_at`, `created_at`

### 8.3 Product & Inventory
- **products**: `id` (BIGINT PK), `product_code` (VARCHAR(30) UNIQUE), `name` (VARCHAR(150)), `part_number` (VARCHAR(60) UNIQUE), `company_id` (BIGINT FK), `category_id` (BIGINT FK), `unit_id` (BIGINT FK), `description` (TEXT), `purchase_price` (NUMERIC(12,2) ≥ 0), `selling_price` (NUMERIC(12,2) ≥ 0), `gst_percent` (NUMERIC(5,2) ≥ 0), `minimum_stock` (INT), `maximum_stock` (INT), `status` (VARCHAR(10) DEFAULT 'ACTIVE'), `created_by` (BIGINT FK), `created_at`, `updated_at`
- **inventory**: `id` (BIGINT PK), `product_id` (BIGINT FK UNIQUE), `current_stock` (INT DEFAULT 0 CHECK ≥ 0), `last_movement_at`, `updated_at`
- **inventory_movements**: `id` (BIGINT PK), `product_id` (BIGINT FK), `movement_type` (VARCHAR(30)), `quantity_change` (INT signed), `stock_before` (INT), `stock_after` (INT), `reference_type` (VARCHAR(20)), `reference_id` (BIGINT), `remarks` (TEXT), `created_by` (BIGINT FK), `created_at`

### 8.4 Customers
- **customers**: `id` (BIGINT PK), `customer_code` (VARCHAR(30) UNIQUE), `name` (VARCHAR(150)), `mobile` (VARCHAR(15) UNIQUE), `alternate_mobile` (VARCHAR(15)), `email` (VARCHAR(150)), `address` (TEXT), `gst_number` (VARCHAR(20)), `city`, `state`, `pincode`, `opening_balance` (NUMERIC(12,2) DEFAULT 0), `credit_limit` (NUMERIC(12,2)), `status` (VARCHAR(10) DEFAULT 'ACTIVE'), `created_by` (BIGINT FK), `created_at`, `updated_at`

### 8.5 Sales, Payments, Invoices
- **sales**: `id` (BIGINT PK), `sale_number` (VARCHAR(30) UNIQUE), `customer_id` (BIGINT FK), `sale_date` (DATE), `sale_status` (VARCHAR(15) DEFAULT 'DRAFT'), `payment_status` (VARCHAR(15) DEFAULT 'ROUGH'), `subtotal`, `discount_amount`, `cgst_total`, `sgst_total`, `igst_total`, `gst_total`, `round_off`, `grand_total`, `paid_amount`, `pending_amount`, `idempotency_key` (VARCHAR(80) UNIQUE), `created_by` (BIGINT FK), `finalized_by` (BIGINT FK), `finalized_at`, `cancelled_by` (BIGINT FK), `cancelled_at`, `cancel_reason` (TEXT), `created_at`, `updated_at`
- **sale_items**: `id` (BIGINT PK), `sale_id` (BIGINT FK), `product_id` (BIGINT FK), `product_name_snapshot`, `part_number_snapshot`, `unit_snapshot`, `quantity` (INT > 0), `unit_price`, `gst_percent`, `cgst_amount`, `sgst_amount`, `igst_amount`, `gst_amount`, `discount_amount`, `item_total`, `created_at`
- **invoices**: `id` (BIGINT PK), `sale_id` (BIGINT FK UNIQUE), `invoice_number` (VARCHAR(40) UNIQUE), `invoice_date` (DATE), `status` (VARCHAR(15) DEFAULT 'FINALIZED'), `shop_snapshot` (JSONB), `customer_snapshot` (JSONB), `subtotal`, `gst_total`, `discount_total`, `grand_total`, `paid_amount`, `pending_amount`, `cancelled_by` (BIGINT FK), `cancelled_at`, `cancel_reason`, `created_at`
- **payments**: `id` (BIGINT PK), `payment_number` (VARCHAR(30) UNIQUE), `sale_id` (BIGINT FK), `customer_id` (BIGINT FK), `amount` (NUMERIC(12,2) > 0), `payment_method` (VARCHAR(20)), `status` (VARCHAR(15) DEFAULT 'COMPLETED'), `reference_note` (VARCHAR(150)), `received_by` (BIGINT FK), `payment_date` (DATE), `idempotency_key` (VARCHAR(80) UNIQUE), `cancelled_by` (BIGINT FK), `cancelled_at`, `created_at`
- **payment_allocations**: `id` (BIGINT PK), `payment_id` (BIGINT FK), `invoice_id` (BIGINT FK), `allocated_amount` (NUMERIC(12,2) > 0), `created_at`, UNIQUE(`payment_id`, `invoice_id`)

### 8.6 Ledger & Audit
- **customer_ledger**: `id` (BIGINT PK), `customer_id` (BIGINT FK), `entry_type` (VARCHAR(20)), `reference_type` (VARCHAR(20)), `reference_id` (BIGINT), `debit_amount` (NUMERIC(12,2) DEFAULT 0), `credit_amount` (NUMERIC(12,2) DEFAULT 0), `running_balance` (NUMERIC(12,2)), `description` (TEXT), `created_by` (BIGINT FK), `created_at`
- **audit_logs**: `id` (BIGINT PK), `user_id` (BIGINT FK), `action` (VARCHAR(50)), `module` (VARCHAR(30)), `record_id` (BIGINT), `old_value` (JSONB), `new_value` (JSONB), `ip_address` (VARCHAR(45)), `created_at`

### 8.7 Infrastructure Tables
- **idempotency_keys**: `id` (BIGINT PK), `key` (VARCHAR(80) UNIQUE), `endpoint` (VARCHAR(100)), `request_hash` (VARCHAR(64)), `response_body` (JSONB), `status_code` (INT), `created_at`, `expires_at`
- **notifications**: `id` (BIGINT PK), `type` (VARCHAR(30)), `title`, `message` (TEXT), `reference_type`, `reference_id` (BIGINT), `target_role_id` (SMALLINT FK), `target_user_id` (BIGINT FK), `is_read` (BOOLEAN DEFAULT false), `created_at`
```

---

## 10. Authentication & Authorization

- **Login**: `POST /api/v1/auth/login` — email + password → bcrypt verify → issue short-lived access JWT (~15 min) + long-lived refresh token (~7–30 days, hashed and stored in `refresh_tokens`).
- **Refresh**: `POST /api/v1/auth/refresh` — validate refresh token against stored hash + expiry, rotate it (issue new refresh token, revoke old one to prevent replay).
- **Logout**: `POST /api/v1/auth/logout` — revoke the refresh token server-side.
- **RBAC Matrix**:

| Module | Admin | Manager | Accountant | Shopkeeper |
| :--- | :---: | :---: | :---: | :---: |
| **Products (write)** | ✅ | ❌ | ❌ | ❌ |
| **Products (read)** | ✅ | ✅ | ✅ | ✅ |
| **Inventory adjust** | ✅ | ✅ | ❌ | ❌ |
| **Customers (write)** | ✅ | ❌ | ❌ | ❌ |
| **Sales create/draft** | ✅ | ✅ | ❌ | ✅ |
| **Sales finalize** | ✅ | ✅ | ❌ | ✅ |
| **Invoice cancel** | ✅ | ❌ | ❌ | ❌ |
| **Payments record** | ✅ | ✅ | ✅ | ✅ |
| **Payment cancel/refund** | ✅ | ❌ | ✅ | ❌ |
| **Reports** | ✅ | ✅ | ✅ | own sales only |
| **Audit logs** | ✅ | ❌ | ❌ | ❌ |
| **User management** | ✅ | ❌ | ❌ | ❌ |

---

## 11. Product Management

- Standard CRUD with strict stock-immutability: Product update payload has no `current_stock` or `initial_stock` field (rejected at validator level).
- Creating a product with `initial_stock > 0` triggers an atomic `OPENING_STOCK` movement and initializes `inventory.current_stock` inside the same creation transaction.
- Search with `ILIKE` on name/part_number; filtering by category, company, status, low-stock, out-of-stock.

---

## 12. Inventory Management

### Stock Movement Types
- `OPENING_STOCK`: Product creation initial stock
- `PURCHASE_IN`: Manual purchase entry / addition
- `SALE_OUT`: Deducted upon sale finalization
- `SALE_CANCEL_REVERSAL_IN`: Restored stock upon invoice cancellation
- `SALE_RETURN_IN`: Customer return
- `ADJUSTMENT_IN` / `ADJUSTMENT_OUT`: Manual inventory count adjustment
- `DAMAGE_OUT`: Damaged/written-off stock

### Atomic Transaction & Row Locking (`applyStockMovement`)
1. Locks the target `inventory` row (`SELECT ... FOR UPDATE`).
2. Checks that resulting stock will not drop below 0 for negative movements.
3. Inserts `inventory_movements` record with `stock_before` and `stock_after`.
4. Updates `inventory.current_stock`.

---

## 13. Customer Management

- Master customer record CRUD.
- Sub-resource queries: `/customers/:id/sales`, `/invoices`, `/payments`, `/ledger`, `/outstanding`.

---

## 14. Sales Management (Draft vs Final)

- **Draft Phase**: `sale_status = DRAFT`, `payment_status = ROUGH`. Fully editable. Zero side effects on inventory, ledger, or reports.
- **Finalize Transaction (`POST /sales/:id/finalize`)**:
  1. Fetch & lock sale (`FOR UPDATE`); check idempotency key.
  2. Validate customer & products active state.
  3. Lock inventory rows sorted by `product_id` (prevents deadlocks).
  4. Recalculate prices, GST, discounts, and totals server-side.
  5. Verify `current_stock >= quantity` for all line items.
  6. Generate document numbers from `document_sequences`.
  7. Insert `SALE_OUT` inventory movements & update stock.
  8. Insert immutable `invoices` snapshot row.
  9. Insert `payments` & `payment_allocations` rows (if payment provided).
  10. Post `INVOICE_DEBIT` and `PAYMENT_CREDIT` to `customer_ledger`.
  11. Set `sale_status = FINALIZED` & derive `payment_status`.
  12. Write `audit_logs` record.
  13. Commit atomic transaction.

---

## 15. GST Calculation Strategy

- All monetary calculations execute server-side via `decimal.js`.
- **Line Item Formulas**:
  - `item_subtotal = unit_price * quantity`
  - `item_after_discount = item_subtotal - discount_amount`
  - `gst_amount = round2(item_after_discount * gst_percent / 100)`
  - `item_total = item_after_discount + gst_amount`
- **CGST/SGST vs IGST**: Intra-state splits `gst_amount` evenly into CGST & SGST; inter-state allocates full GST to IGST.
- **Line-level rounding**: Rounded to 2 decimals per line item; invoice `round_off` absorbs residual ±0.49 variance.

---

## 16. Payment Management & State Machine

### Status Definitions
- `sale.sale_status`: `DRAFT` → `FINALIZED` → `CANCELLED`
- `sale.payment_status`: `ROUGH` → `PENDING` / `PARTIAL` / `COMPLETED` → `CANCELLED` / `REFUNDED`

### State Transitions

| From | To | Trigger | Who | Stock Effect | Ledger Effect |
| :--- | :--- | :--- | :--- | :--- | :--- |
| (new) | `ROUGH` | Draft sale created/edited | Shopkeeper | None | None |
| `ROUGH` | `PENDING` | Finalize (paid = 0) | Shopkeeper/Admin | Deducted | Invoice debit posted |
| `ROUGH` | `PARTIAL` | Finalize (0 < paid < total) | Shopkeeper/Admin | Deducted | Debit + Credit posted |
| `ROUGH` | `COMPLETED` | Finalize (paid ≥ total) | Shopkeeper/Admin | Deducted | Debit + Credit posted |
| `ROUGH` | `CANCELLED` | Draft discarded | Shopkeeper/Admin | None | None |
| `PENDING` | `PARTIAL` | Partial payment received | Any allowed | None | Credit posted |
| `PENDING` | `COMPLETED` | Balance cleared | Any allowed | None | Credit posted |
| `PARTIAL` | `COMPLETED` | Balance cleared | Any allowed | None | Credit posted |
| `PENDING`/`PARTIAL` | `CANCELLED` | Invoice cancelled | Admin only | Restored | Reversal entry posted |
| `COMPLETED` | `REFUNDED` | Refund processed | Admin only | Restored if returned | Refund entry posted |

Multiple payments per invoice are accumulated in `payments` and `payment_allocations`.

---

## 17. Invoice Management

- Created exclusively upon sale finalization (status `FINALIZED`).
- Line items & snapshots are strictly immutable.
- Cancellation via `POST /invoices/:id/cancel` (Admin only) reverses stock & ledger entries, setting invoice status to `CANCELLED`. Corrections require issuing a new sale.

---

## 18. Customer Ledger

- `customer_ledger` is an append-only transaction ledger.
- `running_balance = previous_balance + debit_amount - credit_amount`.
- Single source of truth for customer outstanding balances.

---

## 19. Reports & Dashboard

- **Dashboard**: Today's sales, collections, pending payments, total outstanding, low stock alert count, top-selling products.
- **Reports**: Daily/monthly sales, product sales, customer sales, payment method breakdown, aging report, profit report (`(selling_price - purchase_price) * qty`).

---

## 20. Notifications

- DB-backed `notifications` table.
- System notifications inserted by business services (finalization, payments) and scheduled `node-cron` jobs (low stock, large outstanding).

---

---

## 22. API Architecture & Response Standard

- **Base Path**: `/api/v1`

### Standard Success Response
```json
{
  "success": true,
  "message": "Sale finalized successfully",
  "data": {},
  "meta": {}
}
```

### Standard Error Response
```json
{
  "success": false,
  "message": "Insufficient stock for BS-1024",
  "errorCode": "INSUFFICIENT_STOCK",
  "errors": []
}
```

### Pagination & Query Conventions
- **Pagination parameters**: `?page=1&limit=20`
- **Response meta**: `{ "page": 1, "limit": 20, "total": 100, "totalPages": 5 }`
- **Filtering & Sorting**: Scoped parameters (`?category=&company=&status=&lowStock=true`), sorting via `?sort=-created_at` (`-` = descending). Search via `?q=`.

---

## 23. API Documentation (by module)

### Auth Endpoints

| Method | Path | Auth | Notes |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | None | Email + password → issue access & refresh tokens |
| `POST` | `/api/v1/auth/refresh` | Refresh Token | Rotates refresh token |
| `POST` | `/api/v1/auth/logout` | Access Token | Revokes refresh token server-side |
| `POST` | `/api/v1/auth/change-password` | Access Token | Requires current + new password |

### Products & Catalog Endpoints (Admin write, all roles read)

| Method | Path | Auth | Notes |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/products` | Admin | Create product (initial_stock accepted here only) |
| `GET` | `/api/v1/products` | All Roles | Search + filters (category, company, status, lowStock) + pagination |
| `GET` | `/api/v1/products/:id` | All Roles | Detail including current stock |
| `PUT` | `/api/v1/products/:id` | Admin | Update catalog info (no stock fields accepted in payload) |
| `PATCH` | `/api/v1/products/:id/status` | Admin | Toggle status (`ACTIVE` / `INACTIVE`) |
| `GET/POST` | `/api/v1/categories` | Admin/All | Categories master CRUD |
| `GET/POST` | `/api/v1/companies` | Admin/All | Brands/Companies master CRUD |
| `GET/POST` | `/api/v1/units` | Admin/All | Units master CRUD |

### Inventory Endpoints

| Method | Path | Auth | Notes |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/inventory` | All Roles | List inventory with current stock and low-stock flag |
| `GET` | `/api/v1/inventory/:productId` | All Roles | Single product stock breakdown |
| `POST` | `/api/v1/inventory/adjust` | Admin / Manager | Manual +/- stock adjustment with reason |
| `GET` | `/api/v1/inventory/movements` | All Roles | Stock change history (filterable by product, date, movement type) |

### Customer Endpoints

| Method | Path | Auth | Notes |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/customers` | Admin | Create customer |
| `GET` | `/api/v1/customers` | All Roles | Search + filters |
| `GET` | `/api/v1/customers/:id` | All Roles | Customer profile |
| `PUT` | `/api/v1/customers/:id` | Admin | Update customer details |
| `GET` | `/api/v1/customers/:id/sales` | All Roles | Customer sales history |
| `GET` | `/api/v1/customers/:id/invoices` | All Roles | Customer invoices |
| `GET` | `/api/v1/customers/:id/payments` | All Roles | Customer payments |
| `GET` | `/api/v1/customers/:id/ledger` | All Roles | Customer ledger entries |
| `GET` | `/api/v1/customers/:id/outstanding` | All Roles | Current running outstanding balance |

### Payments Endpoints

| Method | Path | Auth | Notes |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/payments` | All Roles | Create payment (requires `Idempotency-Key` header) |
| `GET` | `/api/v1/payments` | All Roles | List payments |
| `GET` | `/api/v1/payments/pending` | All Roles | List pending sales/payments |
| `GET` | `/api/v1/payments/completed` | All Roles | List completed payments |
| `GET` | `/api/v1/payments/:id` | All Roles | Payment detail with allocations |
| `POST` | `/api/v1/payments/:id/cancel` | Admin / Accountant | Cancel payment |
| `POST` | `/api/v1/payments/:id/refund` | Admin Only | Refund payment |

### Invoices Endpoints

| Method | Path | Auth | Notes |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/invoices` | All Roles | List invoices |
| `GET` | `/api/v1/invoices/:id` | All Roles | Invoice details |
| `POST` | `/api/v1/invoices/:id/cancel` | Admin Only | Cancel invoice & trigger stock/ledger reversal |

### Reports Endpoints

| Method | Path | Auth | Notes |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/reports/dashboard` | Admin / Manager / Accountant | Dashboard summary metrics |
| `GET` | `/api/v1/reports/sales` | Admin / Manager / Accountant | Sales report (`?range=daily|monthly|custom`) |
| `GET` | `/api/v1/reports/stock` | Admin / Manager | Stock report |
| `GET` | `/api/v1/reports/low-stock` | Admin / Manager | Low-stock alert report |
| `GET` | `/api/v1/reports/pending-payments` | Admin / Manager / Accountant | Pending payments aging report |
| `GET` | `/api/v1/reports/profit` | Admin Only | Profit report (`(selling_price - purchase_price) * qty`) |

### Notifications & Audit Logs Endpoints

| Method | Path | Auth | Notes |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/notifications` | All Roles | User & System notifications |
| `PATCH` | `/api/v1/notifications/:id/read` | All Roles | Mark notification as read |
| `GET` | `/api/v1/audit-logs` | Admin Only | Audit trail logs (filterable by module, date, user) |

---

## 24. Validation Rules

All validation rules are strictly enforced server-side via Zod schemas and service-layer assertions:

| Field | Rule |
| :--- | :--- |
| **Mobile** | 10-digit Indian mobile regex (`/^[6-9]\d{9}$/`) |
| **Email** | Standard email format; optional except for users |
| **GSTIN** | 15-character GSTIN pattern (`/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/`) when provided |
| **Prices & GST%** | Numeric, $\ge 0$, max 2 decimal places |
| **Quantity** | Positive integer ($> 0$) |
| **Stock** | Never negative — enforced by database `CHECK` constraint + service pre-check |
| **Payment Amount** | $> 0$, and $\le$ current pending balance (unless overpayment is explicitly allowed) |
| **Part Number** | Unique (checked case-insensitively) |
| **Invoice / Sale Number** | Unique, system-generated sequence only, never client-supplied |
| **Customer / Product References** | Must exist and be `ACTIVE` at time of transaction |
| **Status Transitions** | Enforced via explicit allow-list matrix |

---

## 25. Business Rules

1. **Part number is unique** across products (case-insensitive check).
2. **Inactive products cannot be added** to a new sale.
3. **Stock can never go negative** (enforced by DB `CHECK` constraint + service check).
4. **Finalized invoices are never directly edited** — only cancelled/reversed.
5. **A payment cannot exceed an invoice's pending balance** unless overpayment is explicitly enabled (off by default).
6. **Customer outstanding is always derived from `customer_ledger`**, never recomputed ad hoc elsewhere.
7. **Every inventory change creates an `inventory_movements` row** — no exceptions.
8. **Sale finalization is a single atomic transaction** — partial finalization cannot exist.
9. **GST is always calculated server-side** from live product data at finalize time via `decimal.js`.
10. **Invoice numbers are system-generated and unique**, sequenced per financial year.
11. **Cancelling a finalized sale/invoice reverses inventory** if stock was already deducted.
12. **Cancelling a payment never deletes it** — it's marked `CANCELLED`, preserving complete audit history.
13. **Draft/rough sales have zero effect** on stock, ledger, or any report until finalized.
14. **Every finalized transaction is fully auditable** (who, when, old/new values).
15. **Every financial write carries a `created_by` / `user_id`** and timestamp — no anonymous writes allowed.
16. **Only Admin can cancel** a finalized invoice or process a refund.
17. **Discount on a line item cannot exceed** that line's subtotal.
18. **A customer's `credit_limit`**, if set, triggers a warning/block when a new sale would push outstanding past it.
19. **Products, customers, and users are never hard-deleted** — only deactivated (`status = INACTIVE`) to preserve referential integrity of historical records.
20. **Idempotency keys are required** on finalize/payment/cancel endpoints to guarantee duplicate requests never double-post a financial transaction.

---

## 26. Transaction & Concurrency Strategy

The core race condition: two shopkeepers each try to sell the last 5 units of a product at the same moment.

### Strategy — Pessimistic Row Locking (`SELECT ... FOR UPDATE`)
At this scale, a straightforward locked transaction is simpler to reason about and just as effective as an optimistic retry scheme:

```sql
BEGIN TRANSACTION; -- READ COMMITTED
  -- lock relevant inventory rows in product_id order to avoid deadlocks
  SELECT current_stock FROM inventory WHERE product_id IN (...) ORDER BY product_id FOR UPDATE;

  -- re-verify stock with freshest locked data
  IF current_stock < requested_quantity THEN
     ROLLBACK; RAISE 'INSUFFICIENT_STOCK';
  END IF;

  INSERT INTO inventory_movements (...);
  UPDATE inventory SET current_stock = current_stock - qty WHERE product_id = ...;
  -- ...rest of 13-step finalization...
COMMIT;
```

- Request B arriving a millisecond after Request A blocks on the `FOR UPDATE` lock until A commits or rolls back — it then sees the post-A stock level and correctly gets `INSUFFICIENT_STOCK`.
- **Deadlock Avoidance**: Always lock multiple inventory rows in a consistent order (`ORDER BY product_id` ascending).
- **Prisma Implementation**: Use `prisma.$transaction(async (tx) => { ... })` and `tx.$queryRaw` for `SELECT ... FOR UPDATE` statements.

---

## 27. Idempotency Strategy

- `POST /sales/:id/finalize`, `POST /payments`, and `POST /invoices/:id/cancel` require a client-supplied `Idempotency-Key` header.
- **Flow**:
  1. On request arrival, check `idempotency_keys` table for the key.
  2. If found & request hash matches $\rightarrow$ return stored response immediately.
  3. If found & hash differs $\rightarrow$ reject with `409 IDEMPOTENCY_KEY_CONFLICT`.
  4. If not found $\rightarrow$ proceed, and store the key + response in the same database transaction as the business writes.

---

## 28. Error Handling

Centralized Express error-handling middleware (`AppError(code, message, httpStatus)`).

### Error Code Catalog

| Code | HTTP | Meaning |
| :--- | :---: | :--- |
| `VALIDATION_ERROR` | 400 | Zod schema validation failure |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Role not permitted |
| `NOT_FOUND` | 404 | Resource does not exist |
| `DUPLICATE_PART_NUMBER` | 409 | Part number already exists |
| `DUPLICATE_INVOICE_NUMBER` | 409 | Invoice number conflict |
| `INSUFFICIENT_STOCK` | 409 | Requested stock exceeds current stock |
| `PRODUCT_INACTIVE` | 409 | Product is inactive |
| `CUSTOMER_INACTIVE` | 409 | Customer is inactive |
| `INVALID_STATUS_TRANSITION` | 409 | Invalid state transition attempted |
| `PAYMENT_EXCEEDS_PENDING` | 409 | Payment exceeds current pending balance |
| `IDEMPOTENCY_KEY_CONFLICT` | 409 | Idempotency key payload mismatch |
| `INTERNAL_ERROR` | 500 | Unexpected internal server error |

> [!NOTE]
> Production responses never leak stack traces or raw DB error text — only the typed `errorCode` and `message` are returned to the client.

---

## 29. Security

1. **Passwords**: bcrypt (cost ≥ 12) or argon2id.
2. **JWT**: Short-lived access tokens, rotated refresh tokens stored hashed, signed with strong env-var secrets (never hardcoded).
3. **Rate Limiting**: On `/auth/login` and all write endpoints (Redis-backed once introduced, in-memory acceptable for early dev).
4. **HTTP Headers**: `helmet` for standard security headers; CORS restricted to known frontend origins.
5. **Parameterized Queries Only**: Prisma does this by default — no string-concatenated SQL anywhere, especially in raw `FOR UPDATE` queries.
6. **Input Sanitization**: Strict Zod schemas on every endpoint reject unknown fields.
7. **RBAC**: Enforced server-side on every route from the verified JWT — never inferred from client-sent role claims.
8. **Secrets**: DB URL, JWT secrets, etc. only via environment variables — never committed to VCS.
9. **Backups**: Scheduled `pg_dump` (or managed-DB automated snapshots) with a tested restore procedure.

---

## 30. Testing Strategy

| Test Type | Scope |
| :--- | :--- |
| **Unit Tests** | GST calculation, decimal rounding, status-transition allow-lists, Zod validators — pure functions, no DB |
| **Integration Tests** | Service methods against a real test database (Dockerized Postgres), including the finalize-sale transaction end-to-end |
| **API Tests (Supertest)** | Auth flows, RBAC rejection cases, product/customer/sale/payment/invoice CRUD and error paths |
| **Business Tests** | GST split correctness (same-state vs different-state), partial payment sequences, multi-payment-per-invoice, customer ledger running balance correctness |
| **Concurrency Tests** | Two simultaneous finalize requests for the same product with `stock = requestedQty×2−1` — assert exactly one succeeds, one gets `INSUFFICIENT_STOCK`, final stock is never negative |
| **Security Tests** | Expired/invalid JWT, wrong-role access attempts, SQL-injection-shaped input, oversized/malformed payloads |

### Representative Test Cases
- `"sale with 3 line items, one out of stock, entire finalize rolls back"`
- `"double-submit finalize with same idempotency key returns identical response, only one invoice created"`
- `"cancel a PARTIAL invoice reverses exactly the deducted stock, not more"`

---

## 31. Edge Cases

| Case | Handling |
| :--- | :--- |
| Product later deactivated but referenced in old invoice | Fine — `sale_items` snapshot is independent of current product state |
| Product price changed after a sale | Old invoice keeps its original `unit_price` snapshot; new sales use the new price |
| Customer "deleted" while invoices exist | Customers are only deactivated, never hard-deleted — historical invoices remain intact |
| Sale cancelled after payment already made | Cancellation reverses both stock and ledger; payment is marked `CANCELLED/REFUNDED`, not deleted |
| Partial payment / multiple payments | Native — see §16 |
| Payment correction | No in-place edit — cancel the wrong payment, record a new correct one |
| Duplicate request / double-click finalize | Idempotency key (§27) |
| Network timeout during finalize | Same idempotency key on client retry returns the original result safely |
| Concurrent sales on same product | Row locking (§26) |
| GST rate changes | Only affects future sales; historical invoices keep their snapshot |
| Invoice cancellation | §17 — reversal, not deletion |
| Draft sale abandoned indefinitely | Harmless by design — no side effects exist until finalize |
| Payment marked rough, never finalized | Equivalent to an abandoned draft — no financial footprint until finalized |

---

## 32. Phase-Wise Implementation Plan

> [!NOTE]
> **Architectural Coupling Note**: Sale finalization (§14) is inherently the same atomic transaction that creates the invoice and posts the first payment. "Payment Management" (Phase 9) is where the finalize transaction is built. "Invoice Management" (Phase 10) focuses on invoice retrieval/cancellation/lifecycle on top of what finalize already created.

| Phase | Objective | APIs | Complexity |
| :---: | :--- | :--- | :---: |
| **0** | Requirements & Architecture | None | N/A |
| **1** | Project Setup — Express skeleton, env config, health check | `GET /health` | Low |
| **2** | Database & Migrations — full schema, seed script | None | Medium |
| **3** | Authentication & RBAC | `/auth/*` | Medium |
| **4** | Master Data — companies, categories, units, users | `/companies`, `/categories`, `/units`, `/users` | Low |
| **5** | Product Management — catalog CRUD, opening stock | `/products/*` | Medium |
| **6** | Inventory Engine — `applyStockMovement()`, manual adjust, history | `/inventory/*` | **High** |
| **7** | Customer Management — CRUD, opening ledger entry | `/customers/*` | Low–Medium |
| **8** | Draft Sales — cart-like draft, zero side effects | `/sales/draft`, `/sales/:id` | Medium |
| **9** | Payment Management + Sale Finalization (13-step atomic transaction) | `/sales/:id/finalize`, `/payments/*` | **Very High** |
| **10** | Invoice Management — retrieval, cancellation, reversal, refund | `/invoices/*`, `/payments/:id/refund` | High |
| **11** | Customer Ledger — read/reporting APIs | `/customers/:id/ledger`, `/customers/:id/outstanding` | Medium |
| **12** | Reports & Dashboard — aggregate KPI endpoints | `/reports/*` | Medium |
| **13** | Notifications — in-app + cron scans | `/notifications/*` | Low–Medium |
| **14** | Audit Logs — coverage verification, read API | `/audit-logs` | Low–Medium |
| **15** | Testing — close gaps, CI integration, OpenAPI spec | None new | Medium |
| **16** | Security Hardening — Redis rate limiting, Helmet, CORS, forgot-password | `/auth/forgot-password` | Medium |
| **17** | Docker / Deployment — production Dockerfile, CI-CD pipeline | None new | Medium |
| **18** | Production Readiness — backup drill, monitoring, real data load | None new | Medium |

---

## 33. Development Dependency Map

```
Phase 1 (Setup)
   │
Phase 2 (DB Schema)
   │
Phase 3 (Auth & RBAC)
   │
Phase 4 (Master Data: companies/categories/units/users)
   │
Phase 5 (Products) ──────────────┐
   │                             │
Phase 6 (Inventory Engine)       │
   │                             │
Phase 7 (Customers) ─────────────┤
   │                             │
Phase 8 (Draft Sales) ◀──────────┘  (needs Products + Customers)
   │
Phase 9 (Finalize + Payments) ◀── needs Phase 6's stock engine directly
   │
Phase 10 (Invoice cancel/refund)
   │
Phase 11 (Ledger reports)
   │
Phase 12 (Reports/Dashboard)
   │
Phase 13 (Notifications)   Phase 14 (Audit — ideally woven in incrementally from Phase 5 onward)
   │
Phase 15 (Testing/CI) → Phase 16 (Security) → Phase 17 (Deploy) → Phase 18 (Go-live)
```

> [!IMPORTANT]
> Phase 6 must be solid before Phase 9 starts. Every stock-affecting flow (sale finalization, cancellation reversal, future purchase-order receiving) routes through the same `applyStockMovement()` function — if its locking/validation isn't correct, that bug replicates into every module built on top of it.

---

## 34. End-to-End Example

### Setup (Admin, Phase 5/7)
- **Product**: Mahindra Oil Filter, part number `MOF-200`, selling price ₹500, GST 18%, initial stock 50 → creates `products` row + `inventory` row (`current_stock=50`) + one `inventory_movements` row (`OPENING_STOCK`, +50).
- **Customer**: ABC Tractor Service.

### Shopkeeper Creates a Draft Sale (Phase 8)
- `sales` row: `sale_status=DRAFT`, `payment_status=ROUGH`, qty 3 × ₹500 = ₹1,500 subtotal, 18% GST = ₹270, `grand_total` ₹1,770.
- `sale_items` row: snapshot of product name/part number/price/GST at this moment.
- **No other table touched** — `inventory.current_stock` is still 50, no payments/invoices/customer_ledger rows exist.

### Shopkeeper Finalizes (Phase 9 — Single Atomic Transaction)

| Table | Before | After |
| :--- | :--- | :--- |
| `inventory` | `current_stock = 50` | `current_stock = 47` |
| `inventory_movements` | — | New row: `SALE_OUT`, `qty_change = −3`, `stock_before=50`, `stock_after=47` |
| `sales` | `DRAFT / ROUGH` | `FINALIZED / PARTIAL`, `paid_amount=1000`, `pending_amount=770` |
| `invoices` | — | New row: `INV-2026-2027-000123`, `grand_total=1770`, `paid=1000`, `pending=770` |
| `payments` | — | New row: ₹1,000, `status=COMPLETED` |
| `payment_allocations` | — | New row: this payment → this invoice, ₹1,000 |
| `customer_ledger` | (prior balance) | + `INVOICE_DEBIT` (+1,770) + `PAYMENT_CREDIT` (−1,000); `running_balance = prior + 770` |
| `audit_logs` | — | New row: `SALE_FINALIZED`, user=shopkeeper |

### Customer Pays Remaining ₹770 (later)
A new `POST /payments` adds one more `payments` row, `payment_allocations` row, `customer_ledger PAYMENT_CREDIT` row (−770); `sales.payment_status` recalculates to `COMPLETED`, `pending_amount → 0`.

---

## 35. Deployment Architecture

```
             ┌──────────────┐
Internet ───▶ │  Nginx (TLS) │
             └──────┬───────┘
                    │
             ┌──────▼───────┐
             │  Node API     │  (stateless — can run N replicas)
             │  (Express)    │
             └──────┬───────┘
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
 PostgreSQL        Redis          Cron worker
(primary DB,    (rate limit,    (low-stock scan,
 automated       session/           cleanup)
 backups)        idempotency
                  cache — opt.)
```

- `docker-compose.yml` for local/staging with `api`, `postgres`, and optionally `redis` services.
- **Env vars**: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `NODE_ENV`, `PORT`, `REDIS_URL`, `LOG_LEVEL`.
- Migrations run as an explicit deploy step (`prisma migrate deploy`) — **never** automatically on app boot in production.

---

## 36. Production Checklist

- [ ] All migrations applied cleanly to production DB
- [ ] Real master data loaded, test/seed data removed
- [ ] Admin account created with a strong password, default seed credentials disabled
- [ ] `.env` secrets set via secure secret storage, not committed anywhere
- [ ] Automated daily backups configured and a restore has actually been tested
- [ ] Rate limiting and CORS locked to real frontend origin(s)
- [ ] Error responses verified to leak no stack traces/internal details
- [ ] Full regression suite green in CI
- [ ] Concurrency test (simultaneous last-unit sale) re-verified against production-scale infra
- [ ] Idempotency-key behavior verified on finalize/payment/cancel
- [ ] Monitoring/alerting live for uptime and elevated error rate
- [ ] Audit log coverage checklist fully verified
- [ ] Rollback plan documented for the deploy pipeline

---

## 37. Future Enhancements

- Multi-branch/warehouse inventory
- Supplier/purchase-order management
- Barcode scanning at point of sale
- WhatsApp / SMS / Email invoice delivery (notification interface already prepared in §20)
- Credit notes / partial invoicing
- Customer self-service portal
- Offline-first mobile support with sync
- Approval workflows for large discounts
- e-Invoicing / e-Way Bill integration for GST compliance
- BI/analytics dashboard beyond Phase 12 basic reports
