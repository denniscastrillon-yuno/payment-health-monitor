import { z } from 'zod';
import { transactionSchema } from '../../domain/types';

export const singleTransactionBody = transactionSchema;

export const bulkTransactionBody = z.object({
  transactions: z.array(transactionSchema).min(1).max(1000),
});
