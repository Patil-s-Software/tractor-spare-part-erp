# Android API Integration Guide — Tractor Spare Parts ERP

> **Base URL**: `http://<YOUR_PC_IP>:5000/api/v1`  
> For local dev, replace `<YOUR_PC_IP>` with your PC's local IP (e.g. `192.168.1.100`).  
> Find it with: `ipconfig` → IPv4 Address.  
> Both Android device and PC must be on **the same WiFi network**.

---

## Recommended Android Tech Stack

| Layer | Library |
| :--- | :--- |
| **HTTP Client** | Retrofit 2 + OkHttp |
| **JSON Parsing** | Gson or Moshi |
| **Coroutines** | Kotlin Coroutines |
| **Architecture** | MVVM (ViewModel + LiveData / StateFlow) |
| **DI** | Hilt |
| **Token Storage** | EncryptedSharedPreferences |
| **Navigation** | Jetpack Navigation Component |
| **UI** | Jetpack Compose or XML Views |

---

## Project Structure

```
app/src/main/java/com/yourapp/tractorERP/
├── data/
│   ├── api/
│   │   ├── ApiService.kt          ← All Retrofit endpoints
│   │   ├── AuthInterceptor.kt     ← Auto-attach Bearer token
│   │   └── RetrofitClient.kt      ← Retrofit + OkHttp setup
│   ├── models/
│   │   ├── request/               ← Request data classes
│   │   └── response/              ← Response data classes
│   └── repository/
│       ├── AuthRepository.kt
│       ├── ProductRepository.kt
│       ├── SalesRepository.kt
│       └── ...
├── ui/
│   ├── auth/                      ← Login screen, ViewModel
│   ├── dashboard/
│   ├── products/
│   ├── sales/
│   ├── customers/
│   ├── payments/
│   └── reports/
└── utils/
    ├── TokenManager.kt
    ├── Resource.kt                ← sealed class Success/Error/Loading
    └── Constants.kt
```

---

## Step 1 — Gradle Dependencies (`build.gradle app`)

```kotlin
dependencies {
    // Retrofit
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // ViewModel + LiveData
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-livedata-ktx:2.7.0")

    // Hilt
    implementation("com.google.dagger:hilt-android:2.48")
    kapt("com.google.dagger:hilt-compiler:2.48")

    // Encrypted SharedPrefs
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
}
```

---

## Step 2 — Constants.kt

```kotlin
object Constants {
    const val BASE_URL = "http://192.168.1.100:5000/api/v1/"
    const val PREF_ACCESS_TOKEN = "access_token"
    const val PREF_REFRESH_TOKEN = "refresh_token"
    const val PREF_USER_ROLE = "user_role"
    const val PREF_USER_ID = "user_id"
}
```

---

## Step 3 — Token Manager (EncryptedSharedPreferences)

```kotlin
class TokenManager(context: Context) {
    private val prefs = EncryptedSharedPreferences.create(
        "secure_prefs", MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        context, AES256_SIV, AES256_GCM
    )

    fun saveTokens(accessToken: String, refreshToken: String) {
        prefs.edit()
            .putString(Constants.PREF_ACCESS_TOKEN, accessToken)
            .putString(Constants.PREF_REFRESH_TOKEN, refreshToken)
            .apply()
    }

    fun getAccessToken(): String? = prefs.getString(Constants.PREF_ACCESS_TOKEN, null)
    fun getRefreshToken(): String? = prefs.getString(Constants.PREF_REFRESH_TOKEN, null)

    fun clearTokens() {
        prefs.edit().clear().apply()
    }
}
```

---

## Step 4 — Auth Interceptor (auto-attach token + refresh logic)

```kotlin
class AuthInterceptor(private val tokenManager: TokenManager) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokenManager.getAccessToken()
        val request = chain.request().newBuilder()
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .build()
        return chain.proceed(request)
    }
}
```

---

## Step 5 — RetrofitClient.kt

```kotlin
object RetrofitClient {
    fun create(tokenManager: TokenManager): ApiService {
        val logging = HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BODY }
        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(tokenManager))
            .addInterceptor(logging)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()

        return Retrofit.Builder()
            .baseUrl(Constants.BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }
}
```

---

## Step 6 — Standard API Response Wrappers

