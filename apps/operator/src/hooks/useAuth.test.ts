// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const verifyOtp = vi.fn();
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      verifyOtp: (...a: unknown[]) => verifyOtp(...a),
    },
  },
}));

import { useAuth } from "./useAuth";

beforeEach(() => verifyOtp.mockReset());

describe("useAuth().verifyCode", () => {
  it("signs in with the six-digit code, trimming spaces and ignoring anything that is not a digit", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth());
    expect(await result.current.verifyCode(" sam@moor.test ", "482 916")).toBeNull();
    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect(verifyOtp).toHaveBeenCalledWith({ email: "sam@moor.test", token: "482916", type: "email" });
  });

  it("tries the older magic-link code type if the first is refused", async () => {
    verifyOtp.mockResolvedValueOnce({ error: { message: "x" } }).mockResolvedValueOnce({ error: null });
    const { result } = renderHook(() => useAuth());
    expect(await result.current.verifyCode("sam@moor.test", "482916")).toBeNull();
    expect(verifyOtp.mock.calls.map((c) => (c[0] as { type: string }).type)).toEqual(["email", "magiclink"]);
  });

  it("says so in plain words when the code is wrong or has expired", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "Token has expired or is invalid" } });
    const { result } = renderHook(() => useAuth());
    expect(await result.current.verifyCode("sam@moor.test", "000000")).toMatch(/ask for a new one/);
  });

  it("does not call Supabase for a code that is too short", async () => {
    const { result } = renderHook(() => useAuth());
    expect(await result.current.verifyCode("sam@moor.test", "123")).toMatch(/6-digit/);
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
