import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const statusByTitle: Record<string, string> = {
  "HU 14811 - Filtrar solicitudes por rol (Ciclo 1)": "RETURNED_TO_DEV",
  "14812 Asegurar las URLS de visualización de informes generados en el módulo del buscador mediante token": "UAT",
  "RM01 – Contexto inicial de parametrización": "TEST_DESIGN",
  "RM03 – Identificación visual de notas aperturables": "TEST_DESIGN",
  "RM04 – Configuración de reglas habilitables o deshabilitables": "REGISTERED",
  "Incidente 14977 — Cuando una persona se matricula y da la oportunidad por ganada, el servicio cambia datos en Salesforce (nombre, apellidos, nacionalidad)": "RETURNED_TO_DEV",
  "User Story 13936 — Enpoint de creación de postulación para Salesforce. (Ciclo 2)": "RETURNED_TO_DEV",
  "Incidente 14937 — No se puede postular en programas de la DEC a personas con pasaporte.": "RETURNED_TO_DEV",
  "14844 - En la postulación individual y masiva de la DEC al agregar una postulación pisa la fecha de nacimiento y la dirección": "TEST_DESIGN",
};

for (const [title, status] of Object.entries(statusByTitle)) {
  const story = await prisma.userStory.findFirst({ where: { title } });
  if (!story) { console.log(`No encontrada: ${title.slice(0,40)}`); continue; }
  const assignment = await prisma.testerAssignment.findFirst({ where: { storyId: story.id } });
  if (!assignment) continue;
  if (assignment.status === status) continue;
  await prisma.testerAssignment.update({ where: { id: assignment.id }, data: { status: status as any } });
  await prisma.assignmentStatusLog.create({ data: { assignmentId: assignment.id, status: status as any } });
  console.log(`${title.slice(0,50)} → ${status}`);
}
await prisma.$disconnect();
