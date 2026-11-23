import { createFileRoute } from '@tanstack/react-router';

function equalSecret(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left), b = new TextEncoder().encode(right);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

// The former endpoint accepted absolute stock snapshots. It is intentionally
// retired: stock is now projected only from approved, idempotent movement events.
export const Route = createFileRoute('/api/public/bizsathi-inventory')({
  server: { handlers: { POST: async ({ request }) => {
    const expected = process.env['WEBSITE_INVENTORY_SYNC_SECRET'] ?? '';
    const authorization = request.headers.get('authorization') ?? '';
    const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (expected.length < 24 || !supplied || !equalSecret(supplied, expected)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
    return Response.json(
      { error: 'Absolute stock projection is retired; use the transactional BizSathi stock event endpoint' },
      { status: 410, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
    );
  } } },
});
