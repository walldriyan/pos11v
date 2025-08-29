
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CompanyProfileSchema } from '@/lib/zodSchemas';
import type { CompanyProfileFormData } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Building, ArrowLeft, Edit, Save, X, UploadCloud, Trash2, PlusCircle, User, List } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAllCompanyProfilesAction, saveCompanyProfileAction, deleteCompanyProfileAction } from '@/app/actions/companyActions';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '@/store/slices/authSlice';
import { usePermissions } from '@/hooks/usePermissions';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from '@/lib/utils';

const defaultCompanyProfile: CompanyProfileFormData = {
  name: '', address: '', phone: '', email: '', website: '', taxId: '', logoUrl: '',
};

const isValidHttpUrl = (stringToCheck: string | null | undefined): boolean => {
  if (!stringToCheck) return false;
  if (stringToCheck.startsWith('/uploads/')) return true;
  let url;
  try { url = new URL(stringToCheck); } catch (_) { return false; }
  return url.protocol === "http:" || url.protocol === "https:";
};

export default function CompanyDetailsPage() {
  const { toast } = useToast();
  const currentUser = useSelector(selectCurrentUser);
  const { can } = usePermissions();
  const canManageSettings = can('manage', 'Settings');
  
  const isSuperAdmin = currentUser?.role?.name === 'Admin' || currentUser?.id === 'root-user';

  const [allCompanies, setAllCompanies] = useState<CompanyProfileFormData[]>([]);
  const [editingCompany, setEditingCompany] = useState<CompanyProfileFormData | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<CompanyProfileFormData | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const initialTab = isSuperAdmin ? 'list' : 'details';
  const [activeTab, setActiveTab] = useState(initialTab);


  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formSubmissionError, setFormSubmissionError] = useState<string | null>(null);
  const [formSubmissionFieldErrors, setFormSubmissionFieldErrors] = useState<Record<string, string[]> | null>(null);

  const {
    register, handleSubmit, reset, watch, setValue, formState: { errors, isDirty, isValid },
  } = useForm<CompanyProfileFormData>({
    resolver: zodResolver(CompanyProfileSchema), defaultValues: defaultCompanyProfile, mode: 'all',
  });

  const fetchAllCompanies = useCallback(async () => {
    if (!currentUser?.id) {
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    const result = await getAllCompanyProfilesAction(currentUser.id);
    if (result && result.success && result.data) {
      setAllCompanies(result.data);
      if (result.data.length === 1 && !isSuperAdmin) {
        handleEdit(result.data[0]);
        setActiveTab('details');
      } else if (result.data.length === 0) {
        setActiveTab('details');
      }
    } else {
      toast({ title: 'Error', description: result?.error || 'Could not fetch company profiles.', variant: 'destructive' });
      setAllCompanies([]);
    }
    setIsLoading(false);
  }, [toast, currentUser, isSuperAdmin]);

  useEffect(() => {
    fetchAllCompanies();
  }, [fetchAllCompanies]);
  
  const resetFormAndErrors = (companyData: CompanyProfileFormData | null) => {
    const dataToReset = companyData || defaultCompanyProfile;
    setEditingCompany(companyData);
    reset(dataToReset);
    setPreviewUrl(isValidHttpUrl(dataToReset.logoUrl) ? dataToReset.logoUrl : null);
    setSelectedFile(null);
    setFormSubmissionError(null);
    setFormSubmissionFieldErrors(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddNew = () => {
    resetFormAndErrors(null);
    setActiveTab('details');
  };

  const handleEdit = (company: CompanyProfileFormData) => {
    resetFormAndErrors(company);
    setActiveTab('details');
  };
  
  const handleDelete = async () => {
    if (!companyToDelete || !canManageSettings || !currentUser?.id) {
        toast({ title: 'Error', description: companyToDelete ? 'Permission denied.' : 'No company selected for deletion.', variant: 'destructive'});
        setCompanyToDelete(null);
        return;
    }
    setIsSubmitting(true);
    const result = await deleteCompanyProfileAction(companyToDelete.id!, currentUser.id);
    if (result.success) {
        toast({ title: 'Success', description: 'Company profile deleted successfully.'});
        fetchAllCompanies(); 
        if (editingCompany?.id === companyToDelete.id) {
            handleAddNew(); 
        }
    } else {
        toast({ title: 'Error', description: result.error || 'Failed to delete company.', variant: 'destructive'});
    }
    setCompanyToDelete(null);
    setIsSubmitting(false);
  };

  const onSubmit = async (data: CompanyProfileFormData) => {
    if (!canManageSettings || !currentUser?.id) {
        toast({ title: 'Permission Denied', description: 'You are not authorized to perform this action.', variant: 'destructive' });
        return;
    }
    setIsSubmitting(true);
    setFormSubmissionError(null);
    setFormSubmissionFieldErrors(null);

    const formDataToSend = new FormData();
    if (editingCompany?.id) formDataToSend.append('id', editingCompany.id);
    
    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'logoFile' && value !== null && value !== undefined) {
        formDataToSend.append(key, String(value));
      }
    });
    if (selectedFile) formDataToSend.append('logoFile', selectedFile);
    else if (!previewUrl && editingCompany?.logoUrl) formDataToSend.append('clearLogo', 'true');

    const result = await saveCompanyProfileAction(formDataToSend, currentUser.id);

    if (result.success && result.data) {
      toast({ title: 'Success', description: `Company profile ${editingCompany ? 'updated' : 'created'} successfully.` });
      fetchAllCompanies();
      if (!editingCompany) { 
        handleEdit(result.data); 
      } else { 
        handleEdit(result.data);
      }
      if (isSuperAdmin) {
        setActiveTab('list');
      } else {
        setActiveTab('details');
      }
    } else {
      setFormSubmissionError(result.error || 'An unexpected error occurred.');
      if (result.fieldErrors) setFormSubmissionFieldErrors(result.fieldErrors);
      toast({ title: 'Error Saving', description: result.error || 'Please check the form for errors.', variant: 'destructive' });
    }
    setIsSubmitting(false);
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result as string);
      reader.readDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if(fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const logoToDisplayInEditPreview = previewUrl;

  return (
    <div className="flex flex-col flex-1 p-4 md:p-6 bg-gradient-to-br from-background to-secondary text-foreground">
      <header className="mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-3">
          <Button asChild variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground self-start sm:self-center">
            <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard</Link>
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center">
            <Building className="mr-3 h-7 w-7" /> Company Profile Management
          </h1>
        </div>
        {isSuperAdmin && (
            <Button onClick={handleAddNew} disabled={!canManageSettings} className="bg-primary hover:bg-primary/90 text-primary-foreground self-end sm:self-center">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Company
            </Button>
        )}
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={cn("grid w-full", isSuperAdmin ? "grid-cols-2" : "grid-cols-1")}>
            <TabsTrigger value="details"><User className="mr-2 h-4 w-4" />{editingCompany ? 'Edit Company Profile' : 'Create Company'}</TabsTrigger>
            {isSuperAdmin && <TabsTrigger value="list"><List className="mr-2 h-4 w-4"/>All Companies</TabsTrigger>}
        </TabsList>
        <TabsContent value="details" className="mt-4">
            <form onSubmit={handleSubmit(onSubmit)}>
                <Card className="bg-card border-border shadow-xl">
                <CardHeader>
                    <CardTitle className="text-2xl text-card-foreground">
                    {editingCompany ? `Editing: ${editingCompany.name}` : 'New Company Profile'}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                    {editingCompany ? 'Update the details for this company.' : 'Fill out the form to create a new company profile.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {formSubmissionError && ( <Alert variant="destructive"><AlertTitle>Update Failed</AlertTitle><AlertDescription>{formSubmissionError}</AlertDescription></Alert>)}
                    {(formSubmissionFieldErrors || Object.keys(errors).length > 0) && !formSubmissionError && (
                    <Alert variant="destructive"><AlertTitle>Please correct the following errors:</AlertTitle>
                        <AlertDescription><ul className="list-disc list-inside space-y-0.5">
                        {formSubmissionFieldErrors && Object.entries(formSubmissionFieldErrors).map(([field, fieldErrors]) => fieldErrors.map((errorMsg, i) => <li key={`${field}-s-${i}`}><strong className="capitalize">{field.replace(/([A-Z])/g, ' $1').toLowerCase()}:</strong> {errorMsg}</li>))}
                        {Object.entries(errors).filter(([fieldName]) => !formSubmissionFieldErrors || !formSubmissionFieldErrors[fieldName as keyof CompanyProfileFormData]).map(([fieldName, fieldError]) => fieldError?.message && (<li key={`${fieldName}-l`}><strong className="capitalize">{fieldName.replace(/([A-Z])/g, ' $1').toLowerCase()}:</strong> {String(fieldError.message)}</li>))}
                        </ul></AlertDescription>
                    </Alert>
                    )}
                    <div>
                    <Label htmlFor="name" className="text-xs text-foreground">Company Name*</Label>
                    <Input id="name" {...register('name')} className="bg-input border-border focus:ring-primary text-sm" />
                    {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="logoFile" className="text-xs text-foreground">Company Logo (Optional)</Label>
                        <div className="mt-1 flex items-center space-x-3">
                            <Input id="logoFile" type="file" accept="image/*" onChange={handleFileChange} className="hidden" ref={fileInputRef} />
                            <input type="hidden" {...register('logoUrl')} /> 
                            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="border-dashed border-primary text-primary hover:bg-primary/10 text-sm">
                            <UploadCloud className="mr-2 h-4 w-4" /> {selectedFile ? 'Change Logo' : 'Upload Logo'}
                            </Button>
                            {logoToDisplayInEditPreview && ( <Button type="button" variant="ghost" size="icon" onClick={handleRemoveLogo} className="text-destructive hover:bg-destructive/10" title="Remove current logo"><Trash2 className="h-4 w-4" /></Button>)}
                        </div>
                        {logoToDisplayInEditPreview && (<div className="mt-2 p-2 border border-dashed border-border rounded-md inline-block bg-muted/30"><Image src={logoToDisplayInEditPreview} alt="Logo Preview" width={150} height={50} className="max-h-16 object-contain" data-ai-hint="company logo"/></div>)}
                        {errors.logoUrl && <p className="text-xs text-destructive mt-1">{errors.logoUrl.message}</p>}
                    </div>
                    <div>
                    <Label htmlFor="address" className="text-xs text-foreground">Address</Label>
                    <Textarea id="address" {...register('address')} className="bg-input border-border focus:ring-primary text-sm" />
                    {errors.address && <p className="text-xs text-destructive mt-1">{errors.address.message}</p>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><Label htmlFor="phone" className="text-xs text-foreground">Phone</Label><Input id="phone" {...register('phone')} className="bg-input border-border focus:ring-primary text-sm" />{errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone.message}</p>}</div>
                    <div><Label htmlFor="email" className="text-xs text-foreground">Email (Optional)</Label><Input id="email" type="email" {...register('email')} className="bg-input border-border focus:ring-primary text-sm" />{errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><Label htmlFor="website" className="text-xs text-foreground">Website (Optional)</Label><Input id="website" {...register('website')} placeholder="https://example.com" className="bg-input border-border focus:ring-primary text-sm" />{errors.website && <p className="text-xs text-destructive mt-1">{errors.website.message}</p>}</div>
                    <div><Label htmlFor="taxId" className="text-xs text-foreground">Tax ID / Reg No. (Optional)</Label><Input id="taxId" {...register('taxId')} className="bg-input border-border focus:ring-primary text-sm" />{errors.taxId && <p className="text-xs text-destructive mt-1">{errors.taxId.message}</p>}</div>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4 border-t border-border/30">
                    <Button type="button" variant="outline" onClick={() => resetFormAndErrors(editingCompany)} disabled={isSubmitting} className="border-muted text-muted-foreground hover:bg-muted/80"><X className="mr-2 h-4 w-4" /> Cancel</Button>
                    <Button type="submit" disabled={!isValid || isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground"><Save className="mr-2 h-4 w-4" /> {isSubmitting ? 'Saving...' : 'Save Changes'}</Button>
                    </div>
                </CardContent>
                </Card>
            </form>
        </TabsContent>
        {isSuperAdmin && (
            <TabsContent value="list" className="mt-4">
                 <Card className="bg-card border-border shadow-xl">
                    <CardHeader><CardTitle>All Companies</CardTitle><CardDescription>List of all saved company profiles.</CardDescription></CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-40 w-full" /> : allCompanies.length === 0 ? <p className="text-muted-foreground text-center">No company profiles found. Create one in the 'Details' tab.</p> : (
                            <div className="overflow-x-auto">
                            <Table>
                                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                <TableBody>
                                {allCompanies.map((company) => (<TableRow key={company.id}><TableCell>{company.name}</TableCell><TableCell>{company.phone || 'N/A'}</TableCell><TableCell>{company.email || 'N/A'}</TableCell><TableCell className="text-right space-x-1"><Button variant="ghost" size="icon" onClick={() => handleEdit(company)} className="h-8 w-8 text-blue-500 hover:text-blue-600"><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setCompanyToDelete(company)} className="h-8 w-8 text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>))}
                                </TableBody>
                            </Table>
                            </div>
                        )}
                    </CardContent>
                 </Card>
            </TabsContent>
        )}
      </Tabs>
      {companyToDelete && (
        <AlertDialog open={!!companyToDelete} onOpenChange={() => setCompanyToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Delete Company "{companyToDelete.name}"?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the company profile and its logo.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
