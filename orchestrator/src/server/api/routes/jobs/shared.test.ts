import { describe, expect, it } from "vitest";
import { inferVisaSponsorship } from "./shared";

describe("inferVisaSponsorship", () => {
	it("detects current-or-future sponsorship exclusions", () => {
		expect(
			inferVisaSponsorship(
				"Applicants must have work authorization that does not now or in the future require sponsorship of a visa for employment authorization in the United States.",
				95,
			),
		).toBe("unavailable");
	});

	it("uses a verified sponsor-list match when the listing is silent", () => {
		expect(inferVisaSponsorship("Build useful software.", 95)).toBe(
			"sponsor_listed",
		);
	});
});
