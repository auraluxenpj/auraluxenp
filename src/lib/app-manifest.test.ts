import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const manifest = JSON.parse(readFileSync(resolve("public/manifest.webmanifest"), "utf8"));

describe("home-screen launch configuration", () => {
  it("preserves Auraluxe naming and the white launch background", () => {
    expect(manifest.name).toBe("Auraluxe");
    expect(manifest.short_name).toBe("Auraluxe");
    expect(manifest.background_color).toBe("#ffffff");
    expect(manifest.theme_color).toBe("#faf7ec");
  });

  it("opens the existing homepage in standalone mode", () => {
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.id).toBe("/");
    expect(manifest.display).toBe("standalone");
  });

  it("references only a real, locally served PNG icon", () => {
    expect(manifest.icons).toEqual([
      {
        src: "/favicon.png",
        sizes: "64x64",
        type: "image/png",
        purpose: "any",
      },
    ]);
    expect(existsSync(resolve("public/favicon.png"))).toBe(true);
  });

  it("does not introduce offline workers for home-screen installation", () => {
    expect(existsSync(resolve("public/sw.js"))).toBe(false);
    expect(existsSync(resolve("public/service-worker.js"))).toBe(false);
  });
});
