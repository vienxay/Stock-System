import { PrismaClient, RoleCode } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Roles
  await prisma.role.createMany({
    data: [
      { code: RoleCode.user,       nameLo: 'ຜູ້ໃຊ້ທົ່ວໄປ',    nameEn: 'General User' },
      { code: RoleCode.finance,    nameLo: 'ບັນຊີ',            nameEn: 'Finance' },
      { code: RoleCode.md,         nameLo: 'ຜູ້ອຳນວຍການ',      nameEn: 'Managing Director' },
      { code: RoleCode.stock,      nameLo: 'ຄັງສິນຄ້າ',        nameEn: 'Stock' },
      { code: RoleCode.purchasing, nameLo: 'ຝ່າຍຈັດຊື້',        nameEn: 'Purchasing' },
      { code: RoleCode.ap,         nameLo: 'ບັນຊີຈ່າຍ',         nameEn: 'Accounts Payable' },
      { code: RoleCode.admin,      nameLo: 'ຜູ້ດູແລລະບົບ',      nameEn: 'Admin' },
    ],
    skipDuplicates: true,
  });

  // Units
  await prisma.unit.createMany({
    data: [
      { code: 'pcs',   nameLo: 'ອັນ',    nameEn: 'Pieces' },
      { code: 'box',   nameLo: 'ກ່ອງ',   nameEn: 'Box' },
      { code: 'set',   nameLo: 'ຊຸດ',    nameEn: 'Set' },
      { code: 'kg',    nameLo: 'ກິໂລ',   nameEn: 'Kilogram' },
      { code: 'liter', nameLo: 'ລິດ',    nameEn: 'Liter' },
      { code: 'ream',  nameLo: 'ຣີມ',    nameEn: 'Ream' },
    ],
    skipDuplicates: true,
  });

  // Categories
  await prisma.category.createMany({
    data: [
      { code: 'OFFICE', nameLo: 'ອຸປະກອນຫ້ອງການ',         nameEn: 'Office Supplies' },
      { code: 'IT',     nameLo: 'ອຸປະກອນ IT',              nameEn: 'IT Equipment' },
      { code: 'CLEAN',  nameLo: 'ອຸປະກອນທຳຄວາມສະອາດ',     nameEn: 'Cleaning' },
      { code: 'SPARE',  nameLo: 'ອາໄຫຼ່',                   nameEn: 'Spare Parts' },
    ],
    skipDuplicates: true,
  });

  // ─── Suppliers ──────────────────────────────────────────────
  await prisma.supplier.createMany({
    data: [
      {
        code:        'SUP-001', name: 'ບໍລິສັດ ລາວ ໂອຟີສ ຊັບພ່າຍ ຈຳກັດ',
        taxId:       'LAO-001-2020', contactName: 'ທ. ສົມໃຈ',
        phone:       '021 234 567',  email: 'info@laoofficer.la',
        paymentTerm: 30,             isActive: true,
      },
      {
        code:        'SUP-002', name: 'ຫ້າງ IT World Lao',
        taxId:       'LAO-002-2021', contactName: 'ທ. ວິໄລ',
        phone:       '021 345 678',  email: 'it.world@lao.la',
        paymentTerm: 15,             isActive: true,
      },
      {
        code:        'SUP-003', name: 'ບໍລິສັດ ລາວ ຄລີນ ໂປຣ ຈຳກັດ',
        taxId:       'LAO-003-2022', contactName: 'ທ. ນາງສາ',
        phone:       '021 456 789',  email: 'cleanpro@lao.la',
        paymentTerm: 45,             isActive: true,
      },
      {
        code:        'SUP-004', name: 'ຮ້ານ ສະໜອງ ອາໄຫຼ່',
        taxId:       null,            contactName: 'ທ. ຄຳ',
        phone:       '020 555 1234', email: null,
        paymentTerm: 30,             isActive: true,
      },
    ],
    skipDuplicates: true,
  });

  // ─── Users ──────────────────────────────────────────────────
  const defaultPass = await bcrypt.hash('Admin@1234', 12);

  const seedUsers = [
    { code: RoleCode.admin,      username: 'admin',     fullName: 'System Administrator', email: 'admin@prpo.la',     department: 'IT' },
    { code: RoleCode.finance,    username: 'finance',   fullName: 'ພະນັກງານບັນຊີ',        email: 'finance@prpo.la',   department: 'ການເງິນ' },
    { code: RoleCode.md,         username: 'md',        fullName: 'ຜູ້ອຳນວຍການ',          email: 'md@prpo.la',        department: 'ບໍລິຫານ' },
    { code: RoleCode.stock,      username: 'stock',     fullName: 'ພະນັກງານຄັງສາງ',       email: 'stock@prpo.la',     department: 'ສາງ' },
    { code: RoleCode.purchasing, username: 'purchasing',fullName: 'ພະນັກງານຈັດຊື້',        email: 'purchasing@prpo.la',department: 'ຈັດຊື້' },
    { code: RoleCode.ap,         username: 'ap',        fullName: 'ພະນັກງານບັນຊີຈ່າຍ',    email: 'ap@prpo.la',        department: 'ການເງິນ' },
    { code: RoleCode.user,       username: 'user01',    fullName: 'ຜູ້ໃຊ້ທົ່ວໄປ',          email: 'user01@prpo.la',    department: 'ການຕະຫຼາດ' },
  ];

  for (const u of seedUsers) {
    const role = await prisma.role.findUnique({ where: { code: u.code } });
    if (!role) continue;
    await prisma.user.upsert({
      where:  { username: u.username },
      update: {},
      create: {
        roleId:     role.id,
        username:   u.username,
        password:   defaultPass,
        fullName:   u.fullName,
        email:      u.email,
        department: u.department,
        isActive:   true,
      },
    });
  }

  console.log('✅ Seed completed — ທຸກ user ໃຊ້ password: Admin@1234');
  console.log('');
  console.log('   username: admin      → Admin');
  console.log('   username: finance    → Finance');
  console.log('   username: md         → Managing Director');
  console.log('   username: stock      → Stock');
  console.log('   username: purchasing → Purchasing');
  console.log('   username: ap         → Accounts Payable');
  console.log('   username: user01     → General User');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());