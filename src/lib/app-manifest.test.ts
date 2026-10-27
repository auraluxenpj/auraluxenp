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

  it("provides the required regular and independently marked maskable sizes", () => {
    expect(manifest.icons.map((icon: { sizes: string; purpose: string }) => [icon.sizes, icon.purpose]))
      .toEqual([["192x192", "any"], ["512x512", "any"], ["512x512", "maskable"]]);
    for (const filename of ["icon-192", "icon-512", "icon-maskable-512"]) {
      const asset = JSON.parse(readFileSync(resolve(`src/assets/${filename}.png.asset.json`), "utf8"));
      expect(manifest.icons.some((icon: { src: string; type: string }) => icon.src === asset.url && icon.type === "image/png")).toBe(true);
    }
  });

  it("does not introduce offline workers for home-screen installation", () => {
    expect(existsSync(resolve("public/sw.js"))).toBe(false);
    expect(existsSync(resolve("public/service-worker.js"))).toBe(false);
  });
});