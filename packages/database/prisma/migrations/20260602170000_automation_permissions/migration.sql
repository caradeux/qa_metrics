-- Automation track permissions. Idempotent (ON CONFLICT DO NOTHING), safe to re-run.
-- migrate deploy does NOT run the seed, so prod roles need these explicitly.

INSERT INTO "Permission" (id, resource, action)
SELECT gen_random_uuid()::text, r.resource, a.action
FROM (VALUES ('test-lines'), ('automation-assignments')) AS r(resource)
CROSS JOIN (VALUES ('create'), ('read'), ('update'), ('delete')) AS a(action)
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO "RolePermission" (id, "roleId", "permissionId")
SELECT gen_random_uuid()::text, ro.id, p.id
FROM "Role" ro
JOIN "Permission" p ON p.resource IN ('test-lines', 'automation-assignments')
WHERE ro.name = 'ADMIN'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" (id, "roleId", "permissionId")
SELECT gen_random_uuid()::text, ro.id, p.id
FROM "Role" ro
JOIN "Permission" p ON p.resource IN ('test-lines', 'automation-assignments')
WHERE ro.name = 'QA_LEAD'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" (id, "roleId", "permissionId")
SELECT gen_random_uuid()::text, ro.id, p.id
FROM "Role" ro
JOIN "Permission" p ON (
     (p.resource = 'test-lines' AND p.action = 'read')
  OR (p.resource = 'automation-assignments' AND p.action IN ('read', 'create', 'update'))
)
WHERE ro.name = 'QA_ANALYST'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" (id, "roleId", "permissionId")
SELECT gen_random_uuid()::text, ro.id, p.id
FROM "Role" ro
JOIN "Permission" p ON p.resource IN ('test-lines', 'automation-assignments') AND p.action = 'read'
WHERE ro.name = 'CLIENT_PM'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
