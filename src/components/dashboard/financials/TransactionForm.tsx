
'use client';

import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FinancialTransactionFormSchema } from '@/lib/zodSchemas';
import type { FinancialTransactionFormData, TransactionType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, CheckCircle, FilePlus2 } from 'lucide-react';
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TransactionFormProps {
  transaction?: FinancialTransactionFormData | null;
  onSubmit: (data: FinancialTransactionFormData) => Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string[]> }>;
  isLoading?: boolean;
  formError?: string | null;
  fieldErrors?: Record<string, string[]>;
  onSwitchToAddNew?: () => void;
  submissionDetails?: { id: string; category: string; type: TransactionType } | null;
  isFormDisabled?: boolean; // New prop
}

const defaultFormValues: FinancialTransactionFormData = {
  date: new Date(),
  type: 'EXPENSE',
  amount: 0,
  category: '',
  description: '',
};

export function TransactionForm({
  transaction,
  onSubmit,
  isLoading,
  formError,
  fieldErrors: serverFieldErrors,
  onSwitchToAddNew,
  submissionDetails,
  isFormDisabled = false, // Default to false
}: TransactionFormProps) {
  
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors: localErrors, isValid: formIsValid, isDirty },
  } = useForm<FinancialTransactionFormData>({
    resolver: zodResolver(FinancialTransactionFormSchema),
    defaultValues: transaction || defaultFormValues,
    mode: 'onChange',
  });

  const isEditing = !!transaction?.id;
  const submitButtonText = isEditing ? 'Update Transaction' : 'Save Transaction';

  useEffect(() => {
    if (transaction) {
      reset({ ...defaultFormValues, ...transaction });
    } else {
      reset(defaultFormValues);
    }
  }, [transaction, reset]);

  const handleClearAndPrepareForNew = () => {
    if (onSwitchToAddNew) {
      onSwitchToAddNew();
    }
    reset(defaultFormValues);
  };

  const combinedFieldErrors = { ...localErrors, ...serverFieldErrors };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-4">
      {formError && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{formError}</p>}

      <fieldset disabled={isFormDisabled} className="space-y-4">
        <div>
          <Label htmlFor="date" className="text-foreground text-xs">Date*</Label>
          <Controller
            name="date"
            control={control}
            render={({ field }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    disabled={isFormDisabled}
                    className={cn("w-full justify-start text-left font-normal bg-input border-border hover:bg-input/80", !field.value && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                </PopoverContent>
              </Popover>
            )}
          />
          {(combinedFieldErrors.date) && (<p className="text-xs text-destructive mt-1">{combinedFieldErrors.date?.message}</p>)}
        </div>

        <div>
          <Label className="text-foreground text-xs mb-1 block">Type*</Label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <RadioGroup onValueChange={field.onChange} value={field.value} className="flex space-x-4" disabled={isFormDisabled}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="INCOME" id="type-income" />
                  <Label htmlFor="type-income" className="text-xs">Income</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="EXPENSE" id="type-expense" />
                  <Label htmlFor="type-expense" className="text-xs">Expense</Label>
                </div>
              </RadioGroup>
            )}
          />
          {(combinedFieldErrors.type) && (<p className="text-xs text-destructive mt-1">{combinedFieldErrors.type?.message}</p>)}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="amount" className="text-foreground text-xs">Amount*</Label>
            <Input id="amount" type="number" step="0.01" {...register('amount', { valueAsNumber: true })} className="bg-input border-border focus:ring-primary text-sm" />
            {(combinedFieldErrors.amount) && (<p className="text-xs text-destructive mt-1">{combinedFieldErrors.amount?.message}</p>)}
          </div>
          <div>
            <Label htmlFor="category" className="text-foreground text-xs">Category*</Label>
            <Input id="category" {...register('category')} placeholder="e.g., Rent, Sales, Utilities" className="bg-input border-border focus:ring-primary text-sm" />
            {(combinedFieldErrors.category) && (<p className="text-xs text-destructive mt-1">{combinedFieldErrors.category?.message}</p>)}
          </div>
        </div>

        <div>
          <Label htmlFor="description" className="text-foreground text-xs">Description</Label>
          <Textarea id="description" {...register('description')} placeholder="Add a note..." className="bg-input border-border focus:ring-primary text-sm min-h-[80px]" />
          {(combinedFieldErrors.description) && (<p className="text-xs text-destructive mt-1">{combinedFieldErrors.description?.message}</p>)}
        </div>
      </fieldset>
      
      {submissionDetails && (
        <div className="mt-4 p-3 rounded-md bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/30 flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3">
          <div className="flex items-center space-x-2 flex-grow">
            <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-500" />
            <span className="text-sm">{submissionDetails.type} "{submissionDetails.category}" saved!</span>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleClearAndPrepareForNew}
            className="ml-auto border-green-600 text-green-700 hover:bg-green-600 hover:text-white dark:border-green-500 dark:text-green-400 dark:hover:bg-green-500 dark:hover:text-card-foreground text-xs px-3 py-1 h-auto self-start sm:self-center"
            disabled={isLoading || isFormDisabled}
          >
            <FilePlus2 className="mr-1.5 h-3.5 w-3.5" /> Add Another
          </Button>
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-3 border-t border-border mt-4">
        <Button type="submit" disabled={isLoading || !formIsValid || (!isDirty && isEditing) || isFormDisabled} className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[140px]">
          {isLoading ? 'Saving...' : submitButtonText}
        </Button>
      </div>
    </form>
  );
}
