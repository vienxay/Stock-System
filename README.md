# ລະບົບສາງ PR-PO Management System

ລະບົບຈັດການສາງ ແລະ ຂະບວນການຈັດຊື້ (Procurement) ສຳລັບ SME ໃນລາວ — ຮອງຮັບ PR → PO → GR → Invoice → Payment workflow ພ້ອມ role-based access control ແລະ audit logging.

---

## Screenshots

> Dashboard, Invoice management, Barcode scanner, Audit logs

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express 4 + TypeScript |
| Database | PostgreSQL via Prisma ORM 6 |
| Frontend | React 19 + Vite + Tailwind CSS 3 |
| State | Zustand (auth) + TanStack Query v5 |
| Charts | Recharts |
| Excel | ExcelJS |
| Barcode | react-barcode (display) + @zxing/browser (camera scan) |
| Auth | JWT (access 8h / refresh 7d) + bcrypt |

---

## Features

- **Procurement Workflow** — PR → PO → GR → Invoice → Payment
- **7 Roles** — admin, user, finance, md, purchasing, stock, ap
- **Dashboard** — Charts, KPI cards, procurement flow visualization
- **Barcode Scanner** — USB scanner + camera (ZXing), auto-fill product
- **Invoice Management** — 3-way match, mismatch handling (override/edit/cancel)
- **Excel & PDF Reports** — ExcelJS backend + browser print
- **Audit Log** — Track all CREATE/UPDATE/DELETE with before/after diff
- **Notifications** — Real-time per role
- **System Settings** — Company logo, name, contact info
- **Lao Language UI** — All labels and messages in Lao

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### 1. Clone

```bash
git clone https://github.com/vienxay/Stock-System.git
cd Stock-System
```

### 2. Setup Backend

```bash
cd server
npm install

# Copy env file and fill in values
cp .env.example .env
```

`.env` variables:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/stock_db"
JWT_SECRET="your-secret-32-chars-minimum"
JWT_REFRESH_SECRET="your-refresh-secret-32-chars"
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
```

```bash
# Run migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Seed initial data (admin user, roles, units)
npm run db:seed

# Start dev server
npm run dev
```

### 3. Setup Frontend

```bash
cd client
npm install
npm run dev
```

### 4. Open App

```
http://localhost:5173
```

Default admin login:
```
username: admin
password: admin123
```

---

## Development Commands

### Backend (`server/`)

```bash
npm run dev          # Start with live reload (port 3000)
npm run type-check   # TypeScript validation
npm run lint         # ESLint
npm run db:migrate   # Prisma migrate dev
npm run db:seed      # Seed database
npm run db:reset     # Full DB reset + seed
npm run db:studio    # Prisma Studio GUI
```

### Frontend (`client/`)

```bash
npm run dev    # Vite dev server (port 5173)
npm run build  # Production build
```

> **Note (Windows):** `npx prisma generate` will fail if server is running due to DLL lock. Stop server first.

---

## Project Structure

```
Stock-System/
├── client/                  # React frontend
│   └── src/
│       ├── api/             # Axios client + all API functions
│       ├── components/      # Shared UI (Button, Modal, Table, BarcodeScanner...)
│       ├── pages/           # One folder per feature
│       ├── stores/          # Zustand auth store
│       └── types/           # Shared TypeScript interfaces
│
└── server/                  # Express backend
    ├── prisma/              # Schema + migrations + seed
    └── src/
        ├── controllers/     # Request handlers
        ├── middlewares/     # Auth, authorize, validate
        ├── routes/          # One file per resource
        ├── services/        # Business logic + DB queries
        └── utils/           # ApiResponse, AppError, routeHelpers...
```

---

## Role Permissions

| Role | Access |
|------|--------|
| `admin` | Full access to everything |
| `user` | Create PR only |
| `finance` | Review/approve PR level 1 |
| `md` | Review/approve PR level 2 |
| `purchasing` | Manage PO, supplier |
| `stock` | Receive goods, manage products/stock |
| `ap` | Manage invoices and payments |

---

## Procurement Flow

```
User creates PR
      ↓
Finance approves (level 1)
      ↓
MD approves (level 2) → PO auto-created
      ↓
Purchasing sends PO to Supplier
      ↓
Stock receives goods (GR)
      ↓
AP records Invoice (3-way match vs PO ±5%)
      ↓
AP approves Invoice
      ↓
AP records Payment → PAID ✓
```

---

## API

Base URL: `http://localhost:3000/api/v1`

All responses follow:
```json
{ "success": true, "message": "...", "data": {} }
```

Paginated:
```json
{ "success": true, "data": [], "pagination": { "total": 100, "page": 1, "limit": 20 } }
```

---

## License

MIT
