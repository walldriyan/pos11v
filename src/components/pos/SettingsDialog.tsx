
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Save } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '@/store/store';
import {
  _internalSetTaxRate,
  selectTaxRate
} from '@/store/slices/saleSlice';
import { selectCurrentUser } from '@/store/slices/authSlice';
import {
  saveTaxRateAction,
} from '@/app/actions/settingsActions'; 

interface SettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function SettingsDialog({ isOpen, onOpenChange }: SettingsDialogProps) {
  const dispatch: AppDispatch = useDispatch();
  const { toast } = useToast();
  const currentUser = useSelector(selectCurrentUser);
  const currentTaxRateDecimal = useSelector(selectTaxRate);

  const [taxRateInput, setTaxRateInput] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setTaxRateInput((currentTaxRateDecimal * 100).toFixed(2));
    }
  }, [isOpen, currentTaxRateDecimal]);


  const handleTaxRateSave = async () => {
    if (!currentUser?.id) {
        toast({ title: "Authentication Error", description: "You must be logged in to change settings.", variant: "destructive" });
        return;
    }
    const newRatePercentage = parseFloat(taxRateInput);
    if (isNaN(newRatePercentage) || newRatePercentage < 0 || newRatePercentage > 100) {
      toast({ title: "Invalid Tax Rate", description: "Please enter a valid number between 0 and 100 for the tax rate percentage.", variant: "destructive" });
      return;
    }
    const newRateDecimal = newRatePercentage / 100;
    const result = await saveTaxRateAction(newRateDecimal, currentUser.id);

    if (result.success && result.data !== undefined) {
      dispatch(_internalSetTaxRate(result.data.value));
      toast({ title: "Tax Rate Updated", description: `Tax rate set to ${newRatePercentage.toFixed(2)}%.` });
    } else {
      toast({ title: "Error Saving Tax Rate", description: result.error || "An unknown error occurred.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[600px] max-h-[80vh] flex flex-col bg-card border-border sm:rounded-2xl shadow-xl"
      >
        <DialogHeader>
          <DialogTitle className="text-card-foreground">Settings</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Manage Tax settings for your POS. Discount Sets are managed on their dedicated page.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="tax" className="w-full pt-2 flex-grow overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-1 bg-muted">
            <TabsTrigger value="tax" className="data-[state=active]:bg-primary/80 data-[state=active]:text-primary-foreground">Tax Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="tax" className="mt-4 flex flex-col flex-grow min-h-0">
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2 border border-border p-4 rounded-md bg-background">
                  <h3 className="text-lg font-medium text-foreground">Global Tax Rate Configuration</h3>
                  <Label htmlFor="tax-rate-input" className="text-foreground">Tax Rate (%)</Label>
                  <Input
                      id="tax-rate-input"
                      type="number"
                      value={taxRateInput}
                      onChange={(e) => setTaxRateInput(e.target.value)}
                      className="bg-input border-border focus:ring-primary text-foreground"
                      placeholder="e.g., 10 for 10%"
                      min="0"
                      max="100"
                      step="0.01"
                  />
                  <div className="flex justify-end mt-2">
                      <Button type="button" onClick={handleTaxRateSave} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                         <Save className="mr-2 h-4 w-4" /> Save Tax Rate
                      </Button>
                  </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4 flex-shrink-0 border-t border-border pt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
