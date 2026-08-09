# Feature board — email + password sign-up and sign-in

> **Plan of record for this feature.** Written before the first line of code, per CLAUDE.md §10.0.
> Status lives in the step table in §7 and mirrors `docs/progress-A.md`.
> Companion reading: [`CLAUDE.md`](../CLAUDE.md) §3/§9 · [`TechnicalDocument.md`](../TechnicalDocument.md)
> §4 (auth) · [`docs/feature-contact-ratings.md`](./feature-contact-ratings.md) (the previous follow-on
> feature, whose board shape this copies).

---

## 0. Why

TruckingGO has exactly one way in:

```
GoogleButton → signInWithPopup(Google) → Firebase ID token
             → createSession() Server Action → verifyIdToken → createSessionCookie(5d)
             → HttpOnly __session cookie → upsert User by firebaseUid
```

A user without a Google account — or one who simply does not want to hand us a Google identity — cannot
use the product at all. For an Indian logistics marketplace whose carriers are individual truck owners,
that is a hard floor on who can sign up.

This feature adds Firebase's **Email/Password** provider as a *second source of the same ID token*.

**Scope, as agreed with the user:**

| | |
|---|---|
| ✅ In | Email + password sign-in; email + password sign-up (with a display name); Google stays, unchanged |
| ❌ Out | Forgot-password / reset email · email verification · Google↔password account linking · a separate username handle |

> ⚠️ **Known consequence of the agreed scope.** With no reset flow, a forgotten password is unrecoverable
> through the app; the only remedy is a manual reset in the Firebase console. This was raised with the
> user and the scope was confirmed. What this feature *does* ship is the cheap half of the deferred work:
> honest, specific error copy for every failure mode including the Google/password collision, so a stuck
> user is told what actually happened rather than "Please try again". Adding `sendPasswordResetEmail`
> later is one screen and one client call — nothing here forecloses it.

### Deviation from the PRD, recorded

`TruckingGO_Master_PRD.md` §2 names *"Firebase Authentication (Google OAuth provider)"* as the whole of
auth, and §5 describes only the Google bridge. The PRD is shared read-only (BuildPlan §3), so it is not
edited. This document plus `TechnicalDocument.md` §4 are the record of the deviation.

---

## 1. The governing idea

**Nothing downstream of the ID token changes.**

`src/lib/firebase/clientApp.ts` already exposes `signInWithGoogle(): Promise<string>` — a function whose
whole contract is *"do the browser dance, hand back an ID token."* Email/password adds two more functions
with that identical contract, and every consumer of a token keeps working untouched:

- the same `createSession()` Server Action,
- the same `createSessionCookie(idToken, { expiresIn: 5d })`,
- the same HttpOnly `__session` cookie,
- the same `verifySessionCookie(cookie, true)` revocation check in `getSession()`,
- the same Edge-safe cookie-presence check in `src/middleware.ts`,
- the same `/onboarding` → `/onboarding/details` funnel,
- the same `firebaseUid` join key to the `User` row.

**No new session system. No password column. No new environment variable.** Firebase stores and verifies
the credential; we never see, hash, or store a password. That is the entire security argument for doing
it this way, and it is why this feature is small.

```
                    ┌─ signInWithGoogle() ──┐
   browser          ├─ signInWithEmail() ───┤──► ID token ──► createSession(idToken, name?)
                    └─ signUpWithEmail() ───┘                        │
                                                                     ▼
                                       verifyIdToken → upsert User → createSessionCookie → __session
```

---

## 2. Manual prerequisite

**Firebase Console → Authentication → Sign-in method → enable Email/Password.**

Until that toggle is on, every signup returns `auth/operation-not-allowed`. No code substitutes for it,
and the error mapper in §3.2 has a dedicated message for exactly this case so the failure is legible.

Leave "one account per email address" at its default (enabled). It is what makes Google — a
verified-email provider — link to an existing password account automatically instead of minting a second
Firebase UID for the same address.

---

## 3. Design

### 3.1 Ownership

All Lane A. This checkout's `docs/LANE.md` reads `LANE: A`, and BuildPlan §3 puts every file below in
Lane A's column: `src/app/(auth)/**`, `src/lib/firebase/**`, `src/lib/session.ts`, `src/lib/schemas.ts`,
`src/lib/actions/user.ts`, `src/middleware.ts`.

