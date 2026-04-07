-- CreateIndex
CREATE INDEX `dailyentry_status_entryDate_idx` ON `dailyentry`(`status`, `entryDate`);

-- CreateIndex
CREATE INDEX `dailyentry_equipmentId_status_entryDate_idx` ON `dailyentry`(`equipmentId`, `status`, `entryDate`);
