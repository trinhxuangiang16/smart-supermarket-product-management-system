# Architecture (MVP)

## Monorepo
- `apps/api`: Express + Prisma + MySQL domain backend.
- `apps/web`: React + Vite frontend with feature pages.
- `packages/shared`: shared constants/types extension point.

## Backend Module Pattern
- Route modules under `src/modules/*/*.routes.ts`.
- Domain logic and transactional stock updates are handled in module services/routes with Prisma transactions.
- Cross-cutting middleware: auth, role guard, centralized errors.
- Audit log service captures product and inventory operations.

## Frontend Feature Pattern
- `features/auth`, `features/dashboard`, `features/products`, `features/inventory`, `features/suppliers`, `features/categories`, `features/expiry`, `features/users`, `features/settings`, `features/audit`.
- Global layout with sidebar + topbar shell.
- API client abstraction in `src/lib/api-client.ts`.
- Data fetching and caching via TanStack Query.

## Future Phase Extension Points
- Reports export endpoints remain stubs.
- Settings roadmap endpoint keeps explicit TODO states for advanced BI/export/POS/AI.
- Saved filters are implemented now with JSON-file storage and can be upgraded to DB-backed persistence later.
- Add scheduled job for periodic expiry status recalculation (MVP currently recalculates on product write).
- Detailed backlog for Phase 3/4/5 is tracked in `docs/roadmap.md`.
