# Seed Accounts

All accounts use password: `Password123!`

- `admin@supermarket.test` - `ADMIN`
- `manager@supermarket.test` - `MANAGER`
- `warehouse@supermarket.test` - `WAREHOUSE_STAFF` (inventory department)
- `cashier@supermarket.test` - `CASHIER`
- `sales@supermarket.test` - `SALE_DEPARTMENT`
- `finance@supermarket.test` - `FINANCE_DEPARTMENT`

## Product Permission Notes

- `ADMIN`, `MANAGER`:
  - Create product directly
  - Edit/delete product directly (with confirm modal)

## User Management Rule

- Only `ADMIN` can create user with role `ADMIN`.
- Other accounts cannot create or assign `ADMIN` role.

- `WAREHOUSE_STAFF`, `CASHIER`:
  - Can access product page
  - Edit/delete must go through approval request flow

- `SALE_DEPARTMENT`, `FINANCE_DEPARTMENT`:
  - Reports access
  - Audit History access

## Run On New Machine (Docker DB Only)

### 1) Prerequisites

- Install `Node.js` (20+)
- Install `Docker Desktop`
- Install `Git`

### 2) Clone and install

```bash
git clone <repo-url>
cd smart-supermarket-product-management-system
corepack enable
corepack pnpm install
```

### 3) Start MySQL in Docker

```bash
docker run -d --name smart-saas-db \
  -e MYSQL_ROOT_PASSWORD=123456 \
  -e MYSQL_DATABASE=smart_supermarket \
  -p 3309:3306 \
  mysql:latest
```

### 4) Create `.env` in project root

```env
PORT=4000
DATABASE_URL=mysql://root:123456@localhost:3309/smart_supermarket
CORS_ORIGIN=http://localhost:5173
```

Notes:
- JWT/refresh token env is optional in local dev (fallback is built-in).
- If web runs on another port (example `5174`), set `CORS_ORIGIN` to that port.

### 5) Migrate and seed

```bash
corepack pnpm --filter @smart-supermarket/api prisma:deploy
corepack pnpm --filter @smart-supermarket/api prisma:seed
```

### 6) Start API and Web

Terminal 1:
```bash
corepack pnpm --filter @smart-supermarket/api dev
```

Terminal 2:
```bash
corepack pnpm --filter @smart-supermarket/web dev
```

### 7) Quick health checks

- API: `http://localhost:4000/health` returns `{"status":"ok"}`
- Web: open Vite URL shown in terminal
- Login using seeded accounts above

### 8) Common issues

- `503 Database is unavailable`
  - Check Docker DB is running and mapped to `3309:3306`
  - Verify `DATABASE_URL` matches port `3309`

- `EADDRINUSE: 4000`
  - Another API process is already using port `4000`
  - Stop old process or restart machine terminal session

## Project Feature Checklist (By Sidebar)

This section summarizes what is already completed in the current project, grouped by sidebar modules.

### 1) Dashboard

Completed:
- KPI cards:
  - Total products
  - Total stock value
  - Expiring soon
  - Expired
  - Low stock (threshold from System Settings)
- Expiry distribution chart
- Stock value by category chart
- Recent database activities (latest N, refresh interval configurable)
- Activity detail modal:
  - clear actor/action/target/time
  - changed-fields table (before/after)
  - technical JSON section (collapsible)

Can be developed further:
- Configurable dashboard layouts per role
- Trend charts by day/week/month
- Saved dashboard views
- Alert center with acknowledgment workflow

### 2) Products

Completed:
- Product listing with:
  - search
  - filters (category, supplier, expiry status, stock level, price range)
  - pagination and sorting
  - KPI preset filters from Dashboard navigation
- Product CRUD with RBAC:
  - `ADMIN` / `MANAGER`: direct edit/delete with confirmation modal
  - `WAREHOUSE_STAFF` / `CASHIER`: approval-request flow for edit/delete
- Profit margin recalculation on create/update
- Expiry status recalculation from expiry date
- Soft delete behavior (`isDeleted`, `deletedAt`)

Can be developed further:
- Bulk actions (bulk edit, bulk assign supplier/category)
- Product image upload storage integration
- Product variants / packaging conversion
- Advanced product validation rules by category

