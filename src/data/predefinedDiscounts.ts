
import type { DiscountSet } from '@/types';

// This file provides the initial state for discount sets in the Redux store.
// With the new system, discount sets are fetched from the database.
// An empty array is appropriate here, as the store will be populated from server data.
export const initialDiscountSets: DiscountSet[] = [];
