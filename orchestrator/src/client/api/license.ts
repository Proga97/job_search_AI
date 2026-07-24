import { fetchApi, readAuthResponse, toApiError } from "./core";

export type LicensePayload = {
  version: 1;
  licenseId: string;
  username: string;
  issuedAt: string;
  expiresAt: string;
};

export type Licensee = LicensePayload & { token: string };

export type LicenseStatus = {
  active: boolean;
  issuerMode: boolean;
  license: LicensePayload | null;
  reason: string | null;
};

export async function getLicenseStatus(): Promise<LicenseStatus> {
  const response = await fetch("/api/license/status");
  const parsed = await readAuthResponse<LicenseStatus>(response);
  if ("ok" in parsed) {
    if (!parsed.ok) throw toApiError(response, parsed);
    return parsed.data;
  }
  if (!parsed.success) throw toApiError(response, parsed);
  return parsed.data as LicenseStatus;
}

export async function activateLicense(input: {
  username: string;
  token: string;
}): Promise<LicensePayload | null> {
  const response = await fetch("/api/license/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const parsed = await readAuthResponse<{ license: LicensePayload | null }>(
    response,
  );
  if ("ok" in parsed) {
    if (!parsed.ok) throw toApiError(response, parsed);
    return parsed.data.license;
  }
  if (!parsed.success) throw toApiError(response, parsed);
  return (parsed.data as { license: LicensePayload | null }).license;
}

export async function listLicensees(): Promise<Licensee[]> {
  const result = await fetchApi<{ licensees: Licensee[] }>(
    "/license/admin/licensees",
  );
  return result.licensees;
}

export async function issueLicense(input: {
  username: string;
  expiresAt: string;
}): Promise<Licensee> {
  const result = await fetchApi<{ licensee: Licensee }>(
    "/license/admin/licensees",
    { method: "POST", body: JSON.stringify(input) },
  );
  return result.licensee;
}

export async function deleteLicensee(username: string): Promise<void> {
  await fetchApi<{ username: string }>(
    `/license/admin/licensees/${encodeURIComponent(username)}`,
    { method: "DELETE" },
  );
}
