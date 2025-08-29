import Image from 'next/image';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SaleItem } from "@/types";
import { Plus, Minus, Trash2 } from "lucide-react";

interface SaleItemCardProps {
  item: SaleItem;
  onQuantityChange: (itemId: string, newQuantity: number) => void;
  onRemoveItem: (itemId: string) => void;
}

export function SaleItemCard({ item, onQuantityChange, onRemoveItem }: SaleItemCardProps) {
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuantity = parseInt(e.target.value, 10);
    if (!isNaN(newQuantity) && newQuantity >= 0) {
      onQuantityChange(item.id, newQuantity);
    }
  };

  const incrementQuantity = () => {
    onQuantityChange(item.id, item.quantity + 1);
  };

  const decrementQuantity = () => {
    if (item.quantity > 0) { // Prevent going below 0, removal should be explicit
      onQuantityChange(item.id, item.quantity - 1);
    }
  };
  
  const totalItemPrice = item.price * item.quantity;

  return (
    <Card className="bg-background border-border p-3 shadow-sm transition-all duration-300 hover:shadow-md">
      <CardContent className="p-0 flex items-center space-x-3">
        {item.imageUrl && (
          <div className="relative w-16 h-16 rounded overflow-hidden shrink-0">
            <Image 
              src={item.imageUrl} 
              alt={item.name} 
              layout="fill" 
              objectFit="cover" 
              data-ai-hint={`${item.category} ${item.name.split(' ')[0]}`}
            />
          </div>
        )}
        <div className="flex-grow space-y-1">
          <h4 className="font-medium text-foreground text-sm">{item.name}</h4>
          <p className="text-xs text-muted-foreground">${item.price.toFixed(2)} each</p>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <Button variant="ghost" size="icon" onClick={decrementQuantity} disabled={item.quantity <= 0} aria-label="Decrease quantity">
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            type="number"
            value={item.quantity}
            onChange={handleQuantityChange}
            className="w-14 h-8 text-center bg-input border-border focus:ring-primary"
            min="0"
            aria-label="Item quantity"
          />
          <Button variant="ghost" size="icon" onClick={incrementQuantity} aria-label="Increase quantity">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="font-medium w-20 text-right shrink-0 text-sm">${totalItemPrice.toFixed(2)}</p>
        <Button variant="ghost" size="icon" onClick={() => onRemoveItem(item.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10" aria-label="Remove item">
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
