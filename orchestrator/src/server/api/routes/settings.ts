import { randomUUID } from "node:crypto";
import {
	AppError,
	badRequest,
	serviceUnavailable,
	statusToCode,
	unauthorized,
	upstreamError,
} from "@infra/errors";
import { asyncRoute, fail, ok } from "@infra/http";
import { logger } from "@infra/logger";
import { getRequestId } from "@infra/request-context";
import { isDemoMode, sendDemoBlocked } from "@server/config/demo";
import { getSetting, setSetting } from "@server/repositories/settings";
import { enqueueAutoPdfRegenerationForSettingsChanges } from "@server/services/auto-pdf-regeneration";
import { setBackupSettings } from "@server/services/backup/index";
import { getOriginalEnvValue } from "@server/services/envSettings";
import { resetCodexSession } from "@server/services/llm/codex/client";
import {
	consumeCompletedCodexDeviceAuth,
	disconnectCodexAuth,
	getCodexDeviceAuthSnapshot,
	startCodexDeviceAuth,
} from "@server/services/llm/codex/login";
import { resolveLlmApiKey } from "@server/services/llm/credentials";
import { LlmService } from "@server/services/llm/service";
import { clearProfileCache } from "@server/services/profile";
import {
	clearRxResumeResumeCache,
	extractProjectsFromResume,
	getResume,
	listResumes,
	RxResumeAuthConfigError,
	RxResumeRequestError,
	validateResumeSchema,
	validateCredentials as validateRxResumeCredentials,
} from "@server/services/rxresume";
import { getEffectiveSettings } from "@server/services/settings";
import { applySettingsUpdates } from "@server/services/settings-update";
import {
	mapGlmProviderAlias,
	settingsRegistry,
} from "@shared/settings-registry";
import {
	type UpdateSettingsInput,
	updateSettingsSchema,
} from "@shared/settings-schema";
import {
	LLM_PROVIDER_VALUES,
	LLM_PURPOSE_VALUES,
	type LlmPurpose,
} from "@shared/types";
import { type Request, type Response, Router } from "express";
import { z } from "zod";

export const settingsRouter = Router();

type SavedLlmConfiguration = {
	id: string;
	provider: string;
	baseUrl: string | null;
	model: string;
	apiKey: string | null;
	createdAt: string;
	updatedAt: string;
};

const savedLlmConfigurationInputSchema = z.object({
	provider: z.enum(LLM_PROVIDER_VALUES),
	baseUrl: z.string().trim().url().max(2000).nullable().optional(),
	apiKey: z.string().trim().max(2000).nullable().optional(),
	model: z.string().trim().min(1).max(200),
});

function parseSavedLlmConfigurations(
	raw: string | null,
): SavedLlmConfiguration[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(value): value is SavedLlmConfiguration =>
				Boolean(value) &&
				typeof value === "object" &&
				typeof (value as SavedLlmConfiguration).id === "string" &&
				typeof (value as SavedLlmConfiguration).provider === "string" &&
				typeof (value as SavedLlmConfiguration).model === "string",
		);
	} catch {
		return [];
	}
}

function publicSavedLlmConfiguration(value: SavedLlmConfiguration) {
	return {
		id: value.id,
		provider: value.provider,
		baseUrl: value.baseUrl,
		model: value.model,
		hasApiKey: Boolean(value.apiKey),
		createdAt: value.createdAt,
		updatedAt: value.updatedAt,
	};
}

const RXRESUME_SAVE_VALIDATION_KEYS: Array<keyof UpdateSettingsInput> = [
	"rxresumeUrl",
	"rxresumeApiKey",
];

function hasInputKey<K extends keyof UpdateSettingsInput>(
	input: UpdateSettingsInput,
	key: K,
): boolean {
	return Object.hasOwn(input, key);
}

function shouldValidateRxResumeOnSave(input: UpdateSettingsInput): boolean {
	return RXRESUME_SAVE_VALIDATION_KEYS.some((key) => hasInputKey(input, key));
}

