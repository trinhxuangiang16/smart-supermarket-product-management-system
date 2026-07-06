# Smart Supermarket Product Management System — Cấu trúc & Tính năng dự án

> Tài liệu tổng hợp cấu trúc thư mục và tính năng của toàn bộ hệ thống (Frontend + Backend), dựa trên mã nguồn thực tế trong repo tại thời điểm 2026-07-06 (sau khi hoàn thành 3 phase mở rộng SaaS: AI Provider Layer, Assets/Employees, AI Insights).

## 1. Tổng quan

Đây là hệ thống quản lý sản phẩm siêu thị (MVP) theo mô hình **pnpm/npm monorepo**, gồm:

- **Backend**: Node.js + Express + Prisma ORM + MySQL (TypeScript)
- **Frontend**: React + Vite + TypeScript + TanStack Query
- **Database**: MySQL, chạy qua Docker Compose
- **Shared package**: types/constants dùng chung giữa FE và BE

```
smart-supermarket-product-management-system/
├── apps/
│   ├── api/            # Backend: Express + Prisma
│   └── web/             # Frontend: React + Vite
├── packages/
│   └── shared/           # Types/constants dùng chung
├── docs/                 # Tài liệu API, kiến trúc, roadmap
├── docker-compose.yml     # MySQL container
├── package.json           # Root workspace scripts
└── pnpm-workspace.yaml
```

### Chạy dự án

```bash
cp .env.example .env
npm install
npm run db:up        # Khởi động MySQL (Docker)
npm run db:setup      # Prisma generate + migrate + seed
npm run dev            # Chạy song song API + Web
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000/api`

### Tài khoản seed mẫu (mật khẩu chung: `Password123!`)
| Email | Vai trò |
|---|---|
| admin@supermarket.test | ADMIN |
| manager@supermarket.test | MANAGER |
| warehouse@supermarket.test | WAREHOUSE_STAFF |
| cashier@supermarket.test | CASHIER |
| sales@supermarket.test | SALE_DEPARTMENT |
| finance@supermarket.test | FINANCE_DEPARTMENT |

---

## 2. Backend (`apps/api`)

### 2.1 Công nghệ
- **Express 4** (REST API), TypeScript, chạy qua `tsx watch`
- **Prisma 6** ORM với MySQL
- **JWT** (`jsonwebtoken`) cho access token, cơ chế session lưu DB (`UserSession`) hỗ trợ refresh token
- **bcryptjs** để hash mật khẩu
- **zod** để validate request payload
- **express-rate-limit**, **cors**, **express-async-errors**
- **pdfkit**, **xlsx** cho xuất báo cáo (PDF/Excel)

### 2.2 Cấu trúc thư mục

```
apps/api/src/
├── config/                 # Cấu hình ứng dụng
├── lib/
│   ├── prisma.ts             # Prisma client singleton
│   ├── jwt.ts                # Sign/verify access token
│   ├── password.ts           # Hash/compare mật khẩu
│   ├── expiry.ts             # Logic tính expiryStatus theo ngày hết hạn
│   └── response.ts           # Helper chuẩn hoá response { ok, data, message }
├── middleware/
│   ├── require-auth.ts        # Xác thực JWT, gắn req.user, giới hạn role báo cáo
│   ├── require-role.ts        # Guard theo role (RBAC)
│   ├── error-handler.ts       # Xử lý lỗi tập trung
│   ├── request-context.ts     # Context theo request
│   └── request-id.ts          # Gắn request id để trace/audit
├── modules/                  # Mỗi domain là 1 module riêng (routes + service)
│   ├── ai/                     # AI provider layer: providers.ts (groq/gemini/claude/openai), ai.service.ts (chatWithFallback), ai.routes.ts (/ai/chat, /ai/settings)
│   ├── assets/                  # Quản lý tài sản (CRUD, khấu hao tuyến tính, soft-delete)
│   ├── auth/                   # Đăng nhập, đăng ký, refresh, /me
│   ├── employees/               # Nhân viên + phòng ban (employees.routes.ts, departments.routes.ts)
│   ├── insights/                # AI Insights: gom dữ liệu DB → prompt → AI → summary/findings/recommendations (cache InsightRun)
│   ├── users/                   # Quản lý người dùng
│   ├── products/                 # CRUD sản phẩm
│   ├── categories/               # Danh mục sản phẩm (cây phân cấp)
│   ├── suppliers/                 # Nhà cung cấp
│   ├── warehouses/                 # Kho hàng
│   ├── inventory/                   # Nhập/xuất/điều chỉnh/huỷ kho
│   ├── expiry/                       # Cảnh báo hạn sử dụng
│   ├── approvals/                     # Luồng duyệt sửa/xoá sản phẩm
│   ├── audit/                          # Nhật ký hành động (audit log)
│   ├── dashboard/                       # KPI, biểu đồ tổng quan
│   ├── reports/                          # Báo cáo (stub + export CSV/HTML)
│   ├── settings/                          # Cài đặt hệ thống & cá nhân
│   ├── automation/                         # Job tự động (expiry sync, KPI snapshot)
│   └── common/                              # Helper dùng chung giữa modules
├── routes/index.ts           # Gộp tất cả router con vào /api
└── server.ts                  # Entry point Express app
```

