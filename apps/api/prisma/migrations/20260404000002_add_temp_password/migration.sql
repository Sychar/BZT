-- AlterTable User: temporaeres Klartextpasswort fuer PDF-Export
ALTER TABLE "User" ADD COLUMN "tempPassword" TEXT;
