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

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function generateWeeklyData(weekNum: number, testerIndex: number) {
  const baseDesigned = 12 + weekNum + testerIndex * 2;
  const functional = Math.round(baseDesigned * 0.6);
  const regression = Math.round(baseDesigned * 0.2);
  const smoke = Math.round(baseDesigned * 0.1);
  const exploratory = baseDesigned - functional - regression - smoke;

  const executionRate = 0.7 + weekNum * 0.03;
  const execFunctional = Math.round(functional * Math.min(executionRate, 1));
  const execRegression = Math.round(regression * Math.min(executionRate + 0.05, 1));
  const execSmoke = Math.round(smoke * Math.min(executionRate + 0.1, 1));
  const execExploratory = Math.round(exploratory * Math.min(executionRate, 1));

  const defectBase = Math.max(1, 8 - weekNum);
  const critical = weekNum <= 2 ? Math.max(0, 2 - weekNum) : 0;
  const high = Math.max(0, Math.round(defectBase * 0.3));
  const medium = Math.max(1, Math.round(defectBase * 0.4));
  const low = Math.max(1, Math.round(defectBase * 0.3));

  return {
    designedTotal: functional + regression + smoke + exploratory,
    designedFunctional: functional,
    designedRegression: regression,
    designedSmoke: smoke,
    designedExploratory: exploratory,
    executedTotal: execFunctional + execRegression + execSmoke + execExploratory,
    executedFunctional: execFunctional,
    executedRegression: execRegression,
    executedSmoke: execSmoke,
    executedExploratory: execExploratory,
    defectsCritical: critical,
    defectsHigh: high,
    defectsMedium: medium,
    defectsLow: low,
  };
}

