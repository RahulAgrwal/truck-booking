import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  `reviews.ts` is a read model, so it imports the Prisma client, which throws at
  import time without DATABASE_URL. The client is stubbed with a spy: that lets
  the query itself be asserted — `reviewsFor`'s whole job is the shape of one
  findMany plus the mapping afterwards, and both are worth pinning.
*/
const findMany = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { review: { findMany } } }));

const { REVIEWS_PAGE_SIZE, formatRating, raterSelect, ratingAverage, reviewsFor } = await import(
  "./reviews"
);

/** Columns that may only ever be selected inside `src/lib/contact.ts`. */
const SENSITIVE_COLUMNS = ["phone", "address", "companyName", "truckNumber", "truckType"];

describe("ratingAverage", () => {
  it("is null at zero reviews, never a fabricated 0.0", () => {
    // A 0.0 renders as five empty stars, which reads as "rated badly" when the
    // truth is "not rated yet". The two must stay distinguishable.
    expect(ratingAverage(0, 0)).toBeNull();
  });

  it("is null for a negative or nonsense count rather than dividing by it", () => {
    expect(ratingAverage(5, -1)).toBeNull();
  });

  it("divides exactly", () => {
    expect(ratingAverage(9, 2)).toBe(4.5);
    expect(ratingAverage(5, 1)).toBe(5);
  });

  it("does not round — the caller decides how many digits to show", () => {
    expect(ratingAverage(10, 3)).toBeCloseTo(3.3333, 4);
  });
});

describe("formatRating", () => {
  it("says so when there are no ratings", () => {
    expect(formatRating(0, 0)).toBe("No ratings yet");
  });

  it("is one decimal place plus the count", () => {
    expect(formatRating(9, 2)).toBe("4.5 (2)");
    expect(formatRating(4, 1)).toBe("4.0 (1)");
  });

  it("keeps the trailing zero, so widths stay stable in a list", () => {
    expect(formatRating(25, 5)).toBe("5.0 (5)");
  });

  it("rounds to one decimal", () => {
    expect(formatRating(10, 3)).toBe("3.3 (3)");
  });
});

describe("raterSelect", () => {
  it("is exactly the five public reputation columns", () => {
    expect(Object.keys(raterSelect).sort()).toEqual(
      ["id", "name", "profileImage", "ratingCount", "ratingSum"].sort(),
    );
  });

  /**
   * The load-bearing test in this file.
   *
   * `raterSelect` is spread into reads all over the app — every bid row, every
   * auction detail screen — and none of those reads is gated by Rule 1, because
   * reputation is public (§2, Rule 2). Adding a sensitive column here would
   * therefore leak a phone number onto every bid card in the product, silently,
   * with no screen having done anything wrong. That is precisely the failure
   * the board calls "the one way this feature leaks".
   */
  it("contains no sensitive column — those belong to contact.ts alone", () => {
    for (const column of SENSITIVE_COLUMNS) {
      expect(Object.keys(raterSelect), `raterSelect must not select ${column}`).not.toContain(column);
    }
  });
});

describe("reviewsFor", () => {
  // The spy is module-level, so its call log would otherwise carry over and
  // every `calls[0]` below would read the first test's arguments.
  beforeEach(() => findMany.mockClear());

  it("asks for the subject's reviews, newest first, capped by take", async () => {
    findMany.mockResolvedValueOnce([]);
    await reviewsFor("user-1", 3);

    const args = findMany.mock.calls[0]?.[0];
    expect(args.where).toEqual({ subjectId: "user-1" });
    // Same column order and direction as @@index([subjectId, createdAt]).
    expect(args.orderBy).toEqual({ createdAt: "desc" });
    expect(args.take).toBe(3);
  });

  it("defaults to one page", async () => {
    findMany.mockResolvedValueOnce([]);
    await reviewsFor("user-1");
    expect(findMany.mock.calls[0]?.[0].take).toBe(REVIEWS_PAGE_SIZE);
  });

  it("selects the author by name and image only, never the whole row", async () => {
    findMany.mockResolvedValueOnce([]);
    await reviewsFor("user-1");

    const author = findMany.mock.calls[0]?.[0].select.author.select;
    expect(Object.keys(author).sort()).toEqual(["name", "profileImage"]);
    for (const column of SENSITIVE_COLUMNS) {
      expect(Object.keys(author), `author select must not include ${column}`).not.toContain(column);
    }
  });

  it("flattens the author so no nested User row reaches a component", async () => {
    const createdAt = new Date("2026-08-01T10:00:00Z");
    findMany.mockResolvedValueOnce([
      {
        id: "r1",
        stars: 4,
        comment: "Careful with the load.",
        createdAt,
        author: { name: "Anand Steelworks", profileImage: null },
      },
    ]);

    const rows = await reviewsFor("user-1");

    expect(rows).toEqual([
      {
        id: "r1",
        stars: 4,
        comment: "Careful with the load.",
        createdAt,
        authorName: "Anand Steelworks",
        authorImage: null,
      },
    ]);
    expect(rows[0]).not.toHaveProperty("author");
  });

  it("returns an empty list for someone with no reviews", async () => {
    findMany.mockResolvedValueOnce([]);
    expect(await reviewsFor("user-1")).toEqual([]);
  });
});