function isMissingRxResumeConfigValidationResult(input: {
	status: number;
	message: string;
}): boolean {
	return input.status === 400 && /not configured/i.test(input.message);
}

function buildRxResumeValidationOptions(
	input: UpdateSettingsInput,
): Parameters<typeof validateRxResumeCredentials>[0] {
	return {
		v5: {
			...(hasInputKey(input, "rxresumeApiKey")
				? { apiKey: input.rxresumeApiKey }
				: {}),
			...(hasInputKey(input, "rxresumeUrl")
				? { baseUrl: input.rxresumeUrl }
				: {}),
		},
	};
}

function toRxResumeValidationAppError(
	status: number,
	message: string,
): AppError {
	if (status === 401) {
		return unauthorized(message);
	}

	if (status === 400) {
		return badRequest(message);
	}

	return new AppError({
		status,
		code: statusToCode(status),
		message,
	});
}

function normalizeLlmProviderValue(
	provider: string | null | undefined,
): string | undefined {
	if (!provider) return undefined;
	const normalized = provider.trim().toLowerCase().replace(/[-.]/g, "_");
	const mapped = mapGlmProviderAlias(normalized);
	return mapped === "claude" ? "anthropic" : mapped;
}

function getDefaultValidationBaseUrl(
	provider: string | undefined,
): string | undefined {
	if (provider === "lmstudio") return "http://localhost:1234";
	if (provider === "ollama") return "http://localhost:11434";
	if (provider === "openai_compatible") return "https://api.openai.com";
	if (provider === "glm") return "https://api.z.ai/api/paas/v4";
	return undefined;
}

const CODEX_AUTH_VALIDATION_TTL_MS = 5_000;
let codexValidationCache: {
	value: { valid: boolean; message: string | null; username?: string | null };
	expiresAtMs: number;
} | null = null;
let codexValidationInFlight: Promise<{
	valid: boolean;
	message: string | null;
	username?: string | null;
}> | null = null;

function clearCodexValidationCache(): void {
	codexValidationCache = null;
	codexValidationInFlight = null;
}

async function validateCodexCredentials(): Promise<{
	valid: boolean;
	message: string | null;
	username?: string | null;
}> {
	return await new LlmService({ provider: "codex" }).validateCredentials();
}

async function getCachedCodexValidation(): Promise<{
	valid: boolean;
	message: string | null;
	username?: string | null;
}> {
	const now = Date.now();
	if (codexValidationCache && codexValidationCache.expiresAtMs > now) {
		return codexValidationCache.value;
	}

	if (codexValidationInFlight) {
		return await codexValidationInFlight;
	}

	codexValidationInFlight = (async () => {
		const validation = await validateCodexCredentials();
		codexValidationCache = {
			value: validation,
			expiresAtMs: Date.now() + CODEX_AUTH_VALIDATION_TTL_MS,
		};
		return validation;
	})();

	try {
		return await codexValidationInFlight;
	} finally {
		codexValidationInFlight = null;
	}
}

async function resolveLlmConfig(input: {
	provider?: string | null;
	apiKey?: string | null;
	baseUrl?: string | null;
	purpose?: LlmPurpose | null;
}): Promise<{
	provider: string | undefined;
	apiKey: string | null;
	baseUrl: string | undefined;
}> {
	const [storedApiKey, storedProvider, storedBaseUrl, storedPurposeApiKeys] =
		await Promise.all([
			getSetting("llmApiKey"),
			getSetting("llmProvider"),
			getSetting("llmBaseUrl"),
			getSetting("llmPurposeApiKeys"),
		]);
	const purposeApiKeys =
		settingsRegistry.llmPurposeApiKeys.parse(
			storedPurposeApiKeys ?? undefined,
		) ?? {};
	const storedPurposeApiKey = input.purpose
		? purposeApiKeys[input.purpose]?.trim()
		: null;

	const provider = normalizeLlmProviderValue(
		input.provider?.trim() || storedProvider?.trim() || undefined,
	);
	const usesBaseUrl =
		provider === "lmstudio" ||
		provider === "ollama" ||
		provider === "glm" ||
		provider === "openai_compatible";
	const hasExplicitBaseUrlOverride =
		input.baseUrl !== undefined && input.baseUrl !== null;
	const baseUrl = usesBaseUrl
		? hasExplicitBaseUrlOverride
			? input.baseUrl?.trim() ||
				getOriginalEnvValue("LLM_BASE_URL")?.trim() ||
				getDefaultValidationBaseUrl(provider)
			: storedBaseUrl?.trim() ||
				getOriginalEnvValue("LLM_BASE_URL")?.trim() ||
				getDefaultValidationBaseUrl(provider)
		: undefined;

	return {
		provider,
		apiKey: resolveLlmApiKey({
			storedApiKey: input.apiKey ?? storedApiKey,
			purposeApiKey: storedPurposeApiKey,
			provider,
		}),
		baseUrl,
	};
}

function parseLlmPurpose(value: unknown): LlmPurpose | null {
	if (typeof value !== "string") return null;
	return (LLM_PURPOSE_VALUES as readonly string[]).includes(value)
		? (value as LlmPurpose)
		: null;
}

async function getCodexAuthResponseData(): Promise<{
	authenticated: boolean;
	username: string | null;
	validationMessage: string | null;
	flowStatus: string;
	loginInProgress: boolean;
	verificationUrl: string | null;
	userCode: string | null;
	startedAt: string | null;
	expiresAt: string | null;
	flowMessage: string | null;
}> {
	let flow = getCodexDeviceAuthSnapshot();
	if (flow.status === "completed") {
		const completedFlow = consumeCompletedCodexDeviceAuth();
		if (completedFlow) {
			await resetCodexSession();
			clearCodexValidationCache();
			flow = completedFlow;
		} else {
			flow = getCodexDeviceAuthSnapshot();
		}
	}
	const validation = flow.loginInProgress
		? await getCachedCodexValidation()
		: await validateCodexCredentials();
	if (!flow.loginInProgress) {
		clearCodexValidationCache();
	}

	return {
		authenticated: validation.valid,
		username: validation.username ?? null,
		validationMessage: validation.message,
		flowStatus: flow.status,
		loginInProgress: flow.loginInProgress,
		verificationUrl: flow.verificationUrl,
		userCode: flow.userCode,
		startedAt: flow.startedAt,
		expiresAt: flow.expiresAt,
		flowMessage: flow.message,
	};
}

/**
 * GET /api/settings - Get app settings (effective + defaults)
 */
settingsRouter.get(
	"/",
	asyncRoute(async (_req: Request, res: Response) => {
		const data = await getEffectiveSettings();
		ok(res, data);
	}),
);

/**
 * PATCH /api/settings - Update settings overrides
 */
settingsRouter.patch(
	"/",
	asyncRoute(async (req: Request, res: Response) => {
		if (isDemoMode()) {
			return sendDemoBlocked(
				res,
				"Saving settings is disabled in the public demo.",
				{ route: "PATCH /api/settings" },
			);
		}

		const input = updateSettingsSchema.parse(req.body);
		if (shouldValidateRxResumeOnSave(input)) {
			const validation = await validateRxResumeCredentials(
				buildRxResumeValidationOptions(input),
			);
			if (!validation.ok) {
				const status = validation.status ?? 0;
				if (
					isMissingRxResumeConfigValidationResult({
						status,
						message: validation.message,
					})
				) {
					logger.info(
						"Skipping save-time Reactive Resume validation because credentials are incomplete",
						{
							requestId: getRequestId() ?? null,
							route: "PATCH /api/settings",
							rxresumeMode: validation.mode ?? null,
							status,
						},
					);
				} else if (status >= 400 && status < 500) {
					fail(res, toRxResumeValidationAppError(status, validation.message));
					return;
				} else if (status === 0 || status >= 500) {
					logger.warn(
						"Reactive Resume save-time validation could not verify upstream availability",
						{
							requestId: getRequestId() ?? null,
							route: "PATCH /api/settings",
							rxresumeMode: validation.mode ?? null,
							status,
						},
					);
				}
			}
		}

		const plan = await applySettingsUpdates(input);
		if (plan.shouldClearRxResumeCaches) {
			clearRxResumeResumeCache();
			clearProfileCache();
		}

		const data = await getEffectiveSettings();

		if (plan.shouldRefreshBackupScheduler) {
			setBackupSettings({
				enabled: data.backupEnabled.value,
				hour: data.backupHour.value,
				maxCount: data.backupMaxCount.value,
			});
		}
		ok(res, data);

		queueMicrotask(() => {
			void enqueueAutoPdfRegenerationForSettingsChanges({
				updatedSettingKeys: plan.updatedSettingKeys,
				requestedBy: "user",
			}).catch((error) => {
				logger.warn(
					"Failed to queue auto PDF regeneration for settings change",
					{
						route: "PATCH /api/settings",
						updatedSettingKeys: plan.updatedSettingKeys,
						error,
					},
				);
			});
		});
	}),
);

settingsRouter.get(
	"/llm-configurations",
	asyncRoute(async (_req: Request, res: Response) => {
		const saved = parseSavedLlmConfigurations(
			await getSetting("savedLlmConfigurations"),
		);
		ok(res, { configurations: saved.map(publicSavedLlmConfiguration) });
	}),
);

settingsRouter.post(
	"/llm-configurations",
	asyncRoute(async (req: Request, res: Response) => {
		if (isDemoMode()) {
			return sendDemoBlocked(
				res,
				"Saving LLM configurations is disabled in the public demo.",
				{
					route: "POST /api/settings/llm-configurations",
				},
			);
		}
		const input = savedLlmConfigurationInputSchema.parse(req.body);
		const [rawSaved, activeProvider, activeApiKey] = await Promise.all([
			getSetting("savedLlmConfigurations"),
			getSetting("llmProvider"),
			getSetting("llmApiKey"),
		]);
		const saved = parseSavedLlmConfigurations(rawSaved);
		const normalizedBaseUrl = input.baseUrl?.trim() || null;
		const existing = saved.find(
			(item) =>
				item.provider === input.provider &&
				item.model === input.model &&
				item.baseUrl === normalizedBaseUrl,
		);
		const now = new Date().toISOString();
		const apiKey =
			input.apiKey?.trim() ||
			existing?.apiKey ||
			(activeProvider === input.provider ? activeApiKey : null) ||
			null;
		const configuration: SavedLlmConfiguration = {
			id: existing?.id ?? randomUUID(),
			provider: input.provider,
			baseUrl: normalizedBaseUrl,
			model: input.model,
			apiKey,
			createdAt: existing?.createdAt ?? now,
			updatedAt: now,
		};
		const next = existing
			? saved.map((item) => (item.id === existing.id ? configuration : item))
			: [...saved, configuration];
		await Promise.all([
			setSetting("savedLlmConfigurations", JSON.stringify(next)),
			setSetting("llmProvider", configuration.provider),
			setSetting("llmBaseUrl", configuration.baseUrl),
			setSetting("model", configuration.model),
			...(configuration.apiKey
				? [setSetting("llmApiKey", configuration.apiKey)]
				: []),
		]);
		logger.info("Saved LLM configuration", {
			requestId: getRequestId() ?? null,
			route: "POST /api/settings/llm-configurations",
			configurationId: configuration.id,
			provider: configuration.provider,
			model: configuration.model,
		});
		ok(res, {
			configuration: publicSavedLlmConfiguration(configuration),
			configurations: next.map(publicSavedLlmConfiguration),
		});
	}),
);

settingsRouter.post(
	"/llm-configurations/:id/activate",
	asyncRoute(async (req: Request, res: Response) => {
		if (isDemoMode()) {
			return sendDemoBlocked(
				res,
				"Switching LLM configurations is disabled in the public demo.",
				{
					route: "POST /api/settings/llm-configurations/:id/activate",
				},
			);
		}
		const saved = parseSavedLlmConfigurations(
			await getSetting("savedLlmConfigurations"),
		);
		const configuration = saved.find((item) => item.id === req.params.id);
		if (!configuration) {
			throw new AppError({
				status: 404,
				code: "NOT_FOUND",
				message: "Saved LLM configuration not found.",
			});
		}
		await Promise.all([
			setSetting("llmProvider", configuration.provider),
			setSetting("llmBaseUrl", configuration.baseUrl),
			setSetting("model", configuration.model),
			setSetting("modelScorer", null),
			setSetting("modelTailoring", null),
			setSetting("modelProjectSelection", null),
			setSetting("llmPurposeOverrides", null),
			...(configuration.apiKey
				? [setSetting("llmApiKey", configuration.apiKey)]
				: []),
		]);
		ok(res, { configuration: publicSavedLlmConfiguration(configuration) });
	}),
);

settingsRouter.delete(
	"/llm-configurations/:id",
	asyncRoute(async (req: Request, res: Response) => {
		if (isDemoMode()) {
			return sendDemoBlocked(
				res,
				"Deleting LLM configurations is disabled in the public demo.",
				{
					route: "DELETE /api/settings/llm-configurations/:id",
				},
			);
		}
		const saved = parseSavedLlmConfigurations(
			await getSetting("savedLlmConfigurations"),
		);
		const next = saved.filter((item) => item.id !== req.params.id);
		if (next.length === saved.length) {
			throw new AppError({
				status: 404,
				code: "NOT_FOUND",
				message: "Saved LLM configuration not found.",
			});
		}
		await setSetting(
			"savedLlmConfigurations",
			next.length ? JSON.stringify(next) : null,
		);
		ok(res, { configurations: next.map(publicSavedLlmConfiguration) });
	}),
);

settingsRouter.post(
	"/llm-models",
	asyncRoute(async (req: Request, res: Response) => {
		if (isDemoMode()) {
			ok(res, { models: [] });
			return;
		}

		const provider =
			typeof req.body?.provider === "string" ? req.body.provider : undefined;
		const apiKey =
			typeof req.body?.apiKey === "string" ? req.body.apiKey : undefined;
		const baseUrl =
			typeof req.body?.baseUrl === "string" ? req.body.baseUrl : undefined;
		const purpose = parseLlmPurpose(req.body?.purpose);
		const resolved = await resolveLlmConfig({
			provider,
			apiKey,
			baseUrl,
			purpose,
		});

		const llm = new LlmService({
			provider: resolved.provider,
			apiKey: resolved.apiKey,
			baseUrl: resolved.baseUrl,
		});

		try {
			const models = await llm.listModels();
			ok(res, { models });
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to fetch available LLM models.";
			logger.warn("LLM model discovery failed", {
				requestId: getRequestId() ?? null,
				route: "POST /api/settings/llm-models",
				provider: resolved.provider ?? null,
				hasBaseUrl: Boolean(resolved.baseUrl),
				hasApiKey: Boolean(resolved.apiKey),
				message,
			});
			fail(
				res,
				/api key is missing/i.test(message)
					? badRequest(message)
					: upstreamError(message),
			);
		}
	}),
);

settingsRouter.get(
	"/codex-auth",
	asyncRoute(async (_req: Request, res: Response) => {
		const data = await getCodexAuthResponseData();
		ok(res, data);
	}),
);

