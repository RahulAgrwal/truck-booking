import { describe, expect, it } from "vitest";

import { EmailSignInSchema, EmailSignUpSchema, SignUpNameSchema, firstIssue } from "./schemas";

/**
 * The sign-in / sign-up schemas (docs/feature-email-password-auth.md §3.4).
 *
 * These run in the browser and are UX, not a security boundary — Firebase
 * verifies the credential and the server re-verifies the token. What is tested
 * here is therefore the *normalisation* (which does reach the database) and the
 * error routing (which decides whether a message lands under the right field).
 */

describe("EmailSignUpSchema", () => {
  it("normalises the email before it reaches Firebase", () => {
    // Whitespace from a paste and a capitalised address must not create a
    // second account for a user who already has one.
    const parsed = EmailSignUpSchema.safeParse({
      name: "  Rahul Agarwal  ",
      email: "  Rahul@Acme.IN ",
      password: "correct-horse",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({
      name: "Rahul Agarwal",
      email: "rahul@acme.in",
      password: "correct-horse",
    });
  });

  it("rejects a password below our own floor of 8", () => {
    // Firebase's floor is 6. This is the rule that saves a round trip.
    const parsed = EmailSignUpSchema.safeParse({
      name: "Rahul",
      email: "rahul@acme.in",
      password: "abc1234",
    });

    expect(parsed.success).toBe(false);
    expect(firstIssue(parsed.error!)).toEqual({
      field: "password",
      error: expect.stringContaining("8 characters"),
    });
  });

  it("attaches the failure to the field that caused it", () => {
    // `firstIssue`'s `field` is what puts the red message under the right box
    // rather than at the foot of the form.
    const parsed = EmailSignUpSchema.safeParse({
      name: "Rahul",
      email: "not-an-email",
      password: "long-enough-password",
    });

    expect(firstIssue(parsed.error!).field).toBe("email");
  });

  it("bounds the name at both ends", () => {
    expect(SignUpNameSchema.safeParse("R").success).toBe(false);
    expect(SignUpNameSchema.safeParse("R".repeat(81)).success).toBe(false);
    expect(SignUpNameSchema.safeParse("Ravi").success).toBe(true);
  });

  it("caps the password so a pasted document is not sent as one", () => {
    expect(
      EmailSignUpSchema.safeParse({
        name: "Rahul",
        email: "rahul@acme.in",
        password: "x".repeat(73),
      }).success,
    ).toBe(false);
  });
});

describe("EmailSignInSchema", () => {
  it("accepts a short password", () => {
    /*
      Deliberately laxer than sign-up. An account created before the 8-character
      rule still has a valid 6-character password, and refusing to even attempt
      the sign-in would lock its owner out — with no reset flow to rescue them.
    */
    const parsed = EmailSignInSchema.safeParse({ email: "old@acme.in", password: "abc123" });
    expect(parsed.success).toBe(true);
  });

  it("still requires something in the password box", () => {
    const parsed = EmailSignInSchema.safeParse({ email: "old@acme.in", password: "" });
    expect(parsed.success).toBe(false);
    expect(firstIssue(parsed.error!).field).toBe("password");
  });

  it("normalises the email the same way sign-up does", () => {
    // The two must agree, or a user signs up as one address and cannot sign in
    // with what they typed.
    const parsed = EmailSignInSchema.safeParse({ email: " Rahul@Acme.IN ", password: "whatever" });
    expect(parsed.data?.email).toBe("rahul@acme.in");
  });
});
