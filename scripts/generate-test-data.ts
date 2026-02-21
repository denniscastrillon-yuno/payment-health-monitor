import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

interface TestTransaction {
  id: string;
  psp: string;
  payment_method: string;
  amount: number;
  currency: string;
  status: string;
  response_time_ms: number;
  created_at: string;
}

const PSPs = ['FlutterWave', 'Paystack', 'DPO', 'PesaPal', 'Interswitch', 'Cellulant', 'Ozow'];

const PAYMENT_METHODS = ['mpesa', 'mtn_mobile_money', 'airtel_money', 'card', 'bank_transfer'];

const CURRENCIES: Record<string, string[]> = {
  FlutterWave: ['NGN', 'KES'],
  Paystack: ['NGN'],
  DPO: ['KES', 'ZAR'],
  PesaPal: ['KES'],
  Interswitch: ['NGN'],
  Cellulant: ['KES', 'NGN'],
  Ozow: ['ZAR'],
};

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateAmount(): number {
  return Math.round((Math.random() * 199 + 1) * 100) / 100;
}

function generateTransaction(
  psp: string,
  createdAt: Date,
  isProblematic: boolean,
  problemType?: 'timeout' | 'slow',
): TestTransaction {
  const paymentMethod = randomElement(PAYMENT_METHODS);
  const currency = randomElement(CURRENCIES[psp]);

  let status: string;
  let responseTimeMs: number;

  if (isProblematic && problemType === 'timeout') {
    // FlutterWave: high timeout rate
    const roll = Math.random();
    if (roll < 0.22) {
      status = 'timeout';
      responseTimeMs = randomBetween(25000, 35000);
    } else if (roll < 0.27) {
      status = 'error';
      responseTimeMs = randomBetween(500, 3000);
    } else if (roll < 0.35) {
      status = 'declined';
      responseTimeMs = randomBetween(1000, 4000);
    } else if (roll < 0.38) {
      status = 'pending';
      responseTimeMs = randomBetween(2000, 5000);
    } else {
      status = 'approved';
      responseTimeMs = randomBetween(1000, 5000);
    }
  } else if (isProblematic && problemType === 'slow') {
    // DPO: high avg response time
    const roll = Math.random();
    if (roll < 0.05) {
      status = 'timeout';
      responseTimeMs = randomBetween(28000, 35000);
    } else if (roll < 0.08) {
      status = 'error';
      responseTimeMs = randomBetween(8000, 15000);
    } else if (roll < 0.18) {
      status = 'declined';
      responseTimeMs = randomBetween(12000, 22000);
    } else if (roll < 0.22) {
      status = 'pending';
      responseTimeMs = randomBetween(10000, 20000);
    } else {
      status = 'approved';
      responseTimeMs = randomBetween(15000, 25000);
    }
  } else {
    // Healthy PSPs
    const roll = Math.random();
    if (roll < 0.015) {
      status = 'timeout';
      responseTimeMs = randomBetween(20000, 30000);
    } else if (roll < 0.025) {
      status = 'error';
      responseTimeMs = randomBetween(200, 2000);
    } else if (roll < 0.12) {
      status = 'declined';
      responseTimeMs = randomBetween(800, 3000);
    } else if (roll < 0.16) {
      status = 'pending';
      responseTimeMs = randomBetween(1000, 3000);
    } else {
      status = 'approved';
      responseTimeMs = randomBetween(1000, 5000);
    }
  }

  return {
    id: uuidv4(),
    psp,
    payment_method: paymentMethod,
    amount: generateAmount(),
    currency,
    status,
    response_time_ms: responseTimeMs,
    created_at: createdAt.toISOString(),
  };
}

function generateTestData(): TestTransaction[] {
  const transactions: TestTransaction[] = [];
  const now = new Date();

  // Generate transactions spread over the last 3 hours (primary window)
  // and some in the 24h baseline window
  for (const psp of PSPs) {
    const isFlutterWave = psp === 'FlutterWave';
    const isDPO = psp === 'DPO';
    const isProblematic = isFlutterWave || isDPO;
    const problemType = isFlutterWave ? 'timeout' : isDPO ? 'slow' : undefined;

    // Recent transactions (last 3 hours) — more transactions for problem PSPs
    const recentCount = isProblematic ? randomBetween(70, 90) : randomBetween(50, 70);
    for (let i = 0; i < recentCount; i++) {
      const minutesAgo = Math.random() * 180; // last 3 hours
      const createdAt = new Date(now.getTime() - minutesAgo * 60 * 1000);
      transactions.push(generateTransaction(psp, createdAt, isProblematic, problemType));
    }

    // Baseline transactions (3-27 hours ago) — for trend detection
    const baselineCount = randomBetween(30, 50);
    for (let i = 0; i < baselineCount; i++) {
      const minutesAgo = 180 + Math.random() * (24 * 60); // 3h to 27h ago
      const createdAt = new Date(now.getTime() - minutesAgo * 60 * 1000);
      // Baseline transactions are healthy (to show degradation trend for problem PSPs)
      transactions.push(generateTransaction(psp, createdAt, false));
    }
  }

  // Sort by created_at
  transactions.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return transactions;
}

// Main execution
const transactions = generateTestData();

const outputDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputPath = path.join(outputDir, 'test-transactions.json');
fs.writeFileSync(outputPath, JSON.stringify({ transactions }, null, 2));

console.log(`Generated ${transactions.length} test transactions`);
console.log(`Output: ${outputPath}`);

// Print summary
const summary: Record<string, { total: number; statuses: Record<string, number> }> = {};
for (const tx of transactions) {
  if (!summary[tx.psp]) {
    summary[tx.psp] = { total: 0, statuses: {} };
  }
  summary[tx.psp].total++;
  summary[tx.psp].statuses[tx.status] = (summary[tx.psp].statuses[tx.status] || 0) + 1;
}

console.log('\nSummary by PSP:');
for (const [psp, data] of Object.entries(summary)) {
  const timeoutRate = ((data.statuses['timeout'] || 0) / data.total * 100).toFixed(1);
  console.log(`  ${psp}: ${data.total} transactions (timeout: ${timeoutRate}%) ${JSON.stringify(data.statuses)}`);
}
