-- AlterTable Company: interner Firmencode
ALTER TABLE "Company" ADD COLUMN "internalCode" TEXT;
CREATE UNIQUE INDEX "Company_internalCode_key" ON "Company"("internalCode");

-- AlterTable User: Passwort-Änderungspflicht beim ersten Login
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
