import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/bizsathi-catalogue-publish')({
  server: { handlers: { POST: async () => Response.json(
    { error: 'Auraluxe is not a catalogue source. BizSathi is authoritative.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  ) } },
});