The one boundary to respect: **`src/components/` is Lane B's.** That is why the password field with its
show/hide toggle is built under `src/app/(auth)/` rather than added to `components/ui/input.tsx`.

Both lanes are code-complete (`A0`–`A7`, `B0`–`B6` and the contact/ratings feature are all `[x]`), so
there is no live conflict risk — but `git add -A` remains forbidden in this shared tree. Stage explicit
paths.

### 3.2 `src/lib/firebase/auth-errors.ts` — NEW

A pure `authErrorMessage(code: string | undefined): string | null`. Its own module rather than a function
inside `clientApp.ts` so it is unit-testable without dragging the Firebase SDK into the test environment.

| Firebase code | Copy |
|---|---|
| `auth/invalid-credential`, `auth/wrong-password`, `auth/user-not-found`, `auth/invalid-email` | **"Incorrect email or password."** |
| `auth/email-already-in-use` | "An account with this email already exists. Sign in instead." |
| `auth/weak-password` | "Choose a longer password — at least 8 characters." |
| `auth/too-many-requests` | "Too many attempts. Wait a few minutes and try again." |
| `auth/network-request-failed` | "You appear to be offline. Check your connection." |
| `auth/operation-not-allowed` | "Email sign-in isn't enabled for this app yet." |
| `auth/popup-closed-by-user`, `auth/cancelled-popup-request` | `null` — the user closed the popup; not an error |
| anything else | "Could not sign you in. Please try again." |

**The wrong-credential codes deliberately collapse to one message.** Distinguishing "no such user" from
"wrong password" turns the login form into an account-enumeration oracle. Firebase's own
`auth/invalid-credential` (its newer, deliberately vague code) already does this; we must not undo it by
special-casing `auth/user-not-found`.

### 3.3 `src/lib/firebase/clientApp.ts` — extend

```ts
export async function signInWithEmail(email: string, password: string): Promise<string>
export async function signUpWithEmail(name: string, email: string, password: string): Promise<string>
```

`signUpWithEmail` does `createUserWithEmailAndPassword` → `updateProfile(user, { displayName: name })` →
`getIdToken(true)`. The force-refresh is what pulls the freshly-set `name` claim into the token.

**We do not rely on that refresh.** Claim propagation after `updateProfile` is not contractually
immediate, so the name is *also* passed to `createSession` as an argument. Belt and suspenders, because
the failure mode is silent and permanent: a user whose name lands as their email address stays that way.

### 3.4 `src/lib/schemas.ts` — two schemas

