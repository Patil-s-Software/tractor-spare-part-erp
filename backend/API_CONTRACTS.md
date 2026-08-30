# Tractor Spare Parts ERP — API Contracts

> **Single source of truth for every endpoint's request/response contract.**  
> All endpoints live under base path `/api/v1`.  
> Standard envelope: `{ success, message, data, meta }` on success; `{ success, message, errorCode, errors[] }` on failure.

---

## Module 1 — Auth & RBAC ✅ IMPLEMENTED

### POST /api/v1/auth/login

- Auth: none
- Role(s): public
- Description: Authenticates a user by email + password and issues a short-lived access JWT and a long-lived refresh token.
- Idempotency-Key required: no

Request payload:
```json
{ "email": "admin@tractorerp.com", "password": "Admin@12345" }
```

Request validation rules:
- `email`: string, required, valid email format
- `password`: string, required, min 6 chars

Success response (200):
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "<jwt>",
    "refreshToken": "<opaque>",
    "user": { "id": "1", "name": "Super Admin", "email": "admin@tractorerp.com", "role": "ADMIN" }
  },
  "meta": {}
}
```

Error responses:
| HTTP | errorCode | Condition |
|------|-----------|-----------|
| 400 | VALIDATION_ERROR | payload fails schema |
| 401 | UNAUTHORIZED | invalid credentials |
| 403 | FORBIDDEN | account inactive |

Business logic notes:
- Password verified via bcrypt compare.
- Refresh token stored as SHA-256 hash in `refresh_tokens`; raw token returned once only.
- Updates `users.last_login_at` on success.

---

### POST /api/v1/auth/refresh

- Auth: refresh token (in body)
- Role(s): any authenticated
- Description: Rotates a refresh token — validates the stored hash, revokes the old token, issues a new pair.
- Idempotency-Key required: no

Request payload:
```json
{ "refreshToken": "<opaque-token>" }
```

Success response (200):
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": { "accessToken": "<new-jwt>", "refreshToken": "<new-opaque>" },
  "meta": {}
}
```

Error responses:
| HTTP | errorCode | Condition |
|------|-----------|-----------|
| 401 | UNAUTHORIZED | token not found, expired, or revoked |

---

### POST /api/v1/auth/logout

- Auth: required (access token)
- Role(s): any authenticated
- Description: Revokes the current refresh token server-side.
- Idempotency-Key required: no

Request payload:
```json
{ "refreshToken": "<opaque-token>" }
```

Success response (200):
```json
{ "success": true, "message": "Logged out successfully", "data": {}, "meta": {} }
```

---

### POST /api/v1/auth/change-password

- Auth: required
- Role(s): any authenticated
- Description: Changes the authenticated user's password after verifying current password.
- Idempotency-Key required: no

Request payload:
```json
{ "currentPassword": "Admin@12345", "newPassword": "NewPass@99" }
```

Request validation rules:
- `currentPassword`: string, required
- `newPassword`: string, required, min 8 chars, at least one uppercase, one digit, one special char

Success response (200):
```json
{ "success": true, "message": "Password changed successfully", "data": {}, "meta": {} }
```

Error responses:
| HTTP | errorCode | Condition |
|------|-----------|-----------|
| 400 | VALIDATION_ERROR | new password too weak |
| 401 | UNAUTHORIZED | current password wrong |

---

## Module 2 — Users (ADMIN-managed) ✅ IMPLEMENTED

### GET /api/v1/users/me

- Auth: required
- Role(s): any authenticated
- Description: Returns the profile of the currently authenticated user.

Success response (200):
```json
{
  "success": true, "message": "Profile retrieved",
  "data": { "id": "1", "name": "Super Admin", "email": "admin@tractorerp.com", "role": "ADMIN", "status": "ACTIVE" },
  "meta": {}
}
```

---

### GET /api/v1/users

- Auth: required
- Role(s): ADMIN
- Description: Lists all users with optional status filter and pagination.

Query params: `?page=1&limit=20&status=ACTIVE`

