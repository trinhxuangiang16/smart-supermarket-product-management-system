# Smart Supermarket Product Management System (MVP)

Production-like MVP with React + Express + Prisma + MySQL in a pnpm monorepo.

## Tính năng chi tiết của dự án

### 1. Xác thực & Phân quyền (Auth + RBAC)
- Đăng nhập bằng JWT access token + refresh token xoay vòng, phiên lưu DB (`UserSession`).
- Quản lý đa phiên đăng nhập: xem danh sách thiết bị/IP, thu hồi từng phiên hoặc tất cả phiên khác.
- 6 vai trò: `ADMIN`, `MANAGER`, `WAREHOUSE_STAFF`, `CASHIER`, `SALE_DEPARTMENT`, `FINANCE_DEPARTMENT`.
- Sales/Finance chỉ truy cập được báo cáo + audit; ràng buộc chỉ tồn tại 1 tài khoản ADMIN.
- Rate limit riêng cho `/api/auth` (50 request / 15 phút).

### 2. Quản lý sản phẩm
- CRUD đầy đủ: SKU, barcode, loại hàng, đơn vị tính, giá vốn/giá bán, biên lợi nhuận, tồn kho, ngưỡng đặt lại hàng, ngày sản xuất/hết hạn, ảnh, soft-delete.
- Filter nâng cao: tìm kiếm, danh mục, nhà cung cấp, trạng thái hạn dùng, khoảng giá, mức tồn kho + preset (`lowStock`, `expiringSoon`, `expired`, `stockValue`).
- Nhân bản sản phẩm, lưu trữ hàng loạt (bulk archive), import tối đa 1000 dòng (ghi đè theo SKU).
- Lịch sử thay đổi giá (`PriceHistory`) theo từng sản phẩm.

### 3. Danh mục & Nhà cung cấp
- Danh mục dạng cây cha–con, ẩn/hiện, chặn xoá khi còn sản phẩm hoặc danh mục con.
- Nhà cung cấp: CRUD + thông tin liên hệ, chặn xoá khi còn sản phẩm liên kết.

### 4. Kho & Giao dịch kho (Inventory)
- Nhiều kho/chi nhánh (`Warehouse`), gắn kho vào từng giao dịch.
- Giao dịch: nhập (IN), xuất (OUT), điều chỉnh (ADJUSTMENT), huỷ hàng (DESTROY kèm lý do: hết hạn/hư hỏng/nhiễm bẩn/khác).
- Cập nhật tồn kho trong transaction Prisma đảm bảo toàn vẹn; lịch sử giao dịch theo sản phẩm.

### 5. Hạn sử dụng (Expiry)
- Tự động tính `expiryStatus`: NORMAL / WARNING_15 / ALERT_3 / EXPIRED / DESTROYED.
- Trang cảnh báo hàng sắp/đã hết hạn; gợi ý khuyến mãi rule-based cho hàng cận hạn.

### 6. Luồng duyệt thay đổi sản phẩm (Approval Workflow)
- Nhân viên gửi yêu cầu sửa/xoá sản phẩm → duyệt tuần tự nhiều cấp theo vai trò (vd: WAREHOUSE_STAFF → MANAGER → ADMIN).
- Duyệt/từ chối kèm ghi chú, lưu trạng thái trước/sau thay đổi; đếm yêu cầu chờ duyệt (chuông thông báo).

### 7. Dashboard & Báo cáo
- KPI tổng quan, biểu đồ phân bố hạn dùng, giá trị tồn kho theo danh mục, giao dịch gần đây (Recharts).
- Báo cáo: snapshot tồn kho, phân tích hao hụt, lợi nhuận theo danh mục, xu hướng giao dịch theo ngày, hiệu suất nhà cung cấp, tổng quan theo kho.
- Xuất CSV / Excel (`xlsx`) / HTML / PDF (`pdfkit`).

### 8. Audit log
- Ghi lại mọi thao tác quan trọng (before/after dạng JSON, request-id để trace timeline).
- Trang lịch sử tìm kiếm được + xuất CSV.

### 9. Quản lý người dùng & Cài đặt
- CRUD người dùng, đặt lại mật khẩu, lọc theo vai trò/trạng thái, ràng buộc theo quyền.
- Cài đặt hệ thống (thông tin cửa hàng, ngưỡng tồn kho, cấu hình báo cáo) — chỉ ADMIN/MANAGER.
- Cài đặt cá nhân: thông báo, mật độ bảng, page size, bộ lọc đã lưu, đổi mật khẩu.

### 10. Tự động hoá (Automation)
- Job đồng bộ trạng thái hạn dùng toàn bộ sản phẩm; job snapshot KPI — chạy thủ công, xem trạng thái lần chạy gần nhất.

### 11. Lớp AI Provider (đang phát triển — Phase A/B/C SaaS)
- Module `/api/ai`: gọi chat qua nhiều provider (Groq / Gemini / Claude / OpenAI) với cơ chế fallback tự động, ưu tiên model free.
- API key quản lý qua DB (`AiSetting`, override biến môi trường), chỉ ADMIN/MANAGER cấu hình, không bao giờ trả key ra response.
- Kế hoạch: quản lý tài sản (Assets) + nhân sự (Employees/Departments), AI Insights phân tích dữ liệu thật từ DB (hr / inventory / strategy) có cache kết quả.

## Features in MVP
- JWT authentication + role-based access control.
- Product, category, supplier CRUD.
- Inventory transactions (`IN`, `OUT`, `ADJUSTMENT`, `DESTROY`) with stock updates.
- Expiry status logic and expiry alert APIs/pages.
- Dashboard KPI + charts + recent transactions.
- Audit logs for key operations.
- Product approval workflow (edit/delete request -> manager/admin review).
- Users management page (list/filter/create/edit/reset password/delete with role rules).
- Settings page with user preferences + saved filters + roadmap stubs for future phases.
- Audit history page with searchable action timeline.
- Advanced product and inventory transaction filtering + pagination.
- Clean stubs for future phases (advanced BI/export/POS/AI and similar extensions).

## Project Structure
- `apps/api`: Express + Prisma backend.
- `apps/web`: React + Vite frontend.
- `packages/shared`: shared types/constants.
- `docs`: API and architecture docs.

## Prerequisites
- Node.js 20+
- Docker + Docker Compose

## Quick Start (3 commands)
1. Copy env:
   - `cp .env.example .env` (Windows PowerShell: `Copy-Item .env.example .env`)
2. Install deps:
   - `npm install`
3. Run:
   - `npm run db:up`
   - `npm run db:setup`
   - `npm run dev`

Frontend: `http://localhost:5173`  
Backend: `http://localhost:4000/api`

## Notes
- This project is set up for a lightweight local workflow:
  - MySQL via Docker
  - API + Web via local `dev` commands

## Seed Users
- `admin@supermarket.test / Password123!`
- `manager@supermarket.test / Password123!`
- `warehouse@supermarket.test / Password123!`
- `cashier@supermarket.test / Password123!`
- `sales@supermarket.test / Password123!`
- `finance@supermarket.test / Password123!`

## Commands
- `npm run db:up` - start MySQL Docker container
- `npm run db:setup` - generate Prisma client + migrate + seed
- `npm run db:reset` - reset local DB safely for dev
- `npm run dev` - run API + Web in parallel
- `npm run dev:api`
- `npm run dev:web`
- `npm run build`
- `npm run lint`

## Docs
- [API docs](docs/api.md)
- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