### 2.3 Mô hình dữ liệu (Prisma schema — MySQL)

| Model | Mô tả |
|---|---|
| `User` | Người dùng hệ thống, có `role`, `isActive`, liên kết sản phẩm/giao dịch/audit đã tạo |
| `Category` | Danh mục sản phẩm, hỗ trợ cây cha-con (`parentId`) |
| `Supplier` | Nhà cung cấp (email, sđt, địa chỉ, người liên hệ) |
| `Product` | Sản phẩm: SKU, barcode, loại, đơn vị tính, giá vốn/giá bán, tồn kho, ngưỡng đặt hàng lại, ngày sản xuất/hết hạn, trạng thái hạn dùng, soft-delete |
| `Warehouse` | Kho hàng (mã kho, tên, địa chỉ, trạng thái hoạt động) |
| `InventoryTransaction` | Giao dịch kho: IN / OUT / ADJUSTMENT / DESTROY, gắn với kho, người thực hiện, người duyệt |
| `ApprovalRequest` | Yêu cầu duyệt sửa/xoá sản phẩm (PRODUCT_UPDATE / PRODUCT_DELETE), trạng thái PENDING/APPROVED/REJECTED |
| `PriceHistory` | Lịch sử thay đổi giá vốn/giá bán của sản phẩm |
| `AuditLog` | Nhật ký hành động hệ thống (before/after dạng JSON) |
| `UserSession` | Phiên đăng nhập, lưu refresh token, thiết bị, IP |
| `AiSetting` | Cấu hình AI theo provider (groq/gemini/claude/openai): apiKey (server-side), model override, enabled |
| `Asset` | Tài sản: mã, tên, loại, trạng thái, ngày mua, nguyên giá, số tháng khấu hao, gắn kho/người phụ trách, soft-delete |
| `Department` | Phòng ban, hỗ trợ cây cha-con (`parentId`) |
| `Employee` | Nhân viên: mã, họ tên, email/sđt, phòng ban, chức vụ, ngày vào làm, lương, trạng thái, liên kết tuỳ chọn với `User` |
| `InsightRun` | Cache kết quả AI Insights theo `topic + inputHash` (hash của params + snapshot dữ liệu + ngày) |

**Enums chính**: `Role`, `ProductType` (FRESH_FOOD, DRY_GOODS, COSMETICS, HOUSEHOLD, CUSTOM), `PricingUnit` (PIECE, KG, G, L, ML, BOX), `ExpiryStatus` (NORMAL, WARNING_15, ALERT_3, EXPIRED, DESTROYED), `TransactionType`, `DestroyReason`, `AssetStatus` (ACTIVE, IN_REPAIR, RETIRED, LOST), `EmployeeStatus` (ACTIVE, ON_LEAVE, TERMINATED).

