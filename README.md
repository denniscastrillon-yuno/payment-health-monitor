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

### Architecture Notes

Transactions are stored in a single SQLite table using `better-sqlite3` with WAL (Write-Ahead Logging) mode enabled for concurrent read performance without locking writes. The table is indexed on `(psp, created_at)`, `(status, created_at)`, `(payment_method, created_at)`, and `(created_at)` to support efficient time-window queries across all filtering dimensions.

Metrics are calculated using SQL aggregation for counts and averages (`COUNT`, `SUM`, `AVG`) executed directly against the indexed table, while P95 response times are computed in-memory by fetching sorted response times and selecting the value at `floor(0.95 * length)`. This hybrid approach avoids the complexity of SQLite percentile extensions while keeping the hot path (aggregation) in the database.

Time-window queries work by accepting ISO 8601 `from` and `to` parameters, which default to the last 60 minutes when omitted. These are passed directly as SQL `WHERE` conditions against the indexed `created_at` column, ensuring range queries hit the index rather than performing full table scans. An optional `payment_method` filter can further narrow results by appending an additional `AND` clause.

Health evaluation is performed on-demand for each request: aggregated rows are built into metrics objects, then passed through a pure `evaluateHealth` function that checks timeout rate, error rate, and average response time against configurable thresholds. This keeps the system stateless — no background workers or materialized views — which simplifies deployment and debugging at the cost of re-computing metrics per request.

### Trade-offs

- **SQLite vs PostgreSQL**: SQLite was chosen for zero-dependency deployment and sub-millisecond synchronous reads. At scale (>10K transactions/sec), PostgreSQL with materialized views and `percentile_cont()` would be more appropriate for concurrent writes and native percentile calculations.
- **On-demand computation vs materialized views**: Metrics are computed fresh on every API call rather than pre-computed on a schedule. This ensures results are always up-to-date with zero lag, but adds latency proportional to the data volume in the time window. At scale, a background worker writing to a `metrics_snapshots` table would trade freshness for consistent response times.
- **In-memory P95 vs SQL percentile**: Fetching all response times into memory for P95 calculation works well for moderate data volumes (thousands of transactions per PSP per window) but would become a memory concern at millions. A streaming percentile or t-digest sketch would be the next evolution.
- **Fastify vs Express**: Fastify was chosen for its built-in schema validation, structured logging (Pino), and significantly higher throughput (~2x Express in benchmarks), which matters for a monitoring service receiving high-frequency transaction data.

## API Endpoints

### Transaction Ingestion

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/transactions` | Ingest a single transaction |
| POST | `/api/transactions/bulk` | Batch ingest (up to 1000) |

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

### Real-time Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events` | SSE stream of real-time transaction events (Stretch D) |

### Query Parameters

All GET endpoints (except `/api/alerts/config` and `/api/events`) accept:
- `from` — ISO 8601 timestamp (default: 60 minutes ago)
- `to` — ISO 8601 timestamp (default: now)
- `payment_method` — Filter results to a specific payment method (e.g. `mpesa`, `card`, `bank_transfer`)

