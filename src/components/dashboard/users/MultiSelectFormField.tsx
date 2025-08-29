
'use client';

import React, { useState } from 'react';
import { Controller, Control, FieldPath, FieldValues } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ChevronsUpDown, BarChart3, Settings, PackageIcon, ShoppingCart, ReceiptText, UsersIcon, UserCog, ShieldCheck, ShieldAlert, X, WalletCards } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


interface Option {
  value: string;
  label: string;
  group?: string;
}

interface MultiSelectFormFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  options: Option[];
  placeholder?: string;
  label?: string;
}

const groupIcons: Record<string, React.ElementType> = {
  'all': ShieldAlert,
  'Dashboard': BarChart3,
  'Settings': Settings,
  'Product': PackageIcon,
  'Sale': ShoppingCart,
  'PurchaseBill': ReceiptText,
  'Party': UsersIcon,
  'User': UserCog,
  'Role': ShieldCheck,
  'CashRegister': WalletCards,
};

export function MultiSelectFormField<TFieldValues extends FieldValues>({
  control,
  name,
  options,
  placeholder = "Select...",
  label,
}: MultiSelectFormFieldProps<TFieldValues>) {
  const [isOpen, setIsOpen] = useState(false);

  // Group options if group key is present
  const groupedOptions = React.useMemo(() => {
    const groups: Record<string, Option[]> = {};
    const ungrouped: Option[] = [];
    options.forEach(option => {
      if (option.group) {
        if (!groups[option.group]) {
          groups[option.group] = [];
        }
        groups[option.group].push(option);
      } else {
        ungrouped.push(option);
      }
    });
    return { groups, ungrouped };
  }, [options]);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const selectedValues = Array.isArray(field.value) ? field.value : [];
        
        const handleSelect = (value: string) => {
          const currentSelected = Array.isArray(field.value) ? field.value : [];
          const newSelectedValues = currentSelected.includes(value)
            ? currentSelected.filter(v => v !== value)
            : [...currentSelected, value];
          field.onChange(newSelectedValues);
        };
        
        const toggleSelectAllForGroup = (groupName: string, currentGroupOptions: Option[]) => {
          const groupValues = currentGroupOptions.map(opt => opt.value);
          const currentSelected = Array.isArray(field.value) ? field.value : [];
          const allSelectedInGroup = groupValues.every(gv => currentSelected.includes(gv));
          let newSelectedValues = [...currentSelected];

          if (allSelectedInGroup) { // Deselect all in group
            newSelectedValues = newSelectedValues.filter(v => !groupValues.includes(v));
          } else { // Select all in group (add missing ones)
            groupValues.forEach(gv => {
              if (!newSelectedValues.includes(gv)) {
                newSelectedValues.push(gv);
              }
            });
          }
          field.onChange(newSelectedValues);
        };


        return (
          <div className="space-y-1">
            {label && <Label className="text-xs">{label}</Label>}
            <Popover open={isOpen} onOpenChange={setIsOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isOpen}
                  className="w-full justify-between bg-input border-border text-sm text-foreground hover:bg-muted/20"
                >
                  <span className="truncate">
                    {selectedValues.length > 0 ? `${selectedValues.length} selected` : placeholder}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 flex flex-col h-[26rem]">
                 <ScrollArea className="flex-1">
                  <Accordion type="multiple" className="w-full p-2" defaultValue={Object.keys(groupedOptions.groups)}>
                    {Object.entries(groupedOptions.groups).map(([groupName, groupOptions]) => {
                       const Icon = groupIcons[groupName] || ShieldCheck;
                       return (
                      <AccordionItem key={groupName} value={groupName} className="border border-border/50 rounded-md mb-2 bg-muted/20">
                        <AccordionTrigger className="px-3 py-2 text-sm font-medium hover:no-underline [&[data-state=open]>svg]:text-primary">
                          <div className="flex items-center">
                            <Icon className="mr-2 h-4 w-4 text-primary" />
                            {groupName}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-3 pb-2">
                           <div className="space-y-2">
                              <div className="flex items-center justify-between border-b border-border/30 pb-2 mb-2">
                                <Label className="text-xs text-muted-foreground">Select all in group</Label>
                                <Button
                                  type="button"
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 text-xs text-primary hover:underline"
                                  onClick={() => toggleSelectAllForGroup(groupName, groupOptions)}
                                >
                                  {groupOptions.every(opt => selectedValues.includes(opt.value)) ? 'Deselect All' : 'Select All'}
                                </Button>
                              </div>

                              {groupOptions.map(option => (
                                <div key={option.value} className="flex items-center space-x-2 py-1 hover:bg-background/50 rounded-md px-2">
                                  <Checkbox
                                    id={`ms-${name}-${option.value}`}
                                    checked={selectedValues.includes(option.value)}
                                    onCheckedChange={() => handleSelect(option.value)}
                                  />
                                  <Label htmlFor={`ms-${name}-${option.value}`} className="text-sm font-normal cursor-pointer flex-1">
                                    {option.label}
                                  </Label>
                                </div>
                              ))}
                            </div>
                        </AccordionContent>
                      </AccordionItem>
                       );
                    })}
                  </Accordion>
                </ScrollArea>
                 <div className="p-2 border-t border-border flex-shrink-0">
                    <Button size="sm" className="w-full" onClick={() => setIsOpen(false)}>Done</Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        );
      }}
    />
  );
}