Success response (200):
```json
{
  "success": true, "message": "Users list retrieved",
  "data": [ { "id": "2", "name": "Ravi Sharma", "email": "ravi@erp.com", "role": "SHOPKEEPER", "status": "ACTIVE" } ],
  "meta": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

---

### POST /api/v1/users

- Auth: required
- Role(s): ADMIN
- Description: Creates a new system user (Admin-managed, no self-registration).

Request payload:
```json
{ "name": "Ravi Sharma", "email": "ravi@erp.com", "phone": "9876543210", "password": "Ravi@1234", "roleId": 2 }
```

Request validation rules:
- `name`: string, required, min 2 chars
- `email`: string, required, valid email, unique
- `phone`: string, optional, 10-digit Indian mobile `/^[6-9]\d{9}$/`
- `password`: string, required, min 8 chars
- `roleId`: integer, required, must reference a valid role

Error responses:
| HTTP | errorCode | Condition |
|------|-----------|-----------|
| 409 | CONFLICT | email already exists |

---

### PATCH /api/v1/users/:id/status

- Auth: required
- Role(s): ADMIN
- Description: Activates or deactivates a user account (no hard delete).

Request payload: `{ "status": "INACTIVE" }`

---

## Module 3 — Master Data ✅ IMPLEMENTED

### GET /POST /PUT — /api/v1/categories

- Auth: required (write: ADMIN; read: all roles)
- Description: CRUD for product categories. Supports nesting via `parentCategoryId`.

POST payload: `{ "name": "Engine Parts", "parentCategoryId": null }`
PUT payload: `{ "name": "Engine & Transmission", "status": "ACTIVE" }`

---

### GET /POST /PUT — /api/v1/companies

- Auth: required (write: ADMIN; read: all roles)
- Description: CRUD for product brands/companies.

POST payload: `{ "name": "Mahindra" }`

---

### GET /POST — /api/v1/units

- Auth: required (write: ADMIN; read: all roles)
- Description: CRUD for measurement units.

POST payload: `{ "name": "Pieces", "shortCode": "Pcs" }`

---

## Module 4 — Products ✅ IMPLEMENTED

### POST /api/v1/products

- Auth: required
- Role(s): ADMIN
- Description: Creates a new product. If `initialStock > 0`, atomically creates an OPENING_STOCK movement and sets `inventory.currentStock`.

Request payload:
```json
{
  "name": "Piston Ring Set 85mm", "partNumber": "PR-85-MHD",
  "companyId": "1", "categoryId": "1", "unitId": "1",
  "description": "High grade piston ring for Mahindra tractor engine",
  "purchasePrice": 1200.00, "sellingPrice": 1800.00, "gstPercent": 18,
  "minimumStock": 10, "initialStock": 50
}
```

Request validation rules:
- `name`: string, required, min 2 chars
- `partNumber`: string, required, unique (case-insensitive)
- `companyId`, `categoryId`, `unitId`: string (BigInt), required, must exist
- `purchasePrice`, `sellingPrice`: number, required, >= 0, max 2 decimal places
- `gstPercent`: number, required, >= 0, max 2 decimal places
- `minimumStock`: integer, optional, >= 0, default 0
- `initialStock`: integer, optional, >= 0, default 0
- **`currentStock` is NOT accepted — rejected at Zod schema level**

Success response (201):
```json
{
  "success": true, "message": "Product created successfully",
  "data": {
    "id": "1", "productCode": "PRD-000001", "name": "Piston Ring Set 85mm",
    "partNumber": "PR-85-MHD", "sellingPrice": 1800.00, "gstPercent": 18,
    "currentStock": 50, "status": "ACTIVE"
  },
  "meta": {}
}
```

Error responses:
| HTTP | errorCode | Condition |
|------|-----------|-----------|
| 409 | DUPLICATE_PART_NUMBER | partNumber already exists |

Business logic notes:
- `productCode` is system-generated (`PRD-000001`), never client-supplied.
- `initialStock > 0`: atomic transaction creates `inventory` + `inventory_movements` (`OPENING_STOCK`) in same tx.

---

### GET /api/v1/products

- Auth: required
- Role(s): any authenticated
- Description: Searches and lists products with filters and pagination including joined current stock.

Query params: `?page=1&limit=20&q=piston&categoryId=1&companyId=1&status=ACTIVE&lowStock=true`

---

### GET /api/v1/products/:id | PUT /api/v1/products/:id | PATCH /api/v1/products/:id/status

- Auth: required (write: ADMIN; read: all roles)
- Description: Product detail, catalog update (stock fields strictly forbidden in PUT payload), status toggle.

Business logic notes (PUT):
- Zod schema rejects `currentStock`, `initialStock` fields with `VALIDATION_ERROR`.

---

## Module 5 — Inventory ✅ IMPLEMENTED

### GET /api/v1/inventory

- Auth: required
- Role(s): any authenticated
- Description: Lists current stock levels with `isLowStock` flag (`currentStock <= minimumStock`).

Query params: `?page=1&limit=20&q=piston&lowStock=true`

---

### GET /api/v1/inventory/:productId

- Auth: required
- Role(s): any authenticated
- Description: Returns detailed stock record for a single product.

---

### POST /api/v1/inventory/adjust

- Auth: required
- Role(s): ADMIN, MANAGER
- Description: Applies a manual stock adjustment (IN or OUT) with reason. Uses `applyStockMovement()` with `SELECT ... FOR UPDATE` row locking.

Request payload:
```json
{ "productId": "1", "movementType": "PURCHASE_IN", "quantity": 20, "remarks": "Stock purchase via invoice #8841" }
```

Request validation rules:
- `productId`: string (BigInt), required, must reference ACTIVE product
- `movementType`: enum [`PURCHASE_IN`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `DAMAGE_OUT`], required
- `quantity`: integer, required, > 0
- `remarks`: string, required, min 3 chars

Success response (200):
```json
{
  "success": true, "message": "Stock adjusted successfully",
  "data": { "stockBefore": 47, "stockAfter": 67, "movementId": "38" },
  "meta": {}
}
```

Error responses:
| HTTP | errorCode | Condition |
|------|-----------|-----------|
| 409 | INSUFFICIENT_STOCK | OUT movement would result in negative stock |
| 409 | PRODUCT_INACTIVE | product is not ACTIVE |

---

### GET /api/v1/inventory/movements

- Auth: required
- Role(s): any authenticated
- Description: Returns append-only stock movement history, filterable by product, movement type.

Query params: `?page=1&limit=20&productId=1&movementType=SALE_OUT`

---

## Module 6 — Customers ✅ IMPLEMENTED

### POST /api/v1/customers

- Auth: required
- Role(s): ADMIN
- Description: Creates a new customer. Auto-generates `customerCode`. If `openingBalance > 0`, writes an OPENING_BALANCE ledger entry.

Request payload:
```json
{
  "name": "Ramesh Tractor Workshop", "mobile": "9876543210",
  "email": "ramesh@workshop.com", "address": "Station Road, Ward 4",
  "gstNumber": "27ABCDE1234F1Z5", "city": "Nashik", "state": "Maharashtra",
  "openingBalance": 5000.00, "creditLimit": 50000.00
}
```

Request validation rules:
- `name`: string, required, min 2 chars
- `mobile`: string, required, `/^[6-9]\d{9}$/`, unique
- `email`: string, optional, valid email format
- `gstNumber`: string, optional, 15-char GSTIN pattern
- `openingBalance`: number, optional, >= 0, default 0
- `creditLimit`: number, optional, > 0

Error responses:
| HTTP | errorCode | Condition |
|------|-----------|-----------|
| 409 | CONFLICT | mobile number already exists |

---

### GET /api/v1/customers | GET /api/v1/customers/:id | PUT /api/v1/customers/:id

- Auth: required (write: ADMIN; read: all roles)

---

### Customer sub-resource read views (all GET, all roles)

- `GET /api/v1/customers/:id/sales` — customer's sales history
- `GET /api/v1/customers/:id/invoices` — customer's invoices
- `GET /api/v1/customers/:id/payments` — customer's payment records
- `GET /api/v1/customers/:id/ledger` — paginated ledger entries with running balance
- `GET /api/v1/customers/:id/outstanding` — current outstanding balance

```json
{
  "success": true, "message": "Customer outstanding balance retrieved",
  "data": { "customerId": "1", "outstanding": 770.00 },
  "meta": {}
}
```

---

## Module 7 — Sales (Draft & Finalize) ✅ IMPLEMENTED

### POST /api/v1/sales/draft

- Auth: required
- Role(s): ADMIN, SHOPKEEPER, MANAGER
- Description: Creates a DRAFT sale with zero side effects — no inventory, ledger, invoice, or payment writes.

Request payload:
```json
{
  "customerId": "1",
  "items": [
    { "productId": "1", "quantity": 2, "discountAmount": 50 },
    { "productId": "3", "quantity": 5 }
  ],
  "discountAmount": 100, "paidAmount": 1500.00
}
```

Request validation rules:
- `customerId`: string (BigInt), required, must reference ACTIVE customer
- `items`: array, required, min 1 item
- `items[].productId`: string (BigInt), required, must reference ACTIVE product
- `items[].quantity`: integer, required, > 0
- `items[].discountAmount`: number, optional, >= 0, must not exceed line subtotal
- `discountAmount`: number, optional, >= 0
- `paidAmount`: number, optional, >= 0, default 0

Success response (201):
```json
{
  "success": true, "message": "Draft sale created successfully",
  "data": {
    "id": "991", "saleNumber": "SL-DRAFT-000123",
    "saleStatus": "DRAFT", "paymentStatus": "ROUGH",
    "grandTotal": 4148.00, "paidAmount": 1500.00, "pendingAmount": 4148.00
  },
  "meta": {}
}
```

Business logic notes:
- GST previewed at draft time but **recalculated from live product data at finalize time**.
- No writes to `inventory`, `invoices`, `payments`, `customer_ledger`, or `audit_logs`.

---

### PUT /api/v1/sales/:id

- Auth: required
- Role(s): ADMIN, SHOPKEEPER, MANAGER
- Description: Edits an existing DRAFT sale. Only `sale_status = DRAFT` sales can be modified.

---

### GET /api/v1/sales | GET /api/v1/sales/:id

- Auth: required
- Role(s): any authenticated

Query params (list): `?page=1&limit=20&saleStatus=FINALIZED&paymentStatus=PARTIAL&customerId=1`

---

### POST /api/v1/sales/:id/finalize

- Auth: required
- Role(s): ADMIN, SHOPKEEPER, MANAGER
- Description: Finalizes a draft sale in a 13-step atomic transaction.
- Idempotency-Key required: yes (`Idempotency-Key: <uuid>` header)

Request payload:
```json
{ "paymentAmount": 1000.00, "paymentMethod": "CASH", "paymentReferenceNote": null }
```

Request validation rules:
- `paymentAmount`: number, optional, >= 0, <= `sale.grandTotal`
- `paymentMethod`: enum [`CASH`, `UPI`, `BANK_TRANSFER`, `CARD`, `CHEQUE`, `CREDIT`, `OTHER`], required if `paymentAmount > 0`
- Sale must be `sale_status = DRAFT`
- `Idempotency-Key` header: required, UUID format

Success response (200):
```json
{
  "success": true, "message": "Sale finalized successfully",
  "data": {
    "invoice": { "id": "4021", "invoiceNumber": "INV-2026-2027-000123", "status": "FINALIZED", "grandTotal": 1770.00, "paidAmount": 1000.00, "pendingAmount": 770.00 },
    "sale": { "id": "991", "saleNumber": "SL-2026-2027-000456", "saleStatus": "FINALIZED", "paymentStatus": "PARTIAL" }
  },
  "meta": {}
}
```

Error responses:
| HTTP | errorCode | Condition |
|------|-----------|-----------|
| 404 | NOT_FOUND | sale id does not exist |
| 409 | INVALID_STATUS_TRANSITION | sale is not currently DRAFT |
| 409 | INSUFFICIENT_STOCK | any product has insufficient stock at finalize time |
| 409 | PRODUCT_INACTIVE | product deactivated since draft was created |
| 409 | CUSTOMER_INACTIVE | customer deactivated since draft was created |
| 409 | IDEMPOTENCY_KEY_CONFLICT | same key with different request body |

Business logic notes:
- **13-Step atomic transaction** — lock sale → validate → lock inventory (sorted by `product_id`) → recalculate GST server-side → stock check → generate doc numbers → insert movements → create invoice → create payment → post ledger → update sale → write audit + idempotency key.

---

### POST /api/v1/sales/:id/cancel

- Auth: required
- Role(s): ADMIN only
- Description: Cancels a FINALIZED sale — reverses deducted inventory and posts ledger reversal.
- Idempotency-Key required: yes

Request payload: `{ "cancelReason": "Customer returned item — wrong model" }`

---

## Module 8 — Payments 🔲 TO IMPLEMENT NEXT

### POST /api/v1/payments

- Auth: required
- Role(s): ADMIN, SHOPKEEPER, ACCOUNTANT, MANAGER
- Description: Records an additional payment against an existing FINALIZED invoice's pending balance.
- Idempotency-Key required: yes (`Idempotency-Key: <uuid>` header)

Request payload:
```json
{ "saleId": "991", "amount": 770.00, "paymentMethod": "UPI", "referenceNote": "UPI ref TXN4829182" }
```

Request validation rules:
- `saleId`: string (BigInt), required, must reference FINALIZED sale with `pendingAmount > 0`
- `amount`: number, required, > 0, <= `sale.pendingAmount`
- `paymentMethod`: enum [`CASH`, `UPI`, `BANK_TRANSFER`, `CARD`, `CHEQUE`, `CREDIT`, `OTHER`], required
- `referenceNote`: string, optional, max 150 chars
- `Idempotency-Key` header: required, UUID format

Success response (201):
```json
{
  "success": true, "message": "Payment recorded successfully",
  "data": {
    "payment": { "id": "55", "paymentNumber": "PAY-2026-2027-000055", "amount": 770.00, "paymentMethod": "UPI", "status": "COMPLETED" },
    "sale": { "id": "991", "paymentStatus": "COMPLETED", "paidAmount": 1770.00, "pendingAmount": 0.00 }
  },
  "meta": {}
}
```

Error responses:
| HTTP | errorCode | Condition |
|------|-----------|-----------|
| 404 | NOT_FOUND | sale not found |
| 409 | INVALID_STATUS_TRANSITION | sale not FINALIZED or already COMPLETED/CANCELLED |
| 409 | PAYMENT_EXCEEDS_PENDING | amount > pendingAmount |
| 409 | IDEMPOTENCY_KEY_CONFLICT | duplicate key with different body |

Business logic notes:
- Atomic: lock sale → validate amount → insert `payments` + `payment_allocations` → update `sale.paidAmount`/`pendingAmount` → re-derive `paymentStatus` → post `PAYMENT_CREDIT` to `customer_ledger` → write `audit_logs` → save idempotency key.
- `paymentNumber` generated from `document_sequences`.

---

### GET /api/v1/payments

- Auth: required; Role(s): any authenticated
- Description: Lists payments. Query params: `?saleId=991&customerId=1&status=COMPLETED&paymentMethod=UPI`

---

### GET /api/v1/payments/pending

- Auth: required; Role(s): any authenticated
- Description: Lists FINALIZED sales with `pendingAmount > 0`.

---

### GET /api/v1/payments/completed

- Auth: required; Role(s): any authenticated
- Description: Lists sales where `paymentStatus = COMPLETED`.

---

### GET /api/v1/payments/:id

- Auth: required; Role(s): any authenticated
- Description: Single payment detail with allocations.

Success response (200):
```json
{
  "success": true, "message": "Payment detail retrieved",
  "data": {
    "id": "55", "paymentNumber": "PAY-2026-2027-000055", "amount": 770.00,
    "paymentMethod": "UPI", "status": "COMPLETED",
    "customer": { "id": "1", "name": "Ramesh Tractor Workshop" },
    "allocations": [ { "invoiceId": "4021", "invoiceNumber": "INV-2026-2027-000123", "allocatedAmount": 770.00 } ]
  },
  "meta": {}
}
```

---

### POST /api/v1/payments/:id/cancel

- Auth: required
- Role(s): ADMIN, ACCOUNTANT
- Description: Cancels a payment — marks CANCELLED, posts offset ledger entry. Never deletes.
- Idempotency-Key required: yes

Request payload: `{ "cancelReason": "Wrong amount recorded" }`
Validation: `cancelReason` string required min 3 chars; payment must be `COMPLETED`.

Business logic notes:
- Atomic: mark `CANCELLED` → reverse `sale.paidAmount`/`pendingAmount` → re-derive `paymentStatus` → post `PAYMENT_CANCEL_DEBIT` ledger entry → write audit.

---

### POST /api/v1/payments/:id/refund

- Auth: required
- Role(s): ADMIN only
- Description: Processes a refund for a completed payment.

Request payload: `{ "refundAmount": 770.00, "refundReason": "Customer returned defective part" }`
Validation: `refundAmount` > 0, <= `payment.amount`.

Business logic notes:
- Posts `REFUND_CREDIT` to `customer_ledger`. Sets `payment.status = REFUNDED`.

---

## Module 9 — Invoices 🔲 TO IMPLEMENT

### GET /api/v1/invoices

- Auth: required; Role(s): any authenticated
- Description: Lists invoices with search and filters.

Query params: `?page=1&limit=20&q=INV-2026&customerId=1&status=FINALIZED`

---

### GET /api/v1/invoices/:id

- Auth: required; Role(s): any authenticated
- Description: Full invoice detail — immutable `shopSnapshot`, `customerSnapshot`, and line items from `sale_items` (never joined live from `products`).

Success response (200):
```json
{
  "success": true, "message": "Invoice detail retrieved",
  "data": {
    "id": "4021", "invoiceNumber": "INV-2026-2027-000123", "status": "FINALIZED",
    "shopSnapshot": { "name": "Tractor Spare Parts ERP Store", "gstin": "27AAAAA0000A1Z5" },
    "customerSnapshot": { "name": "Ramesh Tractor Workshop", "mobile": "9876543210" },
    "lineItems": [
      { "productNameSnapshot": "Piston Ring Set 85mm", "partNumberSnapshot": "PR-85-MHD",
        "quantity": 2, "unitPrice": 1800.00, "gstPercent": 18, "cgstAmount": 270.00, "sgstAmount": 270.00, "itemTotal": 3996.00 }
    ],
    "subtotal": 3600.00, "gstTotal": 540.00, "grandTotal": 4040.00,
    "paidAmount": 4040.00, "pendingAmount": 0.00
  },
  "meta": {}
}
```

---

### POST /api/v1/invoices/:id/cancel

- Auth: required
- Role(s): ADMIN only
- Description: Cancels a FINALIZED invoice — reverses deducted stock and posts ledger reversal. Admin-only.
- Idempotency-Key required: yes

Request payload: `{ "cancelReason": "Customer rejected the entire order" }`
Validation: `cancelReason` string required min 3 chars; invoice must be `status = FINALIZED`.

Success response (200):
```json
{
  "success": true, "message": "Invoice cancelled and stock reversed successfully",
  "data": { "invoiceId": "4021", "status": "CANCELLED", "saleStatus": "CANCELLED" },
  "meta": {}
}
```

Error responses:
| HTTP | errorCode | Condition |
|------|-----------|-----------|
| 409 | INVALID_STATUS_TRANSITION | invoice already CANCELLED |
| 403 | FORBIDDEN | non-Admin attempting cancellation |

Business logic notes:
- Atomic: lock sale + invoice → call `applyStockMovement(SALE_CANCEL_REVERSAL_IN)` for each line item → post `REVERSAL` ledger entry → set `invoice.status = CANCELLED`, `sale.saleStatus = CANCELLED` → write audit + idempotency key.

---

## Module 10 — Reports & Dashboard 🔲 TO IMPLEMENT

### GET /api/v1/reports/dashboard

- Auth: required; Role(s): ADMIN, MANAGER, ACCOUNTANT

Success response (200):
```json
{
  "success": true, "message": "Dashboard retrieved",
  "data": {
    "todaySales": { "count": 12, "total": 48500.00 },
    "todayCollections": 32000.00, "pendingPaymentsTotal": 156000.00,
    "totalOutstanding": 89500.00, "lowStockCount": 8, "outOfStockCount": 2,
    "activeProducts": 142, "activeCustomers": 67,
    "topSellingProducts": [ { "productId": "1", "name": "Piston Ring Set 85mm", "totalQtySold": 320 } ]
  },
  "meta": {}
}
```

---

### GET /api/v1/reports/sales

- Auth: required; Role(s): ADMIN, MANAGER, ACCOUNTANT
- Query params: `?range=daily&date=2026-08-15` OR `?range=monthly&month=2026-08` OR `?range=custom&from=2026-08-01&to=2026-08-15`

---

### GET /api/v1/reports/stock

- Auth: required; Role(s): ADMIN, MANAGER
- Description: Full stock valuation report — all products with `currentStock × purchasePrice`.

---

### GET /api/v1/reports/low-stock

- Auth: required; Role(s): ADMIN, MANAGER
- Description: Products where `currentStock <= minimumStock`.

---

### GET /api/v1/reports/pending-payments

- Auth: required; Role(s): ADMIN, MANAGER, ACCOUNTANT
- Description: Aging report — invoices with `pendingAmount > 0` grouped by age (0–30, 31–60, 60+ days).

---

### GET /api/v1/reports/profit

- Auth: required; Role(s): ADMIN only
- Description: Profit report: `(sellingPrice - purchasePrice) × quantity` per product.
- Query params: `?from=2026-08-01&to=2026-08-15`

---

## Module 11 — Notifications 🔲 TO IMPLEMENT

### GET /api/v1/notifications

- Auth: required; Role(s): any authenticated
- Query params: `?page=1&limit=20&isRead=false`

Success response (200):
```json
{
  "success": true, "message": "Notifications retrieved",
  "data": [ { "id": "10", "type": "LOW_STOCK", "title": "Low Stock Alert", "message": "Piston Ring below minimum (8 remaining, min 10)", "isRead": false } ],
  "meta": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 }
}
```

---

### PATCH /api/v1/notifications/:id/read

- Auth: required; Role(s): any authenticated
- Description: Marks a notification as read.

Success response (200): `{ "success": true, "message": "Notification marked as read", "data": { "id": "10", "isRead": true }, "meta": {} }`

---

## Module 12 — Audit Logs 🔲 TO IMPLEMENT

### GET /api/v1/audit-logs

- Auth: required
- Role(s): ADMIN only
- Description: Full audit trail, filterable by module, action, user, record ID, and date range.

Query params: `?page=1&limit=20&module=SALES&action=SALE_FINALIZED&userId=2&from=2026-08-01&to=2026-08-15`

Success response (200):
```json
{
  "success": true, "message": "Audit logs retrieved",
  "data": [
    { "id": "500", "userId": "2", "userName": "Ravi Sharma", "action": "SALE_FINALIZED",
      "module": "SALES", "recordId": "991",
      "newValue": { "invoiceNumber": "INV-2026-2027-000123", "grandTotal": 1770.00 },
      "createdAt": "2026-08-15T08:32:11Z" }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1500, "totalPages": 75 }
}
```
