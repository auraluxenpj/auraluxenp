import { createFileRoute } from '@tanstack/react-router';
import { handleSyncRequest, type RpcClient } from '@/lib/inventory-sync';

// POST /api/public/inventory-sync — called by BizSathi with a bearer secret (see src/lib/inventory-sync.ts).
export const Route = createFileRoute('/api/public/inventory-sync')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        return handleSyncRequest(request, supabaseAdmin as unknown as RpcClient);
      },
    },
  },
});
