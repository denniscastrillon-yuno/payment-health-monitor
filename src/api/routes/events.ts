import { FastifyInstance } from 'fastify';

interface SSEClient {
  id: string;
  reply: { raw: { write: (data: string) => void; on: (event: string, cb: () => void) => void } };
}

const clients: Set<SSEClient> = new Set();

let clientIdCounter = 0;

export function broadcastEvent(type: string, data: unknown): void {
  const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.reply.raw.write(message);
    } catch {
      clients.delete(client);
    }
  }
}

export async function eventRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/events - SSE stream of real-time events
  fastify.get('/api/events', async (request, reply) => {
    const clientId = String(++clientIdCounter);

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send connected event
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ client_id: clientId })}\n\n`);

    const client: SSEClient = { id: clientId, reply: reply as SSEClient['reply'] };
    clients.add(client);

    // Clean up on disconnect
    request.raw.on('close', () => {
      clients.delete(client);
    });

    // Keep the connection open — do not call reply.send()
    await new Promise(() => {});
  });
}
