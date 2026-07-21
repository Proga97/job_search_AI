import type { JobListItem } from "@shared/types.js";
import { Loader2 } from "lucide-react";
import { getSuitabilityScoreTokens } from "@/client/components/ScoreRing";
import { formatPostingAgeLabel } from "@/client/lib/job-posting-age";
import { isPdfRegenerating, isPdfStale } from "@/client/lib/pdf-freshness";
import { cn } from "@/lib/utils";
import { defaultStatusToken, statusTokens } from "./constants";
import { sponsorshipLabels } from "./sponsorship";

interface JobRowContentProps {
	job: JobListItem;
	isSelected?: boolean;
	showStatusDot?: boolean;
	showSuitabilityScore?: boolean;
	statusDotClassName?: string;
	companyStackCount?: number;
	className?: string;
}

function getExperienceLabel(job: JobListItem): string {
	const explicitLabel = job.experienceRange?.trim() || job.jobLevel?.trim();
	if (explicitLabel) return explicitLabel;

	const title = job.title.toLowerCase();
	if (/\b(intern|internship)\b/.test(title)) return "Internship";
	if (/\b(new grad|graduate|entry[- ]level|junior|jr\.?)\b/.test(title)) {
		return "Entry level";
	}
	if (/\b(principal|staff|lead|senior|sr\.?)\b/.test(title)) {
		return "Senior level";
	}
	return "Experience not listed";
}

function getWorkArrangementLabel(job: JobListItem): string {
	const rawWorkArrangement = job.workFromHomeType?.trim().toLowerCase();
	const searchableLocation = `${job.location ?? ""} ${job.title}`.toLowerCase();

	if (rawWorkArrangement?.includes("hybrid")) return "Hybrid";
	if (
		rawWorkArrangement?.includes("remote") ||
		rawWorkArrangement?.includes("work from home") ||
		rawWorkArrangement === "wfh"
	) {
		return "Remote";
	}
	if (
		rawWorkArrangement?.includes("on-site") ||
		rawWorkArrangement?.includes("onsite") ||
		rawWorkArrangement?.includes("office")
	) {
		return "On-site";
	}
	if (job.isRemote === true) return "Remote";
	if (/\bhybrid\b/.test(searchableLocation)) return "Hybrid";
	if (/\b(remote|work from home|wfh)\b/.test(searchableLocation))
		return "Remote";
	if (job.isRemote === false) return "On-site";
	return "Workplace not listed";
}

const sponsorshipTones: Record<
	NonNullable<JobListItem["visaSponsorship"]>,
	string
> = {
	available:
		"border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200",
	unavailable:
		"border-red-300/70 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200",
	sponsor_listed:
		"border-blue-300/70 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-200",
	unknown: "border-border/70 bg-muted/55 text-muted-foreground",
};

export const JobRowContent = ({
	job,
	isSelected = false,
	showStatusDot = true,
	showSuitabilityScore = true,
	statusDotClassName,
	companyStackCount = 1,
	className,
}: JobRowContentProps) => {
	const hasScore = job.suitabilityScore != null;
	const scoreTokens = getSuitabilityScoreTokens(job.suitabilityScore);
	const statusToken = statusTokens[job.status] ?? defaultStatusToken;
	const showStalePdf = isPdfStale(job);
	const showRegeneratingPdf = isPdfRegenerating(job);
	const postingAge = formatPostingAgeLabel(job.datePosted);
	const experienceLabel = getExperienceLabel(job);
	const workArrangementLabel = getWorkArrangementLabel(job);
	const visaSponsorship = job.visaSponsorship ?? "unknown";

	return (
		<div className={cn("flex min-w-0 flex-1 items-center gap-3", className)}>
			<span
				className={cn(
					"h-2 w-2 rounded-full shrink-0",
					statusToken.dot,
					!isSelected && "opacity-70",
					statusDotClassName,
					!showStatusDot && "hidden",
				)}
				title={statusToken.label}
			/>

			<div className="min-w-0 flex-1">
				<div
					className={cn(
						"truncate leading-tight",
						isSelected ? "font-semibold" : "font-medium",
					)}
				>
					{job.title}
				</div>
				<div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
					<span className="truncate">{job.employer}</span>
					{companyStackCount > 1 && (
						<span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
							{companyStackCount} roles
						</span>
					)}
				</div>
				{job.location && (
					<div className="mt-0.5 truncate text-[13px] font-medium text-foreground/90">
						{job.location}
					</div>
				)}
				{job.salary?.trim() && (
					<div className="mt-2.5 truncate text-xs font-medium text-foreground/80">
						{job.salary}
					</div>
				)}
				<div
					className={cn(
						"flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground/90",
						job.salary?.trim() ? "mt-1" : "mt-1.5",
					)}
				>
					<span className="max-w-[14rem] truncate rounded-md border border-border/70 bg-muted/55 px-1.5 py-0.5">
						{experienceLabel}
					</span>
					<span className="shrink-0 rounded-md border border-border/70 bg-muted/55 px-1.5 py-0.5">
						{workArrangementLabel}
					</span>
					<span
						className={cn(
							"shrink-0 rounded-md border px-1.5 py-0.5",
							sponsorshipTones[visaSponsorship],
						)}
						title={
							visaSponsorship === "sponsor_listed"
								? "Employer matched the sponsor list; the listing does not explicitly promise sponsorship."
								: undefined
						}
					>
						{sponsorshipLabels[visaSponsorship]}
					</span>
				</div>
				{(showRegeneratingPdf || showStalePdf) && (
					<div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
						{showRegeneratingPdf && (
							<span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-blue-200/70 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-blue-700 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-200">
								<Loader2 className="h-2.5 w-2.5 animate-spin" />
								Generating PDF
							</span>
						)}
						{showStalePdf && (
							<span className="inline-flex shrink-0 rounded-sm border border-amber-200/70 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200">
								Regenerate PDF
							</span>
						)}
					</div>
				)}
			</div>

			<div className="relative flex w-[6.5rem] shrink-0 flex-col items-center self-stretch justify-start gap-2 text-center">
				<span
					className="whitespace-nowrap text-[11px] font-medium text-muted-foreground/80"
					title={postingAge?.tooltip ?? "Posting date unavailable"}
				>
					{postingAge ? `Posted ${postingAge.label}` : "Posted —"}
				</span>

				{showSuitabilityScore && hasScore ? (
					<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
						<div
							role="img"
							aria-label={scoreTokens.label}
							className={cn(
								"flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 p-0.5",
								scoreTokens.shell,
							)}
						>
							<div className="flex h-full w-full items-center justify-center rounded-full border border-current/15 bg-card text-base font-semibold leading-none tabular-nums">
								{job.suitabilityScore}
							</div>
						</div>
					</div>
				) : showSuitabilityScore ? (
					<span
						role="img"
						aria-label="Waiting for AI scoring to finish."
						className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-muted px-2 py-[5px] text-[13px] font-medium text-muted-foreground"
						title="AI scoring has not been run for this job."
					>
						Score —
					</span>
				) : null}
			</div>
		</div>
	);
};
