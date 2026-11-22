import { createFileRoute } from '@tanstack/react-router';

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

/**
 * Temporary, read-only deployment diagnostic.
 * Calls only BizSathi's bearer-protected auth probe; it cannot reserve,
 * commit, cancel, read stock, or publish an outbox event.
 * Remove after the one-time connectivity verification.
 */
export const Route = createFileRoute('/api/public/inventory-peer-auth-check')({
  server: {
    handlers: {
      GET: async () => {
        const secret = process.env['WEBSITE_INVENTORY_SYNC_SECRET'];
        if (!secret || secret.length < 24) return json({ ok: false, peerAuthenticated: false }, 503);
        try {
          const response = await fetch(
            'https://bizsathi-migration.auraluxe26.workers.dev/api/public/website-inventory-auth',
            {
              method: 'GET',
              headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
              redirect: 'error',
              signal: AbortSignal.timeout(5000),
            },
          );
          const result: unknown = await response.json().catch(() => null);
          const authenticated =
            response.ok &&
            !!result &&
            typeof result === 'object' &&
            'ok' in result &&
            result.ok === true &&
            'authenticated' in result &&
            result.authenticated === true;
          return json({ ok: authenticated, peerAuthenticated: authenticated }, authenticated ? 200 : 503);
        } catch {
          return json({ ok: false, peerAuthenticated: false }, 503);
        }
      },
    },
  },
});
