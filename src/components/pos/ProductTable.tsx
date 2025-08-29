
'use client';

import type { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { PlusCircle } from 'lucide-react';

interface ProductTableProps {
  products: Product[];
  onProductSelect: (product: Product) => void;
}

export function ProductTable({ products, onProductSelect }: ProductTableProps) {
  if (!products || products.length === 0) {
    return <p className="text-center text-muted-foreground py-10">No products available to display.</p>;
  }

  return (
    <ScrollArea className="h-full rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="w-[120px] text-center">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id} className="hover:bg-muted/50">
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell>{product.category || 'N/A'}</TableCell>
              <TableCell className="text-right">${product.price.toFixed(2)}</TableCell>
              <TableCell className="text-right">{product.stock}</TableCell>
              <TableCell className="text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onProductSelect(product)}
                  disabled={product.stock === 0}
                  className="h-8 border-primary text-primary hover:bg-primary hover:text-primary-foreground disabled:border-muted disabled:text-muted-foreground"
                >
                  <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Add
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
