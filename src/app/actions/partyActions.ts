
'use server';

import prisma from '@/lib/prisma';
import { PartyCreateInputSchema, PartyUpdateInputSchema } from '@/lib/zodSchemas';
import type { Party as PartyType, PartyCreateInput, PartyUpdateInput, PartyTypeEnum } from '@/types';
import { Prisma } from '@prisma/client';

async function getCurrentUserAndCompanyId(userId: string): Promise<{ companyId: string | null }> {
    if (userId === 'root-user') {
      return { companyId: null };
    }
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { companyId: true, role: { select: { name: true } } }
    });

    if (!user) {
        throw new Error("User not found.");
    }
    
    // Allow Super Admin to not have a company
    if (user.role?.name === 'Admin') {
        return { companyId: user.companyId };
    }

    if (!user.companyId) {
        // For regular users, a company is required to manage parties.
        // Instead of throwing, we return null, and the action can decide how to handle it.
        return { companyId: null };
    }
    return { companyId: user.companyId };
}


// Helper to map Prisma Party to our PartyType
function mapPrismaPartyToType(
  prismaParty: Prisma.PartyGetPayload<{}>,
): PartyType {
  return {
    id: prismaParty.id,
    name: prismaParty.name,
    phone: prismaParty.phone,
    email: prismaParty.email,
    address: prismaParty.address,
    type: prismaParty.type as PartyTypeEnum, // Cast because Prisma enum might be different
    isActive: prismaParty.isActive,
    createdAt: prismaParty.createdAt?.toISOString(),
    updatedAt: prismaParty.updatedAt?.toISOString(),
    companyId: prismaParty.companyId,
  };
}

export async function createPartyAction(
  partyData: unknown,
  userId: string
): Promise<{ success: boolean; data?: PartyType; error?: string, fieldErrors?: Record<string, string[]> }> {
  if (!userId) {
    return { success: false, error: "User is not authenticated. Cannot create party." };
  }
  
  const validationResult = PartyCreateInputSchema.safeParse(partyData);
  if (!validationResult.success) {
    const fieldErrors = validationResult.error.flatten().fieldErrors;
    return { success: false, error: "Validation failed. Check field errors.", fieldErrors };
  }
  const validatedData = validationResult.data;

  try {
    const { companyId } = await getCurrentUserAndCompanyId(userId);
     if (!companyId) {
      return { success: false, error: "User is not associated with a company. Cannot manage parties." };
    }

    const newParty = await prisma.party.create({
      data: {
        ...validatedData,
        companyId: companyId, // Associate with user's company
        phone: validatedData.phone || undefined,
        email: validatedData.email || undefined,
        address: validatedData.address || undefined,
        createdByUserId: userId,
        updatedByUserId: userId,
      },
    });
    return { success: true, data: mapPrismaPartyToType(newParty) };
  } catch (error: any) {
    console.error('Error creating party:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002' && error.meta?.target) {
         const target = error.meta.target as string[];
        if (target.includes('email') && validatedData.email) {
          return { success: false, error: 'A party with this email already exists in this company.' };
        }
         if (target.includes('name') && validatedData.name) { 
          return { success: false, error: 'A party with this name already exists in this company.' };
        }
        return { success: false, error: `A unique constraint violation occurred on: ${target.join(', ')}` };
      }
    }
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create party.' };
  }
}

export async function getAllPartiesAction(userId: string): Promise<{
  success: boolean;
  data?: PartyType[];
  error?: string;
}> {
  if (!userId) {
    return { success: false, error: "User is not authenticated. Cannot fetch parties." };
  }
  try {
    const { companyId } = await getCurrentUserAndCompanyId(userId);
    // If no companyId (e.g., root user), return empty array gracefully.
    if (!companyId) {
      return { success: true, data: [] };
    }
    const partiesFromDB = await prisma.party.findMany({
      where: { companyId: companyId }, // Filter by company
      orderBy: { name: 'asc' },
    });
    const mappedParties: PartyType[] = partiesFromDB.map(mapPrismaPartyToType);
    return { success: true, data: mappedParties };
  } catch (error: any) {
    console.error('Error fetching parties:', error);
    return { success: false, error: error.message || 'Failed to fetch parties.' };
  }
}

