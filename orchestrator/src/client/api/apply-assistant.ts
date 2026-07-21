import { fetchApi } from "./core";

export type ApplyAssistantStatus = { ready: boolean; browserOpen: boolean };
export type ApplyAssistantLaunchResult = {
  sessionId: string;
  status: "review_required";
  filled: number;
  skipped: number;
};

export function getApplyAssistantStatus(): Promise<ApplyAssistantStatus> {
  return fetchApi<ApplyAssistantStatus>("/apply-assistant/status");
}

export function launchApplyAssistant(
  jobId: string,
): Promise<ApplyAssistantLaunchResult> {
  return fetchApi<ApplyAssistantLaunchResult>(
    `/apply-assistant/jobs/${jobId}/launch`,
    {
      method: "POST",
    },
  );
}
