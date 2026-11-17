// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase", () => ({ supabase: { rpc: (...a) => rpc(...a), auth: { getSession: async () => ({ data: { session: { access_token: "tok-1" } } }) } } }));

import { isPushSupported, getPushEnabled, enableOperatorPush, disableOperatorPush, getCurrentPushEndpoint, sendTestPush } from "./push";

// A browser with a service worker and a push manager.
function fakeBrowser({ permission = "granted", existing = null } = {}) {
  const unsubscribed = vi.fn(async () => true);
  const subscription = { endpoint: "https://push.test/dev-1", toJSON: () => ({ endpoint: "https://push.test/dev-1", keys: { p256dh: "P", auth: "A" } }), unsubscribe: unsubscribed };
  const pushManager = {
    current: existing === "yes" ? subscription : null,
    getSubscription: vi.fn(async () => pushManager.current),
    subscribe: vi.fn(async () => { pushManager.current = subscription; return subscription; }),
  };
  const reg = { pushManager };
  const sw = { register: vi.fn(async () => reg), ready: Promise.resolve(reg), getRegistration: vi.fn(async () => reg) };
  Object.defineProperty(navigator, "serviceWorker", { value: sw, configurable: true });
  Object.defineProperty(navigator, "userAgent", { value: "TestAgent/1.0 ".repeat(20), configurable: true });
  window.PushManager = function PushManager() {};
  window.Notification = { permission, requestPermission: vi.fn(async () => permission) };
  return { sw, reg, pushManager, subscription, unsubscribed };
}

beforeEach(() => { rpc.mockReset(); });
afterEach(() => { delete window.PushManager; delete window.Notification; vi.unstubAllGlobals(); });

describe("subscribing this device", () => {
  it("registers the service worker, asks permission, subscribes with the platform key and stores the device", async () => {
    const b = fakeBrowser();
    rpc.mockImplementation(async (name) => (name === "get_push_public_key" ? { data: "AQIDBAUG", error: null } : { data: null, error: null }));
    await expect(enableOperatorPush()).resolves.toBe(true);
    expect(window.Notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(b.sw.register).toHaveBeenCalledWith("/operator/sw.js", { scope: "/operator/" });
    expect(b.pushManager.subscribe).toHaveBeenCalledTimes(1);
    expect(b.pushManager.subscribe.mock.calls[0][0].userVisibleOnly).toBe(true);
    expect(Array.from(b.pushManager.subscribe.mock.calls[0][0].applicationServerKey)).toEqual([1, 2, 3, 4, 5, 6]);
    const stored = rpc.mock.calls.find((c) => c[0] === "register_operator_push");
    expect(stored[1]).toMatchObject({ p_endpoint: "https://push.test/dev-1", p_p256dh: "P", p_auth: "A" });
    expect(stored[1].p_label.length).toBeLessThanOrEqual(120);
  });

  it("reuses an existing subscription instead of making a second one", async () => {
    const b = fakeBrowser({ existing: "yes" });
    rpc.mockImplementation(async (name) => (name === "get_push_public_key" ? { data: "BKey", error: null } : { data: null, error: null }));
    await enableOperatorPush();
    expect(b.pushManager.subscribe).not.toHaveBeenCalled();
    expect(rpc.mock.calls.some((c) => c[0] === "register_operator_push")).toBe(true);
  });

  it("stops with a plain message, and stores nothing, if permission is refused", async () => {
    fakeBrowser({ permission: "denied" });
    await expect(enableOperatorPush()).rejects.toThrow(/not allowed/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("stops with a plain message if the browser cannot do push (iPhone Safari tab)", async () => {
    await expect(enableOperatorPush()).rejects.toThrow(/isn't supported/i);
    expect(isPushSupported()).toBe(false);
    expect(await getPushEnabled()).toBe(false);
  });

  it("stops if the platform has no push key yet, and stores nothing", async () => {
    fakeBrowser();
    rpc.mockResolvedValue({ data: null, error: { message: "no key" } });
    await expect(enableOperatorPush()).rejects.toThrow(/isn't set up on the server/i);
    expect(rpc.mock.calls.some((c) => c[0] === "register_operator_push")).toBe(false);
  });

  it("surfaces the server's refusal when the device cannot be stored", async () => {
    fakeBrowser();
    rpc.mockImplementation(async (name) => (name === "get_push_public_key" ? { data: "BKey", error: null } : { data: null, error: { message: "Only office staff can turn on booking alerts." } }));
    await expect(enableOperatorPush()).rejects.toThrow(/Only office staff/);
  });

  it("knows whether this device is already subscribed and permitted", async () => {
    fakeBrowser({ existing: "yes" });
    expect(await getPushEnabled()).toBe(true);
    fakeBrowser({ existing: "no", permission: "default" });
    expect(await getPushEnabled()).toBe(false);
    fakeBrowser({ existing: "no" });
    expect(await getPushEnabled()).toBe(false);
  });
});

describe("removing this device", () => {
  it("unsubscribes and forgets the device server-side", async () => {
    const b = fakeBrowser({ existing: "yes" });
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(disableOperatorPush()).resolves.toBe(false);
    expect(b.unsubscribed).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("unregister_operator_push", { p_endpoint: "https://push.test/dev-1" });
  });

  it("does nothing, and does not fail, when there is no subscription", async () => {
    fakeBrowser();
    await expect(disableOperatorPush()).resolves.toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("never throws, even if the browser errors", async () => {
    const b = fakeBrowser({ existing: "yes" });
    b.unsubscribed.mockRejectedValue(new Error("boom"));
    await expect(disableOperatorPush()).resolves.toBe(false);
  });
});

describe("the test notification button", () => {
  it("sends this device's address with the signed-in token and returns the server's message", async () => {
    fakeBrowser({ existing: "yes" });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, message: "Test notification sent to 1 device." }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await getCurrentPushEndpoint()).toBe("https://push.test/dev-1");
    const r = await sendTestPush();
    expect(r).toEqual({ ok: true, message: "Test notification sent to 1 device." });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/push/test");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer tok-1");
    expect(JSON.parse(init.body)).toEqual({ endpoint: "https://push.test/dev-1" });
  });

  it("says what is wrong when the server refuses, when the device is not subscribed, and when offline", async () => {
    fakeBrowser({ existing: "yes" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "No device is subscribed for your account yet." }), { status: 404 })));
    expect(await sendTestPush()).toEqual({ ok: false, message: "No device is subscribed for your account yet." });
    fakeBrowser({ existing: "no" });
    const noCall = vi.fn();
    vi.stubGlobal("fetch", noCall);
    expect((await sendTestPush()).message).toMatch(/Tap Enable first/);
    expect(noCall).not.toHaveBeenCalled();
    fakeBrowser({ existing: "yes" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect((await sendTestPush()).message).toMatch(/Couldn't reach the server/);
  });
});
