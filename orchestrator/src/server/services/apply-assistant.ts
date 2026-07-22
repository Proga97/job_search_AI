import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  notFound,
  requestTimeout,
  serviceUnavailable,
  unprocessableEntity,
  upstreamError,
} from "@infra/errors";
import { logger } from "@infra/logger";
import { requireTenantId } from "@infra/request-context";
import { getJobById } from "@server/repositories/jobs";
import { generateDesignResumePdf, getPdfPath } from "@server/services/pdf";
import { getTenantDesignResumePdfPath } from "@server/services/pdf-storage";
import { getProfile } from "@server/services/profile";
import type { ResumeProfile } from "@shared/types";

export type ApplyAssistantLaunchResult = {
  sessionId: string;
  status: "review_required";
  filled: number;
  skipped: number;
};

type CompanionResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error?: string };

function companionBaseUrl(): string {
  return (
    process.env.APPLY_ASSISTANT_URL ?? "http://host.docker.internal:4317"
  ).replace(/\/$/, "");
}

function companionHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const token = process.env.APPLY_ASSISTANT_TOKEN?.trim();
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

function structuredLocation(
  location: NonNullable<ResumeProfile["basics"]>["location"],
) {
  const address = location?.address?.trim();
  if (!address) return location ?? {};
  if (location?.city || location?.region || location?.postalCode) {
    return location;
  }

  const usAddress = address.match(
    /^(.+?),\s*([^,]+?),\s*([A-Za-z .]+?)\s+(\d{5}(?:-\d{4})?)(?:,\s*(?:USA|US|United States))?$/i,
  );
  if (!usAddress) return location ?? {};

  return {
    address: usAddress[1]?.trim(),
    city: usAddress[2]?.trim(),
    region: usAddress[3]?.trim(),
    postalCode: usAddress[4]?.trim(),
    countryCode: "US",
  };
}

function profilePayload(profile: ResumeProfile) {
  const basics = profile.basics ?? {};
  const location = structuredLocation(basics.location);
  const social = new Map(
    (basics.profiles ?? []).map((entry) => [
      entry.network?.toLowerCase(),
      entry.url,
    ]),
  );
  return {
    fullName: basics.name,
    email: basics.email,
    phone: basics.phone,
    website: basics.url,
    linkedIn: social.get("linkedin"),
    github: social.get("github"),
    address: location.address,
    city: location.city,
    region: location.region,
    postalCode: location.postalCode,
    country: location.countryCode,
  };
}

async function resumePayload(jobId: string, hasJobResume: boolean) {
  let path = hasJobResume ? getPdfPath(jobId) : getTenantDesignResumePdfPath();
  try {
    return (await readFile(path)).toString("base64");
  } catch {
    await generateDesignResumePdf();
    path = getTenantDesignResumePdfPath();
    return (await readFile(path)).toString("base64");
  }
}

async function companionFetch<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${companionBaseUrl()}${path}`, {
      ...init,
      headers: { ...companionHeaders(), ...init?.headers },
      signal: AbortSignal.timeout(50_000),
    });
    const payload = (await response.json()) as CompanionResponse<T>;
    if (!response.ok || !payload.ok) {
      throw upstreamError(
        "The Apply Assistant could not open this job listing",
      );
    }
    return payload.data;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw requestTimeout("The Apply Assistant took too long to respond");
    }
    if (error instanceof TypeError) {
      throw serviceUnavailable(
        "Apply Assistant is offline. Start it on your Mac, then try again.",
      );
    }
    throw error;
  }
}

export async function getApplyAssistantStatus() {
  try {
    return await companionFetch<{ ready: boolean; browserOpen: boolean }>(
      "/health",
    );
  } catch {
    return { ready: false, browserOpen: false };
  }
}

export async function launchApplyAssistant(
  jobId: string,
): Promise<ApplyAssistantLaunchResult> {
  const tenantId = requireTenantId();
  const job = await getJobById(jobId);
  if (!job) throw notFound("Job not found");
  const rawUrl = job.applicationLink || job.jobUrl;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw unprocessableEntity(
      "This job does not have a valid application link",
    );
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw unprocessableEntity(
      "This job does not have a supported application link",
    );
  }

  const sessionId = randomUUID();
  const result = await companionFetch<ApplyAssistantLaunchResult>("/sessions", {
    method: "POST",
    body: JSON.stringify({
      sessionId,
      workspaceKey: tenantId,
      jobId,
      url: url.toString(),
      profile: profilePayload(await getProfile()),
      resume: {
        fileName: "Pranay_Chimmani_Resume.pdf",
        mimeType: "application/pdf",
        dataBase64: await resumePayload(jobId, Boolean(job.pdfPath)),
      },
    }),
  });
  logger.info("Apply Assistant opened job for review", {
    jobId,
    sessionId,
    status: result.status,
    filled: result.filled,
    skipped: result.skipped,
  });
  return result;
}
