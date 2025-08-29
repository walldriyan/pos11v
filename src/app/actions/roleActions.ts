
'use server';

import prisma from '@/lib/prisma';
import type { RoleCreateInput, RoleUpdateInput, Role as RoleType, Permission as PermissionType } from '@/types';
import { RoleFormSchema } from '@/lib/zodSchemas';
import { Prisma } from '@prisma/client';

// Helper to map Prisma Role to our RoleType
function mapPrismaRoleToType(prismaRole: any): RoleType {
  return {
    id: prismaRole.id,
    name: prismaRole.name,
    description: prismaRole.description,
    permissions: prismaRole.permissions?.map((rp: any) => ({ // rp is RolePermission
      id: rp.permission.id,
      action: rp.permission.action,
      subject: rp.permission.subject,
      description: rp.permission.description,
    })) || [],
    createdAt: prismaRole.createdAt?.toISOString(),
    updatedAt: prismaRole.updatedAt?.toISOString(),
  };
}

export async function createRoleAction(
  roleData: unknown,
  userId: string | null
): Promise<{ success: boolean; data?: RoleType; error?: string; fieldErrors?: Record<string, string[]> }> {
  if (!userId) {
    return { success: false, error: 'User is not authenticated.' };
  }
  
  const validationResult = RoleFormSchema.safeParse(roleData);
  if (!validationResult.success) {
    return { success: false, error: "Validation failed.", fieldErrors: validationResult.error.flatten().fieldErrors };
  }
  const { name, description, permissionIds = [] } = validationResult.data;

  try {
    const newRole = await prisma.role.create({
      data: {
        name,
        description,
        permissions: {
          create: permissionIds.map(pid => ({
            permissionId: pid,
          })),
        },
        // For root user, createdBy can be null or a special value if needed.
        // Prisma will handle createdByUserId if it's optional in the schema.
        // Assuming it's optional or handled.
      },
      include: { permissions: { include: { permission: true } } },
    });
    return { success: true, data: mapPrismaRoleToType(newRole) };
  } catch (error: any) {
    console.error('Error creating role:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { success: false, error: 'A role with this name already exists.' };
    }
    return { success: false, error: 'Failed to create role.' };
  }
}

export async function getAllRolesWithPermissionsAction(): Promise<{
  success: boolean;
  data?: RoleType[];
  error?: string;
}> {
  try {
    const roles = await prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
    return { success: true, data: roles.map(mapPrismaRoleToType) };
  } catch (error: any) {
    console.error('Error fetching roles:', error);
    return { success: false, error: 'Failed to fetch roles.' };
  }
}

export async function updateRoleAction(
  id: string,
  roleData: unknown,
  userId: string | null
): Promise<{ success: boolean; data?: RoleType; error?: string; fieldErrors?: Record<string, string[]> }> {
  if (!id) return { success: false, error: "Role ID is required for update." };

  const validationResult = RoleFormSchema.safeParse(roleData);
  if (!validationResult.success) {
    return { success: false, error: "Validation failed.", fieldErrors: validationResult.error.flatten().fieldErrors };
  }
  const { name, description, permissionIds = [] } = validationResult.data;

  try {
    const updatedRole = await prisma.$transaction(async (tx) => {
      // First, update the role's basic details
      const role = await tx.role.update({
        where: { id },
        data: {
          name,
          description,
          // updatedByUserId: userId, // Handle if needed
        },
      });

      // Then, manage permissions:
      // 1. Get current permissions for the role
      const currentRolePermissions = await tx.rolePermission.findMany({
        where: { roleId: id },
        select: { permissionId: true },
      });
      const currentPermissionIds = currentRolePermissions.map(rp => rp.permissionId);

      // 2. Permissions to add: new ones not in current
      const permissionsToAdd = permissionIds.filter(pid => !currentPermissionIds.includes(pid));
      // 3. Permissions to remove: current ones not in new list
      const permissionsToRemove = currentPermissionIds.filter(pid => !permissionIds.includes(pid));

      if (permissionsToRemove.length > 0) {
        await tx.rolePermission.deleteMany({
          where: {
            roleId: id,
            permissionId: { in: permissionsToRemove },
          },
        });
      }

      if (permissionsToAdd.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionsToAdd.map(pid => ({
            roleId: id,
            permissionId: pid,
          })),
        });
      }
      
      // Return the role with updated permissions
      return tx.role.findUniqueOrThrow({
          where: {id},
          include: { permissions: { include: { permission: true } } }
      });
    });

    return { success: true, data: mapPrismaRoleToType(updatedRole) };
  } catch (error: any) {
    console.error(`Error updating role for ID ${id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return { success: false, error: 'A role with this name already exists.' };
      if (error.code === 'P2025') return { success: false, error: 'Role to update not found.' };
    }
    return { success: false, error: 'Failed to update role.' };
  }
}

export async function deleteRoleAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: "Role ID is required for deletion." };
  try {
    // Prisma cascading delete on RolePermission should handle join table entries
    await prisma.role.delete({
      where: { id },
    });
    return { success: true };
  } catch (error: any) {
    console.error(`Error deleting role ID ${id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return { success: false, error: 'Role to delete not found.' };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      // P2003 is a foreign key constraint failure, which means this role is likely still assigned to users.
      return { success: false, error: 'Cannot delete role. It is still assigned to users.' };
    }
    return { success: false, error: 'Failed to delete role.' };
  }
}
