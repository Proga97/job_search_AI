import { badRequest, forbidden, notFound } from "@infra/errors";
import { asyncRoute, fail, ok } from "@infra/http";
import { isSystemAdmin } from "@infra/request-context";
import {
  activateLicense,
  deleteLicensee,
  getLicenseStatus,
  isIssuerMode,
  issueLicense,
  listLicensees,
} from "@server/services/license";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";

const activationSchema = z.object({
  username: z.string().trim().min(1).max(120),
  token: z.string().trim().min(1).max(8192),
});
const issueSchema = z.object({
  username: z.string().trim().min(1).max(120),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const usernameParamSchema = z.string().trim().min(1).max(120);

function requireIssuerAdmin(res: Response): boolean {
  if (isSystemAdmin()) return true;
  fail(res, forbidden("System admin access is required"));
  return false;
}

export const licenseRouter = Router();

licenseRouter.get(
  "/status",
  asyncRoute(async (_req: Request, res: Response) => {
    ok(res, await getLicenseStatus());
  }),
);

licenseRouter.post(
  "/activate",
  asyncRoute(async (req: Request, res: Response) => {
    const parsed = activationSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, badRequest("Enter a username and valid access token"));
      return;
    }
    try {
      ok(res, { license: await activateLicense(parsed.data) });
    } catch (error) {
      fail(
        res,
        badRequest(
          error instanceof Error ? error.message : "Activation failed",
        ),
      );
    }
  }),
);

licenseRouter.delete(
  "/admin/licensees/:username",
  asyncRoute(async (req: Request, res: Response) => {
    if (!requireIssuerAdmin(res)) return;
    if (!(await isIssuerMode())) {
      fail(res, forbidden("This installation is not configured as an issuer"));
      return;
    }
    const parsed = usernameParamSchema.safeParse(req.params.username);
    if (!parsed.success) {
      fail(res, badRequest("Enter a valid username"));
      return;
    }
    if (!(await deleteLicensee(parsed.data))) {
      fail(res, notFound("Issued user was not found"));
      return;
    }
    ok(res, { username: parsed.data.trim().toLowerCase() });
  }),
);

licenseRouter.get(
  "/admin/licensees",
  asyncRoute(async (_req: Request, res: Response) => {
    if (!requireIssuerAdmin(res)) return;
    if (!(await isIssuerMode())) {
      fail(res, forbidden("This installation is not configured as an issuer"));
      return;
    }
    ok(res, { licensees: await listLicensees() });
  }),
);

licenseRouter.post(
  "/admin/licensees",
  asyncRoute(async (req: Request, res: Response) => {
    if (!requireIssuerAdmin(res)) return;
    if (!(await isIssuerMode())) {
      fail(res, forbidden("This installation is not configured as an issuer"));
      return;
    }
    const parsed = issueSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, badRequest("Enter a username and future expiry date"));
      return;
    }
    try {
      ok(res, { licensee: await issueLicense(parsed.data) }, 201);
    } catch (error) {
      fail(
        res,
        badRequest(error instanceof Error ? error.message : "Issuing failed"),
      );
    }
  }),
);