### 2.4 Xác thực & Phân quyền
- **JWT access token + refresh token**: access token gửi qua header `Authorization: Bearer`; refresh token được lưu và quản lý trong bảng `UserSession` (xoay vòng khi refresh, thu hồi được, theo dõi thiết bị/IP/user-agent). Có thêm blocklist trong bộ nhớ (`Set`) cho các token vừa bị thu hồi.
- Mật khẩu hash bằng `bcryptjs`.
- Vai trò (`Role` enum): `ADMIN`, `MANAGER`, `WAREHOUSE_STAFF`, `CASHIER`, `SALE_DEPARTMENT`, `FINANCE_DEPARTMENT`.
- `SALE_DEPARTMENT` và `FINANCE_DEPARTMENT` chỉ được truy cập `/api/reports`, `/api/audit`, `/api/auth/me` (giới hạn ở tầng middleware `require-auth.ts`).
- Các thao tác ghi (create/update/delete) nhạy cảm được giới hạn theo role qua `requireRole(...)` (vd: xoá kho chỉ ADMIN, sửa cài đặt hệ thống chỉ ADMIN/MANAGER, tạo user chỉ ADMIN với ràng buộc chỉ tồn tại 1 tài khoản ADMIN).
- Rate limit riêng cho `/api/auth` (50 req/15 phút).

### 2.5 Danh sách API (base URL: `/api`)

**AI (Phase A)**
- `GET/PUT /ai/settings` (ADMIN/MANAGER) — cấu hình apiKey/model/enabled per provider; response chỉ trả `hasKey`/`keySource`, **không bao giờ trả apiKey**
- `POST /ai/chat` — chat qua provider fallback theo thứ tự free-first: groq → gemini → claude → openai (key từ DB, fallback sang biến môi trường `GROQ_API_KEY`/`GEMINI_API_KEY`/`ANTHROPIC_API_KEY`/`OPENAI_API_KEY`)
- `GET /ai/providers` — danh sách provider

