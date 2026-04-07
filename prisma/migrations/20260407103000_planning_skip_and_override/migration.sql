-- Planning: skip checks, optional effective-hours override, anchor predictions on daily entries.

ALTER TABLE `equipment`
    ADD COLUMN `planningEffectiveHoursOverride` DECIMAL(12, 2) NULL,
    ADD COLUMN `planningEffectiveHoursNote` VARCHAR(191) NULL;

ALTER TABLE `checksheet`
    ADD COLUMN `skippedAt` DATETIME(3) NULL;

ALTER TABLE `checksheet`
    MODIFY COLUMN `status` ENUM(
        'PREDICTED',
        'ISSUE_REQUIRED',
        'NEAR_DUE',
        'ISSUED',
        'COMPLETED',
        'OVERDUE',
        'SKIPPED'
    ) NOT NULL DEFAULT 'PREDICTED';
