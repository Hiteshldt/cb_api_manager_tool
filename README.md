# Carbelim — API Transformation Engine

> *Redefining Green Engineering*

A local Node.js + Express server that connects to WebSocket or REST API sources, transforms incoming JSON, and exposes the result through custom output API endpoints.

---

## Quick Start

```bash
# 1. Install dependencies (Node ≥ 18 required)
npm install

# 2. Configure your admin key (optional — default already set)
cp .env.example .env
# Edit .env → ADMIN_API_KEY=your-secret

# 3. Start the engine
npm start

# 4. Open the admin UI
open http://localhost:3000/admin
```

Default admin key: `local-admin-secret`

---

## How It Works

```
Input Source (WebSocket / REST API)
         ↓
  Transformation Rules
  (field mapping + static values)
         ↓
  Custom Output Endpoint
  GET /api/output/your-path
```

---

## Admin UI Pages

| Page | Description |
|---|---|
| **Dashboard** | Stats, source status, recent logs |
| **Sources** | Add/edit REST or WebSocket input sources |
| **Transformations** | Define field mappings and static values |
| **Output Endpoints** | Create custom `/api/output/...` paths |
| **Logs** | View app and error logs |

---

## API Reference

All admin endpoints require: `x-admin-key: <your-key>`

### Sources
```
GET    /admin/sources
POST   /admin/sources
GET    /admin/sources/:id
PUT    /admin/sources/:id
DELETE /admin/sources/:id
GET    /admin/sources/:id/latest   ← latest raw JSON
```

### Transformations
```
GET    /admin/transformations
POST   /admin/transformations
PUT    /admin/transformations/:id
DELETE /admin/transformations/:id
POST   /admin/transformations/preview
```

### Endpoints
```
GET    /admin/endpoints
POST   /admin/endpoints
PUT    /admin/endpoints/:id
DELETE /admin/endpoints/:id
GET    /admin/endpoints/:id/latest   ← latest transformed JSON
```

### Output API
```
GET /api/output/:custom-path
Headers: x-api-key: <endpoint-key>  (if auth required)
```

---

## Local File Storage

```
data/
  sources.json             ← source configurations
  transformations.json     ← transformation rules
  endpoints.json           ← output endpoint definitions
  latest-raw/              ← latest received data per source
  latest-transformed/      ← latest output per endpoint
  logs/
    app.log
    errors.log
```

---

## Tech Stack

- **Runtime**: Node.js ≥ 18
- **Server**: Express.js
- **WebSocket client**: ws
- **Storage**: Local JSON files (no database)
- **UI**: Vanilla HTML/CSS/JS

---

*Built for Carbelim — Redefining Green Engineering*
