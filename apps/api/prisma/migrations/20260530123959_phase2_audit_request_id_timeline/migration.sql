-- AlterTable
ALTER TABLE `AuditLog` ADD COLUMN `requestId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `AuditLog_requestId_createdAt_idx` ON `AuditLog`(`requestId`, `createdAt`);
