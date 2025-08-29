
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { UserForm } from '@/components/dashboard/users/UserForm';
import { RoleForm } from '@/components/dashboard/users/RoleForm';
import type { User as UserType, Role as RoleType, Permission as PermissionType, UserFormData, RoleFormData, CompanyProfileFormData } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, UserCog, Users, ShieldCheck, PlusCircle, Edit3, Trash2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '@/store/slices/authSlice';
import { usePermissions } from '@/hooks/usePermissions';

import { 
  createUserAction, 
  getAllUsersWithRolesAction, 
  updateUserAction, 
  deleteUserAction,
  getRolesForUserFormAction,
  getCompaniesForUserFormAction
} from '@/app/actions/userActions';
import { 
  createRoleAction, 
  getAllRolesWithPermissionsAction, 
  updateRoleAction, 
  deleteRoleAction 
} from '@/app/actions/roleActions';
import { 
  getAllPermissionsAction,
  seedPermissionsAction
} from '@/app/actions/permissionActions';


interface LastSuccessfulSubmission {
  id: string;
  name: string;
}

export default function UserManagementPage() {
  const { toast } = useToast();
  const currentUser = useSelector(selectCurrentUser);
  const { can } = usePermissions();

  const [activeTab, setActiveTab] = useState('users');
  
  const [users, setUsers] = useState<UserType[]>([]);
  const [roles, setRoles] = useState<RoleType[]>([]);
  const [permissions, setPermissions] = useState<PermissionType[]>([]);
  const [rolesForForm, setRolesForForm] = useState<Pick<RoleType, 'id' | 'name'>[]>([]);
  const [companiesForForm, setCompaniesForForm] = useState<Pick<CompanyProfileFormData, 'id' | 'name'>[]>([]);

  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);

  const [isUserSheetOpen, setIsUserSheetOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);
  const [lastUserSubmission, setLastUserSubmission] = useState<LastSuccessfulSubmission | null>(null);


  const [isRoleSheetOpen, setIsRoleSheetOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleType | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<RoleType | null>(null);
  const [lastRoleSubmission, setLastRoleSubmission] = useState<LastSuccessfulSubmission | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!currentUser?.id) return;
    setIsLoadingUsers(true);
    setLastUserSubmission(null);
    const result = await getAllUsersWithRolesAction(currentUser.id);
    if (result.success && result.data) {
      setUsers(result.data as UserType[]); // Cast because passwordHash is omitted
    } else {
      toast({ title: 'Error Fetching Users', description: result.error, variant: 'destructive' });
    }
    setIsLoadingUsers(false);
  }, [toast, currentUser]);

  const fetchRolesAndCompanies = useCallback(async () => {
    setIsLoadingRoles(true);
    setIsLoadingCompanies(true);
    setLastRoleSubmission(null);
    const [rolesResult, companiesResult] = await Promise.all([
      getAllRolesWithPermissionsAction(),
      getCompaniesForUserFormAction()
    ]);
    
    if (rolesResult.success && rolesResult.data) {
      setRoles(rolesResult.data);
      setRolesForForm(rolesResult.data.map(r => ({id: r.id, name: r.name})));
    } else {
      toast({ title: 'Error Fetching Roles', description: rolesResult.error, variant: 'destructive' });
    }
    setIsLoadingRoles(false);

    if (companiesResult.success && companiesResult.data) {
      setCompaniesForForm(companiesResult.data);
    } else {
       toast({ title: 'Error Fetching Companies', description: companiesResult.error, variant: 'destructive' });
    }
    setIsLoadingCompanies(false);

  }, [toast]);

  const fetchPermissions = useCallback(async () => {
    setIsLoadingPermissions(true);
    const result = await getAllPermissionsAction();
    if (result.success && result.data) {
      setPermissions(result.data);
    } else {
      toast({ title: 'Error Fetching Permissions', description: result.error, variant: 'destructive' });
    }
    setIsLoadingPermissions(false);
  }, [toast]);
  
  const handleSeedPermissions = async () => {
    const result = await seedPermissionsAction();
    if (result.success) {
      toast({ title: 'Permissions Seeded', description: `${result.createdCount} new permissions created, ${result.existingCount} already existed.`});
      fetchPermissions(); // Refresh the list
    } else {
      toast({ title: 'Error Seeding Permissions', description: result.error, variant: 'destructive'});
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRolesAndCompanies();
    fetchPermissions();
  }, [fetchUsers, fetchRolesAndCompanies, fetchPermissions]);

  useEffect(() => {
    if (activeTab === 'users') {
        const fetchCompaniesForForm = async () => {
            setIsLoadingCompanies(true);
            const result = await getCompaniesForUserFormAction();
            if (result.success && result.data) {
                setCompaniesForForm(result.data);
            } else {
                toast({ title: 'Could not refresh companies list', description: result.error, variant: 'destructive' });
            }
            setIsLoadingCompanies(false);
        };
        fetchCompaniesForForm();
    }
  }, [activeTab, toast]);

  // User handlers
  const resetUserFormState = () => {
    setEditingUser(null);
    setLastUserSubmission(null);
  };
  const handleAddUser = () => {
    resetUserFormState();
    setIsUserSheetOpen(true);
  };
  const handleEditUser = (user: UserType) => {
    resetUserFormState();
    setEditingUser(user);
    setIsUserSheetOpen(true);
  };
  const handleDeleteUser = (user: UserType) => setUserToDelete(user);
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsSubmitting(true);
    const result = await deleteUserAction(userToDelete.id);
    if (result.success) {
      toast({ title: 'User Deleted', description: `User "${userToDelete.username}" has been deleted.` });
      fetchUsers(); // Refresh list
    } else {
      toast({ title: 'Error Deleting User', description: result.error, variant: 'destructive' });
    }
    setUserToDelete(null);
    setIsSubmitting(false);
  };
  const handleUserFormSubmit = async (data: UserFormData, id?: string) => {
    if (!currentUser?.id) {
        toast({ title: "Authentication Error", description: "Current user not found.", variant: "destructive" });
        return { success: false, error: "Not authenticated" };
    }
    setIsSubmitting(true);
    const result = id 
      ? await updateUserAction(id, data, currentUser.id) 
      : await createUserAction(data, currentUser.id);

    setIsSubmitting(false);
    if (result.success && result.data) {
      toast({ title: id ? 'User Updated' : 'User Created', description: `User "${result.data.username}" has been saved.` });
      setLastUserSubmission({id: result.data.id, name: result.data.username});
      fetchUsers(); // Refresh list
      if (!id) setEditingUser(null);
    }
    return { success: result.success, error: result.error, fieldErrors: result.fieldErrors };
  };
  const handleUserSheetOpenChange = (open: boolean) => {
    setIsUserSheetOpen(open);
    if (!open) resetUserFormState();
  };

  // Role handlers
  const resetRoleFormState = () => {
    setEditingRole(null);
    setLastRoleSubmission(null);
  };
  const handleAddRole = () => {
    resetRoleFormState();
    setIsRoleSheetOpen(true);
  };
  const handleEditRole = (role: RoleType) => {
    resetRoleFormState();
    setEditingRole(role);
    setIsRoleSheetOpen(true);
  };
  const handleDeleteRole = (role: RoleType) => setRoleToDelete(role);
  const confirmDeleteRole = async () => {
    if (!roleToDelete) return;
    setIsSubmitting(true);
    const result = await deleteRoleAction(roleToDelete.id);
    if (result.success) {
      toast({ title: 'Role Deleted', description: `Role "${roleToDelete.name}" has been deleted.` });
      fetchRolesAndCompanies(); // Refresh list
    } else {
      toast({ title: 'Error Deleting Role', description: result.error, variant: 'destructive' });
    }
    setRoleToDelete(null);
    setIsSubmitting(false);
  };
  const handleRoleFormSubmit = async (data: RoleFormData, id?: string) => {
    if (!currentUser?.id) {
        toast({ title: "Authentication Error", description: "Current user not found.", variant: "destructive" });
        return { success: false, error: "Not authenticated" };
    }
    setIsSubmitting(true);
    const result = id 
        ? await updateRoleAction(id, data, currentUser.id) 
        : await createRoleAction(data, currentUser.id);

    setIsSubmitting(false);
    if (result.success && result.data) {
      toast({ title: id ? 'Role Updated' : 'Role Created', description: `Role "${result.data.name}" has been saved.` });
      setLastRoleSubmission({id: result.data.id, name: result.data.name});
      fetchRolesAndCompanies(); // Refresh list
      if(!id) setEditingRole(null);
    }
    return { success: result.success, error: result.error, fieldErrors: result.fieldErrors };
  };
  const handleRoleSheetOpenChange = (open: boolean) => {
    setIsRoleSheetOpen(open);
    if (!open) resetRoleFormState();
  };

  const UserListSkeleton = () => (
    Array.from({ length: 3 }).map((_, i) => (
      <TableRow key={`skel-user-${i}`}>
        <TableCell><Skeleton className="h-4 w-32 bg-muted/50" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24 bg-muted/50" /></TableCell>
        <TableCell><Skeleton className="h-4 w-40 bg-muted/50" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24 bg-muted/50" /></TableCell>
        <TableCell className="text-center"><Skeleton className="h-6 w-16 mx-auto rounded-full bg-muted/50" /></TableCell>
        <TableCell className="text-center space-x-1">
          <Skeleton className="h-8 w-8 inline-block rounded-md bg-muted/50" />
          <Skeleton className="h-8 w-8 inline-block rounded-md bg-muted/50" />
        </TableCell>
      </TableRow>
    ))
  );
  
  const RoleListSkeleton = () => (
    Array.from({ length: 3 }).map((_, i) => (
       <TableRow key={`skel-role-${i}`}>
        <TableCell><Skeleton className="h-4 w-32 bg-muted/50" /></TableCell>
        <TableCell><Skeleton className="h-4 w-48 bg-muted/50" /></TableCell>
        <TableCell className="text-center"><Skeleton className="h-4 w-12 mx-auto bg-muted/50" /></TableCell>
        <TableCell className="text-center space-x-1">
          <Skeleton className="h-8 w-8 inline-block rounded-md bg-muted/50" />
          <Skeleton className="h-8 w-8 inline-block rounded-md bg-muted/50" />
        </TableCell>
      </TableRow>
    ))
  );

  const permissionOptions = permissions.map(p => ({
    value: p.id,
    label: p.description || `${p.subject}: ${p.action}`,
    group: p.subject,
  })).sort((a,b) => {
      const order: { [key: string]: number } = { 'all': 1, 'Dashboard': 2, 'Product': 3, 'Sale': 4, 'PurchaseBill': 5, 'Party': 6, 'User': 7, 'Role': 8, 'Settings': 9 };
      const groupA = order[a.group] || 99;
      const groupB = order[b.group] || 99;
      if (groupA !== groupB) return groupA - groupB;
      if (a.label.startsWith('Access:') && !b.label.startsWith('Access:')) return -1;
      if (!a.label.startsWith('Access:') && b.label.startsWith('Access:')) return 1;
      return a.label.localeCompare(b.label);
  });
  
  const userListDescription = currentUser?.id === 'root-user' 
    ? "Manage all registered users in the system."
    : "Manage registered users in your company.";


  return (
    <div className="flex flex-col flex-1 p-4 md:p-6 bg-gradient-to-br from-background to-secondary text-foreground">
      <header className="mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-3">
          <Button asChild variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground self-start sm:self-center">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center">
            <UserCog className="mr-3 h-7 w-7" />
            User &amp; Role Management
          </h1>
        </div>
        <div className="flex space-x-2 self-end sm:self-center">
           <Button onClick={() => { fetchUsers(); fetchRolesAndCompanies(); fetchPermissions();}} variant="outline" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground" disabled={isLoadingUsers || isLoadingRoles}>
              <RefreshCw className={`mr-2 h-4 w-4 ${(isLoadingUsers || isLoadingRoles) ? 'animate-spin' : ''}`} /> Refresh All
            </Button>
            {activeTab === 'users' && (
                <Button onClick={handleAddUser} disabled={!can('create', 'User')} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add User
                </Button>
            )}
            {activeTab === 'roles' && (
                <Button onClick={handleAddRole} disabled={!can('create', 'Role')} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Role
                </Button>
            )}
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 mb-4 self-start max-w-sm">
          <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" />Users</TabsTrigger>
          <TabsTrigger value="roles"><ShieldCheck className="mr-2 h-4 w-4" />Roles &amp; Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="flex-1 flex flex-col">
          <Card className="bg-card border-border shadow-xl flex-1">
            <CardHeader>
              <CardTitle className="text-2xl text-card-foreground">User List</CardTitle>
              <CardDescription className="text-muted-foreground">{userListDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingUsers && users.length === 0 ? (
                <Table><TableHeader><TableRow><TableHead>Username</TableHead><TableHead>Company</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead className="text-center">Status</TableHead><TableHead className="text-center">Actions</TableHead></TableRow></TableHeader><TableBody><UserListSkeleton /></TableBody></Table>
              ) : !isLoadingUsers && users.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Users className="mx-auto h-12 w-12 mb-4 text-primary" />
                  <p className="text-lg font-medium">No users found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-muted-foreground">Username</TableHead>
                        <TableHead className="text-muted-foreground">Company</TableHead>
                        <TableHead className="text-muted-foreground">Email</TableHead>
                        <TableHead className="text-muted-foreground">Role</TableHead>
                        <TableHead className="text-center text-muted-foreground">Status</TableHead>
                        <TableHead className="text-center text-muted-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium text-card-foreground">{user.username}</TableCell>
                          <TableCell className="text-card-foreground">{user.company?.name || 'N/A (Super Admin)'}</TableCell>
                          <TableCell className="text-card-foreground">{user.email || 'N/A'}</TableCell>
                          <TableCell className="text-card-foreground">{user.role?.name || 'N/A'}</TableCell>
                          <TableCell className="text-center">
                            {user.isActive ? (
                              <Badge variant="default" className="bg-green-500/80 hover:bg-green-600 text-white text-xs"><CheckCircle className="mr-1 h-3 w-3" /> Active</Badge>
                            ) : (
                              <Badge variant="destructive" className="bg-red-500/80 hover:bg-red-600 text-white text-xs"><XCircle className="mr-1 h-3 w-3" /> Disabled</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center space-x-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)} disabled={!can('update', 'User')} className="h-8 w-8 text-blue-500 hover:text-blue-600"><Edit3 className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user)} disabled={!can('delete', 'User')} className="h-8 w-8 text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="flex-1 flex flex-col">
          <Card className="bg-card border-border shadow-xl flex-1">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="text-2xl text-card-foreground">Role List</CardTitle>
                    <CardDescription className="text-muted-foreground">Manage user roles and their permissions.</CardDescription>
                </div>
                <Button onClick={handleSeedPermissions} variant="outline" size="sm" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground">Seed Default Permissions</Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingRoles && roles.length === 0 ? (
                <Table><TableHeader><TableRow><TableHead>Role Name</TableHead><TableHead>Description</TableHead><TableHead className="text-center">Permissions</TableHead><TableHead className="text-center">Actions</TableHead></TableRow></TableHeader><TableBody><RoleListSkeleton /></TableBody></Table>
              ) : !isLoadingRoles && roles.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <ShieldCheck className="mx-auto h-12 w-12 mb-4 text-primary" />
                  <p className="text-lg font-medium">No roles defined.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-muted-foreground">Role Name</TableHead>
                        <TableHead className="text-muted-foreground">Description</TableHead>
                        <TableHead className="text-center text-muted-foreground">Permissions Count</TableHead>
                        <TableHead className="text-center text-muted-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roles.map((role) => (
                        <TableRow key={role.id}>
                          <TableCell className="font-medium text-card-foreground">{role.name}</TableCell>
                          <TableCell className="text-card-foreground text-xs">{role.description || 'N/A'}</TableCell>
                          <TableCell className="text-center text-card-foreground">
                            <Badge variant="secondary">{role.permissions?.length || 0}</Badge>
                          </TableCell>
                          <TableCell className="text-center space-x-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditRole(role)} disabled={!can('update', 'Role')} className="h-8 w-8 text-blue-500 hover:text-blue-600"><Edit3 className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteRole(role)} disabled={!can('delete', 'Role')} className="h-8 w-8 text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {isUserSheetOpen && (
        <Sheet open={isUserSheetOpen} onOpenChange={handleUserSheetOpenChange}>
          <SheetContent className="sm:max-w-lg w-full md:w-[45vw] max-h-screen flex flex-col p-0 bg-card border-border shadow-xl overflow-hidden">
            <SheetHeader className="p-6 pb-4 border-b border-border">
              <SheetTitle className="text-card-foreground">{editingUser ? 'Edit User' : 'Add New User'}</SheetTitle>
              <SheetDescription className="text-muted-foreground">
                {editingUser ? `Update details for ${editingUser.username}.` : 'Fill in user details.'}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {(isLoadingRoles || isLoadingCompanies) ? <p>Loading roles and companies...</p> : 
                <UserForm
                  key={editingUser?.id || lastUserSubmission?.id || 'new-user-form'}
                  user={editingUser || undefined}
                  roles={rolesForForm}
                  companies={companiesForForm}
                  onSubmit={handleUserFormSubmit}
                  isLoading={isSubmitting}
                  onCancel={() => setIsUserSheetOpen(false)}
                  onSwitchToAddNew={resetUserFormState}
                  submissionDetails={lastUserSubmission as { id: string; username: string; } | null}
                />
              }
            </div>
          </SheetContent>
        </Sheet>
      )}

      {isRoleSheetOpen && (
        <Sheet open={isRoleSheetOpen} onOpenChange={handleRoleSheetOpenChange}>
          <SheetContent className="sm:max-w-xl w-full md:w-[50vw] max-h-screen flex flex-col p-0 bg-card border-border shadow-xl overflow-hidden">
            <SheetHeader className="p-6 pb-4 border-b border-border">
              <SheetTitle className="text-card-foreground">{editingRole ? 'Edit Role' : 'Add New Role'}</SheetTitle>
              <SheetDescription className="text-muted-foreground">
                {editingRole ? `Update details for ${editingRole.name}.` : 'Define a new role and assign permissions.'}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {isLoadingPermissions ? <p>Loading permissions...</p> :
                <RoleForm
                  key={editingRole?.id || lastRoleSubmission?.id || 'new-role-form'}
                  role={editingRole ? { ...editingRole, permissionIds: editingRole.permissions?.map(p => p.id) || [] } : undefined}
                  allPermissions={permissions}
                  onSubmit={handleRoleFormSubmit}
                  isLoading={isSubmitting}
                  onCancel={() => setIsRoleSheetOpen(false)}
                  onSwitchToAddNew={resetRoleFormState}
                  submissionDetails={lastRoleSubmission}
                />
              }
            </div>
          </SheetContent>
        </Sheet>
      )}

      {userToDelete && (
        <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete User "{userToDelete.username}"?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setUserToDelete(null)} disabled={isSubmitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteUser} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">{isSubmitting ? "Deleting..." : "Delete"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {roleToDelete && (
        <AlertDialog open={!!roleToDelete} onOpenChange={() => setRoleToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete Role "{roleToDelete.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. Users assigned this role will lose its permissions.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setRoleToDelete(null)} disabled={isSubmitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteRole} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">{isSubmitting ? "Deleting..." : "Delete"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

    </div>
  );
}
