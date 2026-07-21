import { logger } from "@infra/logger";
import * as aliasCache from "@server/repositories/visa-sponsor-alias-cache";
import type { JsonSchemaDefinition } from "@server/services/llm/types";
import {
	createConfiguredLlmService,
	resolveLlmModel,
} from "@server/services/modelSelection";
import { normalizeCompanyName } from "@shared/job-matching";

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_AI_CONFIDENCE = 85;

interface EmployerAliasResponse {
	legalEmployerName: string | null;
	confidence: number;
}

function normalizeConfidence(value: number): number {
	const normalized = value >= 0 && value <= 1 ? value * 100 : value;
	return Math.max(0, Math.min(100, normalized));
}

const ALIAS_SCHEMA: JsonSchemaDefinition = {
	name: "visa_sponsor_employer_alias",
	schema: {
		type: "object",
		properties: {
			legalEmployerName: { type: ["string", "null"] },
			confidence: { type: "number", minimum: 0, maximum: 100 },
		},
		required: ["legalEmployerName", "confidence"],
		additionalProperties: false,
	},
};

export async function resolveEmployerLegalNameWithAi(
	employer: string,
	countryKey: string,
	allowNewLookup: () => boolean = () => true,
): Promise<string | null> {
	const normalizedEmployer = normalizeCompanyName(employer);
	if (!normalizedEmployer) return null;

	const cached = await aliasCache.getVisaSponsorAlias(
		countryKey,
		normalizedEmployer,
	);
	if (cached && Date.now() - Date.parse(cached.checkedAt) < CACHE_TTL_MS) {
		return normalizeConfidence(cached.confidence) >= MIN_AI_CONFIDENCE
			? cached.legalEmployerName
			: null;
	}
	if (!allowNewLookup()) return null;

	try {
		const [model, llm] = await Promise.all([
			resolveLlmModel("scoring"),
			createConfiguredLlmService("scoring"),
		]);
		const result = await llm.callJson<EmployerAliasResponse>({
			model,
			messages: [
				{
					role: "system",
					content:
						"Resolve a public-facing employer brand to its most likely legal employing entity in the requested country. Do not decide whether it sponsors visas. Return null when uncertain.",
				},
				{
					role: "user",
					content: JSON.stringify({ employer, country: countryKey }),
				},
			],
			jsonSchema: ALIAS_SCHEMA,
			maxRetries: 1,
		});

		const response = result.success
			? {
					legalEmployerName: result.data.legalEmployerName?.trim() || null,
					confidence: normalizeConfidence(result.data.confidence),
				}
			: { legalEmployerName: null, confidence: 0 };
		await aliasCache.setVisaSponsorAlias(countryKey, normalizedEmployer, {
			...response,
			checkedAt: new Date().toISOString(),
		});
		return response.confidence >= MIN_AI_CONFIDENCE
			? response.legalEmployerName
			: null;
	} catch (error) {
		logger.warn("AI employer alias lookup failed", {
			employer,
			countryKey,
			error: error instanceof Error ? error.message : "Unknown error",
		});
		return null;
	}
}
