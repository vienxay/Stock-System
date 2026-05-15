# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**ລະບົບສາງ PR-PO** — Enterprise stock management system with procurement workflow (PR → PO → GR → Invoice → Payment), role-based access control, and audit logging. UI and messages are in **Lao language**.

---

## Development Commands

### Backend (`server/`)
```bash
npm run dev          # ts-node-dev with live reload (port 3000)
npm run type-check   # TypeScript validation only
npm run lint         # ESLint
npm run db:migrate   # Prisma migrate dev (requires server stopped)
npm run db:seed      # Seed database
npm run db:reset     # Full DB reset + seed
npm run db:studio    # Prisma Studio GUI
```

### Frontend (`client/`)
```bash
npm run dev    # Vite dev server (port 5173)
npm run build  # tsc + vite build
```

> **Prisma `generate` note:** `npx prisma generate` will fail if the server is running (DLL lock on Windows). Stop the server first, then run generate, then restart.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Express 4 + TypeScript, Prisma 6 (PostgreSQL) |
| Frontend | React 19, Vite, Tailwind CSS 3 |
| State | Zustand (auth), TanStack Query v5 (server state) |
| Forms | React Hook Form + Zod |
| Auth | JWT (access 8h / refresh 7d), bcrypt |
| Charts | Recharts |
| Excel | ExcelJS (server-side) |
| Barcode | react-barcode (display), @zxing/browser (camera scan) |
| Files | multer → `server/uploads/` served as static |

---

## Architecture

### Backend Structure
```
server/src/
  app.ts               # Middleware stack (helmet, cors, rate-limit, static /uploads)
  server.ts            # Bootstrap
  routes/index.ts      # Composes all routers under /api/v1
  routes/*.ts          # One file per resource
  services/*.ts        # Business logic (transactions, notifications, audit)
  middlewares/
    authMiddleware.ts  # JWT verify → attaches user to req
    authorizeMiddleware.ts  # authorize(...roles) guard
    validateMiddleware.ts   # express-validator wrapper
  utils/
    ApiResponse.ts     # Unified response: success/created/paginate/error
    AppError.ts        # Domain errors with HTTP codes
    runningNumber.ts   # Sequential numbering (PR-001, PO-001…) + pagination meta
  config/
    prisma.ts          # Singleton PrismaClient
    env.ts             # Zod-validated env
```

### Frontend Structure
```
client/src/
  App.tsx              # All routes + RoleGuard per route + roleHome map
  api/
    client.ts          # Axios instance, token injection, auto-refresh on 401
    endpoints.ts       # All API functions grouped by resource
  stores/authStore.ts  # Zustand, persisted to localStorage
  components/
    layout/            # AppLayout, Sidebar (fetches settings for logo/name), Header
    ui/                # Badge, Button, Modal, Table, Pagination, BarcodeScanner
  pages/               # One folder per feature
  types/index.ts       # All shared TypeScript interfaces
```

### Request / Response Convention

Every API response uses `ApiResponse` utility:
```json
// Success / paginated
{ "success": true, "message": "...", "data": {...} }
{ "success": true, "data": [...], "pagination": { "total":n, "page":1, "limit":20, "totalPages":n, "hasNextPage":bool, "hasPrevPage":bool } }

// Error
{ "success": false, "message": "ຂໍ້ຄວາມ (Lao)" }
```

Frontend always unwraps: `(res?.data as { data: T }).data`.

### Auth Pattern
- `authenticate` middleware: validates JWT → fetches user → attaches to `(req as AuthRequest).user`
- `authorize(...roles)` middleware: checks `user.role.code`
- Frontend: Axios interceptor injects `Authorization: Bearer <token>`; on 401, attempts refresh via `POST /auth/refresh`; on failure, calls `logout()` and redirects to `/login`
- Rate limiting: dev mode skips all limits (`skip: () => isDev`); production: 500 req/15min global, 20 req/15min for login

### Role System (7 roles)
`admin` → full access  
`user` → create PR only  
`finance` → review/approve PR level 1  
`md` → review/approve PR level 2, views PO  
`purchasing` → manage PO/supplier  
`stock` → receive goods, manage products/stock  
`ap` → manage invoices, payments  

Frontend route guards are in `App.tsx` (`routeRoles` map + `RoleGuard` component).

### PR → PO Workflow
1. User creates PR (draft) → submits → `finance_review`
2. Finance approves → `md_review`; rejects → `finance_rejected`
3. MD approves → auto-creates PO → `po_created`; rejects → `md_rejected`
4. Purchasing sends PO → `sent` (notifies all `stock` users)
5. Stock receives goods → GR created → `partial_received` / `received`
6. AP creates Invoice (3-way match vs PO amount ±5%) → `matched`/`mismatch`
7. AP approves Invoice → `approved`
8. AP records Payment → `paid`

### Audit Log Pattern
`auditLog(userId, action, tableName, recordId, oldValues, newValues, ip)` in `auditLogService.ts`:
- Fire-and-forget (`.catch()` logs to console, never throws)
- `toJson()` helper serialises Prisma `Decimal`/`Date`/`BigInt` to plain JSON
- Always fetch old values **before** UPDATE for diff display
- Covered: products, suppliers, categories, PO (sent/GR), invoices (create/approve/pay)

### Notification Pattern
Notifications are created server-side via `prisma.notification.create/createMany` inside transactions. Key triggers:
- PR submitted → notify finance
- Finance approves → notify MD
- MD approves + PO created → notify requester + all `purchasing` users
- PO sent → notify all `stock` users
- Issue out below `minStock` → notify all `stock` users

### Settings
`SystemSettings` table (singleton, id=1) stores company name, logo URL, contact info. Sidebar fetches via `GET /api/v1/settings` to display dynamic logo/name.

---

## Key Conventions

- **Lao language** for all UI labels, error messages, and toast notifications
- **"ນ້ອຍ"** not "ຕ່ຳ" for low/minimum stock terminology
- **Running numbers**: PR-001, PO-001, GR-001, PAY-001 via `generateRunningNumber(table, prefix, tx)`
- **Soft delete** for suppliers with linked POs (`isActive: false`); hard delete otherwise
- **Transactions**: Use Prisma `$transaction` for multi-step operations (PO creation, GR + stock update, invoice + notification)
- **File uploads**: `POST /api/v1/upload/product-image` → returns `{ url: "/uploads/products/filename.ext" }` stored in `product.imageUrl`
- **Reports**: Excel via ExcelJS (backend), PDF via browser `window.open()` + `window.print()` (avoids Lao font issues)
