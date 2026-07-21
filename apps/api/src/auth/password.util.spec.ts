import { hashPassword, verifyPassword } from "./password.util";

describe("password.util", () => {
  it("verifies the correct password against its own hash", () => {
    const stored = hashPassword("correct-horse-battery-staple");
    expect(verifyPassword("correct-horse-battery-staple", stored)).toBe(true);
  });

  it("rejects an incorrect password", () => {
    const stored = hashPassword("correct-horse-battery-staple");
    expect(verifyPassword("wrong-password", stored)).toBe(false);
  });

  it("salts each hash independently, so the same password hashes differently", () => {
    const first = hashPassword("same-password");
    const second = hashPassword("same-password");
    expect(first).not.toEqual(second);
    expect(verifyPassword("same-password", first)).toBe(true);
    expect(verifyPassword("same-password", second)).toBe(true);
  });

  it("rejects malformed stored hashes instead of throwing", () => {
    expect(verifyPassword("anything", "not-a-valid-stored-hash")).toBe(false);
    expect(verifyPassword("anything", "")).toBe(false);
  });
});
