import { describe, it, expect, afterEach, vi } from "vitest";

// The deployment's own name and website: the platform's by default, and a
// business's own when the environment says so.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const load = async () => (await import("./deploymentBrand")).DEPLOYMENT_BRAND;

describe("DEPLOYMENT_BRAND", () => {
  it("defaults to the platform's own name and address", async () => {
    vi.stubEnv("NEXT_PUBLIC_BRAND_NAME", "");
    vi.stubEnv("NEXT_PUBLIC_WEBSITE_URL", "");
    expect(await load()).toEqual({
      name: "Winjo Dispatch",
      site: "https://winjo-dispatch.vercel.app",
      loginPlaceholder: "you@winjo-dispatch.vercel.app",
    });
  });

  it("a dedicated deployment sets its own name and site, with nothing of the platform's left", async () => {
    vi.stubEnv("NEXT_PUBLIC_BRAND_NAME", "  Coastal Cars ");
    vi.stubEnv("NEXT_PUBLIC_WEBSITE_URL", "https://www.coastal.test/");
    const b = await load();
    expect(b).toEqual({ name: "Coastal Cars", site: "https://www.coastal.test", loginPlaceholder: "you@coastal.test" });
    expect(JSON.stringify(b)).not.toMatch(/winjo/i);
  });
});
