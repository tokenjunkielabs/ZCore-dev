ALTER TABLE `CreditEvent`
    ADD COLUMN `disputed` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `disputeReason` VARCHAR(191) NULL,
    ADD COLUMN `disputedAt` DATETIME(3) NULL,
    ADD COLUMN `disputedBy` VARCHAR(191) NULL;
