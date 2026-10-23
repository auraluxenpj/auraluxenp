alter table public.orders add column restocked_at timestamptz;

create or replace function public.restock_order(p_order_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_item jsonb;
  v_oi record;
  v_qty int;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can restock orders';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status not in ('cancelled', 'returned') then
    raise exception 'Only cancelled or returned orders can be restocked';
  end if;
  if v_order.restocked_at is not null then
    raise exception 'This order was already restored to stock';
  end if;
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_qty := (v_item->>'quantity')::int;
    select * into v_oi from public.order_items
      where id = (v_item->>'order_item_id')::uuid and order_id = p_order_id;
    if not found then raise exception 'Item does not belong to this order'; end if;
    if v_qty is null or v_qty < 0 or v_qty > v_oi.quantity then
      raise exception 'Invalid quantity for %', v_oi.product_name;
    end if;
    if v_qty > 0 and v_oi.product_id is not null then
      update public.products set stock = stock + v_qty where id = v_oi.product_id;
    end if;
  end loop;
  update public.orders set restocked_at = now() where id = p_order_id;
end;
$$;

revoke all on function public.restock_order(uuid, jsonb) from public;
grant execute on function public.restock_order(uuid, jsonb) to authenticated;