
'use client';

import { useSelector } from 'react-redux';
import { selectCurrentUser } from '@/store/slices/authSlice';
import { useToast } from '@/hooks/use-toast';
import { useCallback } from 'react';

type Action = 'manage' | 'create' | 'read' | 'update' | 'delete' | 'access';
type Subject = 'all' | 'Product' | 'Sale' | 'PurchaseBill' | 'Party' | 'User' | 'Role' | 'Settings' | 'Dashboard' | 'CashRegister';

export const usePermissions = () => {
  const currentUser = useSelector(selectCurrentUser);
  const { toast } = useToast();

  const can = useCallback((action: Action, subject: Subject): boolean => {
    // This is the array of RolePermission objects, which contain the actual permission
    const rolePermissions = currentUser?.role?.permissions;

    if (!rolePermissions) {
      return false;
    }

    // Super admin ('manage', 'all') can do anything.
    // CORRECTED: Check inside the nested `permission` object.
    if (rolePermissions.some(rp => rp.permission?.action === 'manage' && rp.permission?.subject === 'all')) {
      return true;
    }

    // Check for specific permission.
    // CORRECTED: Check inside the nested `permission` object.
    return rolePermissions.some(rp => rp.permission?.action === action && rp.permission?.subject === subject);
    
  }, [currentUser]);

  const check = useCallback((action: Action, subject: Subject): { permitted: boolean; toast: () => void } => {
    const permitted = can(action, subject);
    
    const showToast = () => {
        if (!permitted) {
            toast({
                title: "Permission Denied",
                description: `You do not have permission to perform this action.`,
                variant: "destructive",
            });
        }
    };

    return { permitted, toast: showToast };
  }, [can, toast]);

  return { can, check };
};
