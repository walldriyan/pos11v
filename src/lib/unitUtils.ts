
import type { UnitDefinition } from '@/types';

export interface DisplayQuantityAndUnit {
  displayQuantity: string;
  displayUnit: string;
}

export function getDisplayQuantityAndUnit(
  quantityInBaseUnit: number,
  unitDefinition: UnitDefinition | undefined | null
): DisplayQuantityAndUnit {
  if (!unitDefinition || typeof quantityInBaseUnit !== 'number') {
    return { displayQuantity: (quantityInBaseUnit || 0).toString(), displayUnit: '' };
  }

  const { baseUnit, derivedUnits } = unitDefinition;

  if (derivedUnits && derivedUnits.length > 0) {
    // Sort derived units by threshold descending, so we check largest units first
    // Units with the same threshold will be checked in the order they appear in the array.
    const sortedDerivedUnits = [...derivedUnits].sort((a, b) => (b.threshold || 0) - (a.threshold || 0));

    for (const derived of sortedDerivedUnits) {
      if (quantityInBaseUnit >= derived.threshold && derived.conversionFactor > 0) {
        const convertedQuantity = quantityInBaseUnit / derived.conversionFactor;
        
        let displayQtyStr: string;
        if (Number.isInteger(convertedQuantity)) {
          displayQtyStr = convertedQuantity.toString();
        } else {
          // Format to a reasonable number of decimal places (e.g., 3), 
          // then convert back to a number to automatically remove trailing zeros,
          // and finally convert to a string for display.
          displayQtyStr = Number(convertedQuantity.toFixed(3)).toString();
        }
        return { displayQuantity: displayQtyStr, displayUnit: derived.name };
      }
    }
  }
  // If no derived unit threshold is met or no derived units, use base unit
  return { displayQuantity: quantityInBaseUnit.toString(), displayUnit: baseUnit };
}
