-- AlterTable
ALTER TABLE "PropertyImage" ADD COLUMN "masterKey" TEXT;
ALTER TABLE "PropertyImage" ADD COLUMN "watermarkVersion" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "companyName" TEXT NOT NULL DEFAULT 'ELITE Real Estate',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'QAR',
    "saleCommissionPercent" REAL NOT NULL DEFAULT 2,
    "rentalCommissionPercent" REAL NOT NULL DEFAULT 8.33,
    "agentSharePercent" REAL NOT NULL DEFAULT 40,
    "leadResponseSlaMinutes" INTEGER NOT NULL DEFAULT 60,
    "autoLeadResponseTasks" BOOLEAN NOT NULL DEFAULT true,
    "leadAutoReassignHours" INTEGER NOT NULL DEFAULT 24,
    "leadEscalationUserId" TEXT,
    "saleDepositPercent" REAL NOT NULL DEFAULT 5,
    "rentDepositMonths" INTEGER NOT NULL DEFAULT 1,
    "reservationHoldHours" INTEGER NOT NULL DEFAULT 48,
    "fawranEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankIban" TEXT,
    "bankAccountNumber" TEXT,
    "bankSwift" TEXT,
    "fawranAlias" TEXT,
    "paymentInstructions" TEXT,
    "watermarkEnabled" BOOLEAN NOT NULL DEFAULT true,
    "watermarkPosition" TEXT NOT NULL DEFAULT 'CENTER',
    "watermarkSize" INTEGER NOT NULL DEFAULT 30,
    "watermarkOpacity" INTEGER NOT NULL DEFAULT 45,
    "watermarkVersion" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("agentSharePercent", "autoLeadResponseTasks", "bankAccountName", "bankAccountNumber", "bankIban", "bankName", "bankSwift", "companyName", "defaultCurrency", "fawranAlias", "fawranEnabled", "id", "leadAutoReassignHours", "leadEscalationUserId", "leadResponseSlaMinutes", "paymentInstructions", "rentDepositMonths", "rentalCommissionPercent", "reservationHoldHours", "saleCommissionPercent", "saleDepositPercent", "updatedAt") SELECT "agentSharePercent", "autoLeadResponseTasks", "bankAccountName", "bankAccountNumber", "bankIban", "bankName", "bankSwift", "companyName", "defaultCurrency", "fawranAlias", "fawranEnabled", "id", "leadAutoReassignHours", "leadEscalationUserId", "leadResponseSlaMinutes", "paymentInstructions", "rentDepositMonths", "rentalCommissionPercent", "reservationHoldHours", "saleCommissionPercent", "saleDepositPercent", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