### 3) Inventory

Completed:
- Transaction flows:
  - IN
  - OUT
  - ADJUSTMENT (increase/decrease)
  - DESTROY (reason required)
- Stock protection rules:
  - no negative stock
  - expired stock operation restrictions by role
  - destroyed product cannot be transacted
- Inventory transaction listing:
  - filters (type, search, date range)
  - pagination
- Inventory history endpoint by product

Can be developed further:
- Batch inventory import
- Stock counting sessions and reconciliation workflow
- Multi-warehouse support
- Approval flow for high-impact inventory adjustments

### 4) Suppliers

Completed:
- Supplier CRUD page and API
- Search supplier by name/email/phone/address
- Product count per supplier
- Deletion protection if supplier is linked to products
- Updated table layout for better UI/UX readability

Can be developed further:
- Contact person + notes persisted in DB (migration required)
- Supplier performance metrics (lead time, defect rate)
- Purchase order integration

### 5) Categories

Completed:
- Category CRUD
- Category listing with product count
- Prevent deleting category if products still linked

Can be developed further:
- Category hierarchy (parent/child)
- Category-specific rules (required expiry/supplier/etc.)

### 6) Expiry Alerts

Completed:
- Alert and critical endpoints
- Rule-based promotion suggestion endpoint (`suggest-promo`)

Can be developed further:
- Scheduled expiry scanning job
- Auto-create markdown/clearance tasks
- Expiry handling workflow with approvals

### 7) Reports

Completed:
- Real DB-backed reports:
  - inventory snapshot
  - waste analysis
  - profit by category
- Export options:
  - CSV
  - Friendly HTML management report
  - Real PDF export (`management-report.pdf`)
- Date-range filter support
- Currency/date aligned to US format

Can be developed further:
- Native Excel export (`.xlsx`)
- Scheduled report emails
- Role-specific report templates
- Drill-down links from report rows to transactional pages

### 8) Audit History

Completed:
- Full audit actions listing with search/pagination
- All users can view audit history
- Color-coded action badges
- Improved detail modal with:
  - business-readable summary
  - field-level before/after changes
  - technical JSON collapsible panel

Can be developed further:
- Export audit trails
- Saved audit filters and compliance views
- Correlation IDs across modules

### 9) Users

Completed:
- Admin-only user management page and API
- User list with filters/pagination
- Create / edit / reset password / delete user
- Delete protections:
  - cannot delete own account
  - admin-only delete
- Single-admin policy:
  - system allows only one `ADMIN` account
- Manager cannot access user management page

Can be developed further:
- Fine-grained permission matrix per module/action
- User invitation flow (email token)
- Session/device management

### 10) Settings

Completed:
- Grouped into:
  - System Settings (for `ADMIN` / `MANAGER`)
  - Personal Settings (for current user)
- System settings:
  - store profile
  - operational thresholds and refresh intervals
  - report profile/footer options
- Personal settings:
  - notification preferences
  - table density/page size
  - saved filters
  - change my password

Can be developed further:
- Theme/profile presets per role
- Notification channels (email/SMS/webhook)
- Organization-level policy settings

### 11) Authentication & Security

Completed:
- JWT login + `/auth/me`
- Refresh token flow:
  - `/auth/refresh`
  - `/auth/logout`
- Automatic token refresh in frontend API client
- Rate limiting on auth routes
- RBAC enforced server-side
- Password hashing (`bcrypt`)
- Clear DB unavailable error (`503 DB_UNAVAILABLE`)

Can be developed further:
- Persisted refresh-token store (DB/Redis) instead of in-memory revocation set
- Rotating signing keys / key IDs
- Security audit logs for auth events

### 12) Data Seed & Environment

Completed:
- Seed users for all project roles
- Seed suppliers (40 entries, US-style addresses)
- Seed products (target 200 records in current setup)
- Seed inventory transactions and audit logs
- Cross-machine local run with Docker DB-only setup documented

Can be developed further:
- Strict 1:1 import of full canonical 200 product dataset
- Seed versioning and deterministic fixtures
- CSV import tool for suppliers/products
