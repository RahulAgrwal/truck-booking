# 🚚 TruckingGO - Master PRD, Technical Spec & UI Design Guide

**Target Audience:** AI Coding Assistants (Claude CLI / Full-Stack Developer) & AI UI Generators (Google Stitch)
**App Name:** TruckingGO
**Primary Interface:** Mobile-First Web Application (Progressive Web App approach)

## 1. Project Overview & Vision
**Product Vision:** TruckingGO is a fast, transparent, mobile-first logistics marketplace. It connects Shippers (who have goods to move) with Carriers (truck owners) through a real-time, reverse-auction bidding system.
**Core Differentiator:** Unlike traditional load boards, TruckingGO uses a strictly time-bound auction model. When a timer runs out, or a Shipper accepts a bid, the auction locks instantly.
**Target Platforms:** Mobile Web App. The UI must feel like a native iOS/Android application (bottom navigation, swipeable cards, sticky bottom buttons).

### User Personas & Roles
1. **The Shipper (User Facing):** e.g., Factory Owner, Distributor. Needs to ship material from Point A to Point B. Wants the best price fast. Cares about clear UI, seeing live bids, and a simple 1-click "Accept Bid" button.
2. **The Carrier (Truck Owner Facing):** e.g., Independent Truck Driver. Needs a dark-mode friendly, high-contrast feed to quickly see available loads nearby, check the countdown timer, and submit a bid with thick, easy-to-tap buttons.

---

## 2. Technical Architecture & Technology Stack
*   **Framework:** Next.js 16.3.0 (Strictly using **App Router**, React Server Components, and Server Actions)
*   **Database:** PostgreSQL 17
*   **ORM:** Prisma ORM for type-safe database queries and migrations.
*   **Authentication:** Firebase Authentication (Google OAuth provider) with Firebase Admin SDK for backend session/cookie verification.
*   **Deployment & Cloud:** Google Cloud Platform (GCP)
    *   *Compute:* Google Cloud Run (Containerized Next.js app)
    *   *Database:* NeonDB - PostgreSQL 17: Databse Name /trucking-go -> we can Have Two schema inside it.
    *   *Background Tasks:* Google Cloud Scheduler (Cron job for closing expired auctions)
*   **Styling & UI:** Tailwind CSS, Shadcn UI (for accessible, mobile-friendly components), Lucide React (Icons).
*   **State Management:** Next.js native `fetch` with Server Actions and React hook state.

---

## 3. Database Schema (PostgreSQL 17 + Prisma)
*Instruction for Claude CLI: Use this exact schema for database initialization.*

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  SHIPPER
  CARRIER
}

enum AuctionStatus {
  ACTIVE
  CLOSED_EXPIRED
  COMPLETED_ASSIGNED
}

enum BidStatus {
  PENDING
  ACCEPTED
  REJECTED
}

model User {
  id           String    @id @default(uuid())
  firebaseUid  String    @unique
  email        String    @unique
  name         String
  profileImage String?
  role         Role?     // Nullable initially until onboarding
  createdAt    DateTime  @default(now())
  
  auctions     Auction[] @relation("ShipperAuctions")
  bids         Bid[]     @relation("CarrierBids")
}

model Auction {
  id               String        @id @default(uuid())
  shipperId        String
  pickupLocation   String
  dropoffLocation  String
  materialDetails  String
  weightKg         Float
  status           AuctionStatus @default(ACTIVE)
  endTime          DateTime
  createdAt        DateTime      @default(now())
  
  shipper          User          @relation("ShipperAuctions", fields: [shipperId], references: [id])
  bids             Bid[]
}

model Bid {
  id         String    @id @default(uuid())
  auctionId  String
  carrierId  String
  amount     Float
  status     BidStatus @default(PENDING)
  createdAt  DateTime  @default(now())

  auction    Auction   @relation(fields: [auctionId], references: [id])
  carrier    User      @relation("CarrierBids", fields: [carrierId], references: [id])
}
```

---

## 4. Application Architecture & File Structure (Next.js 16.3.0)

```text
/src
  /app
    /api
      /cron/route.ts                # GCP Cloud Scheduler endpoint to close expired auctions
    /(auth)
      /login/page.tsx               # Firebase Google Auth UI
      /onboarding/page.tsx          # Role selection (Shipper vs Carrier)
    /(dashboard)
      /shipper
        /page.tsx                   # Shipper Dashboard (Active auctions)
        /create/page.tsx            # Form to create auction
        /auction/[id]/page.tsx      # Auction details & live bids
      /carrier
        /page.tsx                   # Global feed of active auctions
        /bids/page.tsx              # History of carrier's bids
        /auction/[id]/page.tsx      # Auction details & bid submission form
    layout.tsx                      # Root layout (Firebase Provider)
    page.tsx                        # Landing page -> redirects to dashboard if logged in
  /components
    /ui                             # Shadcn components (buttons, inputs, cards)
    /mobile-nav.tsx                 # Bottom Navigation Bar
    /auction-card.tsx               # Reusable card for auctions
    /timer.tsx                      # Countdown timer component for auctions
  /lib
    /firebase
      clientApp.ts                  # Firebase client SDK initialization
      adminApp.ts                   # Firebase Admin SDK (token verification)
    /prisma.ts                      # Prisma client singleton
    /actions                        # Next.js Server Actions
      auction.ts                    # Create auction, accept bid
      bid.ts                        # Submit bid
      user.ts                       # Set user role
