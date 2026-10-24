import {Link} from '@tanstack/react-router';
import {Button} from '@/components/ui/button';
export function PurchaseNav(){return <nav className="flex gap-2 border-b border-border pb-4"><Button variant="outline" asChild><Link to="/admin/purchases">Purchase bills</Link></Button><Button variant="outline" asChild><Link to="/admin/purchases/vendors">Vendors</Link></Button></nav>;}