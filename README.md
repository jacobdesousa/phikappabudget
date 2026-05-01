## Phi Kappa Budget
Budgeting application for PKS operations.

### Repo structure
- **`api/`**: Express + Postgres API
- **`react-ui/`**: Next.js frontend

### Running locally

#### Backend (Express)
- Copy `api/env.example` to your own env file (or export vars in your shell) and set your Postgres credentials.
- Install deps + start:

```bash
cd api
npm install
npm run dev
```

#### Frontend (Next.js)
- Copy `react-ui/env.example` to `.env.local` (or export vars) and point it at the API.
- Install deps + start:

```bash
cd react-ui
npm install
npm run dev
```
