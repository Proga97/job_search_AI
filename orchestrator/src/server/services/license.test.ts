import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  activateLicense,
  deleteLicensee,
  getLicenseStatus,
  issueLicense,
  listLicensees,
  verifyLicenseToken,
} from "./license";

describe("offline access licenses", () => {
  let dataDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "meow-ai-license-"));
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    process.env.DATA_DIR = dataDir;
    process.env.MEOW_AI_LICENSE_PRIVATE_KEY = privateKey.export({
      type: "pkcs8",
      format: "pem",
    }) as string;
    process.env.MEOW_AI_LICENSE_PUBLIC_KEY = publicKey.export({
      type: "spki",
      format: "pem",
    }) as string;
    process.env.MEOW_AI_OWNER_TOKEN = "test-owner-token";
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await rm(dataDir, { recursive: true, force: true });
  });

  it("issues, verifies, records, and activates a username-bound token", async () => {
    const expiry = new Date();
    expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
    const licensee = await issueLicense({
      username: "Friend@Example.com",
      expiresAt: expiry.toISOString().slice(0, 10),
    });

    expect((await verifyLicenseToken(licensee.token)).username).toBe(
      "friend@example.com",
    );
    expect(await listLicensees()).toHaveLength(1);

    delete process.env.MEOW_AI_LICENSE_PRIVATE_KEY;
    await activateLicense({
      username: "friend@example.com",
      token: licensee.token,
    });
    const status = await getLicenseStatus();
    expect(status.active).toBe(true);
    expect(status.issuerMode).toBe(false);
    expect(status.license?.username).toBe("friend@example.com");
  });

  it("rejects activation for a different username", async () => {
    const expiry = new Date();
    expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
    const licensee = await issueLicense({
      username: "friend@example.com",
      expiresAt: expiry.toISOString().slice(0, 10),
    });

    await expect(
      activateLicense({ username: "someone-else", token: licensee.token }),
    ).rejects.toThrow("different username");
  });

  it("activates issuer admin mode permanently with the owner token", async () => {
    expect((await getLicenseStatus()).active).toBe(false);

    const license = await activateLicense({
      username: "Pranay",
      token: "test-owner-token",
    });

    expect(license).toBeNull();
    expect(await getLicenseStatus()).toMatchObject({
      active: true,
      issuerMode: true,
      license: null,
    });
  });

  it("deletes an issued user from the owner list", async () => {
    const expiry = new Date();
    expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
    await issueLicense({
      username: "friend@example.com",
      expiresAt: expiry.toISOString().slice(0, 10),
    });

    expect(await deleteLicensee("FRIEND@example.com")).toBe(true);
    expect(await listLicensees()).toEqual([]);
    expect(await deleteLicensee("friend@example.com")).toBe(false);
  });
});
