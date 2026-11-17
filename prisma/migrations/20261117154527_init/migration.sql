-- CreateEnum
CREATE TYPE "TripType" AS ENUM ('BACKPACKING', 'MULTI_CITY', 'HIKING', 'OTHER');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('FLIGHT', 'ACCOMMODATION', 'TRANSPORT', 'ACTIVITY', 'FOOD', 'GEAR', 'OTHER');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('BOOKED', 'PAY_ON_ARRIVAL', 'TO_BOOK', 'NOT_NEEDED');

-- CreateEnum
CREATE TYPE "LinkKind" AS ENUM ('BOOKING', 'CONFIRMATION', 'MAP', 'INFO', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "homeCurrency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "TripType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "coverImageUrl" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "budget" DECIMAL(14,2),
    "travellers" INTEGER NOT NULL DEFAULT 1,
    "copiedFromTripId" TEXT,
    "copiedFromTitle" TEXT,
    "copiedFromAuthor" TEXT,
    "durationDays" INTEGER,
    "countryCodes" TEXT[],
    "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stop" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "country" TEXT,
    "countryCode" CHAR(2),
    "placeId" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "arriveOn" DATE,
    "departOn" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "stopId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "category" "ItemCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "provider" TEXT,
    "startAt" TIMESTAMP(0),
    "endAt" TIMESTAMP(0),
    "fromPlace" TEXT,
    "toPlace" TEXT,
    "cost" DECIMAL(14,2),
    "currency" CHAR(3),
    "status" "ItemStatus" NOT NULL DEFAULT 'TO_BOOK',
    "confirmationCode" TEXT,
    "notes" TEXT,
    "privateNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemLink" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "kind" "LinkKind" NOT NULL DEFAULT 'OTHER',
    "label" TEXT,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ItemLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedTrip" (
    "userId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedTrip_pkey" PRIMARY KEY ("userId","tripId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_slug_key" ON "Trip"("slug");

-- CreateIndex
CREATE INDEX "Trip_ownerId_updatedAt_idx" ON "Trip"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "Trip_visibility_publishedAt_idx" ON "Trip"("visibility", "publishedAt");

-- CreateIndex
CREATE INDEX "Stop_tripId_position_idx" ON "Stop"("tripId", "position");

-- CreateIndex
CREATE INDEX "Stop_placeId_idx" ON "Stop"("placeId");

-- CreateIndex
CREATE INDEX "Item_tripId_status_idx" ON "Item"("tripId", "status");

-- CreateIndex
CREATE INDEX "Item_stopId_idx" ON "Item"("stopId");

-- CreateIndex
CREATE INDEX "ItemLink_itemId_idx" ON "ItemLink"("itemId");

-- CreateIndex
CREATE INDEX "SavedTrip_tripId_idx" ON "SavedTrip"("tripId");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_copiedFromTripId_fkey" FOREIGN KEY ("copiedFromTripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stop" ADD CONSTRAINT "Stop_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "Stop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemLink" ADD CONSTRAINT "ItemLink_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedTrip" ADD CONSTRAINT "SavedTrip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedTrip" ADD CONSTRAINT "SavedTrip_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