```

---

## 5. Core Business Logic & Authentication Flow
*   **Firebase + Next.js App Router Auth Bridge:**
    1. User clicks "Login with Google" on the client (Firebase Client SDK).
    2. Client sends the Firebase ID Token to a Next.js Server Action to set an `HttpOnly` cookie.
    3. Next.js Middleware/Server Components verify the cookie using Firebase Admin SDK.
    4. If the user doesn't exist in Postgres, insert them. If `role` is null, redirect to `/onboarding`.
*   **Auction Timer Handling:** Auctions have an `endTime`. The frontend displays a real-time countdown.
*   **Time Expiration (Cron Job):** A serverless endpoint (`/api/cron`) triggered by GCP Cloud Scheduler every minute runs: `UPDATE Auction SET status = 'CLOSED_EXPIRED' WHERE status = 'ACTIVE' AND endTime <= NOW();`
*   **Accepting a Bid (Transaction):** When a Shipper accepts a bid, a Prisma transaction must:
    1. Update the chosen Bid to `ACCEPTED`.
    2. Update all other Bids for this auction to `REJECTED`.
    3. Update Auction status to `COMPLETED_ASSIGNED`.

---
---

## 6. Global Design System (For Google Stitch)
*Copy & Paste this into Google Stitch as your base context/theme before generating screens.*

> **Project Context:** Create a UI for a mobile-first logistics app named "TruckingGO". The design language must be modern, highly utilitarian, and accessible for truck drivers (large tap targets). 
> **Color Palette:** 
> *   Primary Brand: Bold Safety Orange (#FF6B00) and Trustworthy Navy Blue (#0F172A).
> *   Backgrounds: Off-white (#F8FAFC) for light mode, deep slate (#020617) for dark mode.
> *   Semantic Colors: Success Green (#10B981) for accepted bids, Alert Red (#EF4444) for expiring timers.
> **Typography:** Sans-serif, highly legible (Inter or Roboto). Use heavy font weights (Bold/Black) for prices and countdown timers.
> **Components:** Use soft-rounded cards (border-radius: 12px), subtle drop shadows, and full-width sticky buttons at the bottom of screens for primary actions. Incorporate standard mobile elements like a Bottom Navigation Bar.

---

## 7. View-by-View UI Generation Prompts (For Google Stitch)
Ui already Created using Stitch -> Use Stitch MCP to fetch screens from Project name : "TruckingGO Logistics Marketplace (Having 11 Screens)"

**View 1: Splash & Login Screen**
> Generate a mobile UI Login screen for "TruckingGO". At the center top, display a modern, bold logo featuring a subtle truck icon in Safety Orange and Navy Blue. In the center, add welcome text: "Find loads. Book trucks. Instantly." At the bottom, place a large, full-width button: "Continue with Google" featuring the Google "G" logo. Below it, subtle text: "By logging in, you agree to our Terms of Service."

**View 2: Role Selection (Onboarding)**
> Generate a mobile UI Onboarding screen for TruckingGO. Title: "Choose your role". Subtitle: "You can change this later in settings." Create two large, vertical, selectable UI cards. Card 1 (Shipper): Icon of a factory box. Title: "I have material to ship." Card 2 (Carrier): Icon of a semi-truck. Title: "I am a Truck Owner." The selected card should have a thick Safety Orange border and a checkmark. At the bottom, a sticky full-width primary button: "Continue".

**View 3: Shipper Dashboard (Active Auctions)**
> Generate the main mobile Dashboard screen for the "Shipper" role. Header: "My Auctions", a notification bell icon, and a user avatar. Body: A list of "Active Auction" cards. Each card contains: A pulsing red "Live" badge, a countdown timer ("02h 14m remaining"), Location details ("Mumbai, MH" to "Pune, MH"), Load details ("5 Tons • Steel Coils"), and a callout showing "3 Bids Received". Navigation: A Bottom Navigation Bar (Home, History, Profile). Action: A large Floating Action Button (FAB) in the bottom right corner with a "+" icon in Safety Orange.

**View 4: Create Auction Form (Shipper)**
> Generate a mobile UI screen for "Create New Auction". Header: Back arrow and title "Post a Load". Body: A scrollable form with clean input fields: "Pickup Location", "Drop-off Location", "Material Description", "Weight (in Tons)". Add segmented control chips for "Auction Duration": [1 Hour] [6 Hours] [12 Hours] [24 Hours]. Footer: A sticky bottom container with a full-width Primary Button: "Start Auction Now".

**View 5: Shipper Auction Details & Accept Bid**
> Generate a detailed mobile UI screen for a specific active auction (Shipper view). Top Section: A card summarizing the load and a large, bold red countdown timer "Time Left: 00h 45m 12s". Divider: Bold section header "Live Bids (4)". List of Bids: Generate bid cards showing Carrier Name (e.g., "Rajesh Transport") with an avatar, Bid Amount in a large bold green font, "Time submitted: 5 mins ago", and a medium-sized button inside the card saying "Accept Bid". Give the lowest bid a "Best Price" badge.

**View 6: Carrier Dashboard (Load Feed)**
> Generate the main mobile Dashboard for the "Carrier / Truck Owner" role. Header: Search bar with filter icon. Below it, horizontal scrollable filter chips: "All", "Nearby", "Expiring Soon", "High Weight". Body: Scrollable feed of "Load Available" cards showing pickup/drop-off cities, distance ("15 miles away"), material/weight info, a highly visible countdown timer in red, and a button saying "View & Bid". Navigation: Bottom Navigation Bar (Find Loads, My Bids, Profile).

**View 7: Place a Bid Screen (Carrier)**
> Generate a mobile UI screen for a Carrier placing a bid. Header: Back arrow, title "Submit Bid". Top Card: Minimal summary of the route, material, and a ticking countdown timer. Middle Section: A large, centered numeric input field with a currency symbol. Below it, text: "Current lowest bid is $450". Footer: A sticky bottom section with warning text "Bids cannot be canceled once submitted" and a massive, full-width confirmation button "Submit Bid".

---
---

## 8. AI Coding Implementation Guide (For Claude CLI)
*To build the codebase, paste these prompts sequentially into Claude CLI (Claude Engineer). Do not combine them; AI context windows work best iteratively.*

**Prompt 1: Initialization & Setup**
> "Read the TruckingGO PRD. I want to build this mobile-first web app using Next.js 16.3.0, Tailwind CSS, and Shadcn UI. Please initialize the Next.js project, set up the folder structure mapping my PRD, install Prisma, and create the `prisma/schema.prisma` file using the exact PostgreSQL 17 schema provided. Also, create a standard Dockerfile for GCP Cloud Run deployment."

**Prompt 2: Authentication Foundation**
> "Now, let's implement the Firebase Google Authentication. Create the Firebase client config and Firebase Admin config. Implement the `/login` page, the token verification logic (using cookies to maintain session for Server Components), and the `/onboarding` page where a user selects if they are a 'SHIPPER' or 'CARRIER', saving this to the Postgres DB via a Server Action."

**Prompt 3: Shipper Module (Create & View)**
> "Next, build the Shipper Module. Create a bottom navigation bar for mobile. Implement the `/shipper` dashboard showing their active auctions. Implement the `/shipper/create` page with a form to create a new Auction load with a specified end time. Write the Next.js Server Action to insert this into PostgreSQL using Prisma."

**Prompt 4: Carrier Module & Bidding**
> "Now build the Carrier Module. Implement the `/carrier` dashboard showing a global feed of 'ACTIVE' auctions. Create the `/carrier/auction/[id]` page where a truck owner can view load details, see a countdown timer component, and submit a price Bid using a Server Action. Make sure the UI is mobile-friendly using Tailwind."

**Prompt 5: Auction Finalization & Cron**
> "Finally, let's wire up the auction completion logic. On the `/shipper/auction/[id]` page, list all bids and allow the shipper to 'Accept' a bid. Write a Server Action that uses Prisma transactions to accept the bid, reject others, and close the auction. Also, create a secure `/api/cron/route.ts` route to automatically close expired auctions that GCP Cloud Scheduler will call."