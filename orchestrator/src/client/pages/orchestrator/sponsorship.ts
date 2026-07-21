import type { JobListItem } from "@shared/types";

export type VisaSponsorshipStatus = NonNullable<JobListItem["visaSponsorship"]>;

export const sponsorshipLabels: Record<VisaSponsorshipStatus, string> = {
	available: "Confirmed sponsor",
	unavailable: "Sponsor not found",
	sponsor_listed: "Potential sponsor",
	unknown: "Unchecked sponsor",
};
