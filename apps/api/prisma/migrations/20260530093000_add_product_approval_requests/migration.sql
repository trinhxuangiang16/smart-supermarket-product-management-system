-- Keep product history intact when a product is removed from active operations.
ALTER TABLE `Product`
  ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `deletedAt` DATETIME(3) NULL;

CREATE INDEX `Product_isDeleted_idx` ON `Product`(`isDeleted`);

CREATE TABLE `ApprovalRequest` (
  `id` VARCHAR(191) NOT NULL,
  `type` ENUM('PRODUCT_UPDATE', 'PRODUCT_DELETE') NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `productId` VARCHAR(191) NOT NULL,
  `requestedById` VARCHAR(191) NOT NULL,
  `reviewedById` VARCHAR(191) NULL,
  `reason` VARCHAR(191) NOT NULL,
  `requestedChanges` JSON NULL,
  `before` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewedAt` DATETIME(3) NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `ApprovalRequest_status_idx` ON `ApprovalRequest`(`status`);
CREATE INDEX `ApprovalRequest_type_idx` ON `ApprovalRequest`(`type`);
CREATE INDEX `ApprovalRequest_productId_idx` ON `ApprovalRequest`(`productId`);
CREATE INDEX `ApprovalRequest_requestedById_idx` ON `ApprovalRequest`(`requestedById`);
CREATE INDEX `ApprovalRequest_createdAt_idx` ON `ApprovalRequest`(`createdAt`);

ALTER TABLE `ApprovalRequest`
  ADD CONSTRAINT `ApprovalRequest_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ApprovalRequest_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ApprovalRequest_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
