-- AlterTable
ALTER TABLE `Category` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `Supplier` ADD COLUMN `contactPerson` VARCHAR(191) NULL,
    ADD COLUMN `notes` TEXT NULL;

-- CreateTable
CREATE TABLE `PriceHistory` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `oldCostPrice` DECIMAL(12, 2) NOT NULL,
    `newCostPrice` DECIMAL(12, 2) NOT NULL,
    `oldSellingPrice` DECIMAL(12, 2) NOT NULL,
    `newSellingPrice` DECIMAL(12, 2) NOT NULL,
    `changedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PriceHistory_productId_createdAt_idx`(`productId`, `createdAt`),
    INDEX `PriceHistory_changedById_createdAt_idx`(`changedById`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PriceHistory` ADD CONSTRAINT `PriceHistory_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PriceHistory` ADD CONSTRAINT `PriceHistory_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
