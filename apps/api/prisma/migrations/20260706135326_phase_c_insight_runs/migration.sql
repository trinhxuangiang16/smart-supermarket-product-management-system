-- CreateTable
CREATE TABLE `InsightRun` (
    `id` VARCHAR(191) NOT NULL,
    `topic` VARCHAR(191) NOT NULL,
    `inputHash` VARCHAR(191) NOT NULL,
    `resultJson` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InsightRun_topic_createdAt_idx`(`topic`, `createdAt`),
    UNIQUE INDEX `InsightRun_topic_inputHash_key`(`topic`, `inputHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
