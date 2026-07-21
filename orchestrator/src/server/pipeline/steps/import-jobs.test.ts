import * as jobsRepo from "@server/repositories/jobs";
import * as visaSponsors from "@server/services/visa-sponsors/index";
import type { CreateJobInput, Job } from "@shared/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { importJobsStep } from "./import-jobs";

vi.mock("@server/repositories/jobs", () => ({
	createJobs: vi.fn(),
	getAllJobs: vi.fn(),
	updateJob: vi.fn(),
}));

vi.mock("@server/services/visa-sponsors/index", () => ({
	searchSponsors: vi.fn(),
	calculateSponsorMatchSummary: vi.fn(),
}));

vi.mock("../progress", () => ({
	progressHelpers: { importComplete: vi.fn() },
}));

const discoveredJob: CreateJobInput = {
	source: "hiringcafe",
	title: "Software Engineer",
	employer: "GitHub, Inc.",
	jobUrl: "https://example.com/github-job",
};

describe("importJobsStep sponsor matching", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(jobsRepo.createJobs).mockResolvedValue({ created: 1, skipped: 0 });
		vi.mocked(jobsRepo.getAllJobs).mockResolvedValue([]);
		vi.mocked(visaSponsors.searchSponsors).mockResolvedValue([]);
		vi.mocked(visaSponsors.calculateSponsorMatchSummary).mockReturnValue({
			sponsorMatchScore: 100,
			sponsorMatchNames: '["GitHub, Inc."]',
		});
	});

	it("persists sponsor matches while importing fetched jobs", async () => {
		await importJobsStep({
			discoveredJobs: [discoveredJob],
			visaSponsorCountryKey: "united states",
		});

		expect(visaSponsors.searchSponsors).toHaveBeenCalledWith("GitHub, Inc.", {
			limit: 10,
			minScore: 50,
			countryKey: "united states",
		});
		expect(jobsRepo.createJobs).toHaveBeenCalledWith([
			expect.objectContaining({
				employer: "GitHub, Inc.",
				sponsorMatchScore: 100,
				sponsorMatchNames: '["GitHub, Inc."]',
			}),
		]);
	});

	it("backfills existing jobs whose sponsor match has not been evaluated", async () => {
		vi.mocked(jobsRepo.getAllJobs).mockResolvedValue([
			{
				id: "existing-job",
				employer: "Uber Freight",
				sponsorMatchScore: null,
			} as Job,
		]);

		await importJobsStep({ discoveredJobs: [] });

		expect(visaSponsors.searchSponsors).toHaveBeenCalledWith("Uber Freight", {
			limit: 10,
			minScore: 50,
			countryKey: undefined,
		});
		expect(jobsRepo.updateJob).toHaveBeenCalledWith("existing-job", {
			sponsorMatchScore: 100,
			sponsorMatchNames: '["GitHub, Inc."]',
		});
	});
});
