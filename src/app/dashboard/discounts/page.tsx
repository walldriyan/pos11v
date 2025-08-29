
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useForm, Controller, useFieldArray, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DiscountSetValidationSchema, SpecificDiscountRuleConfigSchema, ProductDiscountConfigurationSchema, BuyGetRuleSchema } from '@/lib/zodSchemas';
import type {
  DiscountSet as DiscountCampaignType,
  ProductDiscountConfiguration as ProductCampaignConfigurationType,
  SpecificDiscountRuleConfig,
  Product as ProductType,
  DiscountSetFormData,
  ProductDiscountConfigurationFormData,
  BuyGetRule,
} from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DialogClose } from "@radix-ui/react-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


import { PlusCircle, Edit3, Trash2, Save, PercentIcon, ArrowLeft, RefreshCw, EyeOff, Info, CheckCircle as CheckCircleIcon, XCircle as XCircleIcon, Settings2, PackagePlus, PackageSearch, ServerCog, X, ShoppingCart, Gift, Repeat, Repeat1 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '@/store/store';
import {
  _internalAddDiscountSet,
  _internalUpdateDiscountSet,
  _internalDeleteDiscountSet,
  initializeDiscountSets,
  selectDiscountSets,
} from '@/store/slices/saleSlice';
import {
  getDiscountSetsAction,
  saveDiscountSetAction,
  deleteDiscountSetAction,
  toggleDiscountSetActivationAction,
  getProductListForDiscountConfigAction,
} from '@/app/actions/settingsActions';
import { selectCurrentUser } from '@/store/slices/authSlice';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';
import { Separator } from '@/components/ui/separator';

const createEmptySpecificRuleConfig = (namePrefix: string): SpecificDiscountRuleConfig => ({
  isEnabled: false,
  name: `${namePrefix} Rule`,
  type: 'percentage',
  value: 0,
  conditionMin: undefined,
  conditionMax: undefined,
  applyFixedOnce: false,
});

const emptyProductCampaignConfigFormData: ProductDiscountConfigurationFormData = {
  productId: '',
  productName: '',
  isActiveForProductInCampaign: true,
  lineItemValueRuleJson: createEmptySpecificRuleConfig('Product Line Value'),
  lineItemQuantityRuleJson: createEmptySpecificRuleConfig('Product Line Quantity'),
  specificQtyThresholdRuleJson: createEmptySpecificRuleConfig('Product Specific Qty'),
  specificUnitPriceThresholdRuleJson: createEmptySpecificRuleConfig('Product Unit Price'),
};

const createEmptyBuyGetRule = (): BuyGetRule => ({
  buyProductId: '',
  buyQuantity: 1,
  getProductId: '',
  getQuantity: 1,
  discountType: 'percentage',
  discountValue: 100,
  isRepeatable: false,
});


const newDiscountCampaignInitialState: DiscountSetFormData = {
  name: '',
  isActive: true,
  isDefault: false,
  isOneTimePerTransaction: false,
  globalCartPriceRuleJson: createEmptySpecificRuleConfig('Global Cart Price'),
  globalCartQuantityRuleJson: createEmptySpecificRuleConfig('Global Cart Quantity'),
  defaultLineItemValueRuleJson: createEmptySpecificRuleConfig('Default Item Value'),
  defaultLineItemQuantityRuleJson: createEmptySpecificRuleConfig('Default Item Quantity'),
  defaultSpecificQtyThresholdRuleJson: createEmptySpecificRuleConfig('Default Item Specific Qty'),
  defaultSpecificUnitPriceThresholdRuleJson: createEmptySpecificRuleConfig('Default Item Unit Price'),
  productConfigurations: [],
  buyGetRulesJson: [],
};

const RenderRuleInputsComponent = ({
  methods,
  rulePath,
  labelPrefix,
  conditionUnit,
  parentFieldName, 
  isProductSpecificContext = false,
}: {
  methods: any; 
  rulePath: string; 
  labelPrefix: string;
  conditionUnit: 'Rs.' | 'Units';
  parentFieldName: string;
  isProductSpecificContext?: boolean;
}) => {
  const { register, control, watch, formState: { errors: formErrorsObject } } = methods;

  const constructPath = (base: string, ...segments: string[]): string => {
    return [base, ...segments].filter(Boolean).join('.');
  };

  const isEnabledPath = constructPath(parentFieldName, rulePath, 'isEnabled');
  const ruleNamePath = constructPath(parentFieldName, rulePath, 'name');
  const ruleValuePath = constructPath(parentFieldName, rulePath, 'value');
  const ruleTypePath = constructPath(parentFieldName, rulePath, 'type');
  const ruleConditionMinPath = constructPath(parentFieldName, rulePath, 'conditionMin');
  const ruleConditionMaxPath = constructPath(parentFieldName, rulePath, 'conditionMax');
  const ruleApplyFixedOncePath = constructPath(parentFieldName, rulePath, 'applyFixedOnce');

  const isEnabled = watch(isEnabledPath);
  
  const getNestedError = (path: string, rootErrors: any) => {
    if (path === "") return rootErrors;
    const parts = path.split('.');
    let currentError = rootErrors;
    for (const part of parts) {
      if (currentError && typeof currentError === 'object' && part in currentError) {
        currentError = (currentError as any)[part];
      } else {
        return undefined;
      }
    }
    return currentError;
  };
  
  const rootErrorsForParent = getNestedError(parentFieldName, formErrorsObject);
  const currentRuleErrors = rootErrorsForParent && typeof rootErrorsForParent === 'object' && rulePath in rootErrorsForParent 
                            ? (rootErrorsForParent as any)[rulePath] 
                            : undefined;

  const getValueForInput = (val: number | null | undefined) => val === null || val === undefined || isNaN(Number(val)) ? '' : String(val);
  const setValueAsNumberOrUndefined = (v: string) => v === "" || v === null || isNaN(parseFloat(v)) ? undefined : parseFloat(v);

  return (
    <div className="space-y-3 border border-border/50 p-3 rounded-md bg-muted/20">
      <div className="flex items-center space-x-2">
        <Controller
          name={isEnabledPath as any}
          control={control}
          render={({ field }) => (
            <Checkbox
              id={`${parentFieldName}-${rulePath}-enabled`}
              checked={!!field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Label htmlFor={`${parentFieldName}-${rulePath}-enabled`} className="text-sm font-medium text-foreground">
          Enable {labelPrefix} Rule
        </Label>
      </div>

      {isEnabled && (
        <div className="space-y-3 pl-2">
          <div>
            <Label htmlFor={ruleNamePath} className="text-foreground text-xs">Rule Display Name*</Label>
            <Input
              id={ruleNamePath}
              {...register(ruleNamePath as any)}
              className="bg-input border-border focus:ring-primary text-foreground h-8 text-xs"
              placeholder={`e.g., ${labelPrefix} Offer`}
            />
            {currentRuleErrors?.name && <p className="text-xs text-destructive mt-1">{(currentRuleErrors.name as any).message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={ruleValuePath} className="text-foreground text-xs">Value*</Label>
              <Controller
                name={ruleValuePath as any}
                control={control}
                render={({ field }) => (
                  <Input
                    id={ruleValuePath}
                    type="number"
                    value={getValueForInput(field.value)}
                    onChange={e => field.onChange(setValueAsNumberOrUndefined(e.target.value))}
                    className="bg-input border-border focus:ring-primary text-foreground h-8 text-xs"
                    min="0"
                  />
                )}
              />
              {currentRuleErrors?.value && <p className="text-xs text-destructive mt-1">{(currentRuleErrors.value as any).message}</p>}
            </div>
            <div>
              <Label htmlFor={ruleTypePath} className="text-foreground block mb-1 text-xs">Type*</Label>
              <Controller
                name={ruleTypePath as any}
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    className="flex space-x-2 mt-1"
                    id={ruleTypePath}
                  >
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="percentage" id={`${ruleTypePath}-percentage`} className="h-3 w-3"/>
                      <Label htmlFor={`${ruleTypePath}-percentage`} className="text-foreground text-xs">%</Label>
                    </div>
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="fixed" id={`${ruleTypePath}-fixed`} className="h-3 w-3"/>
                      <Label htmlFor={`${ruleTypePath}-fixed`} className="text-foreground text-xs">Rs.</Label>
                    </div>
                  </RadioGroup>
                )}
              />
            </div>
          </div>
          { (rulePath.includes('QuantityRuleJson') || rulePath.includes('QtyThresholdRuleJson') || isProductSpecificContext ) &&  ( 
             <div className="flex items-center space-x-2 pt-1">
                <Controller
                    name={ruleApplyFixedOncePath as any}
                    control={control}
                    render={({ field }) => (
                        <Checkbox
                            id={`${ruleApplyFixedOncePath}-applyFixedOnce`}
                            checked={!!field.value}
                            onCheckedChange={field.onChange}
                        />
                    )}
                 />
                <Label htmlFor={`${ruleApplyFixedOncePath}-applyFixedOnce`} className="text-xs text-foreground">
                    Apply Fixed Value Only Once Per Line
                    <Info size={12} className="inline ml-1 text-muted-foreground cursor-help" title="If checked &amp; type is 'Fixed', this value is applied once if condition met for the line. If unchecked, value * quantity (for qty based rule types). Percentage always applies to total line value (for qty based types) or unit price (for price based type)."/>
                </Label>
            </div>
           )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={ruleConditionMinPath} className="text-foreground text-xs">Min Condition ({conditionUnit})</Label>
              <Controller
                name={ruleConditionMinPath as any}
                control={control}
                render={({ field }) => (
                   <Input
                    id={ruleConditionMinPath}
                    type="number"
                    value={getValueForInput(field.value)}
                    onChange={e => field.onChange(setValueAsNumberOrUndefined(e.target.value))}
                    className="bg-input border-border focus:ring-primary text-foreground h-8 text-xs"
                    placeholder="e.g. 100"
                    min="0"
                  />
                )}
              />
              {currentRuleErrors?.conditionMin && <p className="text-xs text-destructive mt-1">{(currentRuleErrors.conditionMin as any).message}</p>}
            </div>
            <div>
              <Label htmlFor={ruleConditionMaxPath} className="text-foreground text-xs">Max Condition ({conditionUnit})</Label>
               <Controller
                name={ruleConditionMaxPath as any}
                control={control}
                render={({ field }) => (
                  <Input
                    id={ruleConditionMaxPath}
                    type="number"
                    value={getValueForInput(field.value)}
                    onChange={e => field.onChange(setValueAsNumberOrUndefined(e.target.value))}
                    className="bg-input border-border focus:ring-primary text-foreground h-8 text-xs"
                    placeholder="e.g. 500"
                    min={watch(ruleConditionMinPath as any) ?? 0}
                  />
                )}
              />
              {currentRuleErrors?.conditionMax && <p className="text-xs text-destructive mt-1">{(currentRuleErrors.conditionMax as any).message}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default function DiscountManagementPage() {
  const dispatch: AppDispatch = useDispatch();
  const { toast } = useToast();
  const currentUser = useSelector(selectCurrentUser);
  const { can, check } = usePermissions();
  const canManageSettings = can('manage', 'Settings');

  const currentDiscountCampaigns = useSelector(selectDiscountSets);
  const [allProducts, setAllProducts] = useState<{ id: string; name: string; category?: string | null }[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  
  const [isCampaignSheetOpen, setIsCampaignSheetOpen] = useState(false);
  const [editingCampaignFormData, setEditingCampaignFormData] = useState<DiscountSetFormData | null>(null);
  
  const [campaignToDelete, setCampaignToDelete] = useState<DiscountCampaignType | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const campaignFormMethods = useForm<DiscountSetFormData>({
    resolver: zodResolver(DiscountSetValidationSchema),
    defaultValues: JSON.parse(JSON.stringify(newDiscountCampaignInitialState)),
    mode: 'onChange',
  });

  const { fields: productConfigFields, append: appendProductConfig, remove: removeProductConfig, update: updateProductConfig, replace: replaceProductConfigs } = useFieldArray({
    control: campaignFormMethods.control,
    name: "productConfigurations",
    keyName: "_key" 
  });
  
  const { fields: buyGetRuleFields, append: appendBuyGetRule, remove: removeBuyGetRule } = useFieldArray({
    control: campaignFormMethods.control,
    name: "buyGetRulesJson",
  });

  const [configuringProductState, setConfiguringProductState] = useState<{ product: ProductType; configData: ProductDiscountConfigurationFormData; originalIndexInCampaign?: number } | null>(null);
  const [inlineFormKey, setInlineFormKey] = useState(0);

  const inlineProductConfigFormMethods = useForm<ProductDiscountConfigurationFormData>({
    resolver: zodResolver(ProductDiscountConfigurationSchema),
    defaultValues: JSON.parse(JSON.stringify(emptyProductCampaignConfigFormData)),
    mode: 'onChange',
  });
  

  const fetchAllProductsForSelector = useCallback(async () => {
    setIsLoadingProducts(true);
    const result = await getProductListForDiscountConfigAction();
    if (result.success && result.data) {
      setAllProducts(result.data);
    } else {
      toast({ title: "Error Fetching Products", description: result.error, variant: "destructive" });
    }
    setIsLoadingProducts(false);
  }, [toast]);

  const fetchDiscountCampaigns = useCallback(async () => {
    if (!currentUser?.id) {
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    const result = await getDiscountSetsAction(currentUser.id);
    if (result.success && result.data) {
      dispatch(initializeDiscountSets(result.data as DiscountCampaignType[]));
    } else {
      toast({ title: "Error Fetching Discount Campaigns", description: result.error, variant: "destructive" });
    }
    setIsLoading(false);
  }, [dispatch, toast, currentUser]);

  useEffect(() => {
    fetchDiscountCampaigns();
    fetchAllProductsForSelector();
  }, [fetchDiscountCampaigns, fetchAllProductsForSelector]);

  const prepareSheetForNewCampaign = () => {
    const { permitted, toast: permissionToast } = check('manage', 'Settings');
    if (!permitted) {
      permissionToast();
      return;
    }
    campaignFormMethods.reset(JSON.parse(JSON.stringify(newDiscountCampaignInitialState)));
    replaceProductConfigs([]); 
    setConfiguringProductState(null); 
    inlineProductConfigFormMethods.reset(JSON.parse(JSON.stringify(emptyProductCampaignConfigFormData)));
    setEditingCampaignFormData(null);
    setFormError(null);
    setIsCampaignSheetOpen(true);
  };
  
  const handleSaveCampaign = async (data: DiscountSetFormData) => {
    const { permitted, toast: permissionToast } = check('manage', 'Settings');
    if (!permitted) {
      permissionToast();
      return;
    }
    if (!currentUser?.id) {
      setFormError("You must be logged in to save a campaign.");
      return;
    }
    setFormError(null);
    const result = await saveDiscountSetAction(data, currentUser.id);

    if (result.success && result.data) {
      if (editingCampaignFormData?.id) {
        dispatch(_internalUpdateDiscountSet(result.data as DiscountCampaignType));
        toast({ title: "Discount Campaign Updated", description: `Campaign "${result.data.name}" updated.` });
      } else {
        dispatch(_internalAddDiscountSet(result.data as DiscountCampaignType));
        toast({ title: "Discount Campaign Added", description: `Campaign "${result.data.name}" added.` });
      }
      setIsCampaignSheetOpen(false);
      fetchDiscountCampaigns(); 
    } else {
      setFormError(result.error || "Failed to save discount campaign.");
      if (result.fieldErrors) {
        Object.entries(result.fieldErrors).forEach(([field, messages]) => {
            campaignFormMethods.setError(field as keyof DiscountSetFormData, { type: 'server', message: (messages as string[])[0]});
        });
      }
      toast({ title: "Error Saving Campaign", description: result.error || "Could not save campaign.", variant: "destructive" });
    }
  };

  const handleEditCampaign = (campaign: DiscountCampaignType) => {
    const { permitted, toast: permissionToast } = check('manage', 'Settings');
    if (!permitted) {
      permissionToast();
      return;
    }
    const formData: DiscountSetFormData = {
        id: campaign.id,
        name: campaign.name,
        isActive: campaign.isActive,
        isDefault: campaign.isDefault,
        isOneTimePerTransaction: campaign.isOneTimePerTransaction,
        globalCartPriceRuleJson: campaign.globalCartPriceRuleJson ? { ...campaign.globalCartPriceRuleJson } : createEmptySpecificRuleConfig('Global Cart Price'),
        globalCartQuantityRuleJson: campaign.globalCartQuantityRuleJson ? { ...campaign.globalCartQuantityRuleJson } : createEmptySpecificRuleConfig('Global Cart Quantity'),
        defaultLineItemValueRuleJson: campaign.defaultLineItemValueRuleJson ? { ...campaign.defaultLineItemValueRuleJson } : createEmptySpecificRuleConfig('Default Item Value'),
        defaultLineItemQuantityRuleJson: campaign.defaultLineItemQuantityRuleJson ? { ...campaign.defaultLineItemQuantityRuleJson } : createEmptySpecificRuleConfig('Default Item Quantity'),
        defaultSpecificQtyThresholdRuleJson: campaign.defaultSpecificQtyThresholdRuleJson ? { ...campaign.defaultSpecificQtyThresholdRuleJson } : createEmptySpecificRuleConfig('Default Item Specific Qty'),
        defaultSpecificUnitPriceThresholdRuleJson: campaign.defaultSpecificUnitPriceThresholdRuleJson ? { ...campaign.defaultSpecificUnitPriceThresholdRuleJson } : createEmptySpecificRuleConfig('Default Item Unit Price'),
        productConfigurations: campaign.productConfigurations ? campaign.productConfigurations.map(pc => ({
            _key: pc.id, 
            id: pc.id,
            productId: pc.productId,
            productName: pc.product?.name || pc.productNameAtConfiguration || 'Unknown Product',
            isActiveForProductInCampaign: pc.isActiveForProductInCampaign,
            lineItemValueRuleJson: pc.lineItemValueRuleJson ? { ...pc.lineItemValueRuleJson } : createEmptySpecificRuleConfig('Product Line Value'),
            lineItemQuantityRuleJson: pc.lineItemQuantityRuleJson ? { ...pc.lineItemQuantityRuleJson } : createEmptySpecificRuleConfig('Product Line Quantity'),
            specificQtyThresholdRuleJson: pc.specificQtyThresholdRuleJson ? { ...pc.specificQtyThresholdRuleJson } : createEmptySpecificRuleConfig('Product Specific Qty'),
            specificUnitPriceThresholdRuleJson: pc.specificUnitPriceThresholdRuleJson ? { ...pc.specificUnitPriceThresholdRuleJson } : createEmptySpecificRuleConfig('Product Unit Price'),
        })) : [],
        buyGetRulesJson: campaign.buyGetRulesJson ? campaign.buyGetRulesJson.map(rule => ({...rule})) : [],
    };
    campaignFormMethods.reset(formData);
    setConfiguringProductState(null);
    inlineProductConfigFormMethods.reset(JSON.parse(JSON.stringify(emptyProductCampaignConfigFormData)));
    setEditingCampaignFormData(formData);
    setFormError(null);
    setIsCampaignSheetOpen(true);
  };

  const confirmDeleteCampaign = async () => {
    const { permitted, toast: permissionToast } = check('manage', 'Settings');
    if (!permitted || !campaignToDelete) {
      if(!permitted) permissionToast();
      setCampaignToDelete(null);
      return;
    }
    const result = await deleteDiscountSetAction(campaignToDelete.id);
    if (result.success) {
      dispatch(_internalDeleteDiscountSet({ id: campaignToDelete.id }));
      toast({ title: "Discount Campaign Deleted", description: `"${campaignToDelete.name}" deleted.` });
    } else {
      toast({ title: "Error Deleting Campaign", description: result.error, variant: "destructive" });
    }
    setCampaignToDelete(null);
  };
  
  const handleToggleCampaignActivation = async (campaign: DiscountCampaignType) => {
    const { permitted, toast: permissionToast } = check('manage', 'Settings');
    if (!permitted) {
      permissionToast();
      return;
    }
    if (!currentUser?.id) {
        toast({ title: "Authentication Error", description: "You must be logged in to perform this action.", variant: "destructive"});
        return;
    }
    const result = await toggleDiscountSetActivationAction(campaign.id, !campaign.isActive, currentUser.id);
    if (result.success && result.data) {
        dispatch(_internalUpdateDiscountSet(result.data as DiscountCampaignType));
        toast({ title: `Campaign ${result.data.isActive ? 'Activated' : 'Deactivated'}`, description: `"${result.data.name}" is now ${result.data.isActive ? 'active' : 'inactive'}.`});
    } else {
        toast({ title: "Error", description: result.error, variant: "destructive"});
    }
  };
  
  const handleSetCampaignAsDefault = async (campaign: DiscountCampaignType) => {
    const { permitted, toast: permissionToast } = check('manage', 'Settings');
    if (!permitted) {
      permissionToast();
      return;
    }
    if (!currentUser?.id) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    const campaignDataToSave: DiscountSetFormData = {
        ...campaign, 
        isDefault: true, 
        isActive: true, 
        productConfigurations: (campaign.productConfigurations || []).map(pc => ({
            ...pc,
             _key: pc.id,
            productName: pc.product?.name || pc.productNameAtConfiguration, 
        })),
    };
    const result = await saveDiscountSetAction(campaignDataToSave, currentUser.id); 
    if (result.success && result.data) {
        dispatch(_internalUpdateDiscountSet(result.data as DiscountCampaignType)); 
        toast({ title: "Default Campaign Updated", description: `"${result.data.name}" is now the default discount campaign.`});
        fetchDiscountCampaigns(); 
    } else {
        toast({ title: "Error Setting Default", description: result.error, variant: "destructive"});
    }
  };
  
  const handleSelectProductForInlineConfig = (productId: string) => {
    if (!productId) {
      setConfiguringProductState(null);
      inlineProductConfigFormMethods.reset(JSON.parse(JSON.stringify(emptyProductCampaignConfigFormData)));
      setInlineFormKey(prev => prev + 1);
      return;
    }
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
      toast({ title: "Error", description: "Selected product not found.", variant: "destructive" });
      return;
    }
    
    const existingConfigIndex = productConfigFields.findIndex(pc => pc.productId === productId);

    if (existingConfigIndex !== -1) {
        const existingConfigData = productConfigFields[existingConfigIndex];
        const clonedData = JSON.parse(JSON.stringify(existingConfigData));

        const getRuleOrDefault = (ruleData: any, defaultName: string): SpecificDiscountRuleConfig => {
            if (ruleData && typeof ruleData === 'object' && 'isEnabled' in ruleData) {
                return { ...createEmptySpecificRuleConfig(defaultName), ...ruleData};
            }
            return createEmptySpecificRuleConfig(defaultName);
        };

        const configForFormReset: ProductDiscountConfigurationFormData = {
            _key: existingConfigData._key,
            id: clonedData.id,
            productId: clonedData.productId,
            productName: clonedData.productName || product.name,
            isActiveForProductInCampaign: clonedData.isActiveForProductInCampaign !== undefined ? clonedData.isActiveForProductInCampaign : true,
            lineItemValueRuleJson: getRuleOrDefault(clonedData.lineItemValueRuleJson, 'Product Line Value'),
            lineItemQuantityRuleJson: getRuleOrDefault(clonedData.lineItemQuantityRuleJson, 'Product Line Quantity'),
            specificQtyThresholdRuleJson: getRuleOrDefault(clonedData.specificQtyThresholdRuleJson, 'Product Specific Qty'),
            specificUnitPriceThresholdRuleJson: getRuleOrDefault(clonedData.specificUnitPriceThresholdRuleJson, 'Product Unit Price'),
        };
        
        setConfiguringProductState({
            product: product as ProductType,
            configData: configForFormReset,
            originalIndexInCampaign: existingConfigIndex,
        });
        inlineProductConfigFormMethods.reset(configForFormReset);
    } else {
      const newConfigData = {
        ...emptyProductCampaignConfigFormData,
        productId: product.id,
        productName: product.name,
      };
      setConfiguringProductState({ product: product as ProductType, configData: newConfigData });
      inlineProductConfigFormMethods.reset(newConfigData);
    }
    setInlineFormKey(prev => prev + 1);
  };

  const handleSaveInlineProductConfigToCampaign = () => {
    inlineProductConfigFormMethods.handleSubmit(
      (data: ProductDiscountConfigurationFormData) => {
        if (!configuringProductState || !configuringProductState.product) return;

        const configToSave: ProductDiscountConfigurationFormData = {
          ...data,
          id: configuringProductState.configData.id,
          productId: configuringProductState.product.id,
          productName: configuringProductState.product.name,
          _key: configuringProductState.configData._key || `new-${Date.now()}`
        };
        
        if (configuringProductState.originalIndexInCampaign !== undefined) {
          updateProductConfig(configuringProductState.originalIndexInCampaign, configToSave);
          toast({ title: "Product Config Updated", description: `Rules for ${configToSave.productName} staged for update in campaign.`});
        } else {
          appendProductConfig(configToSave);
          toast({ title: "Product Config Added", description: `Rules for ${configToSave.productName} staged for addition to campaign.`});
        }
        setConfiguringProductState(null); 
        inlineProductConfigFormMethods.reset(JSON.parse(JSON.stringify(emptyProductCampaignConfigFormData)));
        setInlineFormKey(prev => prev + 1);
      },
      (errors) => {
        console.error("Inline Product Config Form Errors:", errors);
        toast({title: "Validation Error", description: "Please check product rule fields.", variant: "destructive"});
      }
    )();
  };
  
  const availableProductsForSelection = allProducts.filter(
      p => !productConfigFields.some(pc => pc.productId === p.id && pc.productId !== configuringProductState?.product?.id)
  );

  const combinedCampaignFormErrors = campaignFormMethods.formState.errors;

  return (
    <div className="flex flex-col flex-1 p-4 md:p-6 bg-gradient-to-br from-background to-secondary text-foreground">
      <header className="mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-3">
          <Button asChild variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground self-start sm:self-center">
            <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard</Link>
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center">
            <PercentIcon className="mr-3 h-7 w-7" /> Discount Campaign Management
          </h1>
        </div>
        <div className="flex space-x-2 self-end sm:self-center">
            <Button onClick={() => { fetchDiscountCampaigns(); fetchAllProductsForSelector(); }} variant="outline" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground" disabled={isLoading || isLoadingProducts}>
              <RefreshCw className={`mr-2 h-4 w-4 ${(isLoading || isLoadingProducts) ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button onClick={prepareSheetForNewCampaign} disabled={!canManageSettings} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Discount Campaign
            </Button>
          </div>
      </header>

      <Card className="bg-card border-border shadow-xl flex-1">
        <CardHeader>
          <CardTitle className="text-2xl text-card-foreground">Discount Campaigns</CardTitle>
          <CardDescription className="text-muted-foreground">
            Manage discount campaigns. Each campaign can have global cart rules, default item rules, and product-specific rule configurations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || isLoadingProducts ? (
            Array.from({ length: 3 }).map((_, i) => (
                <div key={`skel-discount-${i}`} className="flex items-center space-x-4 p-4 border-b border-border/30">
                  <div className="space-y-2 flex-1"><Skeleton className="h-4 w-1/3 rounded bg-muted/50" /><Skeleton className="h-3 w-2/3 rounded bg-muted/50" /></div>
                  <Skeleton className="h-8 w-24 rounded-md bg-muted/50" />
                </div>))
          ) : currentDiscountCampaigns.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <PercentIcon className="mx-auto h-12 w-12 mb-4 text-primary" />
              <p className="text-lg font-medium">No discount campaigns defined yet.</p>
              <p className="text-sm">Click "Add Discount Campaign" to create one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-border/50 hover:bg-muted/20">
                    <TableHead className="text-muted-foreground">Campaign Name</TableHead>
                    <TableHead className="text-muted-foreground">Product Configs</TableHead>
                    <TableHead className="text-center text-muted-foreground">Status</TableHead>
                    <TableHead className="text-center text-muted-foreground">Behavior</TableHead>
                    <TableHead className="text-center text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentDiscountCampaigns.map((campaign) => (
                    <TableRow key={campaign.id} className="border-b-border/30 hover:bg-muted/10">
                      <TableCell className="font-medium text-card-foreground">{campaign.name}</TableCell>
                      <TableCell className="text-card-foreground text-xs">
                        {campaign.productConfigurations?.length || 0} configured
                      </TableCell>
                      <TableCell className="text-center">
                        {campaign.isActive ? (
                          <Badge variant="default" className="bg-green-500/80 hover:bg-green-600 text-white text-xs"><CheckCircleIcon className="mr-1 h-3 w-3" /> Active</Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-red-500/80 hover:bg-red-600 text-white text-xs"><XCircleIcon className="mr-1 h-3 w-3" /> Inactive</Badge>
                        )}
                        {campaign.isDefault && <Badge variant="secondary" className="ml-1 text-xs">Default</Badge>}
                      </TableCell>
                       <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">{campaign.isOneTimePerTransaction ? "One Best Rule Max" : "Multi-Rule Possible"}</Badge>
                       </TableCell>
                      <TableCell className="text-center space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEditCampaign(campaign as DiscountCampaignType)} disabled={!canManageSettings} className="h-8 w-8 text-blue-500 hover:text-blue-600"><Edit3 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setCampaignToDelete(campaign as DiscountCampaignType)} disabled={!canManageSettings} className="h-8 w-8 text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                        <Button variant="outline" size="xs" onClick={() => handleToggleCampaignActivation(campaign as DiscountCampaignType)} disabled={!canManageSettings} className="h-7 px-2 text-xs">
                          {campaign.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                         {!campaign.isDefault && campaign.isActive && (
                           <Button variant="outline" size="xs" onClick={() => handleSetCampaignAsDefault(campaign as DiscountCampaignType)} disabled={!canManageSettings} className="h-7 px-2 text-xs border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-white">
                             Set Default
                           </Button>
                         )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCampaignSheetOpen} onOpenChange={(isOpen) => {
          setIsCampaignSheetOpen(isOpen);
          if (!isOpen) {
            setEditingCampaignFormData(null);
            setConfiguringProductState(null);
          }
      }}>
        <DialogContent className="max-w-4xl w-full h-[95vh] flex flex-col p-0 bg-card border-border shadow-xl overflow-hidden">
          <DialogHeader className="p-4 pb-3 border-b border-border">
            <DialogTitle className="text-card-foreground">{editingCampaignFormData?.id ? `Edit Campaign: ${campaignFormMethods.watch("name")}` : 'Create New Discount Campaign'}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Define campaign properties, global rules, default item rules, and product-specific rule configurations.
            </DialogDescription>
          </DialogHeader>
          <FormProvider {...campaignFormMethods}>
            <form onSubmit={campaignFormMethods.handleSubmit(handleSaveCampaign)} className="flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {formError && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{formError}</p>}
                
                <Card className="bg-muted/20 border-border/40 mb-4">
                    <CardHeader className="pb-2 pt-3"><CardTitle className="text-base text-foreground">Campaign Details</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <Label htmlFor="campaign-name-form" className="text-foreground text-sm">Campaign Name*</Label>
                            <Input id="campaign-name-form" {...campaignFormMethods.register('name')} className="bg-input border-border focus:ring-primary text-foreground mt-1" />
                            {combinedCampaignFormErrors.name && <p className="text-xs text-destructive mt-1">{combinedCampaignFormErrors.name.message}</p>}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center pt-2">
                            <div className="flex items-center space-x-2"> <Controller name="isActive" control={campaignFormMethods.control} render={({field}) => <Checkbox id="isActiveCampaign" checked={field.value} onCheckedChange={field.onChange} />} /> <Label htmlFor="isActiveCampaign" className="text-sm text-foreground">Active</Label> </div>
                            <div className="flex items-center space-x-2"> <Controller name="isDefault" control={campaignFormMethods.control} render={({field}) => <Checkbox id="isDefaultCampaign" checked={field.value} onCheckedChange={field.onChange} />} /> <Label htmlFor="isDefaultCampaign" className="text-sm text-foreground">Default Campaign</Label> </div>
                            <div className="flex items-center space-x-2"> <Controller name="isOneTimePerTransaction" control={campaignFormMethods.control} render={({field}) => <Checkbox id="isOneTimeCampaign" checked={field.value} onCheckedChange={field.onChange} />} /> <Label htmlFor="isOneTimeCampaign" className="text-sm text-foreground">One Best Rule Max (Entire Campaign)</Label> </div>
                        </div>
                    </CardContent>
                </Card>

                <Tabs defaultValue="product-specific" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="product-specific"><PackagePlus className="mr-2 h-4 w-4"/>Product Specific Rules</TabsTrigger>
                    <TabsTrigger value="buy-get"><Gift className="mr-2 h-4 w-4" />Buy &amp; Get Rules</TabsTrigger>
                    <TabsTrigger value="global-rules"><ShoppingCart className="mr-2 h-4 w-4"/>Global Cart Rules</TabsTrigger>
                    <TabsTrigger value="default-rules"><ServerCog className="mr-2 h-4 w-4"/>Default Item Rules</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="product-specific" className="mt-4">
                    <Card className="bg-muted/20 border-border/40">
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-base text-foreground">Product-Specific Rule Configurations</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-end gap-2">
                          <div className="flex-grow">
                            <Label htmlFor="product-selector-inline" className="text-foreground text-xs">Add or Edit Rules for Product</Label>
                            <Select
                              value={configuringProductState?.product?.id || ""}
                              onValueChange={handleSelectProductForInlineConfig}
                              disabled={allProducts.length === 0}
                            >
                              <SelectTrigger id="product-selector-inline" className="bg-input border-border focus:ring-primary text-sm">
                                <SelectValue placeholder={allProducts.length === 0 ? "No products available" : "Select a product to configure..."} />
                              </SelectTrigger>
                              <SelectContent>
                                {availableProductsForSelection.map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.name} {opt.category ? `(${opt.category})` : ''}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                           {configuringProductState && (
                              <Button type="button" variant="ghost" size="icon" onClick={() => {setConfiguringProductState(null); inlineProductConfigFormMethods.reset(JSON.parse(JSON.stringify(emptyProductCampaignConfigFormData))); setInlineFormKey(prev => prev +1);}} className="h-9 w-9 text-muted-foreground hover:text-destructive"> <X className="h-5 w-5"/> </Button>
                           )}
                        </div>

                        {configuringProductState && (
                          <FormProvider {...inlineProductConfigFormMethods}>
                            <div key={inlineFormKey} className="border border-primary/30 p-3 rounded-md mt-2 space-y-3 bg-background/30">
                              <h4 className="text-sm font-semibold text-primary">
                                Configuring Rules for: {configuringProductState.product.name}
                              </h4>
                               <div className="flex items-center space-x-2">
                                    <Controller name="isActiveForProductInCampaign" control={inlineProductConfigFormMethods.control} render={({field}) => <Checkbox id={`isActiveProdConfigInline-${configuringProductState.product?.id}`} checked={field.value} onCheckedChange={field.onChange} />} />
                                    <Label htmlFor={`isActiveProdConfigInline-${configuringProductState.product?.id}`} className="text-sm text-foreground">Enable this product's specific rules in this campaign</Label>
                               </div>
                              <Accordion type="multiple" className="w-full" defaultValue={['livr-inline', 'liqr-inline', 'sqtr-inline', 'suptr-inline']}>
                                <AccordionItem value="livr-inline" className="border border-border/40 rounded-md bg-muted/20 mb-2">
                                  <AccordionTrigger className="text-xs py-1.5 px-3 hover:text-foreground/80 data-[state=open]:bg-primary/10">1. Line Item Value Rule (total value of this product)</AccordionTrigger>
                                  <AccordionContent className="px-3 pb-2"><RenderRuleInputsComponent methods={inlineProductConfigFormMethods} rulePath="lineItemValueRuleJson" labelPrefix="Line Value" conditionUnit="Rs." parentFieldName="" isProductSpecificContext={true}/></AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="liqr-inline" className="border border-border/40 rounded-md bg-muted/20 mb-2">
                                  <AccordionTrigger className="text-xs py-1.5 px-3 hover:text-foreground/80 data-[state=open]:bg-primary/10">2. Line Item Quantity Rule (quantity of this product)</AccordionTrigger>
                                  <AccordionContent className="px-3 pb-2"><RenderRuleInputsComponent methods={inlineProductConfigFormMethods} rulePath="lineItemQuantityRuleJson" labelPrefix="Line Qty" conditionUnit="Units" parentFieldName="" isProductSpecificContext={true}/></AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="sqtr-inline" className="border border-border/40 rounded-md bg-muted/20 mb-2">
                                  <AccordionTrigger className="text-xs py-1.5 px-3 hover:text-foreground/80 data-[state=open]:bg-primary/10">3. Specific Quantity Threshold Rule (for this product)</AccordionTrigger>
                                  <AccordionContent className="px-3 pb-2"><RenderRuleInputsComponent methods={inlineProductConfigFormMethods} rulePath="specificQtyThresholdRuleJson" labelPrefix="Specific Qty" conditionUnit="Units" parentFieldName="" isProductSpecificContext={true}/></AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="suptr-inline" className="border border-border/40 rounded-md bg-muted/20">
                                  <AccordionTrigger className="text-xs py-1.5 px-3 hover:text-foreground/80 data-[state=open]:bg-primary/10">4. Specific Unit Price Threshold Rule (for this product)</AccordionTrigger>
                                  <AccordionContent className="px-3 pb-2"><RenderRuleInputsComponent methods={inlineProductConfigFormMethods} rulePath="specificUnitPriceThresholdRuleJson" labelPrefix="Unit Price" conditionUnit="Rs." parentFieldName="" isProductSpecificContext={true}/></AccordionContent>
                                </AccordionItem>
                              </Accordion>
                              <Button type="button" onClick={handleSaveInlineProductConfigToCampaign} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/80 text-xs mt-2">
                                {configuringProductState.originalIndexInCampaign !== undefined ? 'Update Staged Product Rules' : 'Add Product Rules to Campaign Stage'}
                              </Button>
                            </div>
                          </FormProvider>
                        )}
                        
                        <div className="mt-4 space-y-2">
                            {productConfigFields.length === 0 && !configuringProductState && <p className="text-xs text-muted-foreground text-center py-3">No product-specific configurations added to this campaign yet. Select a product above to add one.</p>}
                            {productConfigFields.map((field, index) => (
                                <Card key={field._key} className="p-2 bg-background/50 border-border/50">
                                    <div className="flex justify-between items-center">
                                        <div className="flex-grow">
                                           <p className="text-sm font-medium text-foreground">{field.productName || allProducts.find(p=>p.id === field.productId)?.name || 'Unknown Product'}</p>
                                           <p className="text-xs text-muted-foreground">ID: {field.productId?.substring(0,10)}...</p>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            {field.isActiveForProductInCampaign ? <CheckCircleIcon className="h-4 w-4 text-green-500"/> : <XCircleIcon className="h-4 w-4 text-red-500"/>}
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleSelectProductForInlineConfig(field.productId)}><Edit3 className="h-3.5 w-3.5 text-blue-500" /></Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeProductConfig(index)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="buy-get" className="mt-4">
                     <Card className="bg-muted/20 border-border/40">
                        <CardHeader className="pb-2 pt-3">
                           <CardTitle className="text-base text-foreground">"Buy X, Get Y" Rules</CardTitle>
                           <CardDescription className="text-xs">Configure offers like "Buy 2, Get 1 Free". These are applied after all other discounts.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                           {buyGetRuleFields.map((field, index) => (
                             <Card key={field.id} className="p-3 bg-background/50 border-border/50 relative">
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeBuyGetRule(index)} className="h-6 w-6 text-destructive hover:bg-destructive/10 absolute top-1 right-1"><Trash2 className="h-4 w-4" /></Button>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   <div className="space-y-2 p-2 border-r border-border/30">
                                      <Label className="text-sm text-primary">Buy Condition</Label>
                                      <div>
                                         <Label htmlFor={`buyGetRulesJson.${index}.buyProductId`} className="text-xs">Product to Buy*</Label>
                                          <Controller
                                            name={`buyGetRulesJson.${index}.buyProductId`}
                                            control={campaignFormMethods.control}
                                            render={({ field: selectField }) => (
                                                <Select value={selectField.value} onValueChange={selectField.onChange} disabled={allProducts.length === 0}>
                                                    <SelectTrigger><SelectValue placeholder="Select 'Buy' Product" /></SelectTrigger>
                                                    <SelectContent><ScrollArea className="h-48">{allProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</ScrollArea></SelectContent>
                                                </Select>
                                            )}
                                          />
                                          {combinedCampaignFormErrors.buyGetRulesJson?.[index]?.buyProductId && <p className="text-xs text-destructive mt-1">{combinedCampaignFormErrors.buyGetRulesJson[index]?.buyProductId?.message}</p>}
                                      </div>
                                      <div>
                                         <Label htmlFor={`buyGetRulesJson.${index}.buyQuantity`} className="text-xs">Buy Quantity*</Label>
                                         <Input type="number" {...campaignFormMethods.register(`buyGetRulesJson.${index}.buyQuantity`, {valueAsNumber: true})} className="h-8" min="1"/>
                                         {combinedCampaignFormErrors.buyGetRulesJson?.[index]?.buyQuantity && <p className="text-xs text-destructive mt-1">{combinedCampaignFormErrors.buyGetRulesJson[index]?.buyQuantity?.message}</p>}
                                      </div>
                                   </div>
                                    <div className="space-y-2 p-2">
                                      <Label className="text-sm text-green-400">Get Offer</Label>
                                       <div>
                                         <Label htmlFor={`buyGetRulesJson.${index}.getProductId`} className="text-xs">Product to Get*</Label>
                                         <Controller
                                            name={`buyGetRulesJson.${index}.getProductId`}
                                            control={campaignFormMethods.control}
                                            render={({ field: selectField }) => (
                                                <Select value={selectField.value} onValueChange={selectField.onChange} disabled={allProducts.length === 0}>
                                                    <SelectTrigger><SelectValue placeholder="Select 'Get' Product" /></SelectTrigger>
                                                    <SelectContent><ScrollArea className="h-48">{allProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</ScrollArea></SelectContent>
                                                </Select>
                                            )}
                                          />
                                          {combinedCampaignFormErrors.buyGetRulesJson?.[index]?.getProductId && <p className="text-xs text-destructive mt-1">{combinedCampaignFormErrors.buyGetRulesJson[index]?.getProductId?.message}</p>}
                                      </div>
                                      <div>
                                         <Label htmlFor={`buyGetRulesJson.${index}.getQuantity`} className="text-xs">Get Quantity*</Label>
                                         <Input type="number" {...campaignFormMethods.register(`buyGetRulesJson.${index}.getQuantity`, {valueAsNumber: true})} className="h-8" min="1"/>
                                         {combinedCampaignFormErrors.buyGetRulesJson?.[index]?.getQuantity && <p className="text-xs text-destructive mt-1">{combinedCampaignFormErrors.buyGetRulesJson[index]?.getQuantity?.message}</p>}
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                          <div>
                                              <Label htmlFor={`buyGetRulesJson.${index}.discountType`} className="text-xs">Discount Type*</Label>
                                              <Controller name={`buyGetRulesJson.${index}.discountType`} control={campaignFormMethods.control} render={({field}) => (
                                                  <Select value={field.value} onValueChange={field.onChange}>
                                                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                                    <SelectContent><SelectItem value="percentage">Percentage</SelectItem><SelectItem value="fixed">Fixed Price</SelectItem></SelectContent>
                                                  </Select>
                                              )} />
                                          </div>
                                          <div>
                                              <Label htmlFor={`buyGetRulesJson.${index}.discountValue`} className="text-xs">Discount Value*</Label>
                                              <Input type="number" {...campaignFormMethods.register(`buyGetRulesJson.${index}.discountValue`, {valueAsNumber: true})} className="h-8" min="0"/>
                                          </div>
                                      </div>
                                       {combinedCampaignFormErrors.buyGetRulesJson?.[index]?.discountValue && <p className="text-xs text-destructive mt-1">{combinedCampaignFormErrors.buyGetRulesJson[index]?.discountValue?.message}</p>}
                                   </div>
                                </div>
                                <Separator className="my-2" />
                                <div className="flex items-center space-x-2">
                                    <Controller name={`buyGetRulesJson.${index}.isRepeatable`} control={campaignFormMethods.control} render={({field}) => <Checkbox id={`isRepeatable-${index}`} checked={field.value} onCheckedChange={field.onChange} />} />
                                    <Label htmlFor={`isRepeatable-${index}`} className="text-xs flex items-center gap-1">
                                       Allow this offer to be applied multiple times in one transaction?
                                       <Info size={12} className="inline text-muted-foreground cursor-help" title="Checked: If customer buys 4 items for a 'Buy 2, Get 1' offer, they get 2 free. Unchecked: They only get 1 free regardless of total quantity."/>
                                    </Label>
                                </div>
                             </Card>
                           ))}
                           <Button type="button" variant="outline" size="sm" onClick={() => appendBuyGetRule(createEmptyBuyGetRule())} className="mt-2 text-xs h-8"><PlusCircle className="mr-2 h-4 w-4"/>Add "Buy &amp; Get" Rule</Button>
                        </CardContent>
                     </Card>
                  </TabsContent>


                  <TabsContent value="global-rules" className="mt-4">
                     <Accordion type="multiple" className="w-full" defaultValue={['globalCartRulesTab']}>
                        <AccordionItem value="globalCartRulesTab" className="border-none">
                            <AccordionContent className="pt-1 px-1 pb-1 space-y-3">
                                <RenderRuleInputsComponent methods={campaignFormMethods} rulePath="globalCartPriceRuleJson" labelPrefix="Global Cart Total Price" conditionUnit="Rs." parentFieldName="" />
                                <RenderRuleInputsComponent methods={campaignFormMethods} rulePath="globalCartQuantityRuleJson" labelPrefix="Global Cart Total Quantity" conditionUnit="Units" parentFieldName="" />
                            </AccordionContent>
                        </AccordionItem>
                     </Accordion>
                  </TabsContent>

                  <TabsContent value="default-rules" className="mt-4">
                     <Accordion type="multiple" className="w-full" defaultValue={['defaultItemRulesTab']}>
                        <AccordionItem value="defaultItemRulesTab" className="border-none">
                            <AccordionContent className="pt-1 px-1 pb-1 space-y-3">
                                <p className="text-xs text-muted-foreground italic">These rules apply to items in the cart if they don't have specific configurations.</p>
                                <RenderRuleInputsComponent methods={campaignFormMethods} rulePath="defaultLineItemValueRuleJson" labelPrefix="Default Line Value" conditionUnit="Rs." parentFieldName=""/>
                                <RenderRuleInputsComponent methods={campaignFormMethods} rulePath="defaultLineItemQuantityRuleJson" labelPrefix="Default Line Qty" conditionUnit="Units" parentFieldName=""/>
                                <RenderRuleInputsComponent methods={campaignFormMethods} rulePath="defaultSpecificQtyThresholdRuleJson" labelPrefix="Default Specific Qty" conditionUnit="Units" parentFieldName=""/>
                                <RenderRuleInputsComponent methods={campaignFormMethods} rulePath="defaultSpecificUnitPriceThresholdRuleJson" labelPrefix="Default Unit Price" conditionUnit="Rs." parentFieldName=""/>
                            </AccordionContent>
                        </AccordionItem>
                     </Accordion>
                  </TabsContent>
                </Tabs>
              </ScrollArea>
              <DialogFooter className="p-4 border-t border-border mt-auto">
                <DialogClose asChild><Button type="button" variant="outline" className="border-muted text-muted-foreground hover:bg-muted/80">Cancel</Button></DialogClose>
                <Button type="submit" disabled={campaignFormMethods.formState.isSubmitting || !campaignFormMethods.formState.isValid} className="bg-primary hover:bg-primary/90 text-primary-foreground"> <Save className="mr-2 h-4 w-4" /> {editingCampaignFormData?.id ? 'Update Campaign' : 'Save Campaign'} </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>
      
      {campaignToDelete && (
          <AlertDialog open={!!campaignToDelete} onOpenChange={() => setCampaignToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader> <AlertDialogTitle>Delete Campaign "{campaignToDelete.name}"?</AlertDialogTitle> <AlertDialogDescription> This action cannot be undone. This will permanently delete the discount campaign and all its product-specific configurations. </AlertDialogDescription> </AlertDialogHeader>
              <AlertDialogFooter> <AlertDialogCancel onClick={() => setCampaignToDelete(null)}>Cancel</AlertDialogCancel> <AlertDialogAction onClick={confirmDeleteCampaign} className="bg-destructive hover:bg-destructive/90"> Delete </AlertDialogAction> </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
    </div>
  );
}
