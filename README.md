# StockGAS Full Stack

This repository now contains:

- `frontend`: Next.js app version of your STOCKGAS landing page
- `backend`: Node.js + Express REST API

## 1) Run backend

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

Backend runs on `http://localhost:4000`.

## 2) Run frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`.

## Backend API endpoints

- `GET /api/health`
- `POST /api/orders`
- `GET /api/orders/:id`
- `POST /api/contact`
- `POST /api/complaints`
- `GET /api/admin/summary`
- `GET /api/admin/logs` — paginated request audit logs

## Request audit logging

Every incoming HTTP request is automatically logged to the `request_logs` PostgreSQL table, capturing:

| Field | Description |
|-------|-------------|
| `method` | HTTP method (GET, POST, etc.) |
| `url` | Full request URL |
| `path` | URL path only |
| `queryString` | Query parameters (JSON) |
| `ip` | Client IP address |
| `userAgent` | Browser / client identifier |
| `statusCode` | HTTP response status code |
| `responseTimeMs` | Time taken to respond (ms) |
| `requestBody` | Request body (sensitive fields redacted) |
| `createdAt` | Timestamp |

### Query logs

```
GET /api/admin/logs?limit=50&offset=0&method=POST&status=201&path=/api/orders&from=2026-01-01&to=2026-12-31
```

All query parameters are optional.

## Example payload: create order

```json
{
  "customerName": "John Doe",
  "phone": "+2348001234567",
  "cylinderSizeKg": 12.5,
  "quantity": 1,
  "paymentMethod": "Paystack",
  "address": "Port Harcourt, Rivers State"
}
```

