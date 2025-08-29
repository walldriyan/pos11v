
'use server';

import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import type { User as UserType } from '@/types';
import { Prisma } from '@prisma/client';
import { seedPermissionsAction } from './permissionActions';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';
import 'dotenv/config';
import { z } from 'zod';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-default-secret-key-that-is-long-enough');

// Helper function to serialize the user object for Redux, converting Date objects to strings
const serializeUserForRedux = (userWithDates: any): Omit<UserType, 'passwordHash'> => {
  // Deep clone and serialize
  const serializableUser = JSON.parse(JSON.stringify(userWithDates, (key, value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...userWithoutPassword } = serializableUser;
  return userWithoutPassword;
};

async function createAndSetSession(user: any) {
    const session = await new SignJWT({ sub: user.id, role: user.role?.name })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1d') // Session expires in 1 day
      .sign(secret);
    
    (await cookies()).set('auth_token', session, {
      httpOnly: true,
      secure: true, // Must be true for SameSite='none'
      sameSite: 'none', // Required for iframe environments
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day in seconds
    });
}

async function createRootUserSession(username: string) {
    const allPermissions = await prisma.permission.findMany();
    const rootUser = {
        id: 'root-user',
        username: username,
        role: {
            name: process.env.ROOT_USER_ROLE_NAME || 'SuperAdmin',
            permissions: allPermissions.map(p => ({ permission: p }))
        },
        company: null,
        companyId: null,
        isActive: true, // Ensure root user is active
    };
    await createAndSetSession(rootUser);
    return rootUser;
}

export async function loginAction(
  credentials: Record<"username" | "password", string>
): Promise<{ success: boolean; user?: Omit<UserType, 'passwordHash'>; error?: string }> {
  const { username, password } = credentials;

  if (!username || !password) {
    return { success: false, error: 'Username and password are required.' };
  }
  
  try {
    // --- PRIORITY 1: DATABASE FIRST APPROACH ---
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        },
        company: true,
      },
    });

    // If a user is found in the database, authenticate against them.
    if (user) {
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return { success: false, error: 'Invalid username or password.' };
      }
      
      if (!user.isActive) {
          return { success: false, error: 'Your account has been disabled. Please contact an administrator.' };
      }

      // For non-super-admins, check for an open shift within their company
      if (user.companyId && user.role?.name !== 'Admin') {
          const openShiftInCompany = await prisma.cashRegisterShift.findFirst({
              where: { 
                  companyId: user.companyId,
                  status: 'OPEN' 
              },
              include: { user: { select: { id: true, username: true } } }
          });

          if (openShiftInCompany && user.id !== openShiftInCompany.userId) {
              return { 
                  success: false, 
                  error: `Login blocked. User '${openShiftInCompany.user.username}' has an open shift that must be closed first.` 
              };
          }
      }
      
      await createAndSetSession(user);
      return { success: true, user: serializeUserForRedux(user) };
    }

    // --- PRIORITY 2: .ENV ROOT USER (FALLBACK) ---
    // This block is only reached if the user was NOT found in the database.
    const rootUsername = process.env.ROOT_USER_USERNAME;
    const rootPassword = process.env.ROOT_USER_PASSWORD;

    if (rootUsername && username === rootUsername) {
      // Since the username matches the root user, we now check the password.
      if (rootPassword && password === rootPassword) {
        console.log(`[AUTH] Root user login attempt successful for: ${username}`);
        const rootUserSession = await createRootUserSession(username);
        return { success: true, user: serializeUserForRedux(rootUserSession) };
      } else {
        // Username matches root, but password does not. This is a failed login attempt.
        console.log(`[AUTH] Root user login attempt FAILED (wrong password) for: ${username}`);
        return { success: false, error: 'Invalid username or password.' };
      }
    }

    // --- FINAL CASE: USER NOT FOUND ---
    // If the code reaches here, the user was not in the DB and did not match the root user.
    return { success: false, error: 'Invalid username or password.' };

  } catch (error: any) {
    console.error("Login action error:", error);
    let errorMessage = "An unexpected error occurred during login.";
     if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2022') {
            errorMessage = `Database table not found. Please run 'npx prisma migrate dev' to create the database tables.`;
        } else {
            errorMessage = `Database error during login. Code: ${error.code}`;
        }
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

export async function logoutAction() {
    (await cookies()).delete('auth_token');
    return { success: true };
}


export async function verifyAdminPasswordAction(password: string): Promise<{ success: boolean; error?: string }> {
  if (!password) {
    return { success: false, error: 'Password is required.' };
  }

  // --- Root User Check from .env ---
  const rootPassword = process.env.ROOT_USER_PASSWORD;
  if (rootPassword && password === rootPassword) {
      return { success: true };
  }
  // --- End Root User Check ---

  try {
    const adminUsers = await prisma.user.findMany({
      where: {
        role: {
          name: 'Admin'
        },
        isActive: true,
      },
      select: {
        passwordHash: true,
      }
    });

    if (adminUsers.length === 0) {
      return { success: false, error: 'No active Admin accounts found to verify against.' };
    }

    for (const adminUser of adminUsers) {
      const isPasswordValid = await bcrypt.compare(password, adminUser.passwordHash);
      if (isPasswordValid) {
        return { success: true };
      }
    }

    return { success: false, error: 'Invalid admin password.' };

  } catch (error) {
    console.error("verifyAdminPasswordAction error:", error);
    return { success: false, error: "An unexpected error occurred during password verification." };
  }
}

// Action for new company registration
const RegisterSchema = z.object({
  companyName: z.string().min(3, 'Company name must be at least 3 characters.'),
  username: z.string().min(3, 'Username must be at least 3 characters.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

export async function registerCompanyAdminAction(
  formData: unknown
): Promise<{ success: boolean; message: string; fieldErrors?: Record<string, string[]> }> {
  const validation = RegisterSchema.safeParse(formData);
  if (!validation.success) {
    return {
      success: false,
      message: "Validation failed.",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }
  const { companyName, username, password } = validation.data;

  try {
    // Check for existing company name or username in a single query
    const existingCompany = await prisma.companyProfile.findUnique({ where: { name: companyName } });
    if (existingCompany) {
      return { success: false, message: "A company with this name already exists.", fieldErrors: { companyName: ["This company name is already taken."] } };
    }

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return { success: false, message: "This username is already taken.", fieldErrors: { username: ["This username is already taken."] } };
    }
    
    // Find the 'Admin' role
    const adminRole = await prisma.role.findFirst({ where: { name: 'Admin' } });
    if (!adminRole) {
      // This is a system-level issue. The Admin role should always exist (seeded).
      throw new Error("Critical: Admin role not found. Please seed the database.");
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create company and user in a transaction
    await prisma.$transaction(async (tx) => {
      const newCompany = await tx.companyProfile.create({
        data: {
          name: companyName,
          // 'createdByUserId' can be null or a system ID if you want to track it
        },
      });

      await tx.user.create({
        data: {
          username,
          passwordHash,
          roleId: adminRole.id,
          companyId: newCompany.id,
          isActive: true, // New users are active by default
        },
      });
    });
    
    return { success: true, message: "Registration successful! You can now log in with your new credentials." };

  } catch (error: any) {
    console.error("Registration error:", error);
    return { success: false, message: error.message || "An unexpected server error occurred during registration." };
  }
}

    