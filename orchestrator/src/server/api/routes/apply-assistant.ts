import { toAppError } from "@infra/errors";
import { fail, ok } from "@infra/http";
import {
  getApplyAssistantStatus,
  launchApplyAssistant,
} from "@server/services/apply-assistant";
import { type Request, type Response, Router } from "express";

export const applyAssistantRouter = Router();

applyAssistantRouter.get("/status", async (_req: Request, res: Response) => {
  ok(res, await getApplyAssistantStatus());
});

applyAssistantRouter.post(
  "/jobs/:id/launch",
  async (req: Request, res: Response) => {
    try {
      ok(res, await launchApplyAssistant(req.params.id));
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);
