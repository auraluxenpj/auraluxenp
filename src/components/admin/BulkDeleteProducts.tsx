// src/components/admin/BulkDeleteProducts.tsx
// Bulk delete for admin Products page (React + Supabase + shadcn/ui)

import { useState, useCallback } from "react";
import { Trash2, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/* ------------------------------------------------------------------ */
/* 1) Selection hook                                                   */
/* ------------------------------------------------------------------ */
export function useSelection(allIdsOnPage: string[]) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const allSelected =
    allIdsOnPage.length > 0 && allIdsOnPage.every((id) => selected.includes(id));

  const toggleAll = useCallback(() => {
    setSelected(allSelected ? [] : allIdsOnPage);
  }, [allSelected, allIdsOnPage]);

  const clear = useCallback(() => setSelected([]), []);

  return { selected, toggle, toggleAll, allSelected, clear };
}

/* ------------------------------------------------------------------ */
/* 2) Delete helper (chunked so the request URL never gets too long)   */
/* ------------------------------------------------------------------ */
type ChildTable = { table: string; column: string }; // e.g. { table: "product_variants", column: "product_id" }

async function deleteProducts(
  ids: string[],
  tableName: string,
  childTables: ChildTable[]
) {
  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);

    // delete child rows first so foreign keys don't block
    for (const child of childTables) {
      const { error } = await (supabase as any)
        .from(child.table)
        .delete()
        .in(child.column, chunk);
      if (error) throw error;
    }

    const { error } = await (supabase as any)
      .from(tableName)
      .delete()
      .in("id", chunk);
    if (error) throw error;
  }
}

/* ------------------------------------------------------------------ */
/* 3) Action bar + confirm dialog                                      */
/* ------------------------------------------------------------------ */
interface Props {
  selectedIds: string[];
  onClear: () => void;
  onDeleted: () => void; // refetch your product list here
  tableName?: string; // default "products"
  childTables?: ChildTable[]; // optional related tables
}

export function BulkDeleteBar({
  selectedIds,
  onClear,
  onDeleted,
  tableName = "products",
  childTables = [],
}: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (selectedIds.length === 0) return null;

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteProducts(selectedIds, tableName, childTables);
      toast({ title: `${selectedIds.length} products deleted` });
      onClear();
      onDeleted();
      setOpen(false);
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err?.message ?? "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-3 shadow-sm">
        <span className="text-sm font-medium">{selectedIds.length} selected</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClear}>
            <X className="mr-1 h-4 w-4" /> Clear
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
            <Trash2 className="mr-1 h-4 w-4" /> Delete Selected
          </Button>
        </div>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} products?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault(); // keep dialog open until done
                handleDelete();
              }}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 4) OPTIONAL: "Delete ALL" with type-DELETE confirmation             */
/* ------------------------------------------------------------------ */
export function DeleteAllButton({
  onDeleted,
  tableName = "products",
  childTables = [],
}: {
  onDeleted: () => void;
  tableName?: string;
  childTables?: ChildTable[];
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).from(tableName).select("id");
      if (error) throw error;
      const ids = (data ?? []).map((r: any) => r.id);
      await deleteProducts(ids, tableName, childTables);
      toast({ title: `${ids.length} products deleted` });
      setOpen(false);
      setText("");
      onDeleted();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Delete All Products
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ALL products?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes every product permanently. Type DELETE to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="DELETE" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={text !== "DELETE" || loading}
              onClick={(e) => {
                e.preventDefault();
                run();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* HOW TO USE in your Products page                                    */
/* ------------------------------------------------------------------ */
/*
import { Checkbox } from "@/components/ui/checkbox";
import { useSelection, BulkDeleteBar, DeleteAllButton } from "@/components/admin/BulkDeleteProducts";

// inside your component (products = your array, refetch = your reload function):
const { selected, toggle, toggleAll, allSelected, clear } = useSelection(products.map((p) => p.id));

// above the table:
<BulkDeleteBar selectedIds={selected} onClear={clear} onDeleted={refetch} />

// in the table header, add a first column:
<TableHead className="w-10">
  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
</TableHead>

// in each product row, add a first cell:
<TableCell>
  <Checkbox checked={selected.includes(product.id)} onCheckedChange={() => toggle(product.id)} />
</TableCell>

// If you have variants/images tables with foreign keys, pass them:
// <BulkDeleteBar ... childTables={[{ table: "product_variants", column: "product_id" }]} />
*/
