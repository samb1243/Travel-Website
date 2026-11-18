-- Splits the single booking status into a main status and a separate payment
-- status, and gives gear / "other" items bought / to buy / already have.
-- Hand-written so existing items keep their meaning:
--   bookings:  BOOKED          -> booked, paid
--              PAY_ON_ARRIVAL  -> booked (stays, flights, or with a confirmation
--                                 number) or no booking needed; pay on arrival
--              TO_BOOK         -> to book; to pay if it has a price
--              NOT_NEEDED      -> no booking needed; pay on arrival if it has a price
--   gear:      BOOKED / PAY_ON_ARRIVAL -> bought, TO_BOOK -> to buy, NOT_NEEDED -> already have
--   other:     BOOKED -> bought, TO_BOOK / PAY_ON_ARRIVAL -> to buy, NOT_NEEDED -> none

CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'PAY_ON_ARRIVAL', 'TO_PAY');
ALTER TABLE "Item" ADD COLUMN "payment" "PaymentStatus";

ALTER TYPE "ItemStatus" RENAME TO "ItemStatus_old";
CREATE TYPE "ItemStatus" AS ENUM ('BOOKED', 'TO_BOOK', 'NOT_NEEDED', 'BOUGHT', 'TO_BUY', 'HAVE');

DROP INDEX IF EXISTS "Item_tripId_status_idx";
ALTER TABLE "Item" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Item" ALTER COLUMN "status" DROP NOT NULL;
ALTER TABLE "Item" RENAME COLUMN "status" TO "status_old";
ALTER TABLE "Item" ADD COLUMN "status" "ItemStatus";

UPDATE "Item" SET
  "status" = (CASE "status_old"::text
    WHEN 'BOOKED' THEN 'BOOKED'
    WHEN 'TO_BOOK' THEN 'TO_BOOK'
    WHEN 'NOT_NEEDED' THEN 'NOT_NEEDED'
    ELSE CASE WHEN "category" IN ('ACCOMMODATION', 'FLIGHT') OR "confirmationCode" IS NOT NULL
              THEN 'BOOKED' ELSE 'NOT_NEEDED' END
  END)::"ItemStatus",
  "payment" = (CASE "status_old"::text
    WHEN 'BOOKED' THEN 'PAID'
    WHEN 'PAY_ON_ARRIVAL' THEN 'PAY_ON_ARRIVAL'
    WHEN 'TO_BOOK' THEN CASE WHEN "cost" > 0 THEN 'TO_PAY' END
    WHEN 'NOT_NEEDED' THEN CASE WHEN "cost" > 0 THEN 'PAY_ON_ARRIVAL' END
  END)::"PaymentStatus"
WHERE "category" NOT IN ('GEAR', 'OTHER');

UPDATE "Item" SET
  "status" = (CASE "status_old"::text
    WHEN 'BOOKED' THEN 'BOUGHT'
    WHEN 'PAY_ON_ARRIVAL' THEN CASE WHEN "category" = 'GEAR' THEN 'BOUGHT' ELSE 'TO_BUY' END
    WHEN 'TO_BOOK' THEN 'TO_BUY'
    WHEN 'NOT_NEEDED' THEN CASE WHEN "category" = 'GEAR' THEN 'HAVE' END
  END)::"ItemStatus",
  "payment" = NULL
WHERE "category" IN ('GEAR', 'OTHER');

ALTER TABLE "Item" DROP COLUMN "status_old";
DROP TYPE "ItemStatus_old";

CREATE INDEX "Item_tripId_status_idx" ON "Item"("tripId", "status");
