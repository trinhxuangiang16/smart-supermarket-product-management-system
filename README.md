# Smart Supermarket Product Management System (MVP)

Production-like MVP with React + Express + Prisma + MySQL in a pnpm monorepo.

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
