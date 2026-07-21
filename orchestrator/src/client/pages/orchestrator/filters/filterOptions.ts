import type {
	DateFilterPreset,
	FilterTab,
	JobSort,
	SalaryFilterMode,
	SponsorFilterValue,
} from "../constants";
import { sponsorshipLabels } from "../sponsorship";

export const sponsorOptions: Array<{
	value: SponsorFilterValue;
	label: string;
}> = [
	{ value: "available", label: sponsorshipLabels.available },
	{ value: "sponsor_listed", label: sponsorshipLabels.sponsor_listed },
	{ value: "unavailable", label: sponsorshipLabels.unavailable },
	{ value: "unknown", label: sponsorshipLabels.unknown },
];

export const salaryModeOptions: Array<{
	value: SalaryFilterMode;
	label: string;
}> = [
	{ value: "at_least", label: "at least" },
	{ value: "at_most", label: "at most" },
	{ value: "between", label: "between" },
];

export const sortFieldOrder: JobSort["key"][] = [
	"score",
	"datePosted",
	"discoveredAt",
	"salary",
	"title",
	"employer",
];

export const tabDescriptions: Partial<Record<FilterTab, string>> = {
	discovered: "Jobs searched, ready to be tailored",
	ready: "Jobs with tailored CVs, ready to apply",
	applied: "Jobs you've marked as applied",
};

export const datePresetOptions: Array<{
	value: Exclude<DateFilterPreset, "custom">;
	label: string;
}> = [
	{ value: "7", label: "7 days" },
	{ value: "14", label: "14 days" },
	{ value: "30", label: "30 days" },
	{ value: "90", label: "90 days" },
];
