-- Elimina el estado WAITING_UAT del enum AssignmentStatus.
-- Las asignaciones / logs que estaban en WAITING_UAT pasan a UAT.

BEGIN;

-- 1) Migrar datos existentes antes de redefinir el tipo (UAT es válido en el enum actual).
UPDATE "public"."TesterAssignment"  SET "status" = 'UAT' WHERE "status" = 'WAITING_UAT';
UPDATE "public"."AssignmentStatusLog" SET "status" = 'UAT' WHERE "status" = 'WAITING_UAT';

-- 2) Recrear el enum sin WAITING_UAT y migrar ambas columnas.
CREATE TYPE "AssignmentStatus_new" AS ENUM ('REGISTERED', 'ANALYSIS', 'TEST_DESIGN', 'WAITING_QA_DEPLOY', 'EXECUTION', 'RETURNED_TO_DEV', 'UAT', 'PRODUCTION', 'ON_HOLD');
ALTER TABLE "public"."TesterAssignment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."TesterAssignment" ALTER COLUMN "status" TYPE "AssignmentStatus_new" USING ("status"::text::"AssignmentStatus_new");
ALTER TABLE "public"."AssignmentStatusLog" ALTER COLUMN "status" TYPE "AssignmentStatus_new" USING ("status"::text::"AssignmentStatus_new");
ALTER TYPE "AssignmentStatus" RENAME TO "AssignmentStatus_old";
ALTER TYPE "AssignmentStatus_new" RENAME TO "AssignmentStatus";
DROP TYPE "public"."AssignmentStatus_old";
ALTER TABLE "public"."TesterAssignment" ALTER COLUMN "status" SET DEFAULT 'REGISTERED';

COMMIT;
