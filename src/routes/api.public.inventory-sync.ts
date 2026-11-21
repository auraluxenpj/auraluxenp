import { createFileRoute } from '@tanstack/react-router';
import { handleSyncRequest, type RpcClient } from '@/lib/inventory-sync';

// POST /api/public/inventory-sync — called by BizSathi with a bearer secret (see src/lib/inventory-sync.ts).
export const Route = createFileRoute('/api/public/inventory-sync')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const db = supabaseAdmin as unknown as RpcClient;
        const authority = await db.rpc('website_inventory_authority_enabled', {});
        if (authority.error) return Response.json({ error: 'Inventory authority state unavailable' }, { status: 503 });
        if (authority.data === true) return Response.json({ error: 'Legacy inventory sync is disabled; use the transactional BizSathi endpoint' }, { status: 410 });
        return handleSyncRequest(request, db);
      },
    },
  },
});
