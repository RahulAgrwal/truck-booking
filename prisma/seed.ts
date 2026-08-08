/**
 * Demo data covering every state both lanes need to see (TechnicalDocument.md §3.4).
 * Idempotent: clears the tables, then inserts. Safe to re-run.
 *
 *   npm run db:seed
 */
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: ".env.local", override: false, quiet: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const from = (offsetMs: number) => new Date(Date.now() + offsetMs);

async function main() {
  // Children first — Bid references both Auction and User.
  await prisma.bid.deleteMany();
  await prisma.auction.deleteMany();
  await prisma.user.deleteMany();

  const shipper1 = await prisma.user.create({
    data: {
      firebaseUid: "dev-shipper-1",
      email: "shipper1@demo.test",
      name: "Anand Steelworks",
      role: "SHIPPER",
    },
  });

  const shipper2 = await prisma.user.create({
    data: {
      firebaseUid: "dev-shipper-2",
      email: "shipper2@demo.test",
      name: "Meera Distributors",
      role: "SHIPPER",
    },
  });

  const createCarrier = (uid: string, email: string, name: string) =>
    prisma.user.create({ data: { firebaseUid: uid, email, name, role: "CARRIER" } });

  const carrier1 = await createCarrier("dev-carrier-1", "carrier1@demo.test", "Rajesh Transport");
  const carrier2 = await createCarrier("dev-carrier-2", "carrier2@demo.test", "Singh Logistics");
  const carrier3 = await createCarrier("dev-carrier-3", "carrier3@demo.test", "Coastal Carriers");

  // Exercises the /onboarding redirect — signed in, no role yet.
  await prisma.user.create({
    data: {
      firebaseUid: "dev-newcomer",
      email: "newcomer@demo.test",
      name: "Unassigned User",
      role: null,
    },
  });

  // 1. ACTIVE, 3 bids — the happy-path dashboard card.
  const auction1 = await prisma.auction.create({
    data: {
      shipperId: shipper1.id,
      pickupLocation: "Mumbai, MH",
      dropoffLocation: "Pune, MH",
      materialDetails: "Steel Coils",
      weightKg: 5000,
      pickupLat: 19.076,
      pickupLng: 72.8777,
      dropoffLat: 18.5204,
      dropoffLng: 73.8567,
      distanceKm: 148.2,
      estimatedTimeMins: 195,
      endTime: from(2 * HOUR + 14 * MINUTE),
      status: "ACTIVE",
    },
  });

  // 2. ACTIVE, no bids — exercises the "0 Bids" neutral badge.
  await prisma.auction.create({
    data: {
      shipperId: shipper1.id,
      pickupLocation: "Delhi, DL",
      dropoffLocation: "Jaipur, RJ",
      materialDetails: "Electronics",
      weightKg: 12000,
      pickupLat: 28.7041,
      pickupLng: 77.1025,
      dropoffLat: 26.9124,
      dropoffLng: 75.7873,
      distanceKm: 281.4,
      estimatedTimeMins: 330,
      endTime: from(5 * HOUR + 45 * MINUTE),
      status: "ACTIVE",
    },
  });

  // 3. ACTIVE, expiring in 4 minutes — exercises the red urgent timer.
  const auction3 = await prisma.auction.create({
    data: {
      shipperId: shipper1.id,
      pickupLocation: "Surat, GJ",
      dropoffLocation: "Ahmedabad, GJ",
      materialDetails: "Textile Rolls",
      weightKg: 3500,
      pickupLat: 21.1702,
      pickupLng: 72.8311,
      dropoffLat: 23.0225,
      dropoffLng: 72.5714,
      distanceKm: 265.0,
      estimatedTimeMins: 285,
      endTime: from(4 * MINUTE),
      status: "ACTIVE",
    },
  });

  // 4. CLOSED_EXPIRED — bids stay PENDING, nobody won.
  const auction4 = await prisma.auction.create({
    data: {
      shipperId: shipper2.id,
      pickupLocation: "Chennai, TN",
      dropoffLocation: "Bengaluru, KA",
      materialDetails: "Auto Parts",
      weightKg: 8000,
      pickupLat: 13.0827,
      pickupLng: 80.2707,
      dropoffLat: 12.9716,
      dropoffLng: 77.5946,
      distanceKm: 346.1,
      estimatedTimeMins: 400,
      endTime: from(-1 * HOUR),
      status: "CLOSED_EXPIRED",
    },
  });

  // 5. COMPLETED_ASSIGNED — one winner, the rest rejected.
  const auction5 = await prisma.auction.create({
    data: {
      shipperId: shipper2.id,
      pickupLocation: "Kolkata, WB",
      dropoffLocation: "Patna, BR",
      materialDetails: "Packaged Rice",
      weightKg: 15000,
      pickupLat: 22.5726,
      pickupLng: 88.3639,
      dropoffLat: 25.5941,
      dropoffLng: 85.1376,
      distanceKm: 585.7,
      estimatedTimeMins: 690,
      endTime: from(-24 * HOUR),
      status: "COMPLETED_ASSIGNED",
    },
  });

  await prisma.bid.createMany({
    data: [
      // Auction 1 — carrier1 bid twice (reverse auction: you lower your price).
      // Lists must show only their latest, ₹43,500. See TechnicalDocument.md §3.3.
      { auctionId: auction1.id, carrierId: carrier1.id, amount: 47000, status: "PENDING" },
      { auctionId: auction1.id, carrierId: carrier1.id, amount: 43500, status: "PENDING" },
      { auctionId: auction1.id, carrierId: carrier2.id, amount: 42000, status: "PENDING" },
      { auctionId: auction1.id, carrierId: carrier3.id, amount: 45000, status: "PENDING" },

      // Auction 3 — one bid on the nearly-expired load.
      { auctionId: auction3.id, carrierId: carrier2.id, amount: 18000, status: "PENDING" },

      // Auction 4 — expired with live bids still PENDING.
      { auctionId: auction4.id, carrierId: carrier1.id, amount: 61000, status: "PENDING" },
      { auctionId: auction4.id, carrierId: carrier3.id, amount: 58000, status: "PENDING" },

      // Auction 5 — settled.
      { auctionId: auction5.id, carrierId: carrier2.id, amount: 72000, status: "ACCEPTED" },
      { auctionId: auction5.id, carrierId: carrier1.id, amount: 78000, status: "REJECTED" },
      { auctionId: auction5.id, carrierId: carrier3.id, amount: 81000, status: "REJECTED" },
    ],
  });

  const [users, auctions, bids] = await Promise.all([
    prisma.user.count(),
    prisma.auction.count(),
    prisma.bid.count(),
  ]);
  console.log(`Seeded ${users} users, ${auctions} auctions, ${bids} bids.`);
  console.log("Auction 3 expires in ~4 minutes — use it to verify the urgent timer.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
