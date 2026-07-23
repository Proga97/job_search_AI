import {
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign,
  timingSafeEqual,
  verify,
} from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getDataDir } from "@server/config/dataDir";
import { z } from "zod";

const LICENSE_FILENAME = "meow-ai-license.json";
const LICENSEES_FILENAME = "meow-ai-licensees.json";

const payloadSchema = z.object({
  version: z.literal(1),
  licenseId: z.string().uuid(),
  username: z.string().trim().min(1).max(120),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

const storedLicenseSchema = z.union([
  z.object({ token: z.string().min(1) }),
  z.object({ owner: z.literal(true) }),
]);
const licenseeSchema = payloadSchema.extend({ token: z.string().min(1) });
const licenseesSchema = z.array(licenseeSchema);

export type LicensePayload = z.infer<typeof payloadSchema>;
export type Licensee = z.infer<typeof licenseeSchema>;

function encode(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

async function isOwnerToken(value: string): Promise<boolean> {
  const inline = process.env.MEOW_AI_OWNER_TOKEN?.trim();
  const configuredPath = process.env.MEOW_AI_OWNER_TOKEN_PATH?.trim();
  const configured =
    inline ||
    (configuredPath
      ? (await readFirst([resolve(configuredPath)]))?.trim()
      : null);
  if (!configured) return false;
  const provided = Buffer.from(value.trim());
  const expected = Buffer.from(configured);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}

function publicKeyPaths(): string[] {
  const configured = process.env.MEOW_AI_LICENSE_PUBLIC_KEY_PATH?.trim();
  return [
    ...(configured ? [resolve(configured)] : []),
    resolve(process.cwd(), "orchestrator/config/license-public.pem"),
    resolve(process.cwd(), "config/license-public.pem"),
  ];
}

async function readFirst(paths: string[]): Promise<string | null> {
  for (const path of paths) {
    try {
      return await readFile(path, "utf8");
    } catch {
      // Try the next supported runtime location.
    }
  }
  return null;
}

async function readPublicKey(): Promise<string> {
  const inline = process.env.MEOW_AI_LICENSE_PUBLIC_KEY?.trim();
  if (inline) return inline.replace(/\\n/g, "\n");
  const key = await readFirst(publicKeyPaths());
  if (!key) throw new Error("Meow AI license public key is not configured");
  return key;
}

async function readPrivateKey(): Promise<string | null> {
  const inline = process.env.MEOW_AI_LICENSE_PRIVATE_KEY?.trim();
  if (inline) return inline.replace(/\\n/g, "\n");
  const path = process.env.MEOW_AI_LICENSE_PRIVATE_KEY_PATH?.trim();
  return path ? readFirst([resolve(path)]) : null;
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(getDataDir(), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, path);
}

export async function isIssuerMode(): Promise<boolean> {
  return Boolean(await readPrivateKey());
}

export async function verifyLicenseToken(
  token: string,
): Promise<LicensePayload> {
  const parts = token.trim().split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Access token format is invalid");
  }
  const payloadBytes = decode(parts[0]);
  const signature = decode(parts[1]);
  const publicKey = createPublicKey(await readPublicKey());
  if (!verify(null, payloadBytes, publicKey, signature)) {
    throw new Error("Access token signature is invalid");
  }
  const payload = payloadSchema.parse(
    JSON.parse(payloadBytes.toString("utf8")),
  );
  if (Date.parse(payload.expiresAt) <= Date.now()) {
    throw new Error("Access token has expired");
  }
  return { ...payload, username: normalizeUsername(payload.username) };
}

export async function getLicenseStatus(): Promise<{
  active: boolean;
  issuerMode: boolean;
  license: LicensePayload | null;
  reason: string | null;
}> {
  if (await isIssuerMode()) {
    try {
      const stored = storedLicenseSchema.parse(
        JSON.parse(
          await readFile(join(getDataDir(), LICENSE_FILENAME), "utf8"),
        ),
      );
      if ("owner" in stored) {
        return { active: true, issuerMode: true, license: null, reason: null };
      }
    } catch {
      // The owner must activate this installation once with the master token.
    }
    return {
      active: false,
      issuerMode: true,
      license: null,
      reason: "Owner activation is required",
    };
  }
  try {
    const raw = await readFile(join(getDataDir(), LICENSE_FILENAME), "utf8");
    const stored = storedLicenseSchema.parse(JSON.parse(raw));
    if (!("token" in stored)) throw new Error("Activation is required");
    const license = await verifyLicenseToken(stored.token);
    return { active: true, issuerMode: false, license, reason: null };
  } catch (error) {
    return {
      active: false,
      issuerMode: false,
      license: null,
      reason: error instanceof Error ? error.message : "Activation is required",
    };
  }
}

export async function activateLicense(input: {
  username: string;
  token: string;
}): Promise<LicensePayload | null> {
  if ((await isIssuerMode()) && (await isOwnerToken(input.token))) {
    await writeJsonAtomic(join(getDataDir(), LICENSE_FILENAME), {
      owner: true,
    });
    return null;
  }
  const payload = await verifyLicenseToken(input.token);
  if (payload.username !== normalizeUsername(input.username)) {
    throw new Error("This access token belongs to a different username");
  }
  await writeJsonAtomic(join(getDataDir(), LICENSE_FILENAME), {
    token: input.token.trim(),
  });
  return payload;
}

async function readLicensees(): Promise<Licensee[]> {
  try {
    return licenseesSchema.parse(
      JSON.parse(
        await readFile(join(getDataDir(), LICENSEES_FILENAME), "utf8"),
      ),
    );
  } catch {
    return [];
  }
}

export async function listLicensees(): Promise<Licensee[]> {
  return (await readLicensees()).sort((a, b) =>
    a.username.localeCompare(b.username),
  );
}

export async function issueLicense(input: {
  username: string;
  expiresAt: string;
}): Promise<Licensee> {
  const privateKeyPem = await readPrivateKey();
  if (!privateKeyPem) throw new Error("License issuer key is not configured");
  const expiry = new Date(`${input.expiresAt}T23:59:59.999Z`);
  if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) {
    throw new Error("Expiry date must be in the future");
  }
  const payload: LicensePayload = {
    version: 1,
    licenseId: randomUUID(),
    username: normalizeUsername(input.username),
    issuedAt: new Date().toISOString(),
    expiresAt: expiry.toISOString(),
  };
  const payloadBytes = Buffer.from(JSON.stringify(payload));
  const signature = sign(null, payloadBytes, createPrivateKey(privateKeyPem));
  const licensee: Licensee = {
    ...payload,
    token: `${encode(payloadBytes)}.${encode(signature)}`,
  };
  const licensees = (await readLicensees()).filter(
    (entry) => entry.username !== licensee.username,
  );
  licensees.push(licensee);
  await writeJsonAtomic(join(getDataDir(), LICENSEES_FILENAME), licensees);
  return licensee;
}
