
'use client';

import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserCreateSchema, UserUpdateSchema } from '@/lib/zodSchemas';
import type { UserFormData, Role, CompanyProfileFormData } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, FilePlus2, Eye, EyeOff } from 'lucide-react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '@/store/slices/authSlice';


interface UserFormProps {
  user?: Omit<UserFormData, 'password' | 'confirmPassword'> & { id?: string, password?: string, confirmPassword?: string, companyId?: string | null };
  roles: Pick<Role, 'id' | 'name'>[];
  companies: Pick<CompanyProfileFormData, 'id' | 'name'>[];
  onSubmit: (data: UserFormData, id?: string) => Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string[]> }>;
  onCancel?: () => void;
  isLoading?: boolean;
  onSwitchToAddNew?: () => void;
  submissionDetails?: { id: string; username: string } | null;
}

const defaultFormValues: UserFormData = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  roleId: '',
  companyId: null,
  isActive: true,
};

export function UserForm({
  user,
  roles,
  companies,
  onSubmit,
  onCancel,
  isLoading,
  onSwitchToAddNew,
  submissionDetails,
}: UserFormProps) {
  const { toast } = useToast();
  const actor = useSelector(selectCurrentUser);
  const isEditing = !!user?.id;
  
  const formSchema = isEditing ? UserUpdateSchema : UserCreateSchema;

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors: localErrors, isDirty, isValid: formIsValid },
    setError: setLocalError,
  } = useForm<UserFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: user ? { ...defaultFormValues, ...user } : defaultFormValues,
    mode: 'onChange',
  });

  const [serverFormError, setServerFormError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string[]> | undefined>(undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const selectedRoleId = watch('roleId');
  const selectedRoleName = selectedRoleId ? roles.find(r => r.id === selectedRoleId)?.name : '';
  const isSelectedRoleAdmin = selectedRoleName === 'Admin';
  
  const isCompanyRequired = actor?.id !== 'root-user' && !isSelectedRoleAdmin;


  useEffect(() => {
    if (user) {
      reset({
        username: user.username || '',
        email: user.email || '',
        roleId: user.roleId || '',
        companyId: user.companyId || null,
        isActive: user.isActive !== undefined ? user.isActive : true,
        password: '', 
        confirmPassword: '',
      });
    } else {
      reset(defaultFormValues);
    }
    setServerFormError(null);
    setServerFieldErrors(undefined);
  }, [user, reset]);

  const handleFormSubmit = async (data: UserFormData) => {
    setServerFormError(null);
    setServerFieldErrors(undefined);
    
    if (isCompanyRequired && !data.companyId) {
        setLocalError("companyId", { type: 'manual', message: "Company is required for this role."});
        return;
    }
    
    const result = await onSubmit(data, user?.id);

    if (!result.success) {
      setServerFormError(result.error || 'An unexpected error occurred.');
      setServerFieldErrors(result.fieldErrors);
      if (result.fieldErrors) {
        Object.entries(result.fieldErrors).forEach(([field, messages]) => {
          setLocalError(field as keyof UserFormData, { type: 'server', message: messages[0] });
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
  
  const combinedFieldErrors = { ...localErrors, ...serverFieldErrors };
  

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 pb-4">
      {serverFormError && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{serverFormError}</p>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="username" className="text-foreground text-xs">Username*</Label>
          <Input id="username" {...register('username')} className="bg-input border-border focus:ring-primary text-sm" />
          {(combinedFieldErrors.username || serverFieldErrors?.username) && (
            <p className="text-xs text-destructive mt-1">{combinedFieldErrors.username?.message || serverFieldErrors?.username?.[0]}</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Label htmlFor="password" className="text-foreground text-xs">{isEditing ? 'New Password (Optional)' : 'Password*'}</Label>
          <Input id="password" type={showPassword ? "text" : "password"} {...register('password')} className="bg-input border-border focus:ring-primary text-sm pr-10" />
          <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-6 h-7 w-7 text-muted-foreground" onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          {(combinedFieldErrors.password || serverFieldErrors?.password) && (
            <p className="text-xs text-destructive mt-1">{combinedFieldErrors.password?.message || serverFieldErrors?.password?.[0]}</p>
          )}
        </div>
        <div className="relative">
          <Label htmlFor="confirmPassword" className="text-foreground text-xs">{isEditing ? 'Confirm New Password' : 'Confirm Password*'}</Label>
          <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} {...register('confirmPassword')} className="bg-input border-border focus:ring-primary text-sm pr-10" />
           <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-6 h-7 w-7 text-muted-foreground" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          {(combinedFieldErrors.confirmPassword || serverFieldErrors?.confirmPassword) && (
            <p className="text-xs text-destructive mt-1">{combinedFieldErrors.confirmPassword?.message || serverFieldErrors?.confirmPassword?.[0]}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div>
          <Label htmlFor="roleId" className="text-foreground text-xs">Role*</Label>
          <Controller
            name="roleId"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value} disabled={roles.length === 0}>
                <SelectTrigger id="roleId" className="bg-input border-border focus:ring-primary text-sm">
                  <SelectValue placeholder={roles.length === 0 ? "No roles available" : "Select a role"} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (
                    <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {(combinedFieldErrors.roleId || serverFieldErrors?.roleId) && (
            <p className="text-xs text-destructive mt-1">{combinedFieldErrors.roleId?.message || serverFieldErrors?.roleId?.[0]}</p>
          )}
        </div>
        <div className="flex items-center space-x-2 mt-3 md:mt-0 md:self-end">
          <Controller
            name="isActive"
            control={control}
            render={({ field }) => (
              <Switch
                id="isActive"
                checked={field.value}
                onCheckedChange={field.onChange}
                aria-label="User Active Status"
              />
            )}
          />
          <Label htmlFor="isActive" className="text-foreground text-xs">Active</Label>
        </div>
      </div>
      
       <div>
          <Label htmlFor="companyId" className="text-foreground text-xs">Company{isCompanyRequired && '*'}</Label>
           <Controller
            name="companyId"
            control={control}
            render={({ field }) => (
              <Select 
                onValueChange={(value) => field.onChange(value === 'none' ? null : value)} 
                value={field.value || 'none'}
                disabled={companies.length === 0}
              >
                <SelectTrigger id="companyId" className="bg-input border-border focus:ring-primary text-sm">
                  <SelectValue placeholder={companies.length === 0 ? "No companies available" : "Select a company"} />
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="none">No Company Assigned</SelectItem>
                  {companies.map(company => (
                    <SelectItem key={company.id} value={company.id!}>{company.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
           {(combinedFieldErrors.companyId || serverFieldErrors?.companyId) && (
            <p className="text-xs text-destructive mt-1">{combinedFieldErrors.companyId?.message || serverFieldErrors?.companyId?.[0]}</p>
          )}
          {actor?.id === 'root-user' && <p className="text-xs text-muted-foreground mt-1">As root user, you can create users without a company, even for non-Admin roles.</p>}
          {actor?.id !== 'root-user' && isSelectedRoleAdmin && <p className="text-xs text-muted-foreground mt-1">You can assign this Admin to a specific company, or leave it blank to make them a super admin.</p>}
        </div>

      {submissionDetails && (
        <div className="mt-4 p-3 rounded-md bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/30 flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3">
          <div className="flex items-center space-x-2 flex-grow">
            <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-500" />
            <span className="text-sm">User "{submissionDetails.username}" saved successfully!</span>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleClearAndPrepareForNew}
            className="ml-auto border-green-600 text-green-700 hover:bg-green-600 hover:text-white dark:border-green-500 dark:text-green-400 dark:hover:bg-green-500 dark:hover:text-card-foreground text-xs px-3 py-1 h-auto self-start sm:self-center"
            disabled={isLoading}
          >
            <FilePlus2 className="mr-1.5 h-3.5 w-3.5" /> Add Another User
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
          {isLoading ? 'Saving...' : (isEditing ? 'Update User' : 'Create User')}
        </Button>
      </div>
    </form>
  );
}
