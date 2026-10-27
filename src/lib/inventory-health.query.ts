import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { inventoryHealth, type HealthProduct, type HealthVariant } from './inventory-health';

export const inventoryHealthQuery = (userId: string) => queryOptions({
  queryKey: ['admin', 'inventory-health', userId],
  staleTime: 0,
  queryFn: async () => {
    const { data: allowed, error: roleError } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (roleError || !allowed) throw new Error('Administrator access required');
    const products: HealthProduct[] = [];
    const variants: HealthVariant[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('products')
        .select('id,name,sku,stock,sizes,price,sale_price,is_published').order('id').range(offset, offset + 499);
      if (error) throw new Error('Could not load the complete product catalogue. Please retry.');
      products.push(...(data ?? []));
      if ((data?.length ?? 0) < 500) break;
    }
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('product_variants')
        .select('product_id,size,stock').order('id').range(offset, offset + 499);
      if (error) throw new Error('Could not load all size-stock records. Please retry.');
      variants.push(...(data ?? []));
      if ((data?.length ?? 0) < 500) break;
    }
    return { ...inventoryHealth(products, variants), checkedAt: new Date().toISOString() };
  },
});