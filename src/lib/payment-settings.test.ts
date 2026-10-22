// @ts-nocheck
import { describe, expect, it } from "vitest";
import {
  bankComplete,
  enabledCheckoutMethods,
  isAllowedNewOrderMethod,
  qrComplete,
  qrPathIsValid,
  sniffImageMime,
} from "./payment-settings";

const base = {
  qr_enabled: false,
  qr_image_path: null as string | null,
  qr_merchant_name: null as string | null,
  bank_enabled: false,
  bank_name: null as string | null,
  bank_account_name: null as string | null,
  bank_account_number: null as string | null,
};

describe("payment method rules", () => {
  it("never allows COD for new orders", () => {
    expect(isAllowedNewOrderMethod("cod")).toBe(false);
    expect(isAllowedNewOrderMethod("COD")).toBe(false);
    expect(isAllowedNewOrderMethod("")).toBe(false);
    expect(isAllowedNewOrderMethod("qr")).toBe(true);
    expect(isAllowedNewOrderMethod("bank_transfer")).toBe(true);
  });

  it("offers nothing when nothing is configured, so checkout blocks", () => {
    expect(enabledCheckoutMethods(base)).toEqual([]);
  });

  it("excludes disabled or incomplete methods", () => {
    expect(enabledCheckoutMethods({ ...base, qr_enabled: true })).toEqual([]);
    expect(
      enabledCheckoutMethods({ ...base, qr_enabled: true, qr_image_path: "qr/a.png" }),
    ).toEqual([]);
    expect(
      enabledCheckoutMethods({ ...base, bank_enabled: true, bank_name: "NIC Asia", bank_account_name: "Auraluxe" }),
    ).toEqual([]);
  });

  it("offers only complete enabled methods", () => {
    const s = {
      ...base,
      qr_enabled: true,
      qr_image_path: "qr/a.png",
      qr_merchant_name: "Auraluxe",
      bank_enabled: true,
      bank_name: "NIC Asia",
      bank_account_name: "Auraluxe",
      bank_account_number: "1234567890",
    };
    expect(enabledCheckoutMethods(s)).toEqual(["qr", "bank_transfer"]);
    expect(enabledCheckoutMethods({ ...s, qr_enabled: false })).toEqual(["bank_transfer"]);
  });

  it("requires QR image and merchant name for QR completeness", () => {
    expect(qrComplete({ qr_enabled: true, qr_image_path: "qr/a.png", qr_merchant_name: "Auraluxe" })).toBe(true);
    expect(qrComplete({ qr_enabled: true, qr_image_path: null, qr_merchant_name: "Auraluxe" })).toBe(false);
    expect(qrComplete({ qr_enabled: true, qr_image_path: "qr/a.png", qr_merchant_name: "  " })).toBe(false);
  });

  it("requires bank name, holder and account number for bank completeness", () => {
    expect(
      bankComplete({ bank_enabled: true, bank_name: "Nabil", bank_account_name: "Auraluxe", bank_account_number: "1" }),
    ).toBe(true);
    expect(
      bankComplete({ bank_enabled: true, bank_name: "Nabil", bank_account_name: null, bank_account_number: "1" }),
    ).toBe(false);
  });
});

describe("QR upload validation", () => {
  it("accepts real PNG/JPEG/WebP magic bytes", () => {
    expect(sniffImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(
      sniffImageMime(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])),
    ).toBe("image/webp");
  });

  it("rejects SVG and other non-images even with an image extension", () => {
    const svg = new TextEncoder().encode("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");
    expect(sniffImageMime(svg)).toBeNull();
    expect(sniffImageMime(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull(); // GIF
  });

  it("only accepts QR paths inside the private bucket's qr/ prefix", () => {
    expect(qrPathIsValid("qr/abc-123.png")).toBe(true);
    expect(qrPathIsValid("qr/abc.svg")).toBe(false);
    expect(qrPathIsValid("../products/x.png")).toBe(false);
    expect(qrPathIsValid("products/x.png")).toBe(false);
  });
});
