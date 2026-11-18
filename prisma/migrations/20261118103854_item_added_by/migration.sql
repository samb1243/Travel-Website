-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "createdById" TEXT;

-- CreateIndex
CREATE INDEX "Item_createdById_idx" ON "Item"("createdById");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: until now only a trip's owner could add bookings, so credit them.
UPDATE "Item" AS i SET "createdById" = t."ownerId" FROM "Trip" AS t WHERE t."id" = i."tripId";
