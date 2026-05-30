# Product Roadmap

## Phase 3 (Implemented)
- Product approval workflow:
  - request update/delete
  - manager/admin review queue
  - approve/reject actions with audit logs
- Role expansion for reporting teams:
  - `SALE_DEPARTMENT`
  - `FINANCE_DEPARTMENT`
- Audit-friendly dashboard stream:
  - recent inventory transactions
  - approved product change events
- Users management hardening:
  - list/filter/pagination
  - create/edit/delete constraints by role
  - password reset endpoint

## Phase 4 (Implemented)
- Settings center:
  - notification preferences
  - UI preferences (table density, default page size)
  - saved filters (create/list/delete)
  - roadmap endpoint for forward features
- Advanced filters and pagination:
  - products list filter/sort/pagination
  - inventory transactions filter/sort/pagination
- Audit history page:
  - searchable action log
  - detailed action payload modal

## Phase 5 (Planned, Not fully implemented)
- Advanced BI with scheduled aggregates/materialized snapshots
- Export workers for heavy Excel/PDF jobs
- Bulk CSV import with validation preview and rollback report
- Promotion effectiveness scoring and lifecycle tracking
- POS/scanner integration (webhook + mapping layer)
- AI-assisted promotion suggestion workflow with review guardrails
- Undo/redo operation journal for selected inventory operations
- Advanced table virtualization for very large datasets (50k+ rows)
