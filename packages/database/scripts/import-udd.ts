import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

// PDF states → AssignmentStatus
function mapStatus(pdf: string): any {
  const map: Record<string, string> = {
    "Pdte. Aprobación": "WAITING_UAT",
    "Pdte. Instalación QA": "WAITING_QA_DEPLOY",
    "UAT": "UAT",
    "En Traspaso": "REGISTERED",
    "Devuelto a Desarrollo": "RETURNED_TO_DEV",
    "En Diseño": "TEST_DESIGN",
    "No Iniciado": "REGISTERED",
  };
  return map[pdf] ?? "REGISTERED";
}

async function main() {
  const clientPmRole = await prisma.role.findUniqueOrThrow({ where: { name: "CLIENT_PM" } });
  const hash = await bcrypt.hash("Inovabiz.2026", 12);

  // 1) CLIENT_PMs faltantes
  const newPms = [
    { email: "j.ruz@inovabiz.com", name: "Juan Ruz" },
    { email: "j.collao@inovabiz.com", name: "Jorge Collao" },
    { email: "m.larrondo@inovabiz.com", name: "Mauricio Larrondo" },
  ];
  for (const p of newPms) {
    await prisma.user.upsert({
      where: { email: p.email },
      create: { email: p.email, password: hash, name: p.name, roleId: clientPmRole.id },
      update: {},
    });
  }

  const alex = await prisma.user.findUniqueOrThrow({ where: { email: "demo@demo.cl" } });
  const juan = await prisma.user.findUniqueOrThrow({ where: { email: "j.ruz@inovabiz.com" } });
  const jorge = await prisma.user.findUniqueOrThrow({ where: { email: "j.collao@inovabiz.com" } });
  const mauricio = await prisma.user.findUniqueOrThrow({ where: { email: "m.larrondo@inovabiz.com" } });
  const jflores = await prisma.user.findUniqueOrThrow({ where: { email: "jflores@inovabiz.com" } });
  const rgarcia = await prisma.user.findUniqueOrThrow({ where: { email: "rgarcia@inovabiz.com" } });
  const braulio = await prisma.user.findUniqueOrThrow({ where: { email: "b.benardis@inovabiz.com" } });
  const udd = await prisma.client.findFirstOrThrow({ where: { name: { contains: "UDD" } } });

  // 2) Proyectos faltantes
  const missing = [
    { name: "Tracking", pmId: juan.id },
    { name: "Sistema de Notas", pmId: mauricio.id },
    { name: "DEC", pmId: jorge.id },
  ];
  for (const m of missing) {
    const exists = await prisma.project.findFirst({ where: { name: m.name, clientId: udd.id } });
    if (!exists) {
      await prisma.project.create({
        data: { name: m.name, clientId: udd.id, modality: "MANUAL", projectManagerId: m.pmId },
      });
      console.log(`Proyecto creado: ${m.name}`);
    }
  }

  // 3) Datos del PDF
  const projects = [
    {
      name: "Trayectorias", analystId: jflores.id, analystName: "Jose Flores",
      stories: [
        { title: "HU Habilitar unidad que imparte", status: "Pdte. Aprobación", designed: 14, executed: 0, defects: 0 },
        { title: "HU Vigencia de certificaciones", status: "Pdte. Aprobación", designed: 18, executed: 0, defects: 0 },
        { title: "HU Cupos Compartidos", status: "Pdte. Instalación QA", designed: 0, executed: 15, defects: 0 },
        { title: "HU Procesos Programados Certificaciones", status: "Pdte. Aprobación", designed: 18, executed: 0, defects: 0 },
      ],
    },
    {
      name: "COIL", analystId: jflores.id, analystName: "Jose Flores",
      stories: [{ title: "Coil", status: "Pdte. Aprobación", designed: 4, executed: 0, defects: 0 }],
    },
    {
      name: "Certificaciones", analystId: jflores.id, analystName: "Jose Flores",
      stories: [{ title: "HU Certificaciones", status: "UAT", designed: 0, executed: 0, defects: 0 }],
    },
    {
      name: "Migración DB_RESERVA-QA", analystId: rgarcia.id, analystName: "Renato Garcia",
      stories: [{ title: "Migración DB_RESERVA-QA", status: "En Traspaso", designed: 0, executed: 0, defects: 0 }],
    },
    {
      name: "Tracking", analystId: rgarcia.id, analystName: "Renato Garcia",
      stories: [
        { title: "HU 14811 - Filtrar solicitudes por rol (Ciclo 1)", status: "Devuelto a Desarrollo", designed: 38, executed: 37, defects: 2 },
        { title: "14812 Asegurar las URLS de visualización de informes generados en el módulo del buscador mediante token", status: "UAT", designed: 0, executed: 0, defects: 0 },
      ],
    },
    {
      name: "Sistema de Notas", analystId: rgarcia.id, analystName: "Renato Garcia",
      stories: [
        { title: "RM01 – Contexto inicial de parametrización", status: "En Diseño", designed: 15, executed: 0, defects: 0 },
        { title: "RM03 – Identificación visual de notas aperturables", status: "En Diseño", designed: 5, executed: 0, defects: 0 },
        { title: "RM04 – Configuración de reglas habilitables o deshabilitables", status: "No Iniciado", designed: 0, executed: 0, defects: 0 },
      ],
    },
    {
      name: "DEC", analystId: braulio.id, analystName: "Braulio Benardis",
      stories: [
        { title: "Incidente 14977 — Cuando una persona se matricula y da la oportunidad por ganada, el servicio cambia datos en Salesforce (nombre, apellidos, nacionalidad)", status: "Devuelto a Desarrollo", designed: 0, executed: 2, defects: 1 },
        { title: "User Story 13936 — Enpoint de creación de postulación para Salesforce. (Ciclo 2)", status: "Devuelto a Desarrollo", designed: 0, executed: 9, defects: 3 },
        { title: "Incidente 14937 — No se puede postular en programas de la DEC a personas con pasaporte.", status: "Devuelto a Desarrollo", designed: 5, executed: 10, defects: 2 },
        { title: "14844 - En la postulación individual y masiva de la DEC al agregar una postulación pisa la fecha de nacimiento y la dirección", status: "En Diseño", designed: 0, executed: 0, defects: 0 },
      ],
    },
  ];

  // 4) HUs + ciclos + asignaciones
  for (const pj of projects) {
    const project = await prisma.project.findFirstOrThrow({ where: { name: pj.name, clientId: udd.id } });

    // Buscar tester de ese proyecto vinculado al analista (o cualquiera si no coincide)
    let tester = await prisma.tester.findFirst({ where: { projectId: project.id, userId: pj.analystId } });
    if (!tester) {
      tester = await prisma.tester.findFirst({ where: { projectId: project.id } });
    }

    for (const st of pj.stories) {
      // Crear HU si no existe
      const exists = await prisma.userStory.findFirst({ where: { projectId: project.id, title: st.title } });
      if (exists) continue;
      const story = await prisma.userStory.create({
        data: { projectId: project.id, title: st.title, designComplexity: "MEDIUM", executionComplexity: "MEDIUM" },
      });

      // Crear Ciclo 1
      const cycle = await prisma.testCycle.create({
        data: { storyId: story.id, name: "Ciclo 1", startDate: new Date("2026-04-06") },
      });

      // Crear asignación si hay tester
      if (tester) {
        const status = mapStatus(st.status);
        const assignment = await prisma.testerAssignment.create({
          data: {
            testerId: tester.id, storyId: story.id, cycleId: cycle.id,
            startDate: new Date("2026-04-06"),
            status: status as any,
            notes: `Semana 06-10 Abril: ${st.designed} diseñados, ${st.executed} ejecutados, ${st.defects} defectos.`,
          },
        });
        await prisma.assignmentStatusLog.create({
          data: { assignmentId: assignment.id, status: status as any },
        });
      }
      console.log(`HU creada: ${project.name} / ${st.title}`);
    }
  }

  console.log("\nListo.");
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
