-- Antes el FK Tester.userId usaba ON DELETE SET NULL: al borrar un usuario, sus
-- testers quedaban huérfanos (userId = NULL) y el analista dejaba de ver esos
-- proyectos de forma silenciosa. Se cambia a ON DELETE RESTRICT: borrar un
-- usuario con testers queda bloqueado en la BD. La capa de aplicación
-- (users.routes) hace además un pre-check y devuelve un 409 explicativo.
ALTER TABLE "Tester" DROP CONSTRAINT "Tester_userId_fkey";
ALTER TABLE "Tester" ADD CONSTRAINT "Tester_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
