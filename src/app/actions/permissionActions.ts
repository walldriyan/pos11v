
'use server';

import prisma from '@/lib/prisma';
import type { Permission as PermissionType } from '@/types';
import type { Prisma } from '@prisma/client';

// Define a standard set of permissions you might want in your application
const ALL_PERMISSIONS = [
  // --- SUPER ADMIN ---
  { action: 'manage', subject: 'all', description: 'Super Admin: Unrestricted access to all features.' },

  // --- DASHBOARD ---
  { action: 'access', subject: 'Dashboard', description: 'Access: Reports Page' },

  // --- POS & CASH REGISTER ---
  { action: 'access', subject: 'CashRegister', description: 'Access: Cash Register & Shift Management Page' },
  
  // --- SALES & CREDIT ---
  { action: 'read', subject: 'Sale', description: 'Access: Credit Management & Returns Pages' },
  { action: 'create', subject: 'Sale', description: 'Action: Can create new sales (from POS)' },
  { action: 'update', subject: 'Sale', description: 'Action: Can modify sales (returns, credit payments)' },

  // --- INVENTORY & PRODUCTS ---
  { action: 'read', subject: 'Product', description: 'Access: Product Management & Stock Levels Pages' },
  { action: 'create', subject: 'Product', description: 'Action: Can create new products' },
  { action: 'update', subject: 'Product', description: 'Action: Can edit products & perform stock adjustments' },
  { action: 'delete', subject: 'Product', description: 'Action: Can delete products' },
  
  // --- PURCHASES ---
  { action: 'read', subject: 'PurchaseBill', description: 'Access: Purchases (GRN) & Payments Pages' },
  { action: 'create', subject: 'PurchaseBill', description: 'Action: Can create new purchase bills' },
  { action: 'update', subject: 'PurchaseBill', description: 'Action: Can record payments for purchases' },

  // --- CONTACTS ---
  { action: 'read', subject: 'Party', description: 'Access: Contacts (Customers/Suppliers) Page' },
  { action: 'create', subject: 'Party', description: 'Action: Can create new contacts' },
  { action: 'update', subject: 'Party', description: 'Action: Can edit existing contacts' },
  { action: 'delete', subject: 'Party', description: 'Action: Can delete contacts' },
  
  // --- USER & ROLE MANAGEMENT ---
  { action: 'read', subject: 'User', description: 'Access: Users & Roles Page' },
  { action: 'create', subject: 'User', description: 'Action: Can create new users' },
  { action: 'update', subject: 'User', description: 'Action: Can edit existing users' },
  { action: 'delete', subject: 'User', description: 'Action: Can delete users' },

  { action: 'read', subject: 'Role', description: 'Can view roles and permissions' },
  { action: 'create', subject: 'Role', description: 'Action: Can create new roles' },
  { action: 'update', subject: 'Role', description: 'Action: Can edit existing roles' },
  { action: 'delete', subject: 'Role', description: 'Action: Can delete roles' },

  // --- SETTINGS ---
  { action: 'manage', subject: 'Settings', description: 'Access & Modify: All Settings (Company, Discounts, Financials)' },
];


// Helper to map Prisma Permission to our PermissionType
function mapPrismaPermissionToType(prismaPermission: Prisma.PermissionGetPayload<{}>): PermissionType {
  return {
    id: prismaPermission.id,
    action: prismaPermission.action,
    subject: prismaPermission.subject,
    description: prismaPermission.description || null,
    createdAt: prismaPermission.createdAt?.toISOString(),
    updatedAt: prismaPermission.updatedAt?.toISOString(),
  };
}

export async function seedPermissionsAction(): Promise<{
  success: boolean;
  createdCount: number;
  existingCount: number;
  error?: string;
}> {
  if (!prisma || !prisma.permission) {
    console.error("Prisma client or Permission model not initialized in seedPermissionsAction. Please run 'npx prisma generate'.");
    return { 
      success: false, 
      createdCount: 0, 
      existingCount: 0, 
      error: "Database service for permissions is not available. Prisma Client might need to be regenerated." 
    };
  }

  let createdCount = 0;
  let existingCount = 0;
  try {
    for (const perm of ALL_PERMISSIONS) {
      const existing = await prisma.permission.findFirst({
        where: { action: perm.action, subject: perm.subject }, // Check only action & subject for existence
      });
      if (!existing) {
        await prisma.permission.create({
          data: {
            action: perm.action,
            subject: perm.subject,
            description: perm.description,
          },
        });
        createdCount++;
      } else {
        // If it exists, check if the description is different and update if needed
        if (existing.description !== perm.description) {
            await prisma.permission.update({
                where: { id: existing.id },
                data: { description: perm.description },
            });
        }
        existingCount++;
      }
    }
    return { success: true, createdCount, existingCount };
  } catch (error: any) {
    console.error('Error seeding permissions:', error);
    return { success: false, createdCount, existingCount, error: 'Failed to seed permissions.' };
  }
}

export async function getAllPermissionsAction(): Promise<{
  success: boolean;
  data?: PermissionType[];
  error?: string;
}> {
  if (!prisma || !prisma.permission) {
    console.error("Prisma client or Permission model not initialized in getAllPermissionsAction. Please run 'npx prisma generate'.");
    return { 
      success: false, 
      error: "Database service for permissions is not available. Prisma Client might need to be regenerated." 
    };
  }
  try {
    // Always attempt to seed to ensure DB is in sync with the code's master list.
    // The seed action is idempotent and will only add missing permissions.
    const seedResult = await seedPermissionsAction();
    if (!seedResult.success) {
      // Log the seeding error but don't necessarily fail the whole request,
      // as some permissions might still exist.
      console.error("Failed to seed permissions during fetch:", seedResult.error);
    }
    
    // Fetch all permissions from the database after ensuring it's up-to-date.
    const permissions = await prisma.permission.findMany({
      orderBy: [{ subject: 'asc' }, { action: 'asc' }],
    });

    if (permissions.length === 0) {
      console.warn("Permissions table is empty even after seeding attempt. Check ALL_PERMISSIONS array and seed logic.");
    }
    
    return { success: true, data: permissions.map(mapPrismaPermissionToType) };
  } catch (error: any) {
    console.error('Error fetching permissions in getAllPermissionsAction:', error);
    return { success: false, error: 'Failed to fetch permissions due to a database error.' };
  }
}
