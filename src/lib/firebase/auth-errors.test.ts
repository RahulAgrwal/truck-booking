import { describe, expect, it } from "vitest";

import { GENERIC_AUTH_ERROR, authErrorMessage, errorCode } from "./auth-errors";

/** What Firebase actually throws: an Error subclass carrying a `code`. */
function firebaseError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

describe("authErrorMessage", () => {
  it("gives every wrong-credential code the same message", () => {
    /*
      The account-enumeration guard, and the reason this test exists at all.
      If someone later "improves" the copy by telling `user-not-found` apart
      from `wrong-password`, the login form becomes a way to check whether a
      given person has a TruckingGO account. This test fails first.
    */
    const codes = [
      "auth/invalid-credential",
      "auth/invalid-login-credentials",
      "auth/wrong-password",
      "auth/user-not-found",
      "auth/invalid-email",
    ];

    const messages = new Set(codes.map((code) => authErrorMessage(firebaseError(code))));

    expect(messages.size).toBe(1);
    expect([...messages][0]).toBe("Incorrect email or password.");
  });

  it("names the cause when the provider is switched off", () => {
    // The one failure a developer, not a user, has to fix — so it must not hide
    // behind the generic string.
    expect(authErrorMessage(firebaseError("auth/operation-not-allowed"))).toBe(
      "Email sign-in isn't enabled for this app yet.",
    );
  });

  it("tells a returning user their email is taken", () => {
    expect(authErrorMessage(firebaseError("auth/email-already-in-use"))).toMatch(/already exists/i);
  });

  it("points a cross-provider collision at the other sign-in method", () => {
    expect(
      authErrorMessage(firebaseError("auth/account-exists-with-different-credential")),
    ).toMatch(/method you used before/i);
  });

  it.each([
    ["auth/weak-password", /8 characters/],
    ["auth/too-many-requests", /few minutes/i],
    ["auth/network-request-failed", /offline/i],
    ["auth/user-disabled", /disabled/i],
  ])("maps %s to its own message", (code, pattern) => {
    expect(authErrorMessage(firebaseError(code))).toMatch(pattern);
  });

  it("stays silent when the user closes the popup", () => {
    // Not an error. Rendering "Could not sign you in" because someone changed
    // their mind is the bug google-button.tsx has always guarded against.
    expect(authErrorMessage(firebaseError("auth/popup-closed-by-user"))).toBeNull();
    expect(authErrorMessage(firebaseError("auth/cancelled-popup-request"))).toBeNull();
  });

  it("falls through to the generic message for an unmapped code", () => {
    expect(authErrorMessage(firebaseError("auth/some-code-added-in-2027"))).toBe(
      GENERIC_AUTH_ERROR,
    );
  });

  it("survives being handed something that is not a Firebase error", () => {
    // It is fed straight from a `catch`, so it must never be the thing that
    // throws while handling a throw.
    expect(authErrorMessage(new Error("boom"))).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage(null)).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage(undefined)).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage("auth/wrong-password")).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage({ code: 42 })).toBe(GENERIC_AUTH_ERROR);
  });
});

describe("errorCode", () => {
  it("reads a string code and rejects everything else", () => {
    expect(errorCode(firebaseError("auth/wrong-password"))).toBe("auth/wrong-password");
    expect(errorCode({ code: 42 })).toBeNull();
    expect(errorCode(null)).toBeNull();
    expect(errorCode("auth/wrong-password")).toBeNull();
  });
});