settingsRouter.post(
	"/codex-auth/start",
	asyncRoute(async (req: Request, res: Response) => {
		if (isDemoMode()) {
			fail(
				res,
				serviceUnavailable("Codex sign-in is disabled in the public demo."),
			);
			return;
		}

		const forceRestart = req.body?.forceRestart === true;

		try {
			clearCodexValidationCache();
			await startCodexDeviceAuth(forceRestart);
			const data = await getCodexAuthResponseData();
			ok(res, data);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to start Codex sign-in.";
			logger.warn("Codex sign-in flow failed to start", {
				requestId: getRequestId() ?? null,
				route: "POST /api/settings/codex-auth/start",
				message,
			});
			fail(res, serviceUnavailable(message));
		}
	}),
);

settingsRouter.post(
	"/codex-auth/disconnect",
	asyncRoute(async (_req: Request, res: Response) => {
		if (isDemoMode()) {
			return sendDemoBlocked(
				res,
				"Codex sign-out is disabled in the public demo.",
				{ route: "POST /api/settings/codex-auth/disconnect" },
			);
		}

		try {
			await disconnectCodexAuth();
			await resetCodexSession();
			await applySettingsUpdates({ onboardingLlmCompleted: false });
			clearCodexValidationCache();
			const data = await getCodexAuthResponseData();
			ok(res, data);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Unable to disconnect Codex right now.";
			logger.warn("Codex sign-out failed", {
				requestId: getRequestId(),
				route: "POST /api/settings/codex-auth/disconnect",
				message,
			});
			fail(res, serviceUnavailable(message));
		}
	}),
);

/**
 * GET /api/settings/rx-resumes - Fetch list of resumes from Reactive Resume
 */
function failRxResume(res: Response, error: unknown): void {
	if (error instanceof RxResumeAuthConfigError) {
		fail(res, badRequest(error.message));
		return;
	}
	if (error instanceof RxResumeRequestError) {
		if (error.status === 401) {
			fail(
				res,
				badRequest(
					"Reactive Resume authentication failed. Check your configured mode credentials.",
				),
			);
			return;
		}
		if (error.status && error.status >= 500) {
			fail(res, upstreamError(error.message));
			return;
		}
		if (error.status && error.status >= 400 && error.status < 500) {
			fail(
				res,
				new AppError({
					status: error.status,
					code: statusToCode(error.status),
					message: error.message,
				}),
			);
			return;
		}
		if (error.status === 0) {
			fail(
				res,
				serviceUnavailable(
					"Reactive Resume is unavailable. Check the URL and try again.",
				),
			);
			return;
		}
	}
	const message = error instanceof Error ? error.message : "Unknown error";
	logger.error("Reactive Resume route request failed", { message, error });
	fail(res, upstreamError(message));
}

settingsRouter.get(
	"/rx-resumes",
	asyncRoute(async (_req: Request, res: Response) => {
		try {
			const resumes = await listResumes();

			ok(res, {
				resumes: resumes.map((resume) => ({
					id: resume.id,
					name: resume.name,
				})),
			});
		} catch (error) {
			failRxResume(res, error);
		}
	}),
);

/**
 * GET /api/settings/rx-resumes/:id/projects - Fetch project catalog from Reactive Resume (v5 adapter)
 */
settingsRouter.get(
	"/rx-resumes/:id/projects",
	asyncRoute(async (req: Request, res: Response) => {
		try {
			const resumeId = req.params.id;
			if (!resumeId) {
				fail(res, badRequest("Resume id is required."));
				return;
			}

			const resume = await getResume(resumeId);
			const validated = await validateResumeSchema(resume.data ?? {});
			if (!validated.ok) {
				fail(res, badRequest(validated.message));
				return;
			}
			const { catalog } = extractProjectsFromResume(resume.data ?? {});

			ok(res, { projects: catalog });
		} catch (error) {
			failRxResume(res, error);
		}
	}),
);
