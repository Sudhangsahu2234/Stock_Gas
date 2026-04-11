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
