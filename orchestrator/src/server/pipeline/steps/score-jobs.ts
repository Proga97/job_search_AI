import { logger } from "@infra/logger";
import * as jobsRepo from "@server/repositories/jobs";
import * as settingsRepo from "@server/repositories/settings";
import { scoreJobsWithBriefs } from "@server/services/scorer";
import * as visaSponsors from "@server/services/visa-sponsors/index";
import type { Job } from "@shared/types";
import { progressHelpers, updateProgress } from "../progress";
import type { ScoredJob } from "./types";

const SCORING_BATCH_SIZE = 3;

export async function scoreJobsStep(args: {
	profile: Record<string, unknown>;
	scoringInstructions?: string;
	visaSponsorCountryKey?: string | null;
	shouldCancel?: () => boolean;
}): Promise<{ unprocessedJobs: Job[]; scoredJobs: ScoredJob[] }> {
	logger.info("Running scoring step");
	const unprocessedJobs = await jobsRepo.getUnscoredDiscoveredJobs();

	// Check if auto-skip threshold is configured
	const autoSkipThresholdRaw = await settingsRepo.getSetting(
		"autoSkipScoreThreshold",
	);
	const autoSkipThreshold = autoSkipThresholdRaw
		? parseInt(autoSkipThresholdRaw, 10)
		: null;

	updateProgress({
		step: "scoring",
		jobsDiscovered: unprocessedJobs.length,
		jobsScored: 0,
		jobsProcessed: 0,
		totalToProcess: 0,
		currentJob: undefined,
	});

	const scoredJobs: ScoredJob[] = [];
	let completed = 0;
	const scoringInstructions = args.scoringInstructions?.trim();

	for (
		let offset = 0;
		offset < unprocessedJobs.length;
		offset += SCORING_BATCH_SIZE
	) {
		if (args.shouldCancel?.()) break;
		const batch = unprocessedJobs.slice(offset, offset + SCORING_BATCH_SIZE);
		const results = scoringInstructions
			? await scoreJobsWithBriefs(batch, args.profile, { scoringInstructions })
			: await scoreJobsWithBriefs(batch, args.profile);

		for (const job of batch) {
			if (args.shouldCancel?.()) break;
			const result = results.find((candidate) => candidate.jobId === job.id);
			if (!result) continue;
			const { score, reason, jobBrief } = result;

			let sponsorMatchScore = job.sponsorMatchScore ?? 0;
			let sponsorMatchNames = job.sponsorMatchNames ?? undefined;

			if (job.employer && job.sponsorMatchScore == null) {
				const sponsorResults = await visaSponsors.searchSponsors(job.employer, {
					limit: 10,
					minScore: 50,
					countryKey: args.visaSponsorCountryKey ?? undefined,
				});

				const summary =
					visaSponsors.calculateSponsorMatchSummary(sponsorResults);
				sponsorMatchScore = summary.sponsorMatchScore;
				sponsorMatchNames = summary.sponsorMatchNames ?? undefined;
			}

			// Check if job should be auto-skipped based on score threshold
			const shouldAutoSkip =
				job.status !== "applied" &&
				score !== null &&
				autoSkipThreshold !== null &&
				!Number.isNaN(autoSkipThreshold) &&
				score < autoSkipThreshold;

			await jobsRepo.updateJob(job.id, {
				suitabilityScore: score,
				suitabilityReason: reason,
				jobBrief,
				sponsorMatchScore,
				sponsorMatchNames,
				...(shouldAutoSkip ? { status: "skipped" } : {}),
			});

			if (shouldAutoSkip) {
				logger.info("Auto-skipped job due to low score", {
					jobId: job.id,
					title: job.title,
					score,
					threshold: autoSkipThreshold,
				});
			}

			completed += 1;
			progressHelpers.scoringJob(completed, unprocessedJobs.length, job.title);
			scoredJobs.push({
				...job,
				suitabilityScore: score,
				suitabilityReason: reason,
			});
		}
	}

	progressHelpers.scoringComplete(scoredJobs.length);
	logger.info("Scoring step completed", {
		scoredJobs: scoredJobs.length,
		batchSize: SCORING_BATCH_SIZE,
	});

	return { unprocessedJobs, scoredJobs };
}
