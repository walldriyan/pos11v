
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit3, Trash2, Search, CheckCircle, XCircle, FilePlus2, AlertTriangle, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { PartyForm } from '@/components/dashboard/PartyForm';
import type { Party, PartyFormData, PartyTypeEnum } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import {
  createPartyAction,
  updatePartyAction,
  deletePartyAction,
} from '@/app/actions/partyActions';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '@/store/slices/authSlice';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/usePermissions';

interface PartyListProps {
  initialParties: Party[];
}

interface LastSuccessfulSubmission {
  id: string;
  name: string;
  type: PartyTypeEnum;
}

export function PartyList({ initialParties }: PartyListProps) {
  const { toast } = useToast();
  const currentUser = useSelector(selectCurrentUser);
  const { can, check } = usePermissions();
  const canCreate = can('create', 'Party');
  const canUpdate = can('update', 'Party');
  const canDelete = can('delete', 'Party');
  
  const isSuperAdminWithoutCompany = currentUser?.role?.name === 'Admin' && !currentUser?.companyId;

  const [parties, setParties] = useState<Party[]>(initialParties);
  const [isLoading, setIsLoading] = useState(false); // No initial loading as data is passed
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [partyToDelete, setPartyToDelete] = useState<Party | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string[]> | undefined>(undefined);
  const [lastSuccessfulSubmission, setLastSuccessfulSubmission] = useState<LastSuccessfulSubmission | null>(null);

  const resetFormStateAndPrepareForNew = () => {
    setEditingParty(null);
    setFormError(null);
    setFormFieldErrors(undefined);
    setLastSuccessfulSubmission(null);
  };

  const handleAddParty = () => {
    const { permitted, toast: permissionToast } = check('create', 'Party');
    if (!permitted) { permissionToast(); return; }
    resetFormStateAndPrepareForNew();
    setIsSheetOpen(true);
  };

  const handleEditParty = (party: Party) => {
    const { permitted, toast: permissionToast } = check('update', 'Party');
    if (!permitted) { permissionToast(); return; }
    resetFormStateAndPrepareForNew();
    setEditingParty(party);
    setIsSheetOpen(true);
  };

  const handleDeleteParty = (party: Party) => {
     const { permitted, toast: permissionToast } = check('delete', 'Party');
     if (!permitted) { permissionToast(); return; }
     setPartyToDelete(party);
  };

  const confirmDeleteParty = async () => {
    if (!partyToDelete || !currentUser?.id) return;
    setIsSubmitting(true);
    const result = await deletePartyAction(partyToDelete.id, currentUser.id);
    if (result.success) {
      setParties(prev => prev.filter(p => p.id !== partyToDelete.id));
      toast({ title: 'Party Deleted', description: `Party "${partyToDelete.name}" has been removed.` });
    } else {
      toast({ title: 'Error Deleting Party', description: result.error || 'Could not delete party.', variant: 'destructive' });
    }
    setPartyToDelete(null);
    setIsSubmitting(false);
  };

  const handlePartyFormSubmit = async (data: PartyFormData): Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string[]> }> => {
    if (!currentUser?.id) {
      const errorMsg = "User not authenticated. Cannot save party.";
      setFormError(errorMsg);
      return { success: false, error: errorMsg };
    }
    setIsSubmitting(true);
    setFormError(null);
    setFormFieldErrors(undefined);
    
    let result;
    const partyId = editingParty?.id;
    const isUpdating = !!partyId;

    if (isUpdating) {
      result = await updatePartyAction(partyId!, data, currentUser.id);
      if (result.success && result.data) {
        setParties(prev => prev.map(p => p.id === result.data?.id ? result.data! : p));
        toast({ title: 'Party Updated', description: `${result.data.type} "${result.data.name}" has been updated.` });
        setLastSuccessfulSubmission({ id: result.data.id, name: result.data.name, type: result.data.type });
        setEditingParty(result.data); // Keep editing the same party
      }
    } else {
      result = await createPartyAction(data, currentUser.id);
      if (result.success && result.data) {
        setParties(prev => [...prev, result.data!]);
        toast({ title: 'Party Added', description: `${result.data.type} "${result.data.name}" has been added.` });
        setLastSuccessfulSubmission({ id: result.data.id, name: result.data.name, type: result.data.type });
        setEditingParty(null); // Clear editing state, form will reset via key or onSwitchToAddNew
      }
    }
    
    setIsSubmitting(false);

    if (!result.success) {
        setFormError(result.error || 'An unexpected error occurred.');
        setFormFieldErrors(result.fieldErrors);
        setLastSuccessfulSubmission(null);
    }
    return {success: result.success, error: result.error, fieldErrors: result.fieldErrors};
  };
  
  const handleSheetOpenChange = (open: boolean) => {
    setIsSheetOpen(open);
    if (!open) {
      resetFormStateAndPrepareForNew();
    }
  };
  
  const handleSwitchToAddNewInForm = () => {
    resetFormStateAndPrepareForNew();
  };

  const filteredParties = useMemo(() => parties.filter(party =>
    party.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (party.email && party.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (party.phone && party.phone.includes(searchTerm)) ||
    party.type.toLowerCase().includes(searchTerm.toLowerCase())
  ), [parties, searchTerm]);

  return (
    <>
      {isSuperAdminWithoutCompany && (
        <Card className="mb-4 border-yellow-500/50 bg-yellow-950/30">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-yellow-400" />
            <div>
              <p className="font-semibold text-yellow-300">Super Admin Notice</p>
              <p className="text-xs text-yellow-400">
                Party management (customers/suppliers) is company-specific. To use this feature, please ensure your Super Admin account is associated with a company in the User Management settings.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-4 flex justify-end">
        <Button onClick={handleAddParty} disabled={!canCreate || isSuperAdminWithoutCompany} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Party
        </Button>
      </div>

      <Card className="bg-card border-border shadow-xl flex-1">
        <CardHeader>
          <CardTitle className="text-2xl text-card-foreground">Party List</CardTitle>
          <CardDescription className="text-muted-foreground">
            View, add, edit, or delete customers and suppliers.
          </CardDescription>
           <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-input border-border focus:ring-primary text-card-foreground"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             Array.from({ length: 3 }).map((_, i) => (
                <div key={`skel-party-${i}`} className="flex items-center space-x-4 p-4 border-b border-border/30">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4 rounded bg-muted/50" />
                    <Skeleton className="h-3 w-1/2 rounded bg-muted/50" />
                  </div>
                  <Skeleton className="h-8 w-24 rounded-md bg-muted/50" />
                </div>
              ))
          ): filteredParties.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="mx-auto h-12 w-12 mb-4 text-primary" />
              <p className="text-lg font-medium">
                {searchTerm ? `No parties found matching "${searchTerm}".` : (isSuperAdminWithoutCompany ? 'No company selected.' : 'No parties yet.')}
              </p>
              {!searchTerm && !isSuperAdminWithoutCompany && <p className="text-sm">Click "Add Party" to get started.</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-border/50 hover:bg-muted/20">
                    <TableHead className="text-muted-foreground">Name</TableHead>
                    <TableHead className="text-muted-foreground">Type</TableHead>
                    <TableHead className="text-muted-foreground">Phone</TableHead>
                    <TableHead className="text-muted-foreground">Email</TableHead>
                    <TableHead className="text-muted-foreground">Address</TableHead>
                    <TableHead className="text-center text-muted-foreground">Status</TableHead>
                    <TableHead className="text-center text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParties.map((party) => (
                    <TableRow key={party.id} className="border-b-border/30 hover:bg-muted/10">
                      <TableCell className="font-medium text-card-foreground">{party.name}</TableCell>
                      <TableCell>
                        <Badge variant={party.type === 'CUSTOMER' ? 'default' : 'secondary'} className="text-xs">
                            {party.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-card-foreground">{party.phone || 'N/A'}</TableCell>
                      <TableCell className="text-card-foreground">{party.email || 'N/A'}</TableCell>
                      <TableCell className="text-card-foreground truncate max-w-xs" title={party.address || ''}>{party.address || 'N/A'}</TableCell>
                      <TableCell className="text-center">
                        {party.isActive ? (
                            <Badge variant="default" className="bg-green-500/80 hover:bg-green-600 text-white text-xs">
                            <CheckCircle className="mr-1 h-3 w-3" /> Active
                            </Badge>
                        ) : (
                            <Badge variant="destructive" className="bg-red-500/80 hover:bg-red-600 text-white text-xs">
                            <XCircle className="mr-1 h-3 w-3" /> Disabled
                            </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEditParty(party)} disabled={!canUpdate} className="h-8 w-8 text-blue-500 hover:text-blue-600">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteParty(party)} disabled={!canDelete} className="h-8 w-8 text-red-500 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {isSheetOpen && (
        <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
          <SheetContent className="sm:max-w-lg w-full md:w-[40vw] max-h-screen flex flex-col p-0 bg-card border-border shadow-xl overflow-hidden">
            <SheetHeader className="p-6 pb-4 border-b border-border">
              <SheetTitle className="text-card-foreground">{editingParty ? 'Edit Party' : 'Add New Party'}</SheetTitle>
              <SheetDescription className="text-muted-foreground">
                {editingParty ? `Update details for ${editingParty.name}.` : 'Fill in the details for the new customer or supplier.'}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <PartyForm
                key={editingParty?.id || lastSuccessfulSubmission?.id || 'new-party-form'}
                party={editingParty}
                onSubmit={handlePartyFormSubmit}
                isLoading={isSubmitting}
                onCancel={() => setIsSheetOpen(false)}
                formError={formError}
                fieldErrors={formFieldErrors}
                onSwitchToAddNew={handleSwitchToAddNewInForm}
                submissionDetails={lastSuccessfulSubmission}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

        {partyToDelete && (
          <AlertDialog open={!!partyToDelete} onOpenChange={() => setPartyToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to delete this party?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will remove "{partyToDelete.name}" from the list.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setPartyToDelete(null)} disabled={isSubmitting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteParty} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                  {isSubmitting ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
    </>
  );
}
