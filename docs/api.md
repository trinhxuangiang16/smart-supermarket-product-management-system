# API Summary (MVP)

Base URL: `/api`

## Auth
- `POST /auth/login`
- `POST /auth/register` (ADMIN only)
- `GET /auth/me`

## Approvals
- `POST /approvals/product`
- `GET /approvals/pending-count`
- `GET /approvals/pending`
- `POST /approvals/:id/approve`
- `POST /approvals/:id/reject`

## Products
- `GET /products`
- `GET /products/:id`
- `POST /products`
- `PUT /products/:id`
- `DELETE /products/:id`

Filters on `GET /products`: `search`, `categoryId`, `supplierId`, `expiryStatus`, `expiryFrom`, `expiryTo`, `stockLevel`, `minPrice`, `maxPrice`, `page`, `pageSize`, `sortBy`, `sortOrder`, `preset`.

## Categories
- `GET /categories`
- `POST /categories`
- `PUT /categories/:id`
- `DELETE /categories/:id`

## Suppliers
- `GET /suppliers`
- `GET /suppliers/:id`
- `POST /suppliers`
- `PUT /suppliers/:id`
- `DELETE /suppliers/:id`

## Inventory
- `POST /inventory/in`
- `POST /inventory/out`
- `POST /inventory/adjustment`
- `POST /inventory/destroy`
- `GET /inventory/transactions`
- `GET /inventory/history/:productId`

`GET /inventory/transactions` supports: `type`, `productId`, `search`, `from`, `to`, `page`, `pageSize`, `sortOrder`.

## Audit
- `GET /audit/actions`
- `GET /audit/actions/:id`
- `GET /audit/transaction/:id`

## Expiry
- `GET /expiry/alerts`
- `GET /expiry/critical`
- `POST /expiry/suggest-promo` (rule-based stub)

## Dashboard
- `GET /dashboard/overview`
- `GET /dashboard/recent-transactions` (latest audit activities across all users, newest first; count is configurable in system settings)
- `GET /dashboard/expiry-distribution`
- `GET /dashboard/stock-value-by-category`

## Users
- `GET /users`
- `GET /users/:id`
- `POST /users`
- `PUT /users/:id`
- `PATCH /users/:id/password`
- `DELETE /users/:id`

`GET /users` supports: `search`, `role`, `isActive`, `page`, `pageSize`, `sortBy`, `sortOrder`.

## Settings
- `GET /settings/system`
- `PUT /settings/system` (ADMIN, MANAGER)
- `GET /settings/preferences`
- `PUT /settings/preferences`
- `PATCH /settings/change-password`
- `GET /settings/saved-filters`
- `POST /settings/saved-filters`
- `DELETE /settings/saved-filters/:id`
- `GET /settings/roadmap`

## Reports (Stubs)
- `GET /reports/inventory-snapshot`
- `GET /reports/waste-analysis`
- `GET /reports/profit-by-category`
- `GET /reports/inventory-snapshot.csv`
- `GET /reports/management-report.html`
