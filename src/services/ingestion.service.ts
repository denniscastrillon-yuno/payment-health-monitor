import { transactionSchema, TransactionInput } from '../domain/types';
import { TransactionRepository } from '../infrastructure/repositories/transaction.repository';
import { z } from 'zod';

const bulkSchema = z.object({
  transactions: z.array(transactionSchema).min(1).max(1000),
});

export class IngestionService {
  private repo: TransactionRepository;

  constructor() {
    this.repo = new TransactionRepository();
  }

  ingestSingle(data: unknown): { transaction_id: string } {
    const parsed = transactionSchema.parse(data);
    this.repo.insert(parsed);
    return { transaction_id: parsed.id };
  }

  ingestBatch(data: unknown): { total_received: number; inserted: number; errors: string[] } {
    const parsed = bulkSchema.parse(data);
    const { inserted, errors } = this.repo.insertBatch(parsed.transactions);
    return {
      total_received: parsed.transactions.length,
      inserted,
      errors,
    };
  }
}
