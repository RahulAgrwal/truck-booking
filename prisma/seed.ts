/**
 * Demo data covering every state both lanes need to see (TechnicalDocument.md §3.4)
 * plus every state the contact-exchange + ratings feature can be in
 * (docs/feature-contact-ratings.md §2).
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
const DAY = 24 * HOUR;
const from = (offsetMs: number) => new Date(Date.now() + offsetMs);

/*
  Truck numbers are stored normalised, exactly as `normalizeTruckNumber` emits
  them — no spaces. Truck types must be members of `TRUCK_TYPES`.

  Both are written as literals rather than imported from `src/lib/schemas.ts`:
  that module imports through the `@/` alias, which `tsx` does not resolve here.
  If you extend TRUCK_TYPES, these do not follow automatically.
*/

async function main() {
  // Children first. Review now references Auction and User with ON DELETE
  // RESTRICT, so it must go before all three or the truncate dies halfway.
  await prisma.review.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.auction.deleteMany();
  await prisma.user.deleteMany();

  const shipper1 = await prisma.user.create({
    data: {
      firebaseUid: "dev-shipper-1",
      email: "shipper1@demo.test",
      name: "Anand Steelworks",
      role: "SHIPPER",
      phone: "9820011223",
      address: "Plot 14, MIDC Andheri East, Mumbai 400093",
      companyName: "Anand Steelworks Pvt Ltd",
      detailsCompletedAt: from(-30 * DAY),
    },
  });

  const shipper2 = await prisma.user.create({
    data: {
      firebaseUid: "dev-shipper-2",
      email: "shipper2@demo.test",
      name: "Meera Distributors",
      role: "SHIPPER",
      phone: "9833044556",
      address: "22 Strand Road, Kolkata 700001",
      companyName: "Meera Distributors LLP",
      detailsCompletedAt: from(-28 * DAY),
    },
  });

  const createCarrier = (
    uid: string,
    email: string,
    name: string,
    phone: string,
    address: string,
    truckNumber: string,
    truckType: string,
  ) =>
    prisma.user.create({
      data: {
        firebaseUid: uid,
        email,
        name,
        role: "CARRIER",
        phone,
        address,
        truckNumber,
        truckType,
        detailsCompletedAt: from(-25 * DAY),
      },
    });

  const carrier1 = await createCarrier(
    "dev-carrier-1",
    "carrier1@demo.test",
    "Rajesh Transport",
    "9812345670",
    "Transport Nagar, Sector 26, Chandigarh 160019",
    "MH12AB1234",
    "Open Body",
  );
  const carrier2 = await createCarrier(
    "dev-carrier-2",
    "carrier2@demo.test",
    "Singh Logistics",
    "9876501234",
    "GT Road, Ludhiana 141003",
    "PB10CD5678",
    "Container",
  );
  const carrier3 = await createCarrier(
    "dev-carrier-3",
    "carrier3@demo.test",
    "Coastal Carriers",
    "9840112233",
    "Anna Salai, Chennai 600002",
    "TN09EF9012",
    "Trailer",
  );

  /*
    Exercises the onboarding chain end to end: no role, so /onboarding; then
    setUserRole hands over to /onboarding/details, because detailsCompletedAt is
    null. Reach it with DEV_BYPASS_ROLE=NONE. It is deliberately the only user
    without details — every other seeded user must land on a dashboard, or the
    whole app looks broken behind B5's guard.
  */
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
  // Rule 1 must reveal nothing here, to anyone, however the status column reads.
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

  /*
    5–9 are COMPLETED_ASSIGNED: one winner each, the rest rejected. These are
    the only auctions where contact details are exchanged, and the only ones a
    review can attach to. Between them they cover every state the feature has —
    see the table in docs/progress-B.md, B7 notes.
  */

  // 5. Settled, and reviewed by both sides — rate sheet collapsed for everyone.
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

  // 6. Settled, reviewed by both sides.
  const auction6 = await prisma.auction.create({
    data: {
      shipperId: shipper1.id,
      pickupLocation: "Nagpur, MH",
      dropoffLocation: "Nashik, MH",
      materialDetails: "Cement Bags",
      weightKg: 20000,
      pickupLat: 21.1458,
      pickupLng: 79.0882,
      dropoffLat: 19.9975,
      dropoffLng: 73.7898,
      distanceKm: 601.3,
      estimatedTimeMins: 660,
      endTime: from(-6 * DAY),
      status: "COMPLETED_ASSIGNED",
    },
  });

  // 7. Settled, reviewed by NEITHER side — both parties see an open rate sheet.
  const auction7 = await prisma.auction.create({
    data: {
      shipperId: shipper1.id,
      pickupLocation: "Indore, MP",
      dropoffLocation: "Bhopal, MP",
      materialDetails: "Soya Meal",
      weightKg: 9000,
      pickupLat: 22.7196,
      pickupLng: 75.8577,
      dropoffLat: 23.2599,
      dropoffLng: 77.4126,
      distanceKm: 195.4,
      estimatedTimeMins: 230,
      endTime: from(-3 * DAY),
      status: "COMPLETED_ASSIGNED",
    },
  });

  // 8. Settled, carrier rated the shipper but not the other way round.
  const auction8 = await prisma.auction.create({
    data: {
      shipperId: shipper2.id,
      pickupLocation: "Ludhiana, PB",
      dropoffLocation: "Chandigarh, CH",
      materialDetails: "Knitwear Cartons",
      weightKg: 4200,
      pickupLat: 30.901,
      pickupLng: 75.8573,
      dropoffLat: 30.7333,
      dropoffLng: 76.7794,
      distanceKm: 101.8,
      estimatedTimeMins: 135,
      endTime: from(-9 * DAY),
      status: "COMPLETED_ASSIGNED",
    },
  });

  // 9. Settled, shipper rated the carrier but not the other way round.
  const auction9 = await prisma.auction.create({
    data: {
      shipperId: shipper1.id,
      pickupLocation: "Coimbatore, TN",
      dropoffLocation: "Kochi, KL",
      materialDetails: "Pump Castings",
      weightKg: 11000,
      pickupLat: 11.0168,
      pickupLng: 76.9558,
      dropoffLat: 9.9312,
      dropoffLng: 76.2673,
      distanceKm: 189.6,
      estimatedTimeMins: 250,
      endTime: from(-14 * DAY),
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
      // carrier3 has no reviews at all, so this row is where "No ratings yet"
      // shows up next to a live bid.
      { auctionId: auction1.id, carrierId: carrier3.id, amount: 45000, status: "PENDING" },

      // Auction 3 — one bid on the nearly-expired load.
      { auctionId: auction3.id, carrierId: carrier2.id, amount: 18000, status: "PENDING" },

      // Auction 4 — expired with live bids still PENDING. Nobody won, so
      // neither of these carriers may see shipper2's contact details.
      { auctionId: auction4.id, carrierId: carrier1.id, amount: 61000, status: "PENDING" },
      { auctionId: auction4.id, carrierId: carrier3.id, amount: 58000, status: "PENDING" },

      // Auction 5 — settled. carrier2 won; carrier1 and carrier3 must see nothing.
      { auctionId: auction5.id, carrierId: carrier2.id, amount: 72000, status: "ACCEPTED" },
      { auctionId: auction5.id, carrierId: carrier1.id, amount: 78000, status: "REJECTED" },
      { auctionId: auction5.id, carrierId: carrier3.id, amount: 81000, status: "REJECTED" },

      // Auction 6 — carrier1 won.
      { auctionId: auction6.id, carrierId: carrier1.id, amount: 95000, status: "ACCEPTED" },
      { auctionId: auction6.id, carrierId: carrier2.id, amount: 99000, status: "REJECTED" },

      // Auction 7 — carrier3 won.
      { auctionId: auction7.id, carrierId: carrier3.id, amount: 31000, status: "ACCEPTED" },
      { auctionId: auction7.id, carrierId: carrier1.id, amount: 34000, status: "REJECTED" },

      // Auction 8 — carrier1 won.
      { auctionId: auction8.id, carrierId: carrier1.id, amount: 17500, status: "ACCEPTED" },
      { auctionId: auction8.id, carrierId: carrier3.id, amount: 19000, status: "REJECTED" },

      // Auction 9 — carrier2 won.
      { auctionId: auction9.id, carrierId: carrier2.id, amount: 28000, status: "ACCEPTED" },
      { auctionId: auction9.id, carrierId: carrier1.id, amount: 30500, status: "REJECTED" },
    ],
  });

  /*
    Reviews, and the aggregate derived from them.

    The rows are the source of truth and ratingSum/ratingCount are computed from
    this array below — never typed in by hand. That is the same invariant
    submitReview maintains inside a transaction, and a seed that quietly broke
    it would make every rating on screen a lie while every test still passed.
  */
  const reviews = [
    // Auction 5 — both sides rated. Rate sheet collapsed for shipper2 and carrier2.
    {
      auctionId: auction5.id,
      authorId: shipper2.id,
      subjectId: carrier2.id,
      stars: 5,
      comment: "Loaded on time and kept me posted the whole way. Would hire again.",
    },
    {
      auctionId: auction5.id,
      authorId: carrier2.id,
      subjectId: shipper2.id,
      stars: 4,
      comment: "Paperwork was ready at the gate. Unloading took a while.",
    },

    // Auction 6 — both sides rated.
    {
      auctionId: auction6.id,
      authorId: shipper1.id,
      subjectId: carrier1.id,
      stars: 4,
      comment: "Careful with the load. Arrived a few hours late.",
    },
    {
      auctionId: auction6.id,
      authorId: carrier1.id,
      subjectId: shipper1.id,
      stars: 5,
      comment: null,
    },

    // Auction 7 — neither side rated. No rows; both see an open rate sheet.

    // Auction 8 — carrier rated the shipper; the shipper has not reciprocated.
    {
      auctionId: auction8.id,
      authorId: carrier1.id,
      subjectId: shipper2.id,
      stars: 5,
      comment: "Straightforward job, paid without chasing.",
    },

    // Auction 9 — shipper rated the carrier; the carrier has not reciprocated.
    {
      auctionId: auction9.id,
      authorId: shipper1.id,
      subjectId: carrier2.id,
      stars: 4,
      comment: null,
    },
  ];

  await prisma.review.createMany({ data: reviews });

  const aggregates = new Map<string, { sum: number; count: number }>();
  for (const review of reviews) {
    const current = aggregates.get(review.subjectId) ?? { sum: 0, count: 0 };
    aggregates.set(review.subjectId, {
      sum: current.sum + review.stars,
      count: current.count + 1,
    });
  }

  for (const [subjectId, { sum, count }] of aggregates) {
    await prisma.user.update({
      where: { id: subjectId },
      data: { ratingSum: sum, ratingCount: count },
    });
  }

  const [users, auctions, bids, reviewCount] = await Promise.all([
    prisma.user.count(),
    prisma.auction.count(),
    prisma.bid.count(),
    prisma.review.count(),
  ]);
  console.log(`Seeded ${users} users, ${auctions} auctions, ${bids} bids, ${reviewCount} reviews.`);
  console.log("Auction 3 expires in ~4 minutes — use it to verify the urgent timer.");
  console.log("Carrier 3 has no reviews — use it to verify the 'No ratings yet' state.");
  console.log("newcomer@demo.test has no role and no details — DEV_BYPASS_ROLE=NONE.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