```kotlin
// Base success response
data class ApiResponse<T>(
    val success: Boolean,
    val message: String,
    val data: T?,
    val meta: MetaData?
)

// Base error response
data class ApiError(
    val success: Boolean,
    val message: String,
    val errorCode: String?,
    val errors: List<String>?
)

data class MetaData(
    val page: Int,
    val limit: Int,
    val total: Int,
    val totalPages: Int
)

// Sealed class for ViewModel state
sealed class Resource<T> {
    class Loading<T> : Resource<T>()
    data class Success<T>(val data: T) : Resource<T>()
    data class Error<T>(val message: String, val errorCode: String? = null) : Resource<T>()
}
```

---

## Step 7 — All API Models & Endpoints

---

### Module 1 — Auth Endpoints

**Base URL suffix**: `/auth`

#### 7.1 LOGIN

**Endpoint**: `POST /api/v1/auth/login`

Request Model:
```kotlin
data class LoginRequest(
    val email: String,       // "admin@tractorerp.com"
    val password: String     // "Admin@12345"
)
```

Response Model:
```kotlin
data class LoginResponse(
    val accessToken: String,
    val refreshToken: String,
    val user: UserProfile
)

data class UserProfile(
    val id: String,
    val name: String,
    val email: String,
    val phone: String?,
    val role: String         // "ADMIN" | "SHOPKEEPER" | "ACCOUNTANT" | "MANAGER"
)
```

Actual JSON Response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "ac049c0c3530a3524df11c71b4...",
    "user": {
      "id": "1",
      "name": "Super Admin",
      "email": "admin@tractorerp.com",
      "phone": "9999999999",
      "role": "ADMIN"
    }
  },
  "meta": null
}
```

Error Responses:
| HTTP | errorCode | Situation |
|------|-----------|-----------|
| 400 | VALIDATION_ERROR | Bad email/password format |
| 401 | UNAUTHORIZED | Wrong credentials |
| 403 | FORBIDDEN | Account inactive |

---

#### 7.2 REFRESH TOKEN

**Endpoint**: `POST /api/v1/auth/refresh`

Request: `{ "refreshToken": "<stored-token>" }`

Response: Same as login (new `accessToken` + `refreshToken`)

---

#### 7.3 LOGOUT

**Endpoint**: `POST /api/v1/auth/logout`

Request: `{ "refreshToken": "<stored-token>" }`
Headers: `Authorization: Bearer <accessToken>`

Response:
```json
{ "success": true, "message": "Logged out successfully", "data": {}, "meta": null }
```

---

#### 7.4 CHANGE PASSWORD

**Endpoint**: `POST /api/v1/auth/change-password`  
Headers: `Authorization: Bearer <accessToken>`

Request:
```kotlin
data class ChangePasswordRequest(
    val currentPassword: String,
    val newPassword: String
)
```

---

### Module 2 — Products

**Base URL suffix**: `/products`

#### 7.5 LIST PRODUCTS

**Endpoint**: `GET /api/v1/products`  
Headers: `Authorization: Bearer <accessToken>`

Query Params:
```
?page=1&limit=20&q=piston&categoryId=1&companyId=1&status=ACTIVE&lowStock=false
```

Response Model:
```kotlin
data class Product(
    val id: String,
    val productCode: String,       // "PRD-000001"
    val name: String,
    val partNumber: String,
    val description: String?,
    val purchasePrice: Double,
    val sellingPrice: Double,
    val gstPercent: Double,
    val minimumStock: Int,
    val status: String,            // "ACTIVE" | "INACTIVE"
    val company: CompanyInfo,
    val category: CategoryInfo,
    val unit: UnitInfo,
    val inventory: InventoryInfo?
)

data class InventoryInfo(
    val currentStock: Int,
    val isLowStock: Boolean
)

