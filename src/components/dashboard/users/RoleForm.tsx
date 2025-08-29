
'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RoleFormSchema } from '@/lib/zodSchemas';
import type { RoleFormData, Permission as PermissionType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MultiSelectFormField } from './MultiSelectFormField';
import { CheckCircle, FilePlus2 } from 'lucide-react';

interface RoleFormProps {
  role?: RoleFormData & { id?: string; permissionIds?: string[] };
  allPermissions: PermissionType[];
  onSubmit: (data: RoleFormData, id?: string) => Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string[]> }>;
  onCancel?: () => void;
  isLoading?: boolean;
  onSwitchToAddNew?: () => void;
  submissionDetails?: { id: string; name: string } | null;
}

const defaultFormValues: RoleFormData = {
  name: '',
  description: '',
  permissionIds: [],
};

export function RoleForm({
  role,
  allPermissions,
  onSubmit,
  onCancel,
  isLoading,
  onSwitchToAddNew,
  submissionDetails,
}: RoleFormProps) {
  const isEditing = !!role?.id;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors: localErrors, isDirty, isValid: formIsValid },
    setError: setLocalError,
  } = useForm<RoleFormData>({
    resolver: zodResolver(RoleFormSchema),
    defaultValues: role ? { ...defaultFormValues, ...role, description: role.description || '' } : defaultFormValues,
    mode: 'onChange',
  });

  const [serverFormError, setServerFormError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string[]> | undefined>(undefined);

  useEffect(() => {
    if (role) {
      reset({
        name: role.name || '',
        description: role.description || '',
        permissionIds: role.permissionIds || [],
      });
    } else {
      reset(defaultFormValues);
    }
    setServerFormError(null);
    setServerFieldErrors(undefined);
  }, [role, reset]);

  const handleFormSubmit = async (data: RoleFormData) => {
    setServerFormError(null);
    setServerFieldErrors(undefined);
    const result = await onSubmit(data, role?.id);
    if (!result.success) {
      setServerFormError(result.error || 'An unexpected error occurred.');
      setServerFieldErrors(result.fieldErrors);
       if (result.fieldErrors) {
        Object.entries(result.fieldErrors).forEach(([field, messages]) => {
          setLocalError(field as keyof RoleFormData, { type: 'server', message: messages[0] });
        });
      }
    }
  };
  
  const handleClearAndPrepareForNew = () => {
    if (onSwitchToAddNew) {
      onSwitchToAddNew(); 
    }
    reset(defaultFormValues);
    setServerFormError(null);
    setServerFieldErrors(undefined);
  };

  const permissionOptions = allPermissions.map(p => ({
    value: p.id,
    label: p.description || `${p.subject}: ${p.action}`, // Use description as label
    group: p.subject, // Group by subject
  })).sort((a,b) => {
      // Define a custom sort order for groups
      const groupOrder: { [key: string]: number } = { 
        'all': 1, 
        'Dashboard': 2,
        'Settings': 3,
        'Product': 4, 
        'Sale': 5, 
        'PurchaseBill': 6, 
        'Party': 7, 
        'User': 8, 
        'Role': 9 
      };
      const groupAOrder = groupOrder[a.group] || 99;
      const groupBOrder = groupOrder[b.group] || 99;
      if (groupAOrder !== groupBOrder) return groupAOrder - groupBOrder;

      const aIsAccess = a.label.startsWith('Access:');
      const bIsAccess = b.label.startsWith('Access:');
      if (aIsAccess && !bIsAccess) return -1;
      if (!aIsAccess && bIsAccess) return 1;

      const aIsAction = a.label.startsWith('Action:');
      const bIsAction = b.label.startsWith('Action:');
      if (aIsAccess && bIsAction) return -1;
      if(aIsAction && !bIsAction) return 1;
      if(!aIsAction && bIsAction) return -1;

      return a.label.localeCompare(b.label);
  });

  const combinedFieldErrors = { ...localErrors, ...serverFieldErrors };


  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 pb-4">
      {serverFormError && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{serverFormError}</p>}

      <div>
        <Label htmlFor="name" className="text-foreground text-xs">Role Name*</Label>
        <Input id="name" {...register('name')} className="bg-input border-border focus:ring-primary text-sm" />
         {(combinedFieldErrors.name || serverFieldErrors?.name) && (
            <p className="text-xs text-destructive mt-1">{combinedFieldErrors.name?.message || serverFieldErrors?.name?.[0]}</p>
          )}
      </div>

      <div>
        <Label htmlFor="description" className="text-foreground text-xs">Description</Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Brief description of the role..."
          className="bg-input border-border focus:ring-primary text-sm min-h-[80px]"
        />
        {(combinedFieldErrors.description || serverFieldErrors?.description) && (
            <p className="text-xs text-destructive mt-1">{combinedFieldErrors.description?.message || serverFieldErrors?.description?.[0]}</p>
          )}
      </div>

      <div>
        <Label className="text-foreground text-xs">Permissions</Label>
        <MultiSelectFormField
          control={control}
          name="permissionIds"
          options={permissionOptions}
          placeholder="Select permissions..."
        />
        {(combinedFieldErrors.permissionIds || serverFieldErrors?.permissionIds) && (
          <p className="text-xs text-destructive mt-1">
            { (combinedFieldErrors.permissionIds as any)?.message || serverFieldErrors?.permissionIds?.[0]}
          </p>
        )}
      </div>
      
      {submissionDetails && (
        <div className="mt-4 p-3 rounded-md bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/30 flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3">
          <div className="flex items-center space-x-2 flex-grow">
            <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-500" />
            <span className="text-sm">Role "{submissionDetails.name}" saved successfully!</span>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleClearAndPrepareForNew}
            className="ml-auto border-green-600 text-green-700 hover:bg-green-600 hover:text-white dark:border-green-500 dark:text-green-400 dark:hover:bg-green-500 dark:hover:text-card-foreground text-xs px-3 py-1 h-auto self-start sm:self-center"
            disabled={isLoading}
          >
            <FilePlus2 className="mr-1.5 h-3.5 w-3.5" /> Add Another Role
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
          {isLoading ? 'Saving...' : (isEditing ? 'Update Role' : 'Create Role')}
        </Button>
      </div>
    </form>
  );
}
