/*
  Warnings:

  - A unique constraint covering the columns `[equipmentId,entryDate,status]` on the table `DailyEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `dailyentry` DROP FOREIGN KEY `DailyEntry_equipmentId_fkey`;

-- DropIndex
DROP INDEX `DailyEntry_equipmentId_entryDate_key` ON `dailyentry`;

-- AlterTable
ALTER TABLE `dailyentry` ADD COLUMN `approvedAt` DATETIME(3) NULL,
    ADD COLUMN `approvedById` VARCHAR(191) NULL,
    ADD COLUMN `rejectedAt` DATETIME(3) NULL,
    ADD COLUMN `rejectedById` VARCHAR(191) NULL,
    ADD COLUMN `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX `DailyEntry_status_idx` ON `DailyEntry`(`status`);

-- CreateIndex
CREATE INDEX `DailyEntry_equipmentId_status_idx` ON `DailyEntry`(`equipmentId`, `status`);

-- CreateIndex
CREATE UNIQUE INDEX `DailyEntry_equipmentId_entryDate_status_key` ON `DailyEntry`(`equipmentId`, `entryDate`, `status`);

-- AddForeignKey
ALTER TABLE `DailyEntry` ADD CONSTRAINT `DailyEntry_equipmentId_fkey` FOREIGN KEY (`equipmentId`) REFERENCES `Equipment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyEntry` ADD CONSTRAINT `DailyEntry_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyEntry` ADD CONSTRAINT `DailyEntry_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyEntry` ADD CONSTRAINT `DailyEntry_rejectedById_fkey` FOREIGN KEY (`rejectedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
