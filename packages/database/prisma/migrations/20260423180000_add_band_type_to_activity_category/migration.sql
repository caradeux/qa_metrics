-- CreateEnum
CREATE TYPE "ActivityCategoryBandType" AS ENUM ('USER_MEETING', 'DEV_MEETING', 'TRAINING', 'ABSENCE', 'OTHER');

-- AlterTable: agregar columna con default OTHER
ALTER TABLE "ActivityCategory" ADD COLUMN "bandType" "ActivityCategoryBandType" NOT NULL DEFAULT 'OTHER';

-- Backfill: asignar bandType a categorías canónicas conocidas (seed + UDD prod).
UPDATE "ActivityCategory" SET "bandType" = 'USER_MEETING'
  WHERE LOWER("name") IN (
    'reunión con usuario', 'reunion con usuario',
    'aceptacion casos de prueba (presentacion usuarios)',
    'aceptación casos de prueba (presentación usuarios)',
    'presentacion usuarios (uat)',
    'presentación usuarios (uat)'
  );

UPDATE "ActivityCategory" SET "bandType" = 'DEV_MEETING'
  WHERE LOWER("name") IN (
    'reunión con desarrollo', 'reunion con desarrollo',
    'daily scrum'
  );

UPDATE "ActivityCategory" SET "bandType" = 'TRAINING'
  WHERE LOWER("name") IN (
    'inducción', 'induccion',
    'capacitación', 'capacitacion',
    'capacitacion inovabiz', 'capacitación inovabiz'
  );

UPDATE "ActivityCategory" SET "bandType" = 'ABSENCE'
  WHERE LOWER("name") IN (
    'vacaciones',
    'ausencia',
    'licencia',
    'licencia médica', 'licencia medica',
    'permiso',
    'feriado',
    'día administrativo', 'dia administrativo'
  );