- `EmailSignInSchema` — `email` trimmed + lowercased, `password` min 1 ("Enter your password.")
- `EmailSignUpSchema` — same plus `name` 2–80, `password` min **8** (Firebase's own floor is 6; 8 is ours),
  max 72 (a bound is better than none)

These run **on the client, for UX** — they stop a pointless round trip on an obviously bad password and
attach the error to the right field. They are **not the security boundary**: the credential is verified by
Firebase, and the resulting token is re-verified by `verifyIdToken` on the server. The comment in the file
must say so, or the next reader will assume the opposite.

`SignUpNameSchema` is exported for the server side, which validates the one client-supplied value it
actually consumes.

### 3.5 `src/lib/actions/user.ts` → `createSession` — one signature change, three fixes

```ts
export async function createSession(
  idToken: string,
  displayName?: string,   // signup only; zod-validated; ignored when the token carries a name
): Promise<ActionResult<{ next: string }>>
```

1. **Name resolution.** `decoded.name` is absent for a bare email/password token, so today the row would
   be created with `name = email`. Resolve `decoded.name?.trim() || validated(displayName) || decoded.email`.
2. **Stop clobbering on update.** The current `update:` clause writes `name` and `profileImage`
   unconditionally. Both become conditional — write only when there is a value — so a returning
   email/password user does not have their good name overwritten with their email address, and a Google
   user does not get `profileImage` nulled when the claim is momentarily absent. *(Pre-existing latent bug,
   fixed in passing because this feature is what makes it reachable.)*
3. **Map the `email @unique` collision.** `User.email` is `@unique` but the upsert keys on `firebaseUid`,
   so a second Firebase UID for an existing email attempts an **insert** → Prisma `P2002` → swallowed by
   the generic catch as "Could not sign you in. Please try again." Catch `P2002` on `email` and say:
   *"An account already exists for this email. Sign in with the method you used before."* Rare, because
   Firebase's one-account-per-email default links verified providers — but rare is not never, and the
   generic message is a dead end.
4. The hardcoded *"Your **Google** account has no email address"* is now reachable from a non-Google path;
   make it provider-neutral.

### 3.6 `src/middleware.ts` — one line

Add `"/signup"` to `PUBLIC_ONLY`, so a signed-in user hitting it is bounced to `/` exactly like `/login`.
Easy to forget; the route is otherwise reachable while authenticated.

### 3.7 New UI, all under `src/app/(auth)/`

**`password-field.tsx`** (`"use client"`) — composes Lane B's `Input` with a show/hide eye in its `suffix`
slot. The toggle is a real `<button type="button">` at `h-touch-target-min w-touch-target-min` with a
negative right margin to eat the wrapper's padding: a genuine 48×48 target inside the 48px row, not a 20px
glyph. This is the precise bug the `A6` device sweep found in every other form in the app — do not
reintroduce it. `aria-label` flips between "Show password" and "Hide password"; `aria-pressed` carries the
state.

**`email-auth-form.tsx`** (`"use client"`) — one component, `mode: "signin" | "signup"`, following the
`details-form.tsx` pattern already in the tree (`useState` values + `useTransition` + a `{ field, message }`
error object). The name field renders only in signup mode.

Submit path, mirroring `google-button.tsx` exactly:

```
zod parse locally → on failure setError(firstIssue(...)) and stop
                  → signUpWithEmail | signInWithEmail  →  idToken
                  → startTransition(() => createSession(idToken, name))
                  → result.ok ? router.replace(result.data.next) : setError(result.error)
```

Firebase throws are caught and rendered through `authErrorMessage(err.code)` in the same `role="alert"`
inline paragraph the rest of the app uses. `busy = pending || submitting` guards the double-fire, and the
`!isFirebaseConfigured` disabled state matches the Google button's.

Phone-specific wiring that is not optional: a real `<form onSubmit>` (so the keyboard's Go key submits),
`type="email" inputMode="email" autoComplete="email"`, `autoComplete="current-password"` vs `"new-password"`
by mode, `autoComplete="name"`.

**`auth-divider.tsx`** — the hairline "or" rule between the form and the Google button.

**`signup/page.tsx`** — Server Component. Same `getSession()` guard as the login page, a back arrow to
`/login`, `<h1>` "Create your account", `<EmailAuthForm mode="signup" />`, the divider, `<GoogleButton />`,
and "Already have an account? **Sign in**".

**`login/page.tsx`** — the `flex flex-col gap-stack-md` block that currently holds only `<GoogleButton />`
gains `<EmailAuthForm mode="signin" />`, the divider, the existing terms line, and a link to `/signup`.

### 3.8 Drive-by fix: `homePathFor`'s second argument

Three call sites pass only `session.role` and rely on `detailsComplete`'s documented fail-open default,
sending half-onboarded users on a redundant redirect hop. Already an open Lane B → Lane A handoff
(`docs/progress-B.md`), and two of the three are files this feature touches anyway:

- `src/app/page.tsx:12`
- `src/app/(auth)/login/page.tsx:17`
- `src/app/(auth)/onboarding/page.tsx:14`

### 3.9 Constraints this must not break

No `md:`/`lg:` breakpoints · no raw hex · no `any` · no arbitrary spacing outside the two sanctioned
patterns · every interactive element ≥48px · `Input` stays at 16px text or iOS Safari zooms the viewport
on focus · the cookie stays a `createSessionCookie` result, never a raw ID token · middleware stays a
presence check (the Admin SDK cannot run on the Edge runtime).

---

## 4. Files

| File | Change |
|---|---|
| `src/lib/firebase/auth-errors.ts` | **new** — `authErrorMessage` |
| `src/lib/firebase/auth-errors.test.ts` | **new** — mapper coverage |
| `src/lib/firebase/clientApp.ts` | `signInWithEmail`, `signUpWithEmail` |
| `src/lib/schemas.ts` | `EmailSignInSchema`, `EmailSignUpSchema`, `SignUpNameSchema` |
| `src/lib/schemas.test.ts` | **new** — schema coverage |
| `src/lib/actions/user.ts` | `createSession` signature + the three fixes in §3.5 |
| `src/middleware.ts` | `/signup` in `PUBLIC_ONLY` |
| `src/app/(auth)/password-field.tsx` | **new** |
| `src/app/(auth)/email-auth-form.tsx` | **new** |
| `src/app/(auth)/auth-divider.tsx` | **new** |
| `src/app/(auth)/signup/page.tsx` | **new** |
| `src/app/(auth)/login/page.tsx` | form + divider + signup link |
| `src/app/page.tsx`, `src/app/(auth)/onboarding/page.tsx` | `homePathFor` second argument |
| `TechnicalDocument.md` §4.1, §2.5 | sequence + provider note |
| `CLAUDE.md` §5 | architecture map entries |
| `docs/progress-A.md` | ledger entry + `NOT VERIFIED` |

---

## 5. Verification

### 5.1 Unit

`authErrorMessage` — every mapped code, the unknown-code fallthrough, that all wrong-credential codes
collapse to one string, and that the two popup-cancel codes return `null`. Plus the two zod schemas:
short password rejected, email lowercased and trimmed, name bounds.

### 5.2 Toolchain

```
npm run typecheck && npm run lint && npm run test && npm run build
grep -rn "GOOGLE_MAPS_SERVER_API_KEY" src/app src/components   # expect no hits
```

No new env var is introduced, so the `NEXT_PUBLIC_` audit is a no-op — confirm it anyway.

### 5.3 End to end

Requires §2's console toggle **and** `DEV_AUTH_BYPASS=false` in `.env.local` — with the bypass on,
`getSession()` returns a mock and `/login` redirects away before any of this is reachable. Then
`npm run dev` and drive Chrome at **390×844**.

| # | Action | Expected |
|---|---|---|
| 1 | `/signup`, password `abc` | Inline "at least 8 characters" — **no** network call to Firebase |
| 2 | `/signup`, fresh email | Lands on `/onboarding`; the `User` row carries the typed name, not the email |
| 3 | Finish onboarding, sign out, `/login` with the same credentials | Lands on the role's dashboard; name unchanged in `/profile` |
| 4 | `/login`, wrong password — then an unknown email | **The same** "Incorrect email or password." both times |
| 5 | `/signup` reusing an existing email | "An account with this email already exists." |
| 6 | Google button, both screens | Still works; an existing Google user's name and avatar survive re-login |
| 7 | `/signup` while signed in | Middleware bounces to `/` |
| 8 | Eye toggle | Reveals the password; `elementFromPoint` at the control's top edge returns the BUTTON, not the wrapper DIV |
| 9 | `/login` and `/signup` at 390×844, then 360×640 | Nothing clipped, nothing under the home indicator, no horizontal scroll |

**Row 9 is the one most likely to fail.** `/login` is a `min-h-dvh` centred splash currently holding one
button, and it is about to hold a logo, an `h1`, two fields, a submit, a divider, the Google button, a
terms line and a link — roughly 670px of content in ~780px of usable viewport. It fits an iPhone 14 with
little to spare and may need the logo shrunk or the gaps tightened on shorter phones.

---

## 6. Risk register — what to suspect first when something is wrong

| Symptom | Suspect |
|---|---|
| A new user's name shows as their email address | The `updateProfile` → `getIdToken(true)` claim race. The `displayName` passthrough to `createSession` is the fallback; check it is actually being sent |
| "Could not sign you in. Please try again." with no detail | An unmapped Firebase code reaching the fallthrough — log the code and add it to §3.2 |
| Sign-up succeeds in Firebase but the app errors | The `P2002` email collision, or `isFirebaseAdminConfigured()` false (server creds missing while client creds are present) |
| Login screen renders but the button does nothing | `isFirebaseConfigured` false — the `NEXT_PUBLIC_FIREBASE_*` values were not present at **build** time |
| Everything redirects away from `/login` | `DEV_AUTH_BYPASS=true` still set |

---

## 7. Step board

| Step | Status | Title | Notes |
|---|---|---|---|
| `E1` | `[~]` | Email + password sign-up and sign-in | Single step; all Lane A; claimed before code per CLAUDE.md §10.0 |

Markers as CLAUDE.md §10.0: `[ ]` not started · `[~]` in progress · `[x]` done, committed, pushed ·
`[!]` blocked.
