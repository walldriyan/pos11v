
// This file primarily handled client-side IndexedDB storage.
// With the migration of SaleRecords, DiscountSets, and TaxRate to
// server-side SQLite via Prisma, most of its original purpose is now covered
// by server actions.

// For now, keeping the file structure but commenting out or removing
// functions related to sales, discounts, and tax, as they are superseded.
// If other client-side storage needs arise, this file could be repurposed.

// const DB_NAME = 'AroniumPOSDB';
// const DB_VERSION = 3;
// const DISCOUNT_SETS_STORE_NAME = 'discountSets'; // Now in SQLite
// const CONFIG_STORE_NAME = 'appConfig'; // Now in SQLite (for taxRate)
// const SALES_HISTORY_STORE_NAME = 'salesHistory'; // Now in SQLite

// let dbPromise: Promise<IDBDatabase> | null = null;

/*
const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      // Object stores are now managed by Prisma migrations
      // if (!db.objectStoreNames.contains(DISCOUNT_SETS_STORE_NAME)) {
      //   db.createObjectStore(DISCOUNT_SETS_STORE_NAME, { keyPath: 'id' });
      // }
      // if (!db.objectStoreNames.contains(CONFIG_STORE_NAME)) {
      //   db.createObjectStore(CONFIG_STORE_NAME);
      // }
      // if (!db.objectStoreNames.contains(SALES_HISTORY_STORE_NAME)) {
      //   // ... index creation for salesHistory was here ...
      // }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
      dbPromise = null;
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
  return dbPromise;
};
*/

// Discount Sets Operations - MOVED TO SERVER ACTIONS
// export const saveDiscountSetToDB ...
// export const loadDiscountSetsFromDB ...
// export const deleteDiscountSetFromDB ...

// Tax Rate Operations - MOVED TO SERVER ACTIONS
// export const saveTaxRateToDB ...
// export const loadTaxRateFromDB ...

// Sales History Operations - MOVED TO SERVER ACTIONS
// export const saveSaleToDB ...
// export const getSaleByBillNumberFromDB ...
// export const getSalesByOriginalBillNumberFromDB ...
// export const updateSaleInDB ...
// export const getAllSalesFromDB ...

// If there are any other IndexedDB utilities unrelated to these, they can remain.
// For now, this file is largely empty. It can be deleted if no other client-side
// IndexedDB functionality is planned.
export {}; // Add an empty export to make it a module if no other exports remain.
