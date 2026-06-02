-- FlowPilot ahora se controla por permisos (requirePermission), no por rol hardcodeado.
-- Esta migración registra los 16 permisos de FlowPilot y los asigna a los roles
-- existentes. Es idempotente (ON CONFLICT DO NOTHING) y segura de re-ejecutar.
-- Sin esto, al desplegar el backend con gating por permiso, los roles perderían
-- acceso a FlowPilot en prod (migrate deploy NO corre el seed).

-- 1) Permisos de FlowPilot: 4 recursos x 4 acciones.
INSERT INTO "Permission" (id, resource, action)
SELECT gen_random_uuid()::text, r.resource, a.action
FROM (VALUES
  ('flowpilot-control'), ('flowpilot-mappings'), ('flowpilot-config'), ('flowpilot-hours')
) AS r(resource)
CROSS JOIN (VALUES ('create'), ('read'), ('update'), ('delete')) AS a(action)
ON CONFLICT (resource, action) DO NOTHING;

-- 2) ADMIN: acceso total a FlowPilot.
INSERT INTO "RolePermission" (id, "roleId", "permissionId")
SELECT gen_random_uuid()::text, ro.id, p.id
FROM "Role" ro
JOIN "Permission" p ON p.resource IN ('flowpilot-control', 'flowpilot-mappings', 'flowpilot-config', 'flowpilot-hours')
WHERE ro.name = 'ADMIN'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 3) QA_LEAD: monitorea, homologa, ve la URL y registra horas (no cambia la URL).
INSERT INTO "RolePermission" (id, "roleId", "permissionId")
SELECT gen_random_uuid()::text, ro.id, p.id
FROM "Role" ro
JOIN "Permission" p ON (
     (p.resource = 'flowpilot-control'  AND p.action = 'read')
  OR (p.resource = 'flowpilot-config'   AND p.action = 'read')
  OR (p.resource = 'flowpilot-mappings' AND p.action IN ('read', 'update'))
  OR (p.resource = 'flowpilot-hours'    AND p.action IN ('read', 'update'))
)
WHERE ro.name = 'QA_LEAD'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 4) QA_ANALYST: registra y envía sus propias horas.
INSERT INTO "RolePermission" (id, "roleId", "permissionId")
SELECT gen_random_uuid()::text, ro.id, p.id
FROM "Role" ro
JOIN "Permission" p ON p.resource = 'flowpilot-hours' AND p.action IN ('read', 'update')
WHERE ro.name = 'QA_ANALYST'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
