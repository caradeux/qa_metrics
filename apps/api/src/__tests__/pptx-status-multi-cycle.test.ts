import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@qa-metrics/database";
import { buildReportSpec } from "../lib/pptx/report-data.js";

// Cuando una HU tiene múltiples TestCycles, el slide debe mostrar el estado
// del último ciclo (assignment más reciente por createdAt), aun si ese
// último ciclo está en PRODUCTION (sin DailyRecords) y un ciclo previo está
// en otro estado con DailyRecords en el periodo.
describe("PPTX status — última cycle de HUs multi-ciclo", () => {
  let adminUserId: string;
  let adminRoleName: string;
  let clientId: string;
  let projectId: string;
  let storyAId: string; // último ciclo en PRODUCTION
  let storyBId: string; // último ciclo en RETURNED_TO_DEV
  let storyCId: string; // un solo ciclo, EXECUTION (control)
  const externalIdMarker = `MULTICYC-${Date.now()}`;

  const periodStart = new Date(Date.UTC(2026, 3, 1));   // 2026-04-01
  const periodEnd = new Date(Date.UTC(2026, 3, 30, 23, 59, 59));

  beforeAll(async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@qametrics.com" },
      include: { role: true },
    });
    adminUserId = admin.id;
    adminRoleName = admin.role.name;

    const client = await prisma.client.create({
      data: { name: `Cliente Test ${externalIdMarker}`, userId: adminUserId },
    });
    clientId = client.id;

    const project = await prisma.project.create({
      data: { name: `Proyecto Test ${externalIdMarker}`, clientId, modality: "MANUAL" },
    });
    projectId = project.id;

    const tester = await prisma.tester.create({
      data: { name: "Tester Multi-Ciclo", projectId, allocation: 100 },
    });

    // Story A — multi-ciclo, último ciclo en PRODUCTION sin records, ciclo
    // previo en UAT con DailyRecord en el periodo.
    const storyA = await prisma.userStory.create({
      data: {
        projectId,
        externalId: `${externalIdMarker}-A`,
        title: "HU multi-ciclo último=PRODUCTION",
        designComplexity: "MEDIUM",
        executionComplexity: "MEDIUM",
      },
    });
    storyAId = storyA.id;
    const cycleA1 = await prisma.testCycle.create({
      data: { name: "Ciclo 1", storyId: storyA.id, startDate: new Date("2026-03-01"), endDate: new Date("2026-04-10") },
    });
    const cycleA2 = await prisma.testCycle.create({
      data: { name: "Ciclo 2", storyId: storyA.id, startDate: new Date("2026-04-15"), endDate: new Date("2026-04-25") },
    });
    const assignA1 = await prisma.testerAssignment.create({
      data: {
        testerId: tester.id, storyId: storyA.id, cycleId: cycleA1.id,
        startDate: new Date("2026-03-01"), endDate: new Date("2026-04-10"),
        status: "UAT",
        createdAt: new Date("2026-03-01T10:00:00Z"),
      },
    });
    await prisma.dailyRecord.create({
      data: { testerId: tester.id, assignmentId: assignA1.id, date: new Date("2026-04-08"), designed: 3, executed: 2, defects: 0 },
    });
    await prisma.testerAssignment.create({
      data: {
        testerId: tester.id, storyId: storyA.id, cycleId: cycleA2.id,
        startDate: new Date("2026-04-15"), endDate: new Date("2026-04-25"),
        status: "PRODUCTION",
        createdAt: new Date("2026-04-15T10:00:00Z"),
      },
    });

    // Story B — multi-ciclo, último ciclo en RETURNED_TO_DEV sin records,
    // ciclo previo en EXECUTION con DailyRecord.
    const storyB = await prisma.userStory.create({
      data: {
        projectId,
        externalId: `${externalIdMarker}-B`,
        title: "HU multi-ciclo último=RETURNED_TO_DEV",
        designComplexity: "MEDIUM",
        executionComplexity: "MEDIUM",
      },
    });
    storyBId = storyB.id;
    const cycleB1 = await prisma.testCycle.create({
      data: { name: "Ciclo 1", storyId: storyB.id, startDate: new Date("2026-03-01"), endDate: new Date("2026-04-05") },
    });
    const cycleB2 = await prisma.testCycle.create({
      data: { name: "Ciclo 2", storyId: storyB.id, startDate: new Date("2026-04-12"), endDate: new Date("2026-04-25") },
    });
    const assignB1 = await prisma.testerAssignment.create({
      data: {
        testerId: tester.id, storyId: storyB.id, cycleId: cycleB1.id,
        startDate: new Date("2026-03-01"), endDate: new Date("2026-04-05"),
        status: "EXECUTION",
        createdAt: new Date("2026-03-01T10:00:00Z"),
      },
    });
    await prisma.dailyRecord.create({
      data: { testerId: tester.id, assignmentId: assignB1.id, date: new Date("2026-04-03"), designed: 2, executed: 1, defects: 0 },
    });
    await prisma.testerAssignment.create({
      data: {
        testerId: tester.id, storyId: storyB.id, cycleId: cycleB2.id,
        startDate: new Date("2026-04-12"), endDate: new Date("2026-04-25"),
        status: "RETURNED_TO_DEV",
        createdAt: new Date("2026-04-12T10:00:00Z"),
      },
    });

    // Story C — control: un solo ciclo en EXECUTION con records en el periodo.
    const storyC = await prisma.userStory.create({
      data: {
        projectId,
        externalId: `${externalIdMarker}-C`,
        title: "HU single-ciclo EXECUTION",
        designComplexity: "MEDIUM",
        executionComplexity: "MEDIUM",
      },
    });
    storyCId = storyC.id;
    const cycleC1 = await prisma.testCycle.create({
      data: { name: "Ciclo 1", storyId: storyC.id, startDate: new Date("2026-04-01"), endDate: new Date("2026-04-30") },
    });
    const assignC1 = await prisma.testerAssignment.create({
      data: {
        testerId: tester.id, storyId: storyC.id, cycleId: cycleC1.id,
        startDate: new Date("2026-04-01"), endDate: new Date("2026-04-30"),
        status: "EXECUTION",
      },
    });
    await prisma.dailyRecord.create({
      data: { testerId: tester.id, assignmentId: assignC1.id, date: new Date("2026-04-15"), designed: 4, executed: 3, defects: 1 },
    });
  });

  afterAll(async () => {
    // Cascade: project → testers → assignments → records, stories → cycles, etc.
    if (projectId) await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    if (clientId) await prisma.client.delete({ where: { id: clientId } }).catch(() => {});
  });

  it("último ciclo en PRODUCTION → muestra 'En Producción' (no el estado del ciclo previo)", async () => {
    const spec = await buildReportSpec({
      period: "monthly",
      periodStart, periodEnd,
      scope: { id: projectId },
      clientFilter: null,
      userRole: adminRoleName,
      userId: adminUserId,
    });
    const project = spec.projects.find((p) => p.projectId === projectId);
    expect(project).toBeDefined();
    const hu = project!.hus.find((h) => h.storyId === storyAId);
    expect(hu, "Story A debe aparecer en el reporte").toBeDefined();
    expect(hu!.status).toBe("PRODUCTION");
    expect(hu!.statusLabel).toBe("En Producción");
  });

  it("último ciclo en RETURNED_TO_DEV → muestra 'Devuelto a Desarrollo' (no el estado del ciclo previo)", async () => {
    const spec = await buildReportSpec({
      period: "monthly",
      periodStart, periodEnd,
      scope: { id: projectId },
      clientFilter: null,
      userRole: adminRoleName,
      userId: adminUserId,
    });
    const project = spec.projects.find((p) => p.projectId === projectId);
    const hu = project!.hus.find((h) => h.storyId === storyBId);
    expect(hu, "Story B debe aparecer").toBeDefined();
    expect(hu!.status).toBe("RETURNED_TO_DEV");
    expect(hu!.statusLabel).toBe("Devuelto a Desarrollo");
  });

  it("HU single-ciclo en EXECUTION sigue mostrando 'En Curso' (no-regresión)", async () => {
    const spec = await buildReportSpec({
      period: "monthly",
      periodStart, periodEnd,
      scope: { id: projectId },
      clientFilter: null,
      userRole: adminRoleName,
      userId: adminUserId,
    });
    const project = spec.projects.find((p) => p.projectId === projectId);
    const hu = project!.hus.find((h) => h.storyId === storyCId);
    expect(hu, "Story C debe aparecer").toBeDefined();
    expect(hu!.status).toBe("EXECUTION");
    expect(hu!.statusLabel).toBe("En Curso");
  });

  it("pipeline del proyecto cuenta a Story A bajo 'En Producción' y a Story B bajo 'Devuelto a Desarrollo'", async () => {
    const spec = await buildReportSpec({
      period: "monthly",
      periodStart, periodEnd,
      scope: { id: projectId },
      clientFilter: null,
      userRole: adminRoleName,
      userId: adminUserId,
    });
    const project = spec.projects.find((p) => p.projectId === projectId);
    const enProd = project!.pipeline.find((p) => p.label === "En Producción");
    const devuelto = project!.pipeline.find((p) => p.label === "Devuelto a Desarrollo");
    expect(enProd?.count ?? 0).toBeGreaterThanOrEqual(1);
    expect(devuelto?.count ?? 0).toBeGreaterThanOrEqual(1);
  });
});
