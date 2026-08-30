import bcrypt from 'bcryptjs';
import { prisma } from './index';

async function seed() {
  console.log('[Seed] Starting database seeding...');

  // 1. Seed Roles
  const rolesData = [
    { id: 1, name: 'ADMIN', description: 'System Administrator with full permissions' },
    { id: 2, name: 'SHOPKEEPER', description: 'Counter staff for sales and draft creation' },
    { id: 3, name: 'ACCOUNTANT', description: 'Financial officer for ledger and payments oversight' },
    { id: 4, name: 'MANAGER', description: 'Store manager with inventory and reports access' },
  ];

  for (const r of rolesData) {
    await prisma.role.upsert({
      where: { id: r.id },
      update: { name: r.name, description: r.description },
      create: r,
    });
  }
  console.log('[Seed] Roles seeded successfully.');

  // 2. Seed Default Units
  const unitsData = [
    { name: 'Piece', shortCode: 'Pcs' },
    { name: 'Set', shortCode: 'Set' },
    { name: 'Litre', shortCode: 'Ltr' },
    { name: 'Kilogram', shortCode: 'Kg' },
    { name: 'Meter', shortCode: 'Mtr' },
  ];

  for (const u of unitsData) {
    await prisma.unit.upsert({
      where: { name: u.name },
      update: { shortCode: u.shortCode },
      create: u,
    });
  }
  console.log('[Seed] Units seeded successfully.');

  // 3. Seed Document Sequences
  const currentFY = '2026-2027';
  const docTypes = ['SALE', 'INVOICE', 'PAYMENT'];
  const prefixes: Record<string, string> = { SALE: 'SL', INVOICE: 'INV', PAYMENT: 'PAY' };

  for (const docType of docTypes) {
    await prisma.documentSequence.upsert({
      where: {
        doc_type_financial_year_unique: {
          docType,
          financialYear: currentFY,
        },
      },
      update: {},
      create: {
        docType,
        prefix: prefixes[docType],
        financialYear: currentFY,
        lastNumber: 0,
      },
    });
  }
  console.log('[Seed] Document sequences initialized.');

  // 4. Seed Super Admin User
  const adminEmail = 'admin@tractorerp.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('Admin@12345', 10);
    await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: adminEmail,
        phone: '9999999999',
        passwordHash,
        roleId: 1,
        status: 'ACTIVE',
      },
    });
    console.log('[Seed] Initial Admin user created: admin@tractorerp.com / Admin@12345');
  } else {
    console.log('[Seed] Admin user already exists.');
  }

  console.log('[Seed] Database seeding completed successfully.');
}

seed()
  .catch((err) => {
    console.error('[Seed Error]', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
