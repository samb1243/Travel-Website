-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "costPerPersonEur" DECIMAL(14,2);

-- CreateIndex
CREATE INDEX "Trip_visibility_durationDays_idx" ON "Trip"("visibility", "durationDays");
