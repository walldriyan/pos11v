
'use client';

import type { SaleItem } from '@/types'; // Changed from Product to SaleItem
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import Image from 'next/image';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Plus, Minus, Trash2, Search as SearchIcon } from 'lucide-react';

interface CurrentSaleItemsTableProps {
  items: SaleItem[];
  onQuantityChange: (itemId: string, newQuantity: number) => void;
  onRemoveItem: (itemId: string) => void;
}

export function CurrentSaleItemsTable({ items, onQuantityChange, onRemoveItem }: CurrentSaleItemsTableProps) {
  if (!items || items.length === 0) {
    return (
        <div className="flex-1 p-4 flex flex-col items-center justify-center text-center text-muted-foreground h-full">
            <SearchIcon className="h-16 w-16 mx-auto mb-4 text-primary" />
            <p className="text-lg font-medium">Find Products via Search</p>
            <p className="text-sm">Use the search bar above to find products and add them to your sale.</p>
            <p className="text-sm mt-1">Added items will appear here.</p>
        </div>
    );
  }

  const handleQuantityInput = (itemId: string, value: string) => {
    const newQuantity = parseInt(value, 10);
    if (!isNaN(newQuantity)) { // Allow 0 for removal intent, handle in onQuantityChange
      onQuantityChange(itemId, newQuantity);
    } else if (value === "") {
      // Potentially treat empty string as 0 or current quantity, for now, let's assume it means no change until blurred or enter
    }
  };
  
  const incrementQuantity = (item: SaleItem) => {
    if (item.quantity < item.stock) {
      onQuantityChange(item.id, item.quantity + 1);
    }
  };

  const decrementQuantity = (item: SaleItem) => {
    onQuantityChange(item.id, item.quantity - 1); // Let onQuantityChange handle removal if it goes to 0 or less
  };

  return (
    <ScrollArea className="h-full rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-16 text-foreground">Image</TableHead>
            <TableHead className="min-w-[150px] text-foreground">Name</TableHead>
            <TableHead className="text-right text-foreground">Price</TableHead>
            <TableHead className="w-[130px] text-center text-foreground">Quantity</TableHead>
            <TableHead className="text-right text-foreground">Total</TableHead>
            <TableHead className="w-[80px] text-center text-foreground">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="hover:bg-muted/20">
              <TableCell>
                {item.imageUrl ? (
                  <div className="relative w-12 h-12 rounded overflow-hidden">
                    <Image 
                        src={item.imageUrl} 
                        alt={item.name} 
                        layout="fill" 
                        objectFit="cover" 
                        data-ai-hint={`${item.category || ''} ${item.name.split(' ')[0] || ''}`}
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">
                    No Image
                  </div>
                )}
              </TableCell>
              <TableCell className="font-medium text-foreground">{item.name}</TableCell>
              <TableCell className="text-right text-foreground">${item.price.toFixed(2)}</TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center space-x-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => decrementQuantity(item)} aria-label="Decrease quantity">
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleQuantityInput(item.id, e.target.value)}
                    onBlur={(e) => { // Ensure final value is processed if input is directly edited
                        const val = parseInt(e.target.value, 10);
                        if(!isNaN(val)) onQuantityChange(item.id, val);
                        else onQuantityChange(item.id, item.quantity); // revert if invalid
                    }}
                    className="w-12 h-8 text-center bg-input border-border focus:ring-primary text-xs p-1"
                    min="0" // Technically handled by onQuantityChange for removal logic
                    max={item.stock}
                    aria-label="Item quantity"
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => incrementQuantity(item)} disabled={item.quantity >= item.stock} aria-label="Increase quantity">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
              <TableCell className="text-right text-foreground">${(item.price * item.quantity).toFixed(2)}</TableCell>
              <TableCell className="text-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveItem(item.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                  aria-label="Remove item"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