async function main() {
  await prisma.testerAssignment.deleteMany();
  await prisma.weeklyRecord.deleteMany();
  await prisma.userStory.deleteMany();
  await prisma.tester.deleteMany();
  await prisma.testCycle.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();

  // Create roles
  const adminRole = await prisma.role.create({
    data: { name: "ADMIN", description: "Administrator with full access", isSystem: true },
  });
  const qaLeadRole = await prisma.role.create({
    data: { name: "QA_LEAD", description: "QA Lead with project management access", isSystem: true },
  });
  const qaAnalystRole = await prisma.role.create({
    data: { name: "QA_ANALYST", description: "QA Analyst with read and execute access", isSystem: true },
  });

  // Create permissions
  const resources = ["users", "roles", "clients", "projects", "cycles", "testers", "records", "assignments", "reports"];
  const actions = ["create", "read", "update", "delete"];
  const permissions: Record<string, { id: string }> = {};
  for (const resource of resources) {
    for (const action of actions) {
      const perm = await prisma.permission.create({ data: { resource, action } });
      permissions[`${resource}:${action}`] = perm;
    }
  }

  // Admin gets all permissions
  for (const perm of Object.values(permissions)) {
    await prisma.rolePermission.create({ data: { roleId: adminRole.id, permissionId: perm.id } });
  }

  // QA Lead gets most permissions except user/role management
  const leadResources = ["clients", "projects", "cycles", "testers", "records", "assignments", "reports"];
  for (const resource of leadResources) {
    for (const action of actions) {
      await prisma.rolePermission.create({ data: { roleId: qaLeadRole.id, permissionId: permissions[`${resource}:${action}`].id } });
    }
  }
  // Lead can read users and roles
  await prisma.rolePermission.create({ data: { roleId: qaLeadRole.id, permissionId: permissions["users:read"].id } });
  await prisma.rolePermission.create({ data: { roleId: qaLeadRole.id, permissionId: permissions["roles:read"].id } });

  // QA Analyst gets read access to most things, plus create/update on records and assignments
  const analystReadResources = ["clients", "projects", "cycles", "testers", "records", "assignments", "reports"];
  for (const resource of analystReadResources) {
    await prisma.rolePermission.create({ data: { roleId: qaAnalystRole.id, permissionId: permissions[`${resource}:read`].id } });
  }
  for (const action of ["create", "update"] as const) {
    await prisma.rolePermission.create({ data: { roleId: qaAnalystRole.id, permissionId: permissions[`records:${action}`].id } });
    await prisma.rolePermission.create({ data: { roleId: qaAnalystRole.id, permissionId: permissions[`assignments:${action}`].id } });
  }

  const hashedPassword = await bcrypt.hash("QaMetrics2024!", 10);
  const user = await prisma.user.create({
    data: { email: "admin@qametrics.com", password: hashedPassword, name: "Carlos Mendez", roleId: adminRole.id },
  });

  // Usuarios adicionales con distintos roles
  const passLead = await bcrypt.hash("Lead2024!", 10);
  const passAnalyst = await bcrypt.hash("Analyst2024!", 10);
  await prisma.user.create({ data: { email: "laura.gomez@qametrics.com", password: passLead, name: "Laura Gomez", roleId: qaLeadRole.id } });
  await prisma.user.create({ data: { email: "ana.garcia@qametrics.com", password: passAnalyst, name: "Ana Garcia", roleId: qaAnalystRole.id } });
  await prisma.user.create({ data: { email: "luis.torres@qametrics.com", password: passAnalyst, name: "Luis Torres", roleId: qaAnalystRole.id } });
  await prisma.user.create({ data: { email: "pedro.sanchez@qametrics.com", password: passAnalyst, name: "Pedro Sanchez", roleId: qaAnalystRole.id, active: false } });

  const client1 = await prisma.client.create({ data: { name: "Banco Nacional", userId: user.id } });

  const project1 = await prisma.project.create({
    data: { name: "Core Bancario v3.0", clientId: client1.id, modality: "MANUAL" },
  });

  const testers1 = await Promise.all(
    ["Ana Garcia", "Luis Torres", "Maria Rodriguez"].map((name) =>
      prisma.tester.create({ data: { name, projectId: project1.id } })
    )
  );

  const cycle1Start = new Date("2026-01-05");
  const cycle1 = await prisma.testCycle.create({
    data: { name: "Sprint 1-4", projectId: project1.id, startDate: cycle1Start, endDate: new Date("2026-02-27") },
  });

  const cycle2Start = new Date("2026-03-02");
  const cycle2 = await prisma.testCycle.create({
    data: { name: "Sprint 5-8", projectId: project1.id, startDate: cycle2Start, endDate: new Date("2026-04-24") },
  });

  const complexities = ["HIGH","HIGH","HIGH","HIGH","MEDIUM","MEDIUM","MEDIUM","MEDIUM","MEDIUM","LOW","LOW","LOW"] as const;
  const stories1 = [];
  for (let i = 0; i < 12; i++) {
    const s = await prisma.userStory.create({
      data: { title: `HU-${i+1}: Funcionalidad ${i+1} del Core Bancario`, complexity: complexities[i], cycleId: cycle1.id },
    });
    stories1.push(s);
  }
  const stories2 = [];
  for (let i = 0; i < 8; i++) {
    const s = await prisma.userStory.create({
      data: { title: `HU-${i+13}: Mejora ${i+1} del Core Bancario`, complexity: complexities[i % complexities.length], cycleId: cycle2.id },
    });
    stories2.push(s);
  }

  for (let week = 0; week < 8; week++) {
    const weekStart = getMonday(new Date(cycle1Start.getTime() + week * 7 * 24 * 60 * 60 * 1000));
    for (let t = 0; t < testers1.length; t++) {
      const data = generateWeeklyData(week, t);
      await prisma.weeklyRecord.create({ data: { testerId: testers1[t].id, cycleId: cycle1.id, weekStart, ...data, source: "MANUAL" } });
    }
  }

  for (let week = 0; week < 8; week++) {
    const weekStart = getMonday(new Date(cycle2Start.getTime() + week * 7 * 24 * 60 * 60 * 1000));
    for (let t = 0; t < testers1.length; t++) {
      const data = generateWeeklyData(week, t);
      await prisma.weeklyRecord.create({ data: { testerId: testers1[t].id, cycleId: cycle2.id, weekStart, ...data, source: "MANUAL" } });
    }
  }

  const client2 = await prisma.client.create({ data: { name: "Seguros Continental", userId: user.id } });

  const project2 = await prisma.project.create({
    data: { name: "Portal Asegurados", clientId: client2.id, modality: "MANUAL" },
  });

  const testers2 = await Promise.all(
    ["Pedro Sanchez", "Carolina Diaz"].map((name) =>
      prisma.tester.create({ data: { name, projectId: project2.id } })
    )
  );

  const cycle3Start = new Date("2026-02-02");
  const cycle3 = await prisma.testCycle.create({
    data: { name: "Fase Inicial", projectId: project2.id, startDate: cycle3Start, endDate: new Date("2026-03-13") },
  });

  const complexities2 = ["HIGH","HIGH","MEDIUM","MEDIUM","MEDIUM","MEDIUM","LOW","LOW"] as const;
  for (let i = 0; i < 8; i++) {
    await prisma.userStory.create({
      data: { title: `HU-PA-${i+1}: Funcionalidad ${i+1} del Portal`, complexity: complexities2[i], cycleId: cycle3.id },
    });
  }

  for (let week = 0; week < 6; week++) {
    const weekStart = getMonday(new Date(cycle3Start.getTime() + week * 7 * 24 * 60 * 60 * 1000));
    for (let t = 0; t < testers2.length; t++) {
      const data = generateWeeklyData(week, t);
      data.designedExploratory += 3;
      data.designedTotal = data.designedFunctional + data.designedRegression + data.designedSmoke + data.designedExploratory;
      data.executedExploratory += 2;
      data.executedTotal = data.executedFunctional + data.executedRegression + data.executedSmoke + data.executedExploratory;
      await prisma.weeklyRecord.create({ data: { testerId: testers2[t].id, cycleId: cycle3.id, weekStart, ...data, source: "MANUAL" } });
    }
  }

  await prisma.project.create({
    data: {
      name: "App Movil Siniestros",
      clientId: client2.id,
      modality: "AZURE_DEVOPS",
      adoOrgUrl: "https://dev.azure.com/seguros-continental",
      adoProject: "siniestros-app",
      adoToken: encrypt("dummy-pat-token-for-testing"),
    },
  });

  // Asignaciones con flujo realista de QA
  const stories3 = await prisma.userStory.findMany({ where: { cycleId: cycle3.id }, take: 4 });

  // Ana Garcia: variedad de estados
  await prisma.testerAssignment.create({ data: { testerId: testers1[0].id, storyId: stories1[0].id, startDate: new Date("2026-01-05"), endDate: new Date("2026-01-23"), status: "PRODUCTION", notes: "Desplegado en produccion sin incidentes" } });
  await prisma.testerAssignment.create({ data: { testerId: testers1[0].id, storyId: stories1[1].id, startDate: new Date("2026-01-10"), endDate: new Date("2026-02-05"), status: "PRODUCTION" } });
  await prisma.testerAssignment.create({ data: { testerId: testers1[0].id, storyId: stories2[0].id, startDate: new Date("2026-03-02"), endDate: new Date("2026-04-10"), status: "EXECUTION", executionCycle: "Sprint 5-8 Ciclo 2" } });
  await prisma.testerAssignment.create({ data: { testerId: testers1[0].id, storyId: stories2[1].id, startDate: new Date("2026-03-16"), endDate: new Date("2026-04-17"), status: "TEST_DESIGN" } });

  // Luis Torres: una devuelta a dev, otra en ejecucion
  await prisma.testerAssignment.create({ data: { testerId: testers1[1].id, storyId: stories1[3].id, startDate: new Date("2026-01-15"), endDate: new Date("2026-02-10"), status: "PRODUCTION" } });
  await prisma.testerAssignment.create({ data: { testerId: testers1[1].id, storyId: stories2[2].id, startDate: new Date("2026-03-02"), endDate: new Date("2026-04-08"), status: "EXECUTION", executionCycle: "Sprint 5-8 Ciclo 1" } });
  await prisma.testerAssignment.create({ data: { testerId: testers1[1].id, storyId: stories2[3].id, startDate: new Date("2026-03-10"), endDate: new Date("2026-04-20"), status: "RETURNED_TO_DEV", notes: "3 defectos criticos encontrados en regresion. Devuelto a desarrollo." } });
  await prisma.testerAssignment.create({ data: { testerId: testers1[1].id, storyId: stories2[4].id, startDate: new Date("2026-04-01"), endDate: new Date("2026-04-25"), status: "ANALYSIS" } });

  // Maria Rodriguez: en UAT y esperando UAT
  await prisma.testerAssignment.create({ data: { testerId: testers1[2].id, storyId: stories1[2].id, startDate: new Date("2026-01-12"), endDate: new Date("2026-02-14"), status: "PRODUCTION" } });
  await prisma.testerAssignment.create({ data: { testerId: testers1[2].id, storyId: stories2[5].id, startDate: new Date("2026-03-05"), endDate: new Date("2026-04-12"), status: "UAT", notes: "En revision por el cliente" } });
  await prisma.testerAssignment.create({ data: { testerId: testers1[2].id, storyId: stories2[6].id, startDate: new Date("2026-03-20"), endDate: new Date("2026-04-18"), status: "WAITING_UAT" } });

  // Pedro Sanchez: registrada y en analisis
  if (stories3.length > 0) {
    await prisma.testerAssignment.create({ data: { testerId: testers2[0].id, storyId: stories3[0].id, startDate: new Date("2026-02-02"), endDate: new Date("2026-04-15"), status: "EXECUTION", executionCycle: "Fase Inicial Ciclo 1" } });
  }
  if (stories3.length > 1) {
    await prisma.testerAssignment.create({ data: { testerId: testers2[0].id, storyId: stories3[1].id, startDate: new Date("2026-04-01"), endDate: new Date("2026-04-30"), status: "REGISTERED" } });
  }

  // Carolina Diaz: una en produccion, una nueva registrada
  if (stories3.length > 2) {
    await prisma.testerAssignment.create({ data: { testerId: testers2[1].id, storyId: stories3[2].id, startDate: new Date("2026-02-02"), endDate: new Date("2026-03-10"), status: "PRODUCTION" } });
  }
  if (stories3.length > 3) {
    await prisma.testerAssignment.create({ data: { testerId: testers2[1].id, storyId: stories3[3].id, startDate: new Date("2026-04-10"), endDate: new Date("2026-05-05"), status: "ANALYSIS", notes: "Pendiente liberacion de recurso en abril" } });
  }

  console.log("Seed completado:");
  console.log("- 3 roles (ADMIN, QA_LEAD, QA_ANALYST) con permisos RBAC");
  console.log("- 5 usuarios (admin@qametrics.com / QaMetrics2024!)");
  console.log("- 2 clientes, 3 proyectos, 5 testers");
  console.log("- 3 ciclos, 20 user stories, 60 weekly records");
  console.log("- 15 asignaciones con flujo realista de QA");
}

main()
  .catch((e: unknown) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
