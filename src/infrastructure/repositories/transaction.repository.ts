import Database from 'better-sqlite3';
import { getDatabase } from '../database';
import { AggregatedRow, TransactionInput, TimeRange } from '../../domain/types';

export class TransactionRepository {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  insert(tx: TransactionInput): void {
    const stmt = this.db.prepare(`
      INSERT INTO transactions (id, psp, payment_method, amount, currency, status, response_time_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(tx.id, tx.psp, tx.payment_method, tx.amount, tx.currency, tx.status, tx.response_time_ms, tx.created_at);
  }

  insertBatch(transactions: TransactionInput[]): { inserted: number; errors: string[] } {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO transactions (id, psp, payment_method, amount, currency, status, response_time_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const errors: string[] = [];
    let inserted = 0;

    const insertMany = this.db.transaction((txns: TransactionInput[]) => {
      for (const tx of txns) {
        try {
          const result = stmt.run(tx.id, tx.psp, tx.payment_method, tx.amount, tx.currency, tx.status, tx.response_time_ms, tx.created_at);
          if (result.changes > 0) inserted++;
        } catch (err) {
          errors.push(`Failed to insert ${tx.id}: ${(err as Error).message}`);
        }
      }
    });

    insertMany(transactions);
    return { inserted, errors };
  }

  getAggregatedByPSP(timeRange: TimeRange): AggregatedRow[] {
    const stmt = this.db.prepare(`
      SELECT
        psp,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) as declined,
        SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) as timeout,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        AVG(response_time_ms) as avg_response_time
      FROM transactions
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY psp
    `);
    return stmt.all(timeRange.from, timeRange.to) as AggregatedRow[];
  }

  getAggregatedForPSP(psp: string, timeRange: TimeRange): AggregatedRow | undefined {
    const stmt = this.db.prepare(`
      SELECT
        psp,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) as declined,
        SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) as timeout,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        AVG(response_time_ms) as avg_response_time
      FROM transactions
      WHERE psp = ? AND created_at >= ? AND created_at <= ?
      GROUP BY psp
    `);
    return stmt.get(psp, timeRange.from, timeRange.to) as AggregatedRow | undefined;
  }

  getAggregatedByPaymentMethod(psp: string, timeRange: TimeRange): AggregatedRow[] {
    const stmt = this.db.prepare(`
      SELECT
        psp,
        payment_method,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) as declined,
        SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) as timeout,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        AVG(response_time_ms) as avg_response_time
      FROM transactions
      WHERE psp = ? AND created_at >= ? AND created_at <= ?
      GROUP BY psp, payment_method
    `);
    return stmt.all(psp, timeRange.from, timeRange.to) as AggregatedRow[];
  }

  getResponseTimes(psp: string, timeRange: TimeRange): number[] {
    const stmt = this.db.prepare(`
      SELECT response_time_ms
      FROM transactions
      WHERE psp = ? AND created_at >= ? AND created_at <= ?
      ORDER BY response_time_ms ASC
    `);
    const rows = stmt.all(psp, timeRange.from, timeRange.to) as { response_time_ms: number }[];
    return rows.map(r => r.response_time_ms);
  }

  getResponseTimesForPaymentMethod(psp: string, paymentMethod: string, timeRange: TimeRange): number[] {
    const stmt = this.db.prepare(`
      SELECT response_time_ms
      FROM transactions
      WHERE psp = ? AND payment_method = ? AND created_at >= ? AND created_at <= ?
      ORDER BY response_time_ms ASC
    `);
    const rows = stmt.all(psp, paymentMethod, timeRange.from, timeRange.to) as { response_time_ms: number }[];
    return rows.map(r => r.response_time_ms);
  }

  getDistinctPSPs(): string[] {
    const stmt = this.db.prepare('SELECT DISTINCT psp FROM transactions ORDER BY psp');
    const rows = stmt.all() as { psp: string }[];
    return rows.map(r => r.psp);
  }

  getTransactionCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM transactions');
    const row = stmt.get() as { count: number };
    return row.count;
  }
}
