-- A trip can now have several types (e.g. backpacking AND multi-city), and there
-- are more types to choose from. Existing trips keep their type: it's copied
-- into the new list before the old column is dropped.

-- New types (Postgres 12+ allows this inside the migration's transaction as
-- long as the new values aren't used in the same transaction, and they aren't).
ALTER TYPE "TripType" ADD VALUE 'CITY_BREAK';
ALTER TYPE "TripType" ADD VALUE 'ROAD_TRIP';
ALTER TYPE "TripType" ADD VALUE 'RAIL';
ALTER TYPE "TripType" ADD VALUE 'CYCLING';
ALTER TYPE "TripType" ADD VALUE 'BEACH';
ALTER TYPE "TripType" ADD VALUE 'SNOW';
ALTER TYPE "TripType" ADD VALUE 'WILDLIFE';
ALTER TYPE "TripType" ADD VALUE 'FAMILY';

-- AlterTable: add the list, fill it from the old single type, then drop that
ALTER TABLE "Trip" ADD COLUMN "types" "TripType"[] DEFAULT ARRAY['OTHER']::"TripType"[];
UPDATE "Trip" SET "types" = ARRAY["type"];
ALTER TABLE "Trip" DROP COLUMN "type";

-- CreateIndex: Explore filters with "types contains X"
CREATE INDEX "Trip_types_idx" ON "Trip" USING GIN ("types");