**Auth**
- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`
- `POST /auth/register` (ADMIN, ràng buộc chỉ 1 tài khoản ADMIN)
- `GET /auth/sessions`, `POST /auth/sessions/revoke`, `POST /auth/sessions/revoke-others` — quản lý đa phiên đăng nhập

**Users**
- `GET /users`, `GET /users/:id`, `POST /users`, `PUT /users/:id`, `PATCH /users/:id/password`, `DELETE /users/:id`
- Hỗ trợ filter: `search`, `role`, `isActive`, phân trang, sắp xếp

**Products**
- `GET /products` (filter/sort/paginate + preset: `all`/`stockValue`/`expiringSoon`/`expired`/`lowStock`), `GET /products/:id`, `POST /products`, `PUT /products/:id`, `DELETE /products/:id` (soft-delete)
- `POST /products/:id/duplicate` — nhân bản sản phẩm
- `POST /products/bulk/archive` — lưu trữ hàng loạt
- `POST /products/import` — nhập hàng loạt (tối đa 1000 dòng, hỗ trợ ghi đè theo SKU)
- `GET /products/:id/price-history` — lịch sử thay đổi giá
- Filter nâng cao trên `GET /products`: `search`, `categoryId`, `supplierId`, `expiryStatus`, `expiryFrom/To`, `stockLevel`, `minPrice/maxPrice`, phân trang, sort, `preset`

**Categories**
- `GET /categories`, `POST /categories`, `PUT /categories/:id`, `PATCH /categories/:id/visibility`, `DELETE /categories/:id` (chặn nếu còn sản phẩm/danh mục con)

**Suppliers**
- `GET /suppliers`, `GET /suppliers/:id`, `POST /suppliers`, `PUT /suppliers/:id`, `DELETE /suppliers/:id`

**Warehouses**
- `GET /warehouses`, `POST /warehouses` (ADMIN/MANAGER), `PUT /warehouses/:id` (ADMIN/MANAGER), `DELETE /warehouses/:id` (ADMIN, chặn nếu còn giao dịch liên quan)

**Assets (Tài sản — Phase B)**
- `GET /assets` (filter: search/type/status/warehouseId, phân trang, sort; mỗi asset kèm `currentValue`, `monthlyDepreciation`, `monthsElapsed` — khấu hao tuyến tính), `GET /assets/:id`
- `POST /assets`, `PUT /assets/:id`, `DELETE /assets/:id` (soft-delete) — ADMIN/MANAGER; WAREHOUSE_STAFF chỉ xem

**Departments & Employees (Phase B)**
- `GET/POST /departments`, `PUT/DELETE /departments/:id` (cây cha-con, chặn xoá khi còn nhân viên/phòng ban con; ghi ADMIN/MANAGER)
- `GET /employees` (filter: search/departmentId/status, phân trang, sort), `GET /employees/:id`
- `POST /employees`, `PUT /employees/:id`, `DELETE /employees/:id` — ADMIN/MANAGER; liên kết tuỳ chọn 1-1 với tài khoản `User`

**Insights (AI — Phase C)**
- `POST /insights/analyze` (ADMIN/MANAGER) — body `{ topic: "hr"|"inventory"|"strategy", params, forceRefresh? }`: gom dữ liệu thật từ DB → build prompt → `chatWithFallback` → trả `{ summary, findings[], recommendations[], metrics }` (yêu cầu model trả JSON, parse an toàn, fallback text; kết quả cache trong `InsightRun`, re-run bằng `forceRefresh`)
- `GET /insights/recent` — 10 lần chạy gần nhất

**Inventory (Kho)**
- `POST /inventory/in|out|adjustment|destroy`
- `GET /inventory/transactions` (filter: type, productId, search, from/to, phân trang, sort)
- `GET /inventory/history/:productId`

**Approvals (Duyệt thay đổi sản phẩm — hỗ trợ duyệt nhiều cấp)**
- `POST /approvals/product` — tạo yêu cầu (PRODUCT_UPDATE/PRODUCT_DELETE), lưu chuỗi vai trò cần duyệt (`__workflow`, vd: WAREHOUSE_STAFF → MANAGER → ADMIN)
- `GET /approvals/pending-count`, `GET /approvals/pending`
- `POST /approvals/:id/approve`, `POST /approvals/:id/reject`

**Expiry (Hạn sử dụng)**
- `GET /expiry/alerts`, `GET /expiry/critical`
- `POST /expiry/suggest-promo` (rule-based, stub cho khuyến mãi)

**Dashboard**
- `GET /dashboard/overview`
- `GET /dashboard/recent-transactions`
- `GET /dashboard/expiry-distribution`
- `GET /dashboard/stock-value-by-category`

**Audit**
- `GET /audit/actions`, `GET /audit/actions/export.csv`, `GET /audit/actions/:id`, `GET /audit/transaction/:id`, `GET /audit/timeline/:requestId`

**Automation** (ADMIN/MANAGER)
- `GET /automation/jobs` — trạng thái job gần nhất
- `POST /automation/jobs/expiry-sync/run` — quét & cập nhật lại `expiryStatus` toàn bộ sản phẩm
- `POST /automation/jobs/kpi-snapshot/run` — tính nhanh snapshot KPI (tổng sản phẩm, tồn kho thấp, hết hạn, chờ duyệt)

**Settings**
- `GET/PUT /settings/system` (PUT: ADMIN/MANAGER)
- `GET/PUT /settings/preferences`
- `PATCH /settings/change-password`
- `GET/POST/DELETE /settings/saved-filters`
- `GET /settings/roadmap`, `GET /settings/permission-matrix`
- *Lưu ý*: dữ liệu preferences/saved-filters hiện lưu ở file JSON (`apps/api/data/settings.json`), chưa chuyển sang bảng DB.

**Reports**
- `GET /reports/inventory-snapshot`, `/waste-analysis`, `/profit-by-category`
- `GET /reports/trends/transactions-daily`, `/supplier-performance`, `/warehouse-overview`
- Xuất báo cáo: `GET /reports/inventory-snapshot.csv`, `.xlsx`, `/management-report.html`, `/management-report.pdf`
- Một số báo cáo BI nâng cao vẫn ở dạng stub cho phase 5

---

## 3. Frontend (`apps/web`)

### 3.1 Công nghệ
- **React 18** + **Vite 5** + TypeScript
- **React Router v6** (`createBrowserRouter`, data router)
- **TanStack Query v5** (data fetching/caching — không dùng Redux/Zustand, toàn bộ server state qua Query)
- **React Hook Form** + **Zod** (form & validation)
- **Recharts** (biểu đồ dashboard/báo cáo)
- **Tailwind CSS** (styling theme tuỳ biến, không dùng UI kit ngoài), **lucide-react** (icon)
- **Auth state**: React Context (`AuthProvider`/`useAuth`), token lưu ở `localStorage`
- **API client** (`src/lib/api-client.ts`): wrapper `fetch`, tự động gắn `Authorization: Bearer`, tự refresh token khi gặp lỗi 401 (gộp các request refresh trùng lặp) và redirect `/login` nếu refresh thất bại

### 3.2 Cấu trúc thư mục

```
apps/web/src/
├── app/
│   ├── providers/          # React Query Provider, Auth Provider, v.v.
│   └── router/index.tsx    # Khai báo route + Guard đăng nhập + điều hướng theo role
├── components/
│   ├── layout/               # AppShell: sidebar + topbar
│   └── ui/                    # Component UI dùng chung (button, table, modal...)
├── features/                  # Mỗi domain nghiệp vụ là 1 feature module
│   ├── assets/                  # Quản lý tài sản (RHF + Zod, bảng khấu hao)
│   ├── auth/                    # Đăng nhập, auth-context
│   ├── employees/               # Nhân viên + quản lý phòng ban inline (RHF + Zod)
│   ├── insights/                # AI Insights: chọn topic → chạy → summary/findings/recommendations + chart Recharts
│   ├── dashboard/                 # Trang tổng quan KPI + biểu đồ
│   ├── products/                    # Quản lý sản phẩm
│   ├── inventory/                     # Nhập/xuất/điều chỉnh/huỷ kho
│   ├── suppliers/                       # Nhà cung cấp
│   ├── categories/                        # Danh mục sản phẩm
│   ├── warehouses/                          # Kho hàng
│   ├── expiry/                                # Cảnh báo hạn sử dụng
│   ├── users/                                   # Quản lý người dùng
│   ├── settings/                                  # Cài đặt hệ thống/cá nhân + AI Providers (settings/ai/)
│   ├── audit/                                       # Lịch sử hành động (audit)
│   ├── reports/                                       # Báo cáo
│   ├── automation/                                      # Vận hành job tự động
│   └── stubs/                                             # Trang placeholder cho tính năng tương lai
├── lib/
│   ├── api-client.ts        # Lớp gọi API tập trung (fetch wrapper, gắn token)
│   └── audit-detail.ts       # Helper hiển thị chi tiết audit log
└── styles/                    # Tailwind/global CSS
```

### 3.3 Danh sách trang (Routes)

| Route | Trang | Mô tả |
|---|---|---|
| `/login` | Đăng nhập | Không cần auth |
| `/` | Dashboard hoặc Reports | Tự chuyển hướng theo role (SALE/FINANCE → `/reports`) |
| `/products` | Quản lý sản phẩm | CRUD + filter nâng cao + phân trang |
| `/inventory` | Kho vận | Nhập/xuất/điều chỉnh/huỷ hàng, lịch sử giao dịch |
| `/suppliers` | Nhà cung cấp | CRUD |
| `/categories` | Danh mục | CRUD, cây phân cấp |
| `/warehouses` | Kho hàng | CRUD kho |
| `/assets` | Tài sản | CRUD + filter + khấu hao tuyến tính (ADMIN/MANAGER ghi; WAREHOUSE_STAFF xem) |
| `/employees` | Nhân viên | CRUD nhân viên + quản lý phòng ban dạng cây (ADMIN/MANAGER) |
| `/insights` | AI Insights | Chọn topic hr/inventory/strategy → chạy phân tích AI, xem summary/findings/recommendations + chart |
| `/expiry` | Cảnh báo hạn dùng | Danh sách sản phẩm sắp/đã hết hạn, gợi ý khuyến mãi |
| `/reports` | Báo cáo | Snapshot tồn kho, phân tích hao hụt, lợi nhuận theo danh mục (một số là stub) |
| `/audit` | Lịch sử hành động | Timeline audit log có tìm kiếm, modal chi tiết |
| `/users` | Quản lý người dùng | List/filter/tạo/sửa/đổi mật khẩu/xoá theo quyền |
| `/settings` | Cài đặt | Cá nhân hoá, bộ lọc đã lưu, cài đặt hệ thống |
| `/automation` | Tự động hoá | Chạy & xem trạng thái job (expiry sync, KPI snapshot) |

Tất cả các route (trừ `/login`) đều được bọc trong `Guard` — yêu cầu đăng nhập, nếu chưa có session sẽ redirect về `/login`.

---

## 4. Tính năng chính của hệ thống

1. **Xác thực & phân quyền**: JWT + RBAC theo 6 vai trò, giới hạn quyền truy cập riêng cho bộ phận Sales/Finance (chỉ xem báo cáo & audit).
2. **Quản lý sản phẩm**: CRUD đầy đủ, theo dõi giá vốn/giá bán/biên lợi nhuận, tồn kho, ngưỡng đặt hàng lại, ảnh sản phẩm, soft-delete.
3. **Quản lý danh mục** dạng cây (danh mục cha/con) và **nhà cung cấp**.
4. **Quản lý kho hàng nhiều chi nhánh** (`Warehouse`) gắn với từng giao dịch kho.
5. **Giao dịch kho (Inventory)**: nhập (IN), xuất (OUT), điều chỉnh (ADJUSTMENT), huỷ hàng (DESTROY, có lý do: hết hạn/hư hỏng/nhiễm bẩn/khác) — mỗi giao dịch cập nhật tồn kho theo transaction Prisma đảm bảo tính toàn vẹn.
6. **Logic hạn sử dụng tự động**: tính `expiryStatus` (NORMAL/WARNING_15/ALERT_3/EXPIRED/DESTROYED) dựa trên ngày hết hạn, có trang cảnh báo và gợi ý khuyến mãi rule-based cho hàng sắp hết hạn.
7. **Luồng duyệt thay đổi sản phẩm (Approval Workflow) nhiều cấp**: nhân viên yêu cầu sửa/xoá sản phẩm → tuần tự qua các vai trò duyệt (vd: WAREHOUSE_STAFF → MANAGER → ADMIN) → duyệt/từ chối, lưu trạng thái trước/sau thay đổi.
7b. **Nhập/xuất hàng loạt sản phẩm**: nhân bản sản phẩm, lưu trữ hàng loạt (bulk archive), import tối đa 1000 sản phẩm/lần (ghi đè theo SKU).
8. **Dashboard**: KPI tổng quan, biểu đồ phân bố hạn dùng, giá trị tồn kho theo danh mục, giao dịch gần đây.
9. **Audit log**: ghi lại toàn bộ thao tác quan trọng (before/after dạng JSON), có trang lịch sử tìm kiếm được.
10. **Quản lý người dùng**: tạo/sửa/xoá, đặt lại mật khẩu, lọc theo vai trò/trạng thái hoạt động, ràng buộc theo quyền.
11. **Cài đặt hệ thống & cá nhân**: tuỳ chỉnh giao diện (mật độ bảng, page size mặc định), thông báo, bộ lọc đã lưu, roadmap tính năng tương lai.
12. **Tự động hoá (Automation)**: chạy thủ công job đồng bộ trạng thái hạn dùng và job snapshot KPI (tiền đề cho scheduled jobs ở phase sau).
13. **Báo cáo**: snapshot tồn kho, phân tích hao hụt, lợi nhuận theo danh mục, xu hướng giao dịch theo ngày, hiệu suất nhà cung cấp, tổng quan theo kho — xuất được CSV/Excel/HTML/PDF (dùng `xlsx`, `pdfkit`).
14. **Lịch sử giá (Price History)**: theo dõi thay đổi giá vốn/giá bán theo thời gian cho từng sản phẩm.
15. **Quản lý phiên đăng nhập (UserSession)**: JWT access + refresh token xoay vòng, lưu thiết bị/IP, hỗ trợ đa phiên, xem và thu hồi phiên từ xa.
16. **AI Provider Layer (Phase A)**: tích hợp 4 provider (Groq, Gemini, Claude, OpenAI) gọi trực tiếp từ backend; API key lưu server-side (DB override, env fallback), FE chỉ thấy `hasKey`/`keySource`; `chatWithFallback` thử lần lượt provider free trước; cấu hình per-provider (key/model/enabled) trong Settings, chỉ ADMIN/MANAGER.
17. **Quản lý tài sản & nhân sự (Phase B)**: CRUD tài sản với khấu hao tuyến tính (giá trị còn lại theo thời gian), gắn kho/người phụ trách, soft-delete; phòng ban dạng cây; nhân viên với lương/chức vụ/trạng thái, liên kết tuỳ chọn với tài khoản đăng nhập.
18. **AI Insights (Phase C)**: phân tích hr / inventory / strategy trên dữ liệu thật từ DB, model trả JSON `{summary, findings, recommendations}` (parse an toàn, fallback text), cache theo `topic + inputHash` trong bảng `InsightRun`, nút re-run bỏ cache, chart Recharts từ metrics.

---

## 5. Vận hành & hạ tầng

- **Docker**: `docker-compose.yml` ở gốc chỉ định nghĩa service **MySQL 8.4** (root password mặc định, DB `smart_supermarket`, cổng host map ra `3310→3306`). API và Web hiện chạy local qua `npm run dev`, chưa được container hoá.
- **CI/CD**: repo hiện chưa có workflow GitHub Actions hay pipeline CI nào.
- **Lưu trữ dữ liệu phụ**: `apps/api/data/settings.json` — lưu preferences & saved-filters theo user dạng file JSON (giải pháp tạm cho MVP, roadmap sẽ chuyển sang bảng DB).
- **Migrations**: 14 migration Prisma theo từng giai đoạn phát triển (khởi tạo schema, đồng bộ, approval requests, price history, cây danh mục + user sessions, warehouse, audit timeline theo request-id, AI settings, assets + employees + departments, insight runs).
- **Biến môi trường AI (tuỳ chọn)**: `GROQ_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` — dùng làm fallback khi chưa nhập key trong Settings → AI Providers.
- **Seed dữ liệu mẫu** (`apps/api/prisma/seed.ts`): 6 user (mỗi role 1 tài khoản), 18 danh mục, 40 nhà cung cấp, 3 kho, ~200 sản phẩm, ~200 giao dịch kho kèm audit log tương ứng.

---

## 6. Roadmap (định hướng phát triển)

- **Đã triển khai (Phase 3–4)**: luồng duyệt sản phẩm, mở rộng vai trò Sales/Finance, dashboard audit-friendly, quản lý người dùng nâng cao, trung tâm cài đặt, filter/sort/pagination nâng cao, trang lịch sử audit.
- **Đã triển khai (mở rộng SaaS — Phase A/B/C, 2026-07-06)**: AI provider layer đa nhà cung cấp với fallback, quản lý tài sản (khấu hao), nhân viên + phòng ban, AI Insights trên dữ liệu thật có cache.
- **Kế hoạch (Phase 5, chưa triển khai đầy đủ)**:
  - BI nâng cao với aggregate/snapshot theo lịch
  - Worker xuất Excel/PDF cho báo cáo nặng
  - Import CSV hàng loạt có preview & rollback
  - Chấm điểm hiệu quả khuyến mãi
  - Tích hợp POS/máy quét mã vạch
  - Gợi ý khuyến mãi bằng AI có kiểm duyệt
  - Undo/redo cho một số thao tác kho
  - Ảo hoá bảng dữ liệu cho tập dữ liệu lớn (50k+ dòng)

---

*Tài liệu này được tổng hợp tự động từ mã nguồn (Prisma schema, route files, router FE) — tham khảo thêm `docs/api.md`, `docs/architecture.md`, `docs/roadmap.md` trong repo để biết chi tiết bổ sung.*