data class CompanyInfo(val id: String, val name: String)
data class CategoryInfo(val id: String, val name: String)
data class UnitInfo(val id: String, val name: String, val shortCode: String?)
```

Actual JSON Response:
```json
{
  "success": true,
  "message": "Products list retrieved",
  "data": [
    {
      "id": "1",
      "productCode": "PRD-000001",
      "name": "Piston Ring Set 85mm",
      "partNumber": "PR-85-MHD",
      "sellingPrice": 1800.00,
      "gstPercent": 18,
      "status": "ACTIVE",
      "company": { "id": "1", "name": "Mahindra" },
      "category": { "id": "1", "name": "Engine Parts" },
      "unit": { "id": "1", "name": "Pieces", "shortCode": "Pcs" },
      "inventory": { "currentStock": 47 }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 }
}
```

---

#### 7.6 GET PRODUCT DETAIL

**Endpoint**: `GET /api/v1/products/{id}`  
Headers: `Authorization: Bearer <accessToken>`

Same response as above for a single product.

---

#### 7.7 CREATE PRODUCT (Admin only)

**Endpoint**: `POST /api/v1/products`  
Headers: `Authorization: Bearer <accessToken>`

Request:
```kotlin
data class CreateProductRequest(
    val name: String,
    val partNumber: String,
    val companyId: String,
    val categoryId: String,
    val unitId: String,
    val description: String?,
    val purchasePrice: Double,
    val sellingPrice: Double,
    val gstPercent: Double,
    val minimumStock: Int,
    val initialStock: Int      // Creates OPENING_STOCK movement
)
```

Actual JSON Payload:
```json
{
  "name": "Piston Ring Set 85mm",
  "partNumber": "PR-85-MHD",
  "companyId": "1",
  "categoryId": "1",
  "unitId": "1",
  "description": "High grade piston ring",
  "purchasePrice": 1200.00,
  "sellingPrice": 1800.00,
  "gstPercent": 18,
  "minimumStock": 10,
  "initialStock": 50
}
```

Response (HTTP 201):
```json
{
  "success": true,
  "message": "Product created successfully",
  "data": { "id": "1", "productCode": "PRD-000001", "currentStock": 50 }
}
```

Error Responses:
| HTTP | errorCode | Situation |
|------|-----------|-----------|
| 409 | DUPLICATE_PART_NUMBER | partNumber already exists |

---

#### 7.8 UPDATE PRODUCT STATUS

**Endpoint**: `PATCH /api/v1/products/{id}/status`

Request: `{ "status": "INACTIVE" }` or `{ "status": "ACTIVE" }`

---

### Module 3 — Inventory

**Base URL suffix**: `/inventory`

#### 7.9 LIST INVENTORY

**Endpoint**: `GET /api/v1/inventory`  
Query: `?page=1&limit=20&q=piston&lowStock=true`

Response:
```kotlin
data class InventoryItem(
    val id: String,
    val productId: String,
    val productName: String,
    val productCode: String,
    val partNumber: String,
    val unit: String,
    val currentStock: Int,
    val minimumStock: Int,
    val isLowStock: Boolean,
    val lastMovementAt: String?
)
```

---

#### 7.10 ADJUST STOCK

**Endpoint**: `POST /api/v1/inventory/adjust`

Request:
```kotlin
data class StockAdjustRequest(
    val productId: String,
    val movementType: String,   // "PURCHASE_IN" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "DAMAGE_OUT"
    val quantity: Int,
    val remarks: String
)
```

Actual JSON Payload:
```json
{
  "productId": "1",
  "movementType": "PURCHASE_IN",
  "quantity": 20,
  "remarks": "Stock purchase invoice #8841"
}
```

Response:
```json
{
  "success": true,
  "message": "Stock adjusted successfully",
  "data": { "stockBefore": 47, "stockAfter": 67, "movementId": "38" }
}
```

Error:
| HTTP | errorCode | Situation |
|------|-----------|-----------|
| 409 | INSUFFICIENT_STOCK | OUT would make stock negative |

---

#### 7.11 STOCK MOVEMENTS HISTORY

**Endpoint**: `GET /api/v1/inventory/movements`  
Query: `?page=1&limit=20&productId=1&movementType=SALE_OUT`

---

### Module 4 — Customers

**Base URL suffix**: `/customers`

#### 7.12 LIST CUSTOMERS

**Endpoint**: `GET /api/v1/customers`  
Query: `?page=1&limit=20&q=ramesh&status=ACTIVE`

Response:
```kotlin
data class Customer(
    val id: String,
    val customerCode: String,     // "CUST-000001"
    val name: String,
    val mobile: String,
    val email: String?,
    val address: String?,
    val gstNumber: String?,
    val city: String?,
    val state: String?,
    val openingBalance: Double,
    val creditLimit: Double?,
    val status: String
)
```

---

#### 7.13 CREATE CUSTOMER (Admin only)

**Endpoint**: `POST /api/v1/customers`

Request:
```kotlin
data class CreateCustomerRequest(
    val name: String,
    val mobile: String,             // 10-digit: "9876543210"
    val email: String?,
    val address: String?,
    val gstNumber: String?,         // 15-char GSTIN or null
    val city: String?,
    val state: String?,
    val pincode: String?,
    val openingBalance: Double = 0.0,
    val creditLimit: Double?
)
```

Actual JSON Payload:
```json
{
  "name": "Ramesh Tractor Workshop",
  "mobile": "9876543210",
  "email": "ramesh@workshop.com",
  "address": "Station Road, Ward 4",
  "gstNumber": "27ABCDE1234F1Z5",
  "city": "Nashik",
  "state": "Maharashtra",
  "pincode": "422001",
  "openingBalance": 5000.00,
  "creditLimit": 50000.00
}
```

---

#### 7.14 CUSTOMER OUTSTANDING BALANCE

**Endpoint**: `GET /api/v1/customers/{id}/outstanding`

Response:
```json
{
  "success": true,
  "message": "Customer outstanding balance retrieved",
  "data": { "customerId": "1", "outstanding": 770.00 }
}
```

---

#### 7.15 CUSTOMER LEDGER

**Endpoint**: `GET /api/v1/customers/{id}/ledger`  
Query: `?page=1&limit=20`

Response:
```kotlin
data class LedgerEntry(
    val id: String,
    val entryType: String,          // "INVOICE_DEBIT" | "PAYMENT_CREDIT" | "REVERSAL"
    val debitAmount: Double,
    val creditAmount: Double,
    val runningBalance: Double,
    val description: String,
    val createdAt: String
)
```

---

### Module 5 — Sales

**Base URL suffix**: `/sales`

#### 7.16 CREATE DRAFT SALE

**Endpoint**: `POST /api/v1/sales/draft`  
Headers: `Authorization: Bearer <accessToken>`

Request:
```kotlin
data class CreateDraftSaleRequest(
    val customerId: String,
    val items: List<SaleItemRequest>,
    val discountAmount: Double = 0.0,
    val paidAmount: Double = 0.0
)

data class SaleItemRequest(
    val productId: String,
    val quantity: Int,
    val unitPrice: Double?,         // null = use product's sellingPrice
    val discountAmount: Double = 0.0
)
```

Actual JSON Payload:
```json
{
  "customerId": "1",
  "items": [
    { "productId": "1", "quantity": 2, "discountAmount": 50 },
    { "productId": "3", "quantity": 5 }
  ],
  "discountAmount": 100,
  "paidAmount": 1500.00
}
```

Response (HTTP 201):
```kotlin
data class DraftSale(
    val id: String,
    val saleNumber: String,         // "SL-DRAFT-000123"
    val saleStatus: String,         // "DRAFT"
    val paymentStatus: String,      // "ROUGH"
    val subtotal: Double,
    val gstTotal: Double,
    val discountAmount: Double,
    val grandTotal: Double,
    val paidAmount: Double,
    val pendingAmount: Double,
    val customer: CustomerInfo,
    val saleItems: List<SaleItemDetail>
)

data class SaleItemDetail(
    val productId: String,
    val productNameSnapshot: String,
    val partNumberSnapshot: String,
    val quantity: Int,
    val unitPrice: Double,
    val gstPercent: Double,
    val gstAmount: Double,
    val discountAmount: Double,
    val itemTotal: Double
)
```

---

#### 7.17 LIST SALES

**Endpoint**: `GET /api/v1/sales`  
Query: `?page=1&limit=20&saleStatus=DRAFT&paymentStatus=PARTIAL&customerId=1`

---

#### 7.18 GET SALE DETAIL

**Endpoint**: `GET /api/v1/sales/{id}`

---

#### 7.19 FINALIZE SALE ⚠️ MOST IMPORTANT

**Endpoint**: `POST /api/v1/sales/{id}/finalize`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Idempotency-Key: <unique-UUID>       ← MUST be unique per finalize attempt
Content-Type: application/json
```

> **Android tip**: Generate UUID with `UUID.randomUUID().toString()` once per button press. Store it until success, then generate a new one.

Request:
```kotlin
data class FinalizeSaleRequest(
    val paymentAmount: Double = 0.0,
    val paymentMethod: String?,     // "CASH" | "UPI" | "BANK_TRANSFER" | "CARD" | "CHEQUE" | "CREDIT" | "OTHER"
    val paymentReferenceNote: String? = null
)
```

Actual JSON Payload:
```json
{ "paymentAmount": 1000.00, "paymentMethod": "CASH", "paymentReferenceNote": null }
```

Response (HTTP 200):
```kotlin
data class FinalizeResponse(
    val invoice: InvoiceSummary,
    val sale: SaleSummary
)

data class InvoiceSummary(
    val id: String,
    val invoiceNumber: String,       // "INV-2026-2027-000123"
    val invoiceDate: String,
    val status: String,              // "FINALIZED"
    val subtotal: Double,
    val gstTotal: Double,
    val grandTotal: Double,
    val paidAmount: Double,
    val pendingAmount: Double
)

data class SaleSummary(
    val id: String,
    val saleNumber: String,          // "SL-2026-2027-000456"
    val saleStatus: String,          // "FINALIZED"
    val paymentStatus: String        // "PENDING" | "PARTIAL" | "COMPLETED"
)
```

Error Responses:
| HTTP | errorCode | Situation |
|------|-----------|-----------|
| 409 | INVALID_STATUS_TRANSITION | Sale not in DRAFT state |
| 409 | INSUFFICIENT_STOCK | Product stock ran out before finalizing |
| 409 | PRODUCT_INACTIVE | Product deactivated since draft |
| 409 | CUSTOMER_INACTIVE | Customer deactivated |
| 409 | IDEMPOTENCY_KEY_CONFLICT | Same key, different body |

---

#### 7.20 CANCEL FINALIZED SALE (Admin only)

**Endpoint**: `POST /api/v1/sales/{id}/cancel`  
Headers: + `Idempotency-Key: <uuid>`

Request: `{ "cancelReason": "Customer returned item" }`

---

### Module 6 — Payments

**Base URL suffix**: `/payments`

#### 7.21 RECORD ADDITIONAL PAYMENT

**Endpoint**: `POST /api/v1/payments`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Idempotency-Key: <unique-UUID>
```

Request:
```kotlin
data class CreatePaymentRequest(
    val saleId: String,
    val amount: Double,
    val paymentMethod: String,
    val referenceNote: String? = null
)
```

Actual JSON Payload:
```json
{ "saleId": "991", "amount": 770.00, "paymentMethod": "UPI", "referenceNote": "UPI ref TXN4829182" }
```

Response (HTTP 201):
```kotlin
data class PaymentResponse(
    val payment: PaymentDetail,
    val sale: SaleSummary
)

data class PaymentDetail(
    val id: String,
    val paymentNumber: String,       // "PAY-2026-2027-000055"
    val amount: Double,
    val paymentMethod: String,
    val status: String,              // "COMPLETED"
    val paymentDate: String
)
```

Error Responses:
| HTTP | errorCode | Situation |
|------|-----------|-----------|
| 409 | PAYMENT_EXCEEDS_PENDING | Amount > pending balance |
| 409 | INVALID_STATUS_TRANSITION | Sale already completed/cancelled |

---

#### 7.22 LIST PAYMENTS

**Endpoint**: `GET /api/v1/payments`  
Query: `?page=1&limit=20&saleId=991&status=COMPLETED`

---

#### 7.23 PENDING PAYMENTS

**Endpoint**: `GET /api/v1/payments/pending`

---

#### 7.24 PAYMENT DETAIL

**Endpoint**: `GET /api/v1/payments/{id}`

Response:
```kotlin
data class PaymentDetailFull(
    val id: String,
    val paymentNumber: String,
    val amount: Double,
    val paymentMethod: String,
    val status: String,
    val referenceNote: String?,
    val customer: CustomerInfo,
    val allocations: List<AllocationDetail>
)

data class AllocationDetail(
    val invoiceId: String,
    val invoiceNumber: String,
    val allocatedAmount: Double
)
```

---

#### 7.25 CANCEL PAYMENT

**Endpoint**: `POST /api/v1/payments/{id}/cancel`  
Headers: + `Idempotency-Key: <uuid>`

Request: `{ "cancelReason": "Wrong amount recorded" }`

---

### Module 7 — Invoices

**Base URL suffix**: `/invoices`

#### 7.26 LIST INVOICES

**Endpoint**: `GET /api/v1/invoices`  
Query: `?page=1&limit=20&q=INV-2026&status=FINALIZED&customerId=1`

Response:
```kotlin
data class InvoiceListItem(
    val id: String,
    val invoiceNumber: String,
    val invoiceDate: String,
    val status: String,              // "FINALIZED" | "CANCELLED"
    val grandTotal: Double,
    val paidAmount: Double,
    val pendingAmount: Double,
    val customer: CustomerInfo
)
```

---

#### 7.27 INVOICE DETAIL

**Endpoint**: `GET /api/v1/invoices/{id}`

Response:
```kotlin
data class InvoiceDetail(
    val id: String,
    val invoiceNumber: String,
    val invoiceDate: String,
    val status: String,
    val shopSnapshot: ShopInfo,
    val customerSnapshot: CustomerSnapshot,
    val lineItems: List<InvoiceLineItem>,
    val subtotal: Double,
    val gstTotal: Double,
    val discountTotal: Double,
    val grandTotal: Double,
    val paidAmount: Double,
    val pendingAmount: Double
)

data class InvoiceLineItem(
    val productNameSnapshot: String,
    val partNumberSnapshot: String,
    val unitSnapshot: String,
    val quantity: Int,
    val unitPrice: Double,
    val gstPercent: Double,
    val cgstAmount: Double,
    val sgstAmount: Double,
    val gstAmount: Double,
    val discountAmount: Double,
    val itemTotal: Double
)
```

---

### Module 8 — Reports

**Base URL suffix**: `/reports`

#### 7.28 DASHBOARD

**Endpoint**: `GET /api/v1/reports/dashboard`

Response:
```kotlin
data class DashboardData(
    val todaySales: SalesSummary,
    val todayCollections: Double,
    val pendingPaymentsTotal: Double,
    val totalOutstanding: Double,
    val lowStockCount: Int,
    val outOfStockCount: Int,
    val activeProducts: Int,
    val activeCustomers: Int,
    val topSellingProducts: List<TopProduct>
)

data class SalesSummary(val count: Int, val total: Double)
data class TopProduct(val productId: String, val name: String, val totalQtySold: Int)
```

---

#### 7.29 SALES REPORT

**Endpoint**: `GET /api/v1/reports/sales`  
Query: `?range=daily&date=2026-08-15`  
OR: `?range=monthly&month=2026-08`  
OR: `?range=custom&from=2026-08-01&to=2026-08-15`

---

#### 7.30 LOW STOCK REPORT

**Endpoint**: `GET /api/v1/reports/low-stock`

---

#### 7.31 PENDING PAYMENTS REPORT

**Endpoint**: `GET /api/v1/reports/pending-payments`

---

### Module 9 — Notifications

#### 7.32 LIST NOTIFICATIONS

**Endpoint**: `GET /api/v1/notifications`  
Query: `?page=1&limit=20&isRead=false`

Response:
```kotlin
data class Notification(
    val id: String,
    val type: String,            // "LOW_STOCK" | "PAYMENT_RECEIVED" | "INVOICE_CREATED"
    val title: String,
    val message: String,
    val isRead: Boolean,
    val createdAt: String
)
```

---

#### 7.33 MARK AS READ

**Endpoint**: `PATCH /api/v1/notifications/{id}/read`

Response: `{ "success": true, "message": "Notification marked as read" }`

---

## Step 8 — ApiService.kt (Complete Retrofit Interface)

```kotlin
interface ApiService {

    // AUTH
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<ApiResponse<LoginResponse>>

    @POST("auth/refresh")
    suspend fun refreshToken(@Body request: RefreshTokenRequest): Response<ApiResponse<LoginResponse>>

    @POST("auth/logout")
    suspend fun logout(@Body request: LogoutRequest): Response<ApiResponse<Any>>

    @POST("auth/change-password")
    suspend fun changePassword(@Body request: ChangePasswordRequest): Response<ApiResponse<Any>>

    // PRODUCTS
    @GET("products")
    suspend fun getProducts(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("q") query: String? = null,
        @Query("categoryId") categoryId: String? = null,
        @Query("companyId") companyId: String? = null,
        @Query("status") status: String? = null,
        @Query("lowStock") lowStock: Boolean? = null
    ): Response<ApiResponse<List<Product>>>

    @GET("products/{id}")
    suspend fun getProductById(@Path("id") id: String): Response<ApiResponse<Product>>

    @POST("products")
    suspend fun createProduct(@Body request: CreateProductRequest): Response<ApiResponse<Product>>

    @PUT("products/{id}")
    suspend fun updateProduct(@Path("id") id: String, @Body request: UpdateProductRequest): Response<ApiResponse<Product>>

    @PATCH("products/{id}/status")
    suspend fun updateProductStatus(@Path("id") id: String, @Body request: StatusRequest): Response<ApiResponse<Any>>

    // INVENTORY
    @GET("inventory")
    suspend fun getInventory(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("q") query: String? = null,
        @Query("lowStock") lowStock: Boolean? = null
    ): Response<ApiResponse<List<InventoryItem>>>

    @GET("inventory/{productId}")
    suspend fun getInventoryByProduct(@Path("productId") productId: String): Response<ApiResponse<InventoryItem>>

    @POST("inventory/adjust")
    suspend fun adjustStock(@Body request: StockAdjustRequest): Response<ApiResponse<Any>>

    @GET("inventory/movements")
    suspend fun getStockMovements(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("productId") productId: String? = null,
        @Query("movementType") movementType: String? = null
    ): Response<ApiResponse<List<StockMovement>>>

    // CUSTOMERS
    @GET("customers")
    suspend fun getCustomers(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("q") query: String? = null,
        @Query("status") status: String? = null
    ): Response<ApiResponse<List<Customer>>>

    @GET("customers/{id}")
    suspend fun getCustomerById(@Path("id") id: String): Response<ApiResponse<Customer>>

    @POST("customers")
    suspend fun createCustomer(@Body request: CreateCustomerRequest): Response<ApiResponse<Customer>>

    @PUT("customers/{id}")
    suspend fun updateCustomer(@Path("id") id: String, @Body request: CreateCustomerRequest): Response<ApiResponse<Customer>>

    @GET("customers/{id}/outstanding")
    suspend fun getCustomerOutstanding(@Path("id") id: String): Response<ApiResponse<OutstandingData>>

    @GET("customers/{id}/ledger")
    suspend fun getCustomerLedger(@Path("id") id: String, @Query("page") page: Int = 1): Response<ApiResponse<List<LedgerEntry>>>

    @GET("customers/{id}/sales")
    suspend fun getCustomerSales(@Path("id") id: String): Response<ApiResponse<List<DraftSale>>>

    @GET("customers/{id}/invoices")
    suspend fun getCustomerInvoices(@Path("id") id: String): Response<ApiResponse<List<InvoiceListItem>>>

    // SALES
    @POST("sales/draft")
    suspend fun createDraftSale(@Body request: CreateDraftSaleRequest): Response<ApiResponse<DraftSale>>

    @PUT("sales/{id}")
    suspend fun updateDraftSale(@Path("id") id: String, @Body request: CreateDraftSaleRequest): Response<ApiResponse<DraftSale>>

    @GET("sales")
    suspend fun getSales(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("saleStatus") saleStatus: String? = null,
        @Query("paymentStatus") paymentStatus: String? = null,
        @Query("customerId") customerId: String? = null
    ): Response<ApiResponse<List<DraftSale>>>

    @GET("sales/{id}")
    suspend fun getSaleById(@Path("id") id: String): Response<ApiResponse<DraftSale>>

    @POST("sales/{id}/finalize")
    suspend fun finalizeSale(
        @Path("id") id: String,
        @Header("Idempotency-Key") idempotencyKey: String,
        @Body request: FinalizeSaleRequest
    ): Response<ApiResponse<FinalizeResponse>>

    @POST("sales/{id}/cancel")
    suspend fun cancelSale(
        @Path("id") id: String,
        @Header("Idempotency-Key") idempotencyKey: String,
        @Body request: CancelRequest
    ): Response<ApiResponse<Any>>

    // PAYMENTS
    @POST("payments")
    suspend fun recordPayment(
        @Header("Idempotency-Key") idempotencyKey: String,
        @Body request: CreatePaymentRequest
    ): Response<ApiResponse<PaymentResponse>>

    @GET("payments")
    suspend fun getPayments(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("saleId") saleId: String? = null,
        @Query("status") status: String? = null
    ): Response<ApiResponse<List<PaymentDetail>>>

    @GET("payments/pending")
    suspend fun getPendingPayments(@Query("page") page: Int = 1): Response<ApiResponse<List<DraftSale>>>

    @GET("payments/{id}")
    suspend fun getPaymentById(@Path("id") id: String): Response<ApiResponse<PaymentDetailFull>>

    @POST("payments/{id}/cancel")
    suspend fun cancelPayment(
        @Path("id") id: String,
        @Header("Idempotency-Key") idempotencyKey: String,
        @Body request: CancelRequest
    ): Response<ApiResponse<Any>>

    // INVOICES
    @GET("invoices")
    suspend fun getInvoices(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("q") query: String? = null,
        @Query("status") status: String? = null,
        @Query("customerId") customerId: String? = null
    ): Response<ApiResponse<List<InvoiceListItem>>>

    @GET("invoices/{id}")
    suspend fun getInvoiceById(@Path("id") id: String): Response<ApiResponse<InvoiceDetail>>

    @POST("invoices/{id}/cancel")
    suspend fun cancelInvoice(
        @Path("id") id: String,
        @Header("Idempotency-Key") idempotencyKey: String,
        @Body request: CancelRequest
    ): Response<ApiResponse<Any>>

    // MASTER DATA
    @GET("categories")
    suspend fun getCategories(): Response<ApiResponse<List<CategoryInfo>>>

    @GET("companies")
    suspend fun getCompanies(): Response<ApiResponse<List<CompanyInfo>>>

    @GET("units")
    suspend fun getUnits(): Response<ApiResponse<List<UnitInfo>>>

    // REPORTS
    @GET("reports/dashboard")
    suspend fun getDashboard(): Response<ApiResponse<DashboardData>>

    @GET("reports/sales")
    suspend fun getSalesReport(
        @Query("range") range: String,
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
        @Query("date") date: String? = null,
        @Query("month") month: String? = null
    ): Response<ApiResponse<Any>>

    @GET("reports/low-stock")
    suspend fun getLowStockReport(): Response<ApiResponse<List<InventoryItem>>>

    @GET("reports/pending-payments")
    suspend fun getPendingPaymentsReport(): Response<ApiResponse<Any>>

    // NOTIFICATIONS
    @GET("notifications")
    suspend fun getNotifications(
        @Query("page") page: Int = 1,
        @Query("isRead") isRead: Boolean? = null
    ): Response<ApiResponse<List<Notification>>>

    @PATCH("notifications/{id}/read")
    suspend fun markNotificationRead(@Path("id") id: String): Response<ApiResponse<Any>>
}
```

---

## Step 9 — Error Handling Utility

```kotlin
suspend fun <T> safeApiCall(apiCall: suspend () -> Response<ApiResponse<T>>): Resource<T> {
    return try {
        val response = apiCall()
        if (response.isSuccessful) {
            val body = response.body()
            if (body?.success == true && body.data != null) {
                Resource.Success(body.data)
            } else {
                Resource.Error(body?.message ?: "Unknown error")
            }
        } else {
            val errorBody = response.errorBody()?.string()
            val errorResponse = Gson().fromJson(errorBody, ApiError::class.java)
            Resource.Error(
                message = errorResponse?.message ?: "Error ${response.code()}",
                errorCode = errorResponse?.errorCode
            )
        }
    } catch (e: IOException) {
        Resource.Error("Network error — check your WiFi connection")
    } catch (e: Exception) {
        Resource.Error("Unexpected error: ${e.message}")
    }
}
```

---

## Step 10 — Screen-by-Screen Implementation Priority

| Priority | Screen | API Calls |
| :---: | :--- | :--- |
| 1 | **Login** | `POST /auth/login` → save tokens |
| 2 | **Dashboard** | `GET /reports/dashboard` |
| 3 | **Product List** | `GET /products?page&q&lowStock` |
| 4 | **Product Detail** | `GET /products/{id}` |
| 5 | **Customer List** | `GET /customers?page&q` |
| 6 | **Customer Detail + Outstanding** | `GET /customers/{id}` + `/outstanding` |
| 7 | **Create Draft Sale** | `GET /customers` + `GET /products` + `POST /sales/draft` |
| 8 | **Sales List** | `GET /sales?saleStatus` |
| 9 | **Finalize Sale** | `POST /sales/{id}/finalize` + Idempotency-Key |
| 10 | **Record Payment** | `POST /payments` + Idempotency-Key |
| 11 | **Invoice Detail** | `GET /invoices/{id}` |
| 12 | **Inventory Adjust** | `POST /inventory/adjust` |
| 13 | **Notifications** | `GET /notifications` |
| 14 | **Reports** | `/reports/sales`, `/reports/low-stock` |

---

## Step 11 — Important Notes for Android

1. **Idempotency Key**: Generate `UUID.randomUUID().toString()` once per user action (button press). Save it locally. If the network call fails, **reuse the same UUID on retry** — do not generate a new one. Only generate a new UUID after successful response.

2. **Token Refresh**: If any API returns HTTP 401, call `/auth/refresh`, save new tokens, and **retry the original request**.

3. **Android Network Config** (`res/xml/network_security_config.xml`): Add this to allow HTTP on local IP during development:
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">192.168.1.100</domain>
    </domain-config>
</network-security-config>
```
Then add to `AndroidManifest.xml`:
```xml
<application android:networkSecurityConfig="@xml/network_security_config" ...>
```

4. **BigInt IDs**: The backend uses MySQL `BIGINT` IDs — always handle `id` fields as `String` in Kotlin, not `Int` or `Long`, to avoid overflow. (JSON: `"id": "1"`)

5. **Offline Handling**: Show a friendly error from `safeApiCall` — "Network error — check your WiFi connection".
