# Progreso SDD — asociación analista↔cliente y especialidades

Plan: docs/superpowers/plans/2026-06-25-asociacion-analista-cliente-especialidades.md
Rama: feature/asociacion-analista-cliente
Base inicial: 93fd18c46cbef5b5e58e4d5dc41de69c4b2d7ca5

## Estado
- Entorno: Postgres dev arriba (qa_metrics_db), seed cargado, API dev en :4000 (bg bohfr1rl0).
- Task 1: complete (commit 93fd18c..010dc73, review limpio)
- Task 2: complete (commit 010dc73..fb4ebab, review limpio)
  - Minor (para review final): test 2 de users-list desestructura assignedClients[0] sin guardia.
- Task 3: complete (commit fb4ebab..e7c0798, review limpio)
  - Minor (review final): test 2 de users-update usa clients[0] sin guardia de longitud.
- Task 4: complete (commit e7c0798..f1d4abb, review limpio)
  - Nota: implementador reordenó validación (asociación antes de "ya asignado"); benigno y correcto.
  - Suite API: 20 failed preexistentes (SASL/INTERNAL_SECRET/mailer), no por la feature (baseline era 28 failed).
- Task 5: complete (commit f1d4abb..24bab3b, tsc limpio, review directo OK)
- Task 6: complete (commit 24bab3b..a3aa697, tsc limpio; además quitó filtro client-side de capacidad en projects/page.tsx)
- TODAS las tasks completas. Pendiente: review final whole-branch (opcional) + prueba manual del usuario.
