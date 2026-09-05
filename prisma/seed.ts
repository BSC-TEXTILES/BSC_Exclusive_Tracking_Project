import { PrismaClient } from '@prisma/client'
import bcryptjs from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // ============================================================
  // 1. ROLES
  // ============================================================
  console.log('Creating roles...')
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN', description: 'System administrator with full access' },
  })

  const userRole = await prisma.role.upsert({
    where: { name: 'USER' },
    update: {},
    create: { name: 'USER', description: 'Normal employee user' },
  })

  await prisma.role.upsert({
    where: { name: 'MANAGER' },
    update: {},
    create: { name: 'MANAGER', description: 'Department manager with review access' },
  })

  await prisma.role.upsert({
    where: { name: 'SUPERVISOR' },
    update: {},
    create: { name: 'SUPERVISOR', description: 'Supervisor with limited review access' },
  })

  await prisma.role.upsert({
    where: { name: 'AUDITOR' },
    update: {},
    create: { name: 'AUDITOR', description: 'Auditor with read-only access to all data' },
  })

  await prisma.role.upsert({
    where: { name: 'VIEWER' },
    update: {},
    create: { name: 'VIEWER', description: 'Read-only access to own data' },
  })

  // Fetch all roles for permission mapping
  const allRoles = await prisma.role.findMany()
  const roleMap = Object.fromEntries(allRoles.map(r => [r.name, r.id]))

  // ============================================================
  // 1.5. PERMISSIONS
  // ============================================================
  console.log('Creating permissions...')
  const { PERMISSIONS, ROLE_PERMISSIONS } = await import('../lib/permissions/constants')
  
  for (const [key, value] of Object.entries(PERMISSIONS)) {
    const category = key.split('_')[0].toLowerCase()
    const description = `Allows ${key.replace(/_/g, ' ').toLowerCase()}`
    
    await prisma.permission.upsert({
      where: { name: value },
      update: {},
      create: { name: value, description, category },
    })
  }

  const allDbPermissions = await prisma.permission.findMany()
  const permissionMap = Object.fromEntries(allDbPermissions.map(p => [p.name, p.id]))

  // ============================================================
  // 1.6. ROLE PERMISSIONS
  // ============================================================
  console.log('Mapping role permissions...')
  
  for (const [roleName, permissionNames] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap[roleName]
    if (!roleId) continue

    for (const permName of permissionNames) {
      const permissionId = permissionMap[permName]
      if (!permissionId) continue

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          }
        },
        update: {},
        create: {
          roleId,
          permissionId,
        },
      })
    }
  }

  // ============================================================
  // 2. ADMIN USER
  // ============================================================
  console.log('Creating admin user...')
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Admin@123456'
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@bscexclusive.com'
  const adminUsername = process.env.INITIAL_ADMIN_USERNAME || 'admin'
  const hashedPassword = await bcryptjs.hash(adminPassword, 12)

  await prisma.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      employeeCode: 'ADM001',
      fullName: 'System Administrator',
      email: adminEmail,
      username: adminUsername,
      passwordHash: hashedPassword,
      roleId: adminRole.id,
      status: 'ACTIVE',
      mustChangePassword: false,
    },
  })

  // ============================================================
  // 3. DEPARTMENTS
  // ============================================================
  console.log('Creating departments...')
  const departments = [
    { name: 'CRM', code: 'CRM', description: 'Customer Relationship Management' },
    { name: 'Warehouse & Purchase', code: 'WHP', description: 'Warehouse and Purchasing Operations' },
    { name: 'Sales', code: 'SALES', description: 'Sales Department' },
    { name: 'HR', code: 'HR', description: 'Human Resources' },
    { name: 'Accounts', code: 'ACCT', description: 'Accounts and Finance' },
    { name: 'Database', code: 'DB', description: 'Database Management' },
  ]

  const createdDepartments: Record<string, string> = {}
  for (const dept of departments) {
    const created = await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: dept,
    })
    createdDepartments[dept.code] = created.id
  }

  // ============================================================
  // 4. MODULES (one per department for this application)
  // ============================================================
  console.log('Creating modules...')
  const modules = [
    { name: 'CRM', slug: 'crm', departmentId: createdDepartments['CRM'], displayOrder: 1 },
    { name: 'Warehouse & Purchase', slug: 'warehouse-purchase', departmentId: createdDepartments['WHP'], displayOrder: 2 },
    { name: 'Sales', slug: 'sales', departmentId: createdDepartments['SALES'], displayOrder: 3 },
    { name: 'HR', slug: 'hr', departmentId: createdDepartments['HR'], displayOrder: 4 },
    { name: 'Accounts', slug: 'accounts', departmentId: createdDepartments['ACCT'], displayOrder: 5 },
    { name: 'Database', slug: 'database', departmentId: createdDepartments['DB'], displayOrder: 6 },
  ]

  const createdModules: Record<string, string> = {}
  for (const mod of modules) {
    const created = await prisma.module.upsert({
      where: { slug: mod.slug },
      update: {},
      create: mod,
    })
    createdModules[mod.slug] = created.id
  }

  // ============================================================
  // 5. CHECKPOINTS
  // ============================================================
  console.log('Creating checkpoints...')

  // CRM Checkpoints (7)
  const crmCheckpoints = [
    { title: 'Ensure the footfall data was collected on the regular basis and updated in the app on timely basis', score: 5, displayOrder: 1 },
    { title: 'Ensure that the divert was properly collected through the app', score: 5, displayOrder: 2 },
    { title: 'Ensure that the feedback was collected', score: 5, displayOrder: 3 },
    { title: 'Ensure that proper actions were taken based on the negative feedback', score: 5, displayOrder: 4 },
    { title: 'Ensure that the DER was shared in the WhatsApp group', score: 5, displayOrder: 5 },
    { title: 'VM Checklist', score: 5, displayOrder: 6 },
    { title: 'Daily 10 minutes CRM meeting', score: 5, displayOrder: 7 },
  ]

  for (const cp of crmCheckpoints) {
    await prisma.checkpoint.upsert({
      where: {
        id: `crm-cp-${cp.displayOrder}`, // Use a deterministic ID for upsert
      },
      update: {},
      create: {
        id: `crm-cp-${cp.displayOrder}`,
        moduleId: createdModules['crm'],
        title: cp.title,
        score: cp.score,
        displayOrder: cp.displayOrder,
        isAccuracyRequired: true,
        isCorrectiveActionRequired: true,
      },
    })
  }

  // Warehouse & Purchase Checkpoints (9)
  const warehouseCheckpoints = [
    { title: 'Verify all incoming goods match purchase orders', score: 5, displayOrder: 1 },
    { title: 'Ensure proper storage conditions are maintained', score: 5, displayOrder: 2 },
    { title: 'Check inventory levels against minimum stock requirements', score: 5, displayOrder: 3 },
    { title: 'Verify all purchase requisitions are properly approved', score: 5, displayOrder: 4 },
    { title: 'Ensure FIFO (First In First Out) is followed for perishable items', score: 5, displayOrder: 5 },
    { title: 'Check warehouse cleanliness and organization', score: 5, displayOrder: 6 },
    { title: 'Verify goods return notes are properly documented', score: 5, displayOrder: 7 },
    { title: 'Ensure vendor delivery schedules are maintained', score: 5, displayOrder: 8 },
    { title: 'Daily stock reconciliation completed', score: 5, displayOrder: 9 },
  ]

  for (const cp of warehouseCheckpoints) {
    await prisma.checkpoint.upsert({
      where: { id: `whp-cp-${cp.displayOrder}` },
      update: {},
      create: {
        id: `whp-cp-${cp.displayOrder}`,
        moduleId: createdModules['warehouse-purchase'],
        title: cp.title,
        score: cp.score,
        displayOrder: cp.displayOrder,
        isAccuracyRequired: true,
      },
    })
  }

  // Sales Checkpoints (9)
  const salesCheckpoints = [
    { title: 'Daily sales target review and tracking', score: 5, displayOrder: 1 },
    { title: 'Customer follow-up calls completed', score: 5, displayOrder: 2 },
    { title: 'New lead generation activities performed', score: 5, displayOrder: 3 },
    { title: 'Sales pipeline updated in CRM', score: 5, displayOrder: 4 },
    { title: 'Quotations sent within SLA timeframe', score: 5, displayOrder: 5 },
    { title: 'Customer complaints addressed within 24 hours', score: 5, displayOrder: 6 },
    { title: 'Sales team briefing completed', score: 5, displayOrder: 7 },
    { title: 'Competitor pricing analysis updated', score: 5, displayOrder: 8 },
    { title: 'Customer visit reports submitted', score: 5, displayOrder: 9 },
  ]

  for (const cp of salesCheckpoints) {
    await prisma.checkpoint.upsert({
      where: { id: `sales-cp-${cp.displayOrder}` },
      update: {},
      create: {
        id: `sales-cp-${cp.displayOrder}`,
        moduleId: createdModules['sales'],
        title: cp.title,
        score: cp.score,
        displayOrder: cp.displayOrder,
      },
    })
  }

  // HR Checkpoints (12)
  const hrCheckpoints = [
    { title: 'Attendance tracking completed for all employees', score: 5, displayOrder: 1 },
    { title: 'Leave applications processed within SLA', score: 5, displayOrder: 2 },
    { title: 'New joiner onboarding checklist completed', score: 5, displayOrder: 3 },
    { title: 'Employee grievances addressed', score: 5, displayOrder: 4 },
    { title: 'Training schedule reviewed and updated', score: 5, displayOrder: 5 },
    { title: 'Performance review meetings scheduled', score: 5, displayOrder: 6 },
    { title: 'Payroll inputs verified', score: 5, displayOrder: 7 },
    { title: 'Compliance documents up to date', score: 5, displayOrder: 8 },
    { title: 'Safety briefing conducted', score: 5, displayOrder: 9 },
    { title: 'Employee engagement activity planned', score: 5, displayOrder: 10 },
    { title: 'Exit interviews completed for departing employees', score: 5, displayOrder: 11 },
    { title: 'HR daily report submitted', score: 5, displayOrder: 12 },
  ]

  for (const cp of hrCheckpoints) {
    await prisma.checkpoint.upsert({
      where: { id: `hr-cp-${cp.displayOrder}` },
      update: {},
      create: {
        id: `hr-cp-${cp.displayOrder}`,
        moduleId: createdModules['hr'],
        title: cp.title,
        score: cp.score,
        displayOrder: cp.displayOrder,
      },
    })
  }

  // Accounts Checkpoints (1)
  await prisma.checkpoint.upsert({
    where: { id: 'acct-cp-1' },
    update: {},
    create: {
      id: 'acct-cp-1',
      moduleId: createdModules['accounts'],
      title: 'Daily cash reconciliation and bank statement verification',
      score: 5,
      displayOrder: 1,
      isAccuracyRequired: true,
      isPhotoRequired: true,
    },
  })

  // Database Checkpoints (2)
  const dbCheckpoints = [
    { title: 'Database backup verification completed', score: 5, displayOrder: 1 },
    { title: 'Data integrity checks performed', score: 5, displayOrder: 2 },
  ]

  for (const cp of dbCheckpoints) {
    await prisma.checkpoint.upsert({
      where: { id: `db-cp-${cp.displayOrder}` },
      update: {},
      create: {
        id: `db-cp-${cp.displayOrder}`,
        moduleId: createdModules['database'],
        title: cp.title,
        score: cp.score,
        displayOrder: cp.displayOrder,
      },
    })
  }

  // ============================================================
  // 6. SAMPLE NORMAL USER
  // ============================================================
  console.log('Creating sample user...')
  const samplePassword = await bcryptjs.hash('User@123456', 12)
  const sampleUser = await prisma.user.upsert({
    where: { username: 'john.doe' },
    update: {},
    create: {
      employeeCode: 'EMP001',
      fullName: 'John Doe',
      email: 'john.doe@bscexclusive.com',
      username: 'john.doe',
      passwordHash: samplePassword,
      roleId: userRole.id,
      departmentId: createdDepartments['CRM'],
      status: 'ACTIVE',
      mustChangePassword: false,
    },
  })

  // ============================================================
  // 7. SAMPLE ASSIGNMENTS (for today)
  // ============================================================
  console.log('Creating sample assignments...')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get all active checkpoints
  const allCheckpoints = await prisma.checkpoint.findMany({
    where: { status: 'ACTIVE' },
  })

  // Assign all checkpoints to the sample user for today
  for (const cp of allCheckpoints) {
    await prisma.checkpointAssignment.upsert({
      where: {
        userId_checkpointId_assignedDate: {
          userId: sampleUser.id,
          checkpointId: cp.id,
          assignedDate: today,
        },
      },
      update: {},
      create: {
        checkpointId: cp.id,
        userId: sampleUser.id,
        assignedDate: today,
        frequency: 'DAILY',
      },
    })
  }

  // ============================================================
  // 8. LOCATIONS
  // ============================================================
  console.log('Creating locations...')
  await prisma.location.upsert({
    where: { code: 'HQ' },
    update: {},
    create: { name: 'Head Office', code: 'HQ', address: 'Main Office Location' },
  })

  await prisma.location.upsert({
    where: { code: 'BR1' },
    update: {},
    create: { name: 'Branch 1', code: 'BR1', address: 'Branch Office 1' },
  })

  // ============================================================
  // 9. SYSTEM SETTINGS
  // ============================================================
  console.log('Creating system settings...')
  const settings = [
    { key: 'app_name', value: 'BSC Exclusive', type: 'string', category: 'general' },
    { key: 'app_timezone', value: 'Asia/Kolkata', type: 'string', category: 'general' },
    { key: 'max_file_size_mb', value: '10', type: 'number', category: 'uploads' },
    { key: 'allowed_file_types', value: 'image/jpeg,image/png,image/webp', type: 'string', category: 'uploads' },
    { key: 'compliance_score_fully_followed', value: '100', type: 'number', category: 'scoring' },
    { key: 'compliance_score_partially_followed', value: '50', type: 'number', category: 'scoring' },
    { key: 'compliance_score_not_followed', value: '0', type: 'number', category: 'scoring' },
    { key: 'compliance_score_yet_to_implement', value: '0', type: 'number', category: 'scoring' },
    { key: 'accuracy_score_fully_accurate', value: '100', type: 'number', category: 'scoring' },
    { key: 'accuracy_score_partly_accurate', value: '50', type: 'number', category: 'scoring' },
    { key: 'accuracy_score_inaccurate', value: '0', type: 'number', category: 'scoring' },
    { key: 'autosave_debounce_ms', value: '1000', type: 'number', category: 'general' },
  ]

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    })
  }

  console.log('✅ Seed completed successfully!')
  console.log('')
  console.log('📋 Admin credentials:')
  console.log(`   Username: ${adminUsername}`)
  console.log(`   Password: ${adminPassword}`)
  console.log('')
  console.log('📋 Sample user credentials:')
  console.log('   Username: john.doe')
  console.log('   Password: User@123456')
  console.log('')
  console.log(`📊 Created ${allCheckpoints.length} checkpoints across 6 modules`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