### Utility

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ping` | Health check + transaction count |

## Response Examples

### POST /api/transactions

```json
{
  "success": true,
  "data": {
    "transaction_id": "txn-001"
  }
}
```

### POST /api/transactions/bulk

```json
{
  "success": true,
  "data": {
    "total_received": 500,
    "inserted": 498,
    "errors": ["Failed to insert txn-dup: UNIQUE constraint failed"]
  }
}
```

### GET /api/health

```json
{
  "success": true,
  "data": {
    "psps": [
      {
        "metrics": {
          "psp": "FlutterWave",
          "total_transactions": 85,
          "approved_count": 52,
          "declined_count": 8,
          "timeout_count": 19,
          "error_count": 4,
          "pending_count": 2,
          "timeout_rate": 0.2235,
          "error_rate": 0.0471,
          "success_rate": 0.8387,
          "avg_response_time_ms": 8250.33,
          "p95_response_time_ms": 32000,
          "time_window": {
            "from": "2025-01-15T00:00:00.000Z",
            "to": "2025-01-15T01:00:00.000Z"
          }
        },
        "status": "unhealthy",
        "alerts": [
          {
            "metric": "timeout_rate",
            "threshold": "> 15%",
            "current_value": 0.2235,
            "severity": "critical"
          }
        ]
      }
    ]
  }
}
```

### GET /api/health/:psp

```json
{
  "success": true,
  "data": {
    "metrics": {
      "psp": "Paystack",
      "total_transactions": 60,
      "approved_count": 57,
      "declined_count": 2,
      "timeout_count": 0,
      "error_count": 1,
      "pending_count": 0,
      "timeout_rate": 0,
      "error_rate": 0.0167,
      "success_rate": 0.9661,
      "avg_response_time_ms": 2100.45,
      "p95_response_time_ms": 4500,
      "time_window": {
        "from": "2025-01-15T00:00:00.000Z",
        "to": "2025-01-15T01:00:00.000Z"
      }
    },
    "status": "healthy",
    "alerts": []
  }
}
```

### GET /api/alerts

```json
{
  "success": true,
  "data": {
    "timestamp": "2025-01-15T01:00:00.000Z",
    "unhealthy_psps": [
      {
        "psp": "FlutterWave",
        "status": "unhealthy",
        "metrics": { "...": "..." },
        "alerts": [
          { "metric": "timeout_rate", "threshold": "> 15%", "current_value": 0.2235, "severity": "critical" }
        ]
      }
    ],
    "degraded_psps": [
      {
        "psp": "DPO",
        "status": "degraded",
        "metrics": { "...": "..." },
        "alerts": [
          { "metric": "avg_response_time_ms", "threshold": "> 16000ms", "current_value": 18500.2, "severity": "warning" }
        ]
      }
    ],
    "healthy_psps": [
      { "psp": "Paystack", "status": "healthy", "metrics": { "...": "..." }, "alerts": [] }
    ],
    "total_psps": 7
  }
}
```

### GET /api/alerts/config

```json
{
  "success": true,
  "data": {
    "thresholds": {
      "timeout_rate": { "unhealthy": "> 15%", "degraded": "> 12%" },
      "avg_response_time_ms": { "unhealthy": "> 20000ms", "degraded": "> 16000ms" },
      "error_rate": { "unhealthy": "> 10%", "degraded": "> 8%" }
    }
  }
}
```

### GET /api/health/:psp/methods (Stretch A)

```json
{
  "success": true,
  "data": {
    "psp": "FlutterWave",
    "methods": [
      {
        "psp": "FlutterWave",
        "payment_method": "mpesa",
        "total_transactions": 20,
        "approved_count": 12,
        "timeout_rate": 0.25,
        "error_rate": 0.05,
        "success_rate": 0.8571,
        "avg_response_time_ms": 9500.0,
        "p95_response_time_ms": 33000,
        "...": "..."
      }
    ]
  }
}
```

### GET /api/health/:psp/trends (Stretch B)

```json
{
  "success": true,
  "data": {
    "psp": "FlutterWave",
    "current_window": { "...": "metrics for current time range" },
    "baseline_window": { "...": "metrics for 24h before current range" },
    "trends": {
      "timeout_rate": { "direction": "worsening", "change_percent": 85.5 },
      "error_rate": { "direction": "stable", "change_percent": 2.1 },
      "avg_response_time": { "direction": "worsening", "change_percent": 45.0 },
      "success_rate": { "direction": "worsening", "change_percent": -12.3 }
    }
  }
}
```

### GET /api/health/scores (Stretch C)

```json
{
  "success": true,
  "data": {
    "scores": [
      {
        "psp": "Paystack",
        "score": 99.3,
        "status": "healthy",
        "breakdown": {
          "timeout_component": 30,
          "error_component": 29.7,
          "success_component": 19.6,
          "response_time_component": 19.9
        }
      },
      {
        "psp": "FlutterWave",
        "score": 62.1,
        "status": "unhealthy",
        "breakdown": {
          "timeout_component": 23.3,
          "error_component": 28.6,
          "success_component": 16.8,
          "response_time_component": 14.5
        }
      }
    ]
  }
}
```

### GET /api/events (Stretch D — SSE)

```
event: connected
data: {"client_id":"1"}

event: transaction
data: {"transaction_id":"txn-001"}

event: batch_ingested
data: {"total_received":500,"inserted":498}
```

**Usage:**
```bash
# Connect to SSE stream
curl -N http://localhost:3000/api/events

# In another terminal, send a transaction to see the event
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"id":"sse-test","psp":"Paystack","payment_method":"card","amount":50,"currency":"NGN","status":"approved","response_time_ms":1200,"created_at":"2025-01-15T10:30:00Z"}'
```

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
- **Amount range**: $1 - $200

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

# 8. Filter by payment method
curl "http://localhost:3000/api/health?payment_method=mpesa" | jq
curl "http://localhost:3000/api/health/FlutterWave?payment_method=card" | jq

# 9. Real-time SSE events (Stretch D)
curl -N http://localhost:3000/api/events
```

## Configuration

Copy `.env.example` to `.env` and adjust as needed. All values have sensible defaults.

## Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Fastify 5
- **Database**: SQLite (better-sqlite3, WAL mode)
- **Validation**: Zod
- **Testing**: Vitest
