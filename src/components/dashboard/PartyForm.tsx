
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PartyCreateInputSchema, PartyTypeEnumSchema } from '@/lib/zodSchemas';
import type { PartyFormData, PartyTypeEnum } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from '@/components/ui/switch';
import { CheckCircle, FilePlus2 } from 'lucide-react';
import React, { useEffect } from 'react';

interface PartyFormProps {
  party?: PartyFormData | null;
  onSubmit: (data: PartyFormData) => Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string[]> }>;
  onCancel?: () => void;
  isLoading?: boolean;
  formError?: string | null;
  fieldErrors?: Record<string, string[]>;
  onSwitchToAddNew?: () => void;
  submissionDetails?: { id: string; name: string; type: PartyTypeEnum } | null;
}

const defaultFormValues: PartyFormData = {
  name: '',
  phone: '',
  email: '',
  address: '',
  type: 'CUSTOMER',
  isActive: true,
};

export function PartyForm({
  party,
  onSubmit,
  onCancel,
  isLoading,
  formError,
  fieldErrors: serverFieldErrors,
  onSwitchToAddNew,
  submissionDetails,
}: PartyFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors: localErrors, isDirty, isValid: formIsValid },
  } = useForm<PartyFormData>({
    resolver: zodResolver(PartyCreateInputSchema),
    defaultValues: party || defaultFormValues,
    mode: 'onChange',
  });

  const isEditing = !!party?.name; // Use party prop to determine if editing
  const submitButtonText = isEditing ? 'Update Party' : 'Create Party';

  useEffect(() => {
    if (party) {
      reset({
        ...defaultFormValues,
        ...party,
        phone: party.phone || '',
        email: party.email || '',
        address: party.address || '',
        type: party.type || 'CUSTOMER',
        isActive: party.isActive !== undefined ? party.isActive : true,
      });
    } else {
      reset(defaultFormValues);
    }
  }, [party, reset]);

  const handleFormSubmit = async (data: PartyFormData) => {
    const dataToSubmit: PartyFormData = {
      ...data,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
    };
    await onSubmit(dataToSubmit);
    // Parent will handle clearing form or setting new party via onSwitchToAddNew / submissionDetails
  };

  const handleClearAndPrepareForNew = () => {
    if (onSwitchToAddNew) {
      onSwitchToAddNew(); // Parent clears submissionDetails and sets party to null
    }
    reset(defaultFormValues); // Reset form for new entry
  };

  const combinedFieldErrors = { ...localErrors, ...serverFieldErrors };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 pb-4">
      {formError && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{formError}</p>}

      <div>
        <Label htmlFor="name" className="text-foreground text-xs">Name*</Label>
        <Input id="name" {...register('name')} className="bg-input border-border focus:ring-primary text-sm" />
        {(combinedFieldErrors.name || serverFieldErrors?.name) && (
          <p className="text-xs text-destructive mt-1">{combinedFieldErrors.name?.message || serverFieldErrors?.name?.[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="phone" className="text-foreground text-xs">Phone Number</Label>
          <Input id="phone" {...register('phone')} className="bg-input border-border focus:ring-primary text-sm" />
          {(combinedFieldErrors.phone || serverFieldErrors?.phone) && (
            <p className="text-xs text-destructive mt-1">{combinedFieldErrors.phone?.message || serverFieldErrors?.phone?.[0]}</p>
          )}
        </div>
        <div>
          <Label htmlFor="email" className="text-foreground text-xs">Email Address</Label>
          <Input id="email" type="email" {...register('email')} className="bg-input border-border focus:ring-primary text-sm" />
          {(combinedFieldErrors.email || serverFieldErrors?.email) && (
            <p className="text-xs text-destructive mt-1">{combinedFieldErrors.email?.message || serverFieldErrors?.email?.[0]}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="address" className="text-foreground text-xs">Address</Label>
        <Textarea
          id="address"
          {...register('address')}
          placeholder="Enter address..."
          className="bg-input border-border focus:ring-primary text-sm min-h-[80px]"
        />
        {(combinedFieldErrors.address || serverFieldErrors?.address) && (
          <p className="text-xs text-destructive mt-1">{combinedFieldErrors.address?.message || serverFieldErrors?.address?.[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div>
          <Label className="text-foreground text-xs mb-1 block">Party Type*</Label>
          <Controller
            name="type"
            control={control}
            defaultValue="CUSTOMER"
            render={({ field }) => (
              <RadioGroup
                onValueChange={field.onChange}
                value={field.value}
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CUSTOMER" id="type-customer" />
                  <Label htmlFor="type-customer" className="text-xs">Customer</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="SUPPLIER" id="type-supplier" />
                  <Label htmlFor="type-supplier" className="text-xs">Supplier</Label>
                </div>
              </RadioGroup>
            )}
          />
           {(combinedFieldErrors.type || serverFieldErrors?.type) && (
            <p className="text-xs text-destructive mt-1">{combinedFieldErrors.type?.message || serverFieldErrors?.type?.[0]}</p>
          )}
        </div>
        
        <div className="flex items-center space-x-2 mt-3 md:mt-0 md:self-end">
          <Controller
            name="isActive"
            control={control}
            defaultValue={true}
            render={({ field }) => (
              <Switch
                id="isActive"
                checked={field.value}
                onCheckedChange={field.onChange}
                aria-label="Party Status"
              />
            )}
          />
          <Label htmlFor="isActive" className="text-foreground text-xs">Active</Label>
        </div>
      </div>

      {submissionDetails && (
        <div className="mt-4 p-3 rounded-md bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/30 flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3">
          <div className="flex items-center space-x-2 flex-grow">
            <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-500" />
            <span className="text-sm">{submissionDetails.type} "{submissionDetails.name}" saved successfully!</span>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleClearAndPrepareForNew}
            className="ml-auto border-green-600 text-green-700 hover:bg-green-600 hover:text-white dark:border-green-500 dark:text-green-400 dark:hover:bg-green-500 dark:hover:text-card-foreground text-xs px-3 py-1 h-auto self-start sm:self-center"
            disabled={isLoading}
          >
            <FilePlus2 className="mr-1.5 h-3.5 w-3.5" /> Add Another Party
          </Button>
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-3 border-t border-border mt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading} className="border-muted text-muted-foreground hover:bg-muted/80">
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading || !formIsValid || (!isDirty && isEditing)} className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[120px]">
          {isLoading ? 'Saving...' : submitButtonText}
        </Button>
      </div>
    </form>
  );
}
