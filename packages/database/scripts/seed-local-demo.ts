/**
 * seed-local-demo.ts
 *
 * Genera datos de demostración ricos para tomar screenshots de la landing.
 * SOLO corre en local. Se rehúsa a ejecutar si:
 *   - NODE_ENV === "production"
 *   - DATABASE_URL no apunta a localhost / 127.0.0.1
 *
 * Idempotente: borra todo lo previo con prefijo "[DEMO]" y regenera desde cero.
 *
 * Uso:
 *   cd qa-metrics
 *   tsx packages/database/scripts/seed-local-demo.ts
 */

import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { addDays, startOfDay, subDays, isWeekend, format } from "date-fns";

// ── Guard-rails ─────────────────────────────────────────────────────

if (process.env.NODE_ENV === "production") {
  console.error("❌ SEED-DEMO BLOQUEADO: NODE_ENV=production");
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL || "";
const isLocal = /localhost|127\.0\.0\.1|::1/i.test(dbUrl);
if (!isLocal) {
  console.error(`❌ SEED-DEMO BLOQUEADO: DATABASE_URL no apunta a localhost`);
  console.error(`   Actual: ${dbUrl.replace(/:[^:@/]*@/, ":***@")}`);
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

// ── Helpers ────────────────────────────────────────────────────────

const DEMO_PREFIX = "[DEMO]";
const today = startOfDay(new Date());

function rnd<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rndInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function skewLow(max: number): number {
  // Sesgo hacia valores bajos (útil para defectos)
  return Math.floor(Math.random() * Math.random() * max);
}

// ── Clean previous demo data ───────────────────────────────────────

async function cleanDemo() {
  const demoClients = await prisma.client.findMany({
    where: { name: { startsWith: DEMO_PREFIX } },
    select: { id: true },
  });
  if (demoClients.length) {
    const ids = demoClients.map((c) => c.id);
    // Cascade: projects → testers/stories → cycles/assignments → phases/records/activities
    await prisma.client.deleteMany({ where: { id: { in: ids } } });
    console.log(`  ✓ Limpié ${demoClients.length} clientes DEMO previos (cascade)`);
  }
  // También limpiamos activities huérfanas creadas por demo (por si acaso)
  await prisma.activity.deleteMany({
    where: { notes: { startsWith: "[demo]" } },
  });
}

// ── Main seed ──────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seed DEMO local iniciando...");
  console.log(`   DB: ${dbUrl.replace(/:[^:@/]*@/, ":***@")}`);

  // Necesitamos un admin existente para ser "owner" de los clients.
  // Preferimos el email configurado en DEMO_OWNER_EMAIL (si está seteado),
  // luego jcaradeux@inovabiz.com (usuario principal del proyecto),
  // y si no, cualquier ADMIN disponible.
  const preferredEmail =
    process.env.DEMO_OWNER_EMAIL || "jcaradeux@inovabiz.com";
  let admin = await prisma.user.findFirst({
    where: {
      email: preferredEmail,
      role: { name: { in: ["ADMIN", "QA_LEAD"] } },
    },
  });
  if (!admin) {
    admin = await prisma.user.findFirst({
      where: { role: { name: "ADMIN" } },
    });
  }
  if (!admin) {
    console.error("❌ No existe usuario ADMIN. Corre primero: npx prisma db seed");
    process.exit(1);
  }
  console.log(`👤 Owner de clientes DEMO: ${admin.email}`);

  // Activity categories (deben existir; si no, crear las 4 default)
  const categories = await prisma.activityCategory.findMany({ where: { active: true } });
  if (categories.length === 0) {
    console.error("❌ No hay categorías de actividad. Corre primero: npx prisma db seed");
    process.exit(1);
  }

  await cleanDemo();

  // ── 1. Clients ────────────────────────────────────────────────
  // Nombres totalmente ficticios, sin relación con industria/cliente real.
  const clientsData = [
    { name: `${DEMO_PREFIX} Cliente Demo Alpha`, projects: ["Producto A · Core", "Producto A · Mobile"] },
    { name: `${DEMO_PREFIX} Cliente Demo Beta`, projects: ["Producto B · Web", "Producto B · Backend"] },
    { name: `${DEMO_PREFIX} Cliente Demo Gamma`, projects: ["Producto C · API", "Producto C · Dashboard"] },
  ];

  console.log("\n📂 Creando clientes + proyectos...");
  const projects: Array<{
    id: string;
    name: string;
    clientName: string;
    modality: "AZURE_DEVOPS" | "MANUAL";
  }> = [];
  const clients: { id: string; name: string }[] = [];

  for (const c of clientsData) {
    const client = await prisma.client.create({
      data: { name: c.name, userId: admin.id },
    });
    clients.push({ id: client.id, name: client.name });
    console.log(`  ✓ Cliente: ${c.name}`);

    for (let i = 0; i < c.projects.length; i++) {
      const modality = i === 0 ? "AZURE_DEVOPS" : "MANUAL";
      const project = await prisma.project.create({
        data: {
          name: c.projects[i],
          clientId: client.id,
          modality,
          adoOrgUrl: modality === "AZURE_DEVOPS" ? "https://dev.azure.com/demo" : null,
          adoProject: modality === "AZURE_DEVOPS" ? c.projects[i].toLowerCase().replace(/\s+/g, "-") : null,
        },
      });
      projects.push({ id: project.id, name: c.projects[i], clientName: c.name, modality });
      console.log(`     ↳ Proyecto (${modality}): ${c.projects[i]}`);
    }
  }

  // ── 2. Testers por proyecto ───────────────────────────────────
  console.log("\n👥 Creando testers...");
  const testerNames = [
    "Ana García",
    "Luis Torres",
    "Pedro Sánchez",
    "Carla Muñoz",
    "Diego Ramos",
    "Sofía Castro",
  ];
  const testers: Array<{
    id: string;
    name: string;
    projectId: string;
    allocation: number;
  }> = [];

  for (const p of projects) {
    // Cada proyecto tiene 2-3 testers con allocations variadas
    const n = rndInt(2, 3);
    const selected = [...testerNames].sort(() => Math.random() - 0.5).slice(0, n);
    for (const name of selected) {
      const allocation = rnd([50, 75, 100]);
      const t = await prisma.tester.create({
        data: {
          name,
          projectId: p.id,
          allocation,
        },
      });
      testers.push({ id: t.id, name, projectId: p.id, allocation });
    }
  }
  console.log(`  ✓ ${testers.length} testers creados`);

  // ── 3. User Stories + Cycles ──────────────────────────────────
  console.log("\n📋 Creando user stories + test cycles...");

  const storyTemplates = [
    "Login con MFA",
    "Recuperación de contraseña",
    "Registro de nuevo usuario",
    "Edición de perfil",
    "Notificaciones push",
    "Exportación a PDF",
    "Búsqueda avanzada",
    "Validación de formularios",
    "Carga de comprobantes",
    "Dashboard de usuario",
    "Integración con API externa",
    "Flujo de checkout",
    "Gestión de favoritos",
    "Historial de transacciones",
    "Autenticación biométrica",
  ];

  type ComplexityValue = "HIGH" | "MEDIUM" | "LOW";
  const complexities: ComplexityValue[] = ["LOW", "MEDIUM", "HIGH"];

  const allStories: Array<{
    id: string;
    projectId: string;
    cycleId: string;
    title: string;
  }> = [];

  for (const p of projects) {
    const nStories = rndInt(5, 8);
    const titles = [...storyTemplates].sort(() => Math.random() - 0.5).slice(0, nStories);
    let idx = 1;
    for (const title of titles) {
      const story = await prisma.userStory.create({
        data: {
          externalId: `DEMO-${p.id.slice(-4)}-${String(idx).padStart(3, "0")}`,
          title,
          projectId: p.id,
          designComplexity: rnd(complexities),
          executionComplexity: rnd(complexities),
        },
      });
      // Un ciclo por HU para demo
      const cycle = await prisma.testCycle.create({
        data: {
          name: `Ciclo 1`,
          storyId: story.id,
          startDate: subDays(today, rndInt(30, 60)),
          endDate: addDays(today, rndInt(5, 30)),
        },
      });
      allStories.push({ id: story.id, projectId: p.id, cycleId: cycle.id, title });
      idx++;
    }
  }
  console.log(`  ✓ ${allStories.length} user stories + cycles creados`);

  // ── 4. Assignments + Phases + Status ──────────────────────────
  console.log("\n🎯 Creando asignaciones, fases y estados...");

  const statuses: Array<
    | "REGISTERED"
    | "ANALYSIS"
    | "TEST_DESIGN"
    | "WAITING_QA_DEPLOY"
    | "EXECUTION"
    | "RETURNED_TO_DEV"
    | "WAITING_UAT"
    | "UAT"
    | "PRODUCTION"
    | "ON_HOLD"
  > = [
    "ANALYSIS",
    "TEST_DESIGN",
    "EXECUTION",
    "EXECUTION",
    "EXECUTION",
    "WAITING_UAT",
    "UAT",
    "PRODUCTION",
    "RETURNED_TO_DEV",
  ];

  const assignments: Array<{
    id: string;
    testerId: string;
    storyId: string;
    cycleId: string;
    start: Date;
    end: Date;
  }> = [];

  for (const story of allStories) {
    // Cada HU se asigna a 1 tester del proyecto
    const projectTesters = testers.filter((t) => t.projectId === story.projectId);
    if (projectTesters.length === 0) continue;
    const tester = rnd(projectTesters);

    const startOffset = rndInt(30, 60);
    const durationDays = rndInt(14, 35);
    const start = subDays(today, startOffset);
    const end = addDays(start, durationDays);

    const assignment = await prisma.testerAssignment.create({
      data: {
        testerId: tester.id,
        storyId: story.id,
        cycleId: story.cycleId,
        startDate: start,
        endDate: end,
        status: rnd(statuses),
        notes: "[demo] asignación generada automáticamente",
      },
    });
    assignments.push({
      id: assignment.id,
      testerId: tester.id,
      storyId: story.id,
      cycleId: story.cycleId,
      start,
      end,
    });

    // Phases: ANALYSIS → TEST_DESIGN → EXECUTION (dividir el rango)
    const analysisDays = Math.max(2, Math.floor(durationDays * 0.2));
    const designDays = Math.max(3, Math.floor(durationDays * 0.35));
    const analysisStart = start;
    const analysisEnd = addDays(start, analysisDays);
    const designStart = analysisEnd;
    const designEnd = addDays(designStart, designDays);
    const executionStart = designEnd;
    const executionEnd = end;

    await prisma.assignmentPhase.createMany({
      data: [
        {
          assignmentId: assignment.id,
          phase: "ANALYSIS",
          startDate: analysisStart,
          endDate: analysisEnd,
        },
        {
          assignmentId: assignment.id,
          phase: "TEST_DESIGN",
          startDate: designStart,
          endDate: designEnd,
        },
        {
          assignmentId: assignment.id,
          phase: "EXECUTION",
          startDate: executionStart,
          endDate: executionEnd,
        },
      ],
    });
  }
  console.log(`  ✓ ${assignments.length} asignaciones con 3 fases cada una`);

  // ── 5. Daily Records ──────────────────────────────────────────
  console.log("\n📅 Generando daily records (60 días)...");

  let recordCount = 0;
  for (const a of assignments) {
    // Solo días entre start y min(end, hoy), saltando fines de semana
    const rangeEnd = a.end > today ? today : a.end;
    let cursor = new Date(a.start);
    while (cursor <= rangeEnd) {
      if (!isWeekend(cursor)) {
        // No todos los días del asignamiento tienen registro (80% prob)
        if (Math.random() < 0.8) {
          const designed = rndInt(0, 4);
          const executed = rndInt(1, 8);
          const defects = skewLow(3);
          await prisma.dailyRecord.upsert({
            where: {
              assignmentId_date: {
                assignmentId: a.id,
                date: cursor,
              },
            },
            update: { designed, executed, defects },
            create: {
              testerId: a.testerId,
              assignmentId: a.id,
              date: cursor,
              designed,
              executed,
              defects,
              source: "MANUAL",
            },
          });
          recordCount++;
        }
      }
      cursor = addDays(cursor, 1);
    }
  }
  console.log(`  ✓ ${recordCount} daily records creados`);

  // ── 6. Activities (reuniones, capacitaciones) ─────────────────
  console.log("\n⏰ Generando actividades del equipo...");

  let activityCount = 0;
  for (const t of testers) {
    // Cada tester tiene 8-15 actividades en los últimos 30 días
    const n = rndInt(8, 15);
    for (let i = 0; i < n; i++) {
      const daysAgo = rndInt(0, 30);
      const date = subDays(today, daysAgo);
      if (isWeekend(date)) continue;
      const hour = rndInt(9, 17);
      const minute = rnd([0, 15, 30, 45]);
      const startAt = new Date(date);
      startAt.setHours(hour, minute, 0, 0);
      const durationMin = rnd([30, 45, 60, 60, 90]);
      const endAt = new Date(startAt.getTime() + durationMin * 60_000);

      const category = rnd(categories);
      await prisma.activity.create({
        data: {
          testerId: t.id,
          categoryId: category.id,
          startAt,
          endAt,
          notes: `[demo] ${category.name}`,
          createdById: admin.id,
        },
      });
      activityCount++;
    }
  }
  console.log(`  ✓ ${activityCount} actividades creadas`);

  // ── Resumen ────────────────────────────────────────────────────
  console.log("\n✅ Seed DEMO completado");
  console.log(`   Clientes:    ${clients.length}`);
  console.log(`   Proyectos:   ${projects.length}`);
  console.log(`   Testers:     ${testers.length}`);
  console.log(`   User Stories:${allStories.length}`);
  console.log(`   Asignaciones:${assignments.length}`);
  console.log(`   Daily Records:${recordCount}`);
  console.log(`   Activities:  ${activityCount}`);
  console.log("");
  console.log("🎬 Todo listo para capturar screenshots.");
  console.log("   Loguéate como admin@qametrics.com / QaMetrics2024!");
  console.log(`   Fecha referencia: ${format(today, "yyyy-MM-dd")}`);
}

main()
  .catch((err) => {
    console.error("❌ Error en seed-local-demo:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
