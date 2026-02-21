# Payment Health Monitoring Service

Real-time PSP (Payment Service Provider) performance monitoring service. Tracks timeout rates, response times, error rates and flags unhealthy providers.

## Quick Start

```bash
# Install dependencies
npm install

# Start the server (development mode with hot reload)
npm run dev

# Generate test data (600+ realistic transactions)
npm run generate-data

# Load test data into the service
curl -X POST http://localhost:3000/api/transactions/bulk \
  -H "Content-Type: application/json" -d @data/test-transactions.json

# Verify it's working
curl http://localhost:3000/ping
```

## Architecture

```
src/
├── config/          # Zod-validated environment configuration
├── domain/          # Pure business logic (types, metrics, alerts)
├── infrastructure/  # SQLite database + repository layer
├── services/        # Orchestration (ingestion, metrics, alerts)
└── api/             # Fastify routes + validation schemas
```

**Key decisions:**
- **SQLite** (better-sqlite3) — zero external dependencies, WAL mode for performance
- **Fastify 5** — high performance, built-in validation, Pino logging
- **Repository pattern** — database access isolated for easy swapping to PostgreSQL
- **Domain-driven** — pure functions for metrics/alerts, no side effects

## API Endpoints

### Transaction Ingestion

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/transactions` | Ingest a single transaction |
| POST | `/api/transactions/bulk` | Batch ingest (up to 1000) |

**Single transaction body:**
```json
{
  "id": "txn-001",
  "psp": "FlutterWave",
  "payment_method": "mpesa",
  "amount": 150.00,
  "currency": "KES",
  "status": "approved",
  "response_time_ms": 1200,
  "created_at": "2025-01-15T10:30:00Z"
}
```

**Bulk body:** `{ "transactions": [ ...array of transactions... ] }`

### Health Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | All PSPs — metrics + health status |
| GET | `/api/health/:psp` | Specific PSP metrics + health status |
| GET | `/api/health/:psp/methods` | Breakdown by payment method (Stretch A) |
| GET | `/api/health/:psp/trends` | Trend detection vs 24h baseline (Stretch B) |
| GET | `/api/health/scores` | Health scores 0-100 for all PSPs (Stretch C) |

### Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alerts` | Current unhealthy/degraded/healthy PSPs |
| GET | `/api/alerts/config` | View threshold configuration |

### Query Parameters

All GET endpoints accept:
- `from` — ISO 8601 timestamp (default: 60 minutes ago)
- `to` — ISO 8601 timestamp (default: now)

### Utility

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ping` | Health check + transaction count |

## Metrics

| Metric | Calculation |
|--------|-------------|
| Timeout rate | `timeout_count / total_count` |
| Error rate | `error_count / total_count` |
| Success rate | `approved_count / (total - timeout - error)` |
| Avg response time | `AVG(response_time_ms)` via SQL |
| P95 response time | In-memory: sort ascending, value at `floor(0.95 * length)` |

## Alert Thresholds

Configurable via `.env`:

| Metric | Unhealthy | Degraded |
|--------|-----------|----------|
| Timeout rate | > 15% | > 12% |
| Avg response time | > 20,000ms | > 16,000ms |
| Error rate | > 10% | > 8% |

## Health Score (Stretch C)

```
score = (1 - timeoutRate) * 30
      + (1 - errorRate) * 30
      + successRate * 20
      + max(0, 1 - avgResponseTime/30000) * 20
```

## Test Data

Generated via `npm run generate-data`:

- **7 PSPs**: FlutterWave, Paystack, DPO, PesaPal, Interswitch, Cellulant, Ozow
- **5 payment methods**: mpesa, mtn_mobile_money, airtel_money, card, bank_transfer
- **3 currencies**: KES, NGN, ZAR

**Problem PSPs** (for alert verification):
- **FlutterWave**: ~20-25% timeout rate → triggers **unhealthy** alert
- **DPO**: avg response time 15-25s → triggers **degraded/unhealthy** alert

**Healthy PSPs**: 1-5s response, <2% timeout, <1% error

## Demo Walkthrough

```bash
# 1. Start + load data
npm run dev
npm run generate-data
curl -X POST http://localhost:3000/api/transactions/bulk \
  -H "Content-Type: application/json" -d @data/test-transactions.json

# 2. See all PSP health
curl http://localhost:3000/api/health | jq

# 3. FlutterWave should be unhealthy
curl http://localhost:3000/api/health/FlutterWave | jq

# 4. Alert summary
curl http://localhost:3000/api/alerts | jq

# 5. Health scores (Stretch C)
curl http://localhost:3000/api/health/scores | jq

# 6. Payment method breakdown (Stretch A)
curl http://localhost:3000/api/health/FlutterWave/methods | jq

# 7. Trends vs 24h baseline (Stretch B)
curl http://localhost:3000/api/health/FlutterWave/trends | jq
```

## Configuration

Copy `.env.example` to `.env` and adjust as needed. All values have sensible defaults.

## Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Fastify 5
- **Database**: SQLite (better-sqlite3, WAL mode)
- **Validation**: Zod
- **Testing**: Vitest