export async function getAllCustomersAction(userId: string): Promise<{
  success: boolean;
  data?: PartyType[];
  error?: string;
}> {
   if (!userId) {
    return { success: false, error: "User is not authenticated. Cannot fetch customers." };
  }
  try {
    const { companyId } = await getCurrentUserAndCompanyId(userId);
    // If no companyId (e.g., root user), return empty array gracefully.
    if (!companyId) {
      return { success: true, data: [] };
    }
    const customersFromDB = await prisma.party.findMany({
      where: { companyId: companyId, type: 'CUSTOMER', isActive: true }, // Filter by company
      orderBy: { name: 'asc' },
    });
    const mappedCustomers: PartyType[] = customersFromDB.map(mapPrismaPartyToType);
    return { success: true, data: mappedCustomers };
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return { success: false, error: error.message || 'Failed to fetch customers.' };
  }
}


export async function getPartyByIdAction(
  id: string,
  userId: string
): Promise<{ success: boolean; data?: PartyType; error?: string }> {
  if (!userId) {
    return { success: false, error: "User not authenticated. Cannot fetch party." };
  }
  if (!id) return { success: false, error: "Party ID is required." };
  try {
    const { companyId } = await getCurrentUserAndCompanyId(userId);
    const party = await prisma.party.findFirst({
      where: { id: id, companyId: companyId }, // Ensure party belongs to user's company
    });
    if (!party) {
      return { success: false, error: 'Party not found in your company.' };
    }
    return { success: true, data: mapPrismaPartyToType(party) };
  } catch (error: any) {
    console.error(`Error fetching party by ID ${id}:`, error);
    return { success: false, error: error.message || 'Failed to fetch party.' };
  }
}

export async function updatePartyAction(
  id: string,
  partyData: unknown,
  userId: string
): Promise<{ success: boolean; data?: PartyType; error?: string, fieldErrors?: Record<string, string[]> }> {
  if (!userId) {
    return { success: false, error: "User not authenticated. Cannot update party." };
  }
  if (!id) return { success: false, error: "Party ID is required for update." };
  
  const validationResult = PartyUpdateInputSchema.safeParse(partyData);
  if (!validationResult.success) {
     const fieldErrors = validationResult.error.flatten().fieldErrors;
    return { success: false, error: "Validation failed. Check field errors.", fieldErrors };
  }
  const validatedData = validationResult.data;

  if (Object.keys(validatedData).length === 0) {
    return { success: false, error: "No data provided for update." };
  }
  
  const dataToUpdate: Prisma.PartyUpdateInput = { 
    ...validatedData,
    updatedByUserId: userId,
  };
  if (validatedData.hasOwnProperty('phone')) dataToUpdate.phone = validatedData.phone === null ? null : validatedData.phone;
  if (validatedData.hasOwnProperty('email')) dataToUpdate.email = validatedData.email === null ? null : validatedData.email;
  if (validatedData.hasOwnProperty('address')) dataToUpdate.address = validatedData.address === null ? null : validatedData.address;

  try {
    const { companyId } = await getCurrentUserAndCompanyId(userId);
    const partyToUpdate = await prisma.party.findFirst({
        where: { id: id, companyId: companyId }
    });
    if (!partyToUpdate) {
        return { success: false, error: 'Party not found or you do not have permission to edit it.' };
    }

    const updatedParty = await prisma.party.update({
      where: { id },
      data: dataToUpdate,
    });
    return { success: true, data: mapPrismaPartyToType(updatedParty) };
  } catch (error: any) {
    console.error(`Error updating party for ID ${id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002' && error.meta?.target) {
         const target = error.meta.target as string[];
        if (target.includes('email') && validatedData.email) {
          return { success: false, error: 'A party with this email already exists in this company.' };
        }
         if (target.includes('name') && validatedData.name) {
          return { success: false, error: 'A party with this name already exists in this company.' };
        }
        return { success: false, error: `A unique constraint violation occurred on: ${target.join(', ')}` };
      }
      if (error.code === 'P2025') return { success: false, error: 'Party to update not found.' };
    }
    return { success: false, error: error.message || 'Failed to update party.' };
  }
}

export async function deletePartyAction(
  id: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!userId) {
    return { success: false, error: "User not authenticated. Cannot delete party." };
  }
  if (!id) return { success: false, error: "Party ID is required for deletion." };
  try {
    const { companyId } = await getCurrentUserAndCompanyId(userId);
    const partyToDelete = await prisma.party.findFirst({
        where: { id: id, companyId: companyId }
    });
    if (!partyToDelete) {
        return { success: false, error: 'Party not found or you do not have permission to delete it.' };
    }

    await prisma.party.delete({
      where: { id },
    });
    return { success: true };
  } catch (error: any) {
    console.error(`Error deleting party for ID ${id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return { success: false, error: 'Party to delete not found.' };
    }
    return { success: false, error: error.message || 'Failed to delete party.' };
  }
}
      
