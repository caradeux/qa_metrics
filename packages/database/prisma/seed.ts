import "dotenv/config";

// Proteccion contra ejecucion accidental en produccion
if (process.env.NODE_ENV === "production") {
  console.error("SEED BLOQUEADO: No se puede ejecutar el seed en produccion.");
  console.error("Si realmente necesitas seedear produccion, usa: NODE_ENV=seed npx prisma db seed");
  process.exit(1);
}

import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { addDays, startOfWeek, subWeeks } from "date-fns";
import { HOLIDAYS_CL_2026 } from "../src/holidays-cl-2026.ts";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function encrypt(text: string): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY no configurada");
  const keyHash = crypto.createHash("sha256").update(key).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyHash, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

// Idempotent helpers
async function upsertRole(name: string, description: string) {
  return prisma.role.upsert({
    where: { name },
    update: { description },
    create: { name, description, isSystem: true },
  });
}

async function upsertPermission(resource: string, action: string) {
  return prisma.permission.upsert({
    where: { resource_action: { resource, action } },
    update: {},
    create: { resource, action },
  });
}

async function linkRolePermission(roleId: string, permissionId: string) {
  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId, permissionId } },
    update: {},
    create: { roleId, permissionId },
  });
}

async function main() {
  // NOTA: este seed es idempotente. NO borra data existente.

  // Feriados CL 2026
  await prisma.holiday.createMany({
    data: HOLIDAYS_CL_2026.map((h) => ({ date: new Date(h.date), name: h.name })),
    skipDuplicates: true,
  });
  console.log("✓ Feriados CL 2026 asegurados");

  // Categorías de actividad por defecto
  const defaultCategories = [
    { name: "Reunión con usuario", color: "#2E5FA3" },
    { name: "Reunión con desarrollo", color: "#1F3864" },
    { name: "Capacitación", color: "#6FAB3F" },
    { name: "Inducción", color: "#D89A1F" },
  ];
  for (const c of defaultCategories) {
    await prisma.activityCategory.upsert({
      where: { name: c.name },
      update: { color: c.color, active: true },
      create: { name: c.name, color: c.color, active: true },
    });
  }
  console.log("✓ Categorías de actividad aseguradas");

  // Roles
  const adminRole = await upsertRole("ADMIN", "Administrator with full access");
  const qaLeadRole = await upsertRole("QA_LEAD", "QA Lead with project management access");
  const qaAnalystRole = await upsertRole("QA_ANALYST", "QA Analyst with read and execute access");
  const clientPmRole = await upsertRole("CLIENT_PM", "Jefe de Proyecto del Cliente (solo lectura de proyectos asignados)");

  // Permissions
  const resources = [
    "users", "roles", "clients", "projects",
    "stories", "story-status", "cycles", "testers",
    "assignments", "phases",
    "records",
    "activities",
    "activity-categories",
    "dashboard", "gantt", "reports",
    "audit",
    "holidays",
  ];
  const actions = ["create", "read", "update", "delete"];
  const permissions: Record<string, { id: string }> = {};
  for (const resource of resources) {
    for (const action of actions) {
      const perm = await upsertPermission(resource, action);
      permissions[`${resource}:${action}`] = perm;
    }
  }

  // Admin: todos los permisos
  for (const perm of Object.values(permissions)) {
    await linkRolePermission(adminRole.id, perm.id);
  }

  // QA_LEAD: todo menos gestionar users/roles (solo lectura)
  const leadResources = ["clients", "projects", "stories", "cycles", "testers", "assignments", "phases", "records", "activities", "activity-categories", "reports"];
  for (const resource of leadResources) {
    for (const action of actions) {
      await linkRolePermission(qaLeadRole.id, permissions[`${resource}:${action}`].id);
    }
  }
  await linkRolePermission(qaLeadRole.id, permissions["users:read"].id);
  await linkRolePermission(qaLeadRole.id, permissions["roles:read"].id);
  await linkRolePermission(qaLeadRole.id, permissions["dashboard:read"].id);
  await linkRolePermission(qaLeadRole.id, permissions["gantt:read"].id);
  await linkRolePermission(qaLeadRole.id, permissions["story-status:update"].id);
  await linkRolePermission(qaLeadRole.id, permissions["audit:read"].id);
  for (const action of actions) {
    await linkRolePermission(qaLeadRole.id, permissions[`holidays:${action}`].id);
  }

  // QA_ANALYST
  const analystReadResources = ["clients", "projects", "stories", "cycles", "testers", "assignments", "phases", "records", "dashboard", "gantt", "reports", "audit", "holidays"];
  for (const resource of analystReadResources) {
    await linkRolePermission(qaAnalystRole.id, permissions[`${resource}:read`].id);
  }
  for (const action of ["create", "update"] as const) {
    await linkRolePermission(qaAnalystRole.id, permissions[`records:${action}`].id);
    await linkRolePermission(qaAnalystRole.id, permissions[`assignments:${action}`].id);
    await linkRolePermission(qaAnalystRole.id, permissions[`phases:${action}`].id);
  }
  await linkRolePermission(qaAnalystRole.id, permissions["story-status:update"].id);
  // QA_ANALYST puede gestionar SUS propias actividades (scope por ruta)
  for (const action of actions) {
    await linkRolePermission(qaAnalystRole.id, permissions[`activities:${action}`].id);
  }
  // Pero las categorías solo las lee (las mutan ADMIN/QA_LEAD)
  await linkRolePermission(qaAnalystRole.id, permissions["activity-categories:read"].id);

  // CLIENT_PM: read-only
  const clientPmResources = ["clients", "projects", "stories", "cycles", "testers", "assignments", "phases", "records", "activities", "activity-categories", "dashboard", "gantt", "reports"];
  for (const resource of clientPmResources) {
    await linkRolePermission(clientPmRole.id, permissions[`${resource}:read`].id);
  }

  // Usuarios base (idempotente)
  const hashedPassword = await bcrypt.hash("QaMetrics2024!", 10);
  const passLead = await bcrypt.hash("Lead2024!", 10);
  const passAnalyst = await bcrypt.hash("Analyst2024!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@qametrics.com" },
    update: { roleId: adminRole.id, name: "Carlos Mendez" },
    create: { email: "admin@qametrics.com", password: hashedPassword, name: "Carlos Mendez", roleId: adminRole.id },
  });
  await prisma.user.upsert({
    where: { email: "laura.gomez@qametrics.com" },
    update: { roleId: qaLeadRole.id },
    create: { email: "laura.gomez@qametrics.com", password: passLead, name: "Laura Gomez", roleId: qaLeadRole.id },
  });
  await prisma.user.upsert({
    where: { email: "ana.garcia@qametrics.com" },
    update: { roleId: qaAnalystRole.id },
    create: { email: "ana.garcia@qametrics.com", password: passAnalyst, name: "Ana Garcia", roleId: qaAnalystRole.id },
  });
  await prisma.user.upsert({
    where: { email: "luis.torres@qametrics.com" },
    update: { roleId: qaAnalystRole.id },
    create: { email: "luis.torres@qametrics.com", password: passAnalyst, name: "Luis Torres", roleId: qaAnalystRole.id },
  });
  await prisma.user.upsert({
    where: { email: "pedro.sanchez@qametrics.com" },
    update: { roleId: qaAnalystRole.id, active: false },
    create: { email: "pedro.sanchez@qametrics.com", password: passAnalyst, name: "Pedro Sanchez", roleId: qaAnalystRole.id, active: false },
  });

  // Clientes y proyectos (findFirst + create)
  async function ensureClient(name: string) {
    const existing = await prisma.client.findFirst({ where: { name } });
    if (existing) return existing;
    return prisma.client.create({ data: { name, userId: admin.id } });
  }

  async function ensureProject(name: string, clientId: string, modality: "MANUAL" | "AZURE_DEVOPS", extra?: { adoOrgUrl?: string; adoProject?: string; adoToken?: string }) {
    const existing = await prisma.project.findFirst({ where: { name, clientId } });
    if (existing) return existing;
    return prisma.project.create({ data: { name, clientId, modality, ...extra } });
  }

  const client1 = await ensureClient("Banco Nacional");
  const project1 = await ensureProject("Core Bancario v3.0", client1.id, "MANUAL");

  async function ensureTester(name: string, projectId: string) {
    const existing = await prisma.tester.findFirst({ where: { name, projectId } });
    if (existing) return existing;
    return prisma.tester.create({ data: { name, projectId } });
  }

  const testers1 = await Promise.all(
    ["Ana Garcia", "Luis Torres", "Maria Rodriguez"].map((n) => ensureTester(n, project1.id))
  );

  // Historias (por proyecto) — el schema actual: UserStory.projectId + design/executionComplexity.
  async function ensureStory(title: string, projectId: string, complexity: "HIGH" | "MEDIUM" | "LOW") {
    const existing = await prisma.userStory.findFirst({ where: { title, projectId } });
    if (existing) return existing;
    return prisma.userStory.create({
      data: {
        title,
        projectId,
        designComplexity: complexity,
        executionComplexity: complexity,
      },
    });
  }

  const complexities = ["HIGH","HIGH","HIGH","HIGH","MEDIUM","MEDIUM","MEDIUM","MEDIUM","MEDIUM","LOW","LOW","LOW"] as const;
  const stories1 = [];
  for (let i = 0; i < 12; i++) {
    stories1.push(await ensureStory(`HU-${i+1}: Funcionalidad ${i+1} del Core Bancario`, project1.id, complexities[i]));
  }
  const stories2 = [];
  for (let i = 0; i < 8; i++) {
    stories2.push(await ensureStory(`HU-${i+13}: Mejora ${i+1} del Core Bancario`, project1.id, complexities[i % complexities.length]));
  }

  // TestCycles: ahora cuelgan de UserStory (storyId). Creamos un ciclo por HU.
  async function ensureCycle(name: string, storyId: string, startDate: Date, endDate: Date) {
    const existing = await prisma.testCycle.findFirst({ where: { name, storyId } });
    if (existing) return existing;
    return prisma.testCycle.create({ data: { name, storyId, startDate, endDate } });
  }

  const cyclesByStory = new Map<string, { id: string }>();
  for (const s of stories1) {
    const c = await ensureCycle("Sprint 1-4", s.id, new Date("2026-01-05"), new Date("2026-02-27"));
    cyclesByStory.set(s.id, c);
  }
  for (const s of stories2) {
    const c = await ensureCycle("Sprint 5-8", s.id, new Date("2026-03-02"), new Date("2026-04-24"));
    cyclesByStory.set(s.id, c);
  }

  // Cliente 2
  const client2 = await ensureClient("Seguros Continental");
  const project2 = await ensureProject("Portal Asegurados", client2.id, "MANUAL");
  const testers2 = await Promise.all(
    ["Pedro Sanchez", "Carolina Diaz"].map((n) => ensureTester(n, project2.id))
  );

  const complexities2 = ["HIGH","HIGH","MEDIUM","MEDIUM","MEDIUM","MEDIUM","LOW","LOW"] as const;
  const storiesP2: { id: string; projectId: string }[] = [];
  for (let i = 0; i < 8; i++) {
    const s = await ensureStory(`HU-PA-${i+1}: Funcionalidad ${i+1} del Portal`, project2.id, complexities2[i]);
    storiesP2.push(s);
    const c = await ensureCycle("Fase Inicial", s.id, new Date("2026-02-02"), new Date("2026-03-13"));
    cyclesByStory.set(s.id, c);
  }

  await ensureProject("App Movil Siniestros", client2.id, "AZURE_DEVOPS", {
    adoOrgUrl: "https://dev.azure.com/seguros-continental",
    adoProject: "siniestros-app",
    adoToken: encrypt("dummy-pat-token-for-testing"),
  });

  // Vincular primeros 2 testers a users con rol QA_ANALYST (idempotente)
  const tester1User = await prisma.user.upsert({
    where: { email: "tester1@qametrics.com" },
    update: { roleId: qaAnalystRole.id },
    create: { email: "tester1@qametrics.com", name: "Tester Uno", password: hashedPassword, roleId: qaAnalystRole.id },
  });
  await prisma.tester.update({ where: { id: testers1[0].id }, data: { userId: tester1User.id } });
  const tester2User = await prisma.user.upsert({
    where: { email: "tester2@qametrics.com" },
    update: { roleId: qaAnalystRole.id },
    create: { email: "tester2@qametrics.com", name: "Tester Dos", password: hashedPassword, roleId: qaAnalystRole.id },
  });
  await prisma.tester.update({ where: { id: testers1[1].id }, data: { userId: tester2User.id } });

  // Asignaciones realistas — DailyRecord ahora lleva assignmentId + testerId + date
  async function ensureAssignment(data: {
    testerId: string;
    storyId: string;
    cycleId: string;
    startDate: Date;
    endDate?: Date | null;
    status: "REGISTERED" | "ANALYSIS" | "TEST_DESIGN" | "WAITING_QA_DEPLOY" | "EXECUTION" | "RETURNED_TO_DEV" | "WAITING_UAT" | "UAT" | "PRODUCTION";
    notes?: string;
  }) {
    const existing = await prisma.testerAssignment.findUnique({
      where: {
        testerId_storyId_cycleId: { testerId: data.testerId, storyId: data.storyId, cycleId: data.cycleId },
      },
    });
    if (existing) return existing;
    const a = await prisma.testerAssignment.create({ data });
    await prisma.assignmentStatusLog.create({ data: { assignmentId: a.id, status: data.status } });
    return a;
  }

  // Flujo variado de estados
  const assignmentsSpec = [
    { t: testers1[0], s: stories1[0], status: "PRODUCTION" as const, start: "2026-01-05", end: "2026-01-23", notes: "Desplegado en produccion sin incidentes" },
    { t: testers1[0], s: stories1[1], status: "PRODUCTION" as const, start: "2026-01-10", end: "2026-02-05" },
    { t: testers1[0], s: stories2[0], status: "EXECUTION" as const, start: "2026-03-02", end: "2026-04-10" },
    { t: testers1[0], s: stories2[1], status: "TEST_DESIGN" as const, start: "2026-03-16", end: "2026-04-17" },
    { t: testers1[1], s: stories1[3], status: "PRODUCTION" as const, start: "2026-01-15", end: "2026-02-10" },
    { t: testers1[1], s: stories2[2], status: "EXECUTION" as const, start: "2026-03-02", end: "2026-04-08" },
    { t: testers1[1], s: stories2[3], status: "RETURNED_TO_DEV" as const, start: "2026-03-10", end: "2026-04-20", notes: "3 defectos criticos en regresion" },
    { t: testers1[1], s: stories2[4], status: "ANALYSIS" as const, start: "2026-04-01", end: "2026-04-25" },
    { t: testers1[2], s: stories1[2], status: "PRODUCTION" as const, start: "2026-01-12", end: "2026-02-14" },
    { t: testers1[2], s: stories2[5], status: "UAT" as const, start: "2026-03-05", end: "2026-04-12", notes: "En revision por el cliente" },
    { t: testers1[2], s: stories2[6], status: "WAITING_UAT" as const, start: "2026-03-20", end: "2026-04-18" },
  ];

  const createdAssignments: { testerId: string; id: string }[] = [];
  for (const a of assignmentsSpec) {
    const cycle = cyclesByStory.get(a.s.id);
    if (!cycle) continue;
    const res = await ensureAssignment({
      testerId: a.t.id,
      storyId: a.s.id,
      cycleId: cycle.id,
      startDate: new Date(a.start),
      endDate: new Date(a.end),
      status: a.status,
      notes: a.notes,
    });
    createdAssignments.push({ testerId: a.t.id, id: res.id });
  }

  if (storiesP2[0]) {
    const cyc = cyclesByStory.get(storiesP2[0].id)!;
    await ensureAssignment({ testerId: testers2[0].id, storyId: storiesP2[0].id, cycleId: cyc.id, startDate: new Date("2026-02-02"), endDate: new Date("2026-04-15"), status: "EXECUTION" });
  }
  if (storiesP2[1]) {
    const cyc = cyclesByStory.get(storiesP2[1].id)!;
    await ensureAssignment({ testerId: testers2[0].id, storyId: storiesP2[1].id, cycleId: cyc.id, startDate: new Date("2026-04-01"), endDate: new Date("2026-04-30"), status: "REGISTERED" });
  }
  if (storiesP2[2]) {
    const cyc = cyclesByStory.get(storiesP2[2].id)!;
    await ensureAssignment({ testerId: testers2[1].id, storyId: storiesP2[2].id, cycleId: cyc.id, startDate: new Date("2026-02-02"), endDate: new Date("2026-03-10"), status: "PRODUCTION" });
  }
  if (storiesP2[3]) {
    const cyc = cyclesByStory.get(storiesP2[3].id)!;
    await ensureAssignment({ testerId: testers2[1].id, storyId: storiesP2[3].id, cycleId: cyc.id, startDate: new Date("2026-04-10"), endDate: new Date("2026-05-05"), status: "ANALYSIS", notes: "Pendiente liberacion de recurso en abril" });
  }

  // DailyRecords: para los 2 primeros testers, ultimas 5 semanas L-V — por asignacion existente
  const today = new Date();
  for (const tester of [testers1[0], testers1[1]]) {
    const mine = createdAssignments.filter((a) => a.testerId === tester.id);
    if (mine.length === 0) continue;
    for (let w = 4; w >= 0; w--) {
      const monday = startOfWeek(subWeeks(today, w), { weekStartsOn: 1 });
      for (let d = 0; d < 5; d++) {
        const date = addDays(monday, d);
        const assignment = mine[(w + d) % mine.length]!;
        await prisma.dailyRecord.upsert({
          where: { assignmentId_date: { assignmentId: assignment.id, date } },
          update: {},
          create: {
            testerId: tester.id,
            assignmentId: assignment.id,
            date,
            designed: 2 + (d % 3),
            executed: 1 + (d % 4),
            defects: d === 2 ? 1 : 0,
          },
        });
      }
    }
  }

  console.log("Seed completado (idempotente):");
  console.log("- Feriados CL 2026 (skipDuplicates)");
  console.log("- 4 roles (ADMIN, QA_LEAD, QA_ANALYST, CLIENT_PM)");
  console.log("- Usuarios base incluidos admin@qametrics.com / QaMetrics2024!");
  console.log("- 2 clientes, 3 proyectos");
  console.log("- HUs con ciclos por HU (schema actual)");
  console.log("- Asignaciones + logs iniciales + DailyRecords recientes");
}

main()
  .catch((e: unknown) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
