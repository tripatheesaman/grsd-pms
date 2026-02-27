# GrSD Planning System

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- MySQL + Prisma ORM
- React Query for API data fetching and caching

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env`:

```bash
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/grsd_pms"
```

3. Generate Prisma client:

```bash
npm run db:generate
```

4. Apply database migration:

```bash
npm run db:migrate
```

5. Run development server:

```bash
npm run dev
```

6. Bootstrap the first superadmin from login screen, then sign in and configure equipment/check rules.

## Scripts

- `npm run dev`: Start local development server
- `npm run build`: Build production bundle
- `npm run start`: Start production server
- `npm run lint`: Run ESLint
- `npm run typecheck`: Run TypeScript checks
- `npm run db:generate`: Generate Prisma client
- `npm run db:migrate`: Run Prisma migrations
- `npm run db:studio`: Open Prisma Studio

## Security and Intelligence

- Role and permission-based API authorization with custom grants
- Audit logging for authentication and high-impact mutations
- Alert acknowledgment workflow
- Forecast quality metrics per equipment with confidence range and MAPE
- In-app notification queue with read tracking and channel-aware delivery records
- Overdue escalation runner with multi-level policy thresholds
- Forecast drift analytics grouped by equipment class
