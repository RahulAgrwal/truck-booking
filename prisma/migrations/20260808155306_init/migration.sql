-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SHIPPER', 'CARRIER');

-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('ACTIVE', 'CLOSED_EXPIRED', 'COMPLETED_ASSIGNED');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profileImage" TEXT,
    "role" "Role",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "shipperId" TEXT NOT NULL,
    "pickupLocation" TEXT NOT NULL,
    "dropoffLocation" TEXT NOT NULL,
    "materialDetails" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "status" "AuctionStatus" NOT NULL DEFAULT 'ACTIVE',
    "endTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "BidStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Auction_status_endTime_idx" ON "Auction"("status", "endTime");

-- CreateIndex
CREATE INDEX "Auction_shipperId_createdAt_idx" ON "Auction"("shipperId", "createdAt");

-- CreateIndex
CREATE INDEX "Bid_auctionId_amount_idx" ON "Bid"("auctionId", "amount");

-- CreateIndex
CREATE INDEX "Bid_carrierId_createdAt_idx" ON "Bid"("carrierId", "createdAt");

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_shipperId_fkey" FOREIGN KEY ("shipperId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
