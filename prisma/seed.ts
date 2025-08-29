
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log(`[SEED] Starting the seeding process...`);

  // 1. Upsert Admin Role & User
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: {
      name: 'Admin',
      description: 'Administrator with full access.',
    },
  });
  console.log(`[SEED] ✅ 'Admin' role is available.`);

  let adminUser = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!adminUser) {
    const passwordHash = await bcrypt.hash('admin', 10);
    adminUser = await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash,
        roleId: adminRole.id,
        isActive: true,
      },
    });
    console.log(`[SEED] ✅ Created 'admin' user.`);
  } else {
    console.log(`[SEED] ✅ 'admin' user already exists.`);
  }
  
  const adminUserId = adminUser.id;

  // 2. Upsert Sample Customer
  await prisma.party.upsert({
    where: { name: "Saman Kumara" },
    update: {},
    create: {
      name: "Saman Kumara",
      phone: "0771234567",
      email: "saman@example.com",
      address: "123, Main Street, Galle",
      type: "CUSTOMER",
      isActive: true,
      createdByUserId: adminUserId,
      updatedByUserId: adminUserId,
    },
  });
  console.log(`[SEED] ✅ Upserted sample customer 'Saman Kumara'.`);

  // 3. Upsert Sample Supplier
  await prisma.party.upsert({
    where: { name: "Wijesinghe Wholesalers" },
    update: {},
    create: {
      name: "Wijesinghe Wholesalers",
      phone: "0112987654",
      email: "orders@wijesinghe.com",
      address: "45, Wholesale Market, Colombo 11",
      type: "SUPPLIER",
      isActive: true,
      createdByUserId: adminUserId,
      updatedByUserId: adminUserId,
    },
  });
  console.log(`[SEED] ✅ Upserted sample supplier 'Wijesinghe Wholesalers'.`);

  // 4. Upsert Sample Products
  const product1 = await prisma.product.upsert({
    where: { name: "Sunlight Soap" },
    update: {},
    create: {
      name: 'Sunlight Soap',
      code: 'PROD-001',
      category: 'Toiletries',
      barcode: '9780201379624',
      units: {
        baseUnit: 'pcs',
        derivedUnits: [
            { name: 'Pack', conversionFactor: 4, threshold: 4 }
        ],
      } as Prisma.JsonObject,
      sellingPrice: 80.00,
      costPrice: 65.00,
      stock: 100,
      defaultQuantity: 1,
      isActive: true,
      isService: false,
      description: 'Yellow Sunlight Soap Bar 110g',
      createdByUserId: adminUserId,
      updatedByUserId: adminUserId,
    },
  });
  console.log(`[SEED] ✅ Upserted sample product 'Sunlight Soap'.`);

  const product2 = await prisma.product.upsert({
    where: { name: "Signal Toothpaste" },
    update: {},
    create: {
      name: 'Signal Toothpaste',
      code: 'PROD-002',
      category: 'Oral Care',
      barcode: '9780201379625',
      units: {
        baseUnit: 'pcs',
        derivedUnits: [],
      } as Prisma.JsonObject,
      sellingPrice: 150.00,
      costPrice: 120.00,
      stock: 50,
      defaultQuantity: 1,
      isActive: true,
      isService: false,
      description: 'Signal Herbal Toothpaste 120g',
      createdByUserId: adminUserId,
      updatedByUserId: adminUserId,
    },
  });
  console.log(`[SEED] ✅ Upserted sample product 'Signal Toothpaste'.`);
  
  // 5. Upsert Sample Discount Campaign
  await prisma.discountSet.upsert({
    where: { name: "New Year Sale" },
    update: {
      // You can define what to update if it already exists.
      // For now, we'll just ensure it exists.
    },
    create: {
      name: "New Year Sale",
      isActive: true,
      isDefault: true,
      isOneTimePerTransaction: false,
      // Default rule for any item worth over Rs. 1000
      defaultLineItemValueRuleJson: {
        isEnabled: true,
        name: "10% off on items over Rs.1000",
        type: "percentage",
        value: 10,
        conditionMin: 1000,
        conditionMax: null,
        applyFixedOnce: false,
      } as Prisma.JsonObject,
      // Global cart rule for bills over Rs. 5000
      globalCartPriceRuleJson: {
        isEnabled: true,
        name: "Flat Rs.250 off on bills over Rs.5000",
        type: "fixed",
        value: 250,
        conditionMin: 5000,
        conditionMax: null,
        applyFixedOnce: true,
      } as Prisma.JsonObject,
      // "Buy 2 Get 1 Free" for Sunlight Soap
      buyGetRulesJson: [
        {
          buyProductId: product1.id, // Sunlight Soap ID
          buyQuantity: 2,
          getProductId: product1.id, // Sunlight Soap ID
          getQuantity: 1,
          discountType: 'percentage', // Get 100% off on the 'get' item
          discountValue: 100,
          isRepeatable: true,
        }
      ] as Prisma.JsonArray,
      // Product-specific configuration for Signal
      productConfigurations: {
        create: [
          {
            productId: product2.id,
            productNameAtConfiguration: product2.name,
            isActiveForProductInCampaign: true,
            // Rule: Buy 3 or more Signal, get a fixed Rs. 5 off each
            lineItemQuantityRuleJson: {
              isEnabled: true,
              name: "Signal Bulk Discount",
              type: "fixed",
              value: 5, // Rs. 5 off
              conditionMin: 3, // for 3 or more
              conditionMax: null,
              applyFixedOnce: false, // Apply per unit
            } as Prisma.JsonObject
          }
        ]
      },
      createdByUserId: adminUserId,
      updatedByUserId: adminUserId,
    }
  });
  console.log(`[SEED] ✅ Upserted sample discount campaign 'New Year Sale'.`);
  
  console.log('[SEED] Seeding finished successfully.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('[SEED] An error occurred during seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
