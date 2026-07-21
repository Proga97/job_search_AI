import { logger } from "@infra/logger";
import * as jobsRepo from "@server/repositories/jobs";
import { resolveEmployerLegalNameWithAi } from "@server/services/visa-sponsors/ai-alias";
import * as visaSponsors from "@server/services/visa-sponsors/index";
import { asyncPool } from "@server/utils/async-pool";
import { deduplicateJobsByTitleAndEmployer } from "@shared/job-matching.js";
import type { CreateJobInput } from "@shared/types";
import { progressHelpers } from "../progress";

const MAX_NEW_AI_ALIAS_LOOKUPS_PER_IMPORT = 25;

async function resolveSponsorMatch(
	employer: string,
	countryKey?: string | null,
	reserveAiLookup: () => boolean = () => true,
): Promise<Pick<CreateJobInput, "sponsorMatchScore" | "sponsorMatchNames">> {
	if (!employer.trim()) return {};

	try {
		const results = await visaSponsors.searchSponsors(employer, {
			limit: 10,
			minScore: 50,
			countryKey: countryKey ?? undefined,
		});
		let summary = visaSponsors.calculateSponsorMatchSummary(results);
		if (summary.sponsorMatchScore < 80 && countryKey) {
			const legalEmployerName = await resolveEmployerLegalNameWithAi(
				employer,
				countryKey,
				reserveAiLookup,
			);
			if (legalEmployerName) {
				const verifiedResults = await visaSponsors.searchSponsors(
					legalEmployerName,
					{ limit: 10, minScore: 80, countryKey },
				);
				const verifiedSummary =
					visaSponsors.calculateSponsorMatchSummary(verifiedResults);
				if (verifiedSummary.sponsorMatchScore >= 80) {
					summary = verifiedSummary;
				}
			}
		}
		return {
			sponsorMatchScore: summary.sponsorMatchScore,
			sponsorMatchNames: summary.sponsorMatchNames ?? undefined,
		};
	} catch (error) {
		logger.warn("Visa sponsor matching unavailable during job import", {
			employer,
			countryKey: countryKey ?? null,
			error: error instanceof Error ? error.message : "Unknown error",
		});
		return {};
	}
}

export async function importJobsStep(args: {
	discoveredJobs: CreateJobInput[];
	visaSponsorCountryKey?: string | null;
}): Promise<{ created: number; skipped: number; fuzzyMerged: number }> {
	logger.info("Importing discovered jobs", {
		discovered: args.discoveredJobs.length,
	});

	const dedupedJobs = deduplicateJobsByTitleAndEmployer(args.discoveredJobs);
	const fuzzyMerged = args.discoveredJobs.length - dedupedJobs.length;

	if (fuzzyMerged > 0) {
		logger.info("Fuzzy-deduped discovered jobs before import", {
			original: args.discoveredJobs.length,
			dedupedCount: dedupedJobs.length,
			fuzzyMerged,
		});
	}

	const employerMatches = new Map<
		string,
		Promise<Awaited<ReturnType<typeof resolveSponsorMatch>>>
	>();
	let aiAliasLookupsReserved = 0;
	const reserveAiLookup = () => {
		if (aiAliasLookupsReserved >= MAX_NEW_AI_ALIAS_LOOKUPS_PER_IMPORT) {
			return false;
		}
		aiAliasLookupsReserved += 1;
		return true;
	};
	const getEmployerMatch = (employer: string) => {
		const key = employer.trim().toLowerCase();
		let match = employerMatches.get(key);
		if (!match) {
			match = resolveSponsorMatch(
				employer,
				args.visaSponsorCountryKey,
				reserveAiLookup,
			);
			employerMatches.set(key, match);
		}
		return match;
	};
	const enrichedJobs = await asyncPool({
		items: dedupedJobs,
		concurrency: 3,
		task: async (job) => ({
			...job,
			...(await getEmployerMatch(job.employer)),
		}),
	});

	const { created, skipped } = await jobsRepo.createJobs(enrichedJobs);

	const jobsMissingSponsorMatch = (await jobsRepo.getAllJobs()).filter(
		(job) => job.sponsorMatchScore == null || job.sponsorMatchScore < 80,
	);
	await asyncPool({
		items: jobsMissingSponsorMatch,
		concurrency: 3,
		task: async (job) => {
			const match = await getEmployerMatch(job.employer);
			await jobsRepo.updateJob(job.id, match);
		},
	});

	logger.info("Import step complete", {
		discovered: args.discoveredJobs.length,
		fuzzyMerged,
		created,
		skipped,
		sponsorMatchesBackfilled: jobsMissingSponsorMatch.length,
	});

	progressHelpers.importComplete(created, skipped + fuzzyMerged);

	return { created, skipped, fuzzyMerged };
}
