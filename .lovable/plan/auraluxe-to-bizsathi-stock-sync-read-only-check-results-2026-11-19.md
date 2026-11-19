# Auraluxe to BizSathi stock sync: read-only check results

## Findings
- The live link is at POST /api/public/inventory-sync. It needs `Authorization: Bearer <INVENTORY_SYNC_SECRET>`. The key is compared in constant time. If the key is missing or shorter than 24 characters, the link returns 500.
- INVENTORY_SYNC_SECRET is **present** in the project secrets. Its value was not read or shown.
- The only read-only action is `{"action":"state","skus":[...]}`. It runs `inv_sync_state`, which only reads data. It returns `{ items: [{ sku, match, current, last, pending }] }`.
- The `ack`, `recorded` and `push` actions all write data. None of them was called.
- There is no separate health or status action.

## Test results (live www.auraluxe.com.np)
- No key: HTTP 401, `text/plain`, body "Unauthorized".
- Wrong key: HTTP 401, `text/plain`, body "Unauthorized".
- The published project address replied 307, a redirect to the main domain, so I ran these tests directly against the main domain.
- 401 for a wrong key means the server found a valid key, because a missing or short key returns 500 first.

## Blocker
- No available tool can send a request that uses the stored key on the server without exposing it. So the signed-in `state` test was **not run**.
- A database read also failed this turn with "Database is possibly not accessible".

## Next step (if approved)
- Run the signed-in `state` check from BizSathi, the side that holds the key, using one known SKU. Confirm it returns HTTP 200 and the `items` shape. Make no changes.
