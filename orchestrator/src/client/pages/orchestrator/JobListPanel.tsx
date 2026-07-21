import { Tip } from "@client/components/Tip";
import type { JobListItem } from "@shared/types.js";
import { Building2, EyeOff, Loader2 } from "lucide-react";
import { forwardRef, useImperativeHandle, useMemo } from "react";
import {
	useVirtualizedList,
	type VirtualListHandle,
} from "@/client/lib/virtual-list";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { FilterTab } from "./constants";
import {
	appliedDuplicateIndicator,
	defaultStatusToken,
	emptyStateCopy,
	statusTokens,
} from "./constants";
import { JobRowContent } from "./JobRowContent";

interface EmptyStateAction {
	label: string;
	onClick: () => void;
}

interface JobListPanelProps {
	isLoading: boolean;
	jobs: JobListItem[];
	activeJobs: JobListItem[];
	selectedJobId: string | null;
	selectedJobIds: Set<string>;
	activeTab: FilterTab;
	onSelectJob: (jobId: string) => void;
	onToggleSelectJob: (jobId: string) => void;
	onToggleSelectAll: (checked: boolean) => void;
	onHideJob?: (job: JobListItem) => Promise<void>;
	onHideCompany?: (job: JobListItem) => Promise<void>;
	primaryEmptyStateAction?: EmptyStateAction;
	secondaryEmptyStateAction?: EmptyStateAction;
	emptyStateMessage?: string;
}

const ROW_ESTIMATE = 84;

export const JobListPanel = forwardRef<VirtualListHandle, JobListPanelProps>(
	(
		{
			isLoading,
			jobs,
			activeJobs,
			selectedJobId,
			selectedJobIds,
			activeTab,
			onSelectJob,
			onToggleSelectJob,
			onToggleSelectAll,
			onHideJob,
			onHideCompany,
			primaryEmptyStateAction,
			secondaryEmptyStateAction,
			emptyStateMessage,
		},
		ref,
	) => {
		const companyStackMeta = useMemo(() => {
			const metadata: Array<{
				count: number;
				position: "first" | "middle" | "last" | "single";
			}> = activeJobs.map(() => ({ count: 1, position: "single" }));
			let start = 0;
			while (start < activeJobs.length) {
				const employer = activeJobs[start]?.employer.trim().toLowerCase();
				let end = start + 1;
				while (
					end < activeJobs.length &&
					activeJobs[end]?.employer.trim().toLowerCase() === employer
				) {
					end += 1;
				}
				const count = end - start;
				if (count > 1) {
					for (let index = start; index < end; index += 1) {
						metadata[index] = {
							count,
							position:
								index === start
									? "first"
									: index === end - 1
										? "last"
										: "middle",
						};
					}
				}
				start = end;
			}
			return metadata;
		}, [activeJobs]);

		const virtualizer = useVirtualizedList({
			count: activeJobs.length,
			mode: "window",
			estimateSize: () => ROW_ESTIMATE,
			overscan: 8,
			getItemKey: (index) => activeJobs[index]?.id ?? index,
		});

		useImperativeHandle(
			ref,
			() => ({
				scrollToIndex: (index, options) =>
					virtualizer.scrollToIndex(index, options),
			}),
			[virtualizer],
		);

		if (isLoading && jobs.length === 0) {
			return (
				<div className="min-w-0 rounded-xl border border-border bg-card shadow-sm">
					<div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
						<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						<div className="text-sm text-muted-foreground">Loading jobs...</div>
					</div>
				</div>
			);
		}

		if (activeJobs.length === 0) {
			return (
				<div className="min-w-0 rounded-xl border border-border bg-card shadow-sm">
					<div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
						<div className="text-base font-semibold">No jobs found</div>
						<p className="max-w-md text-sm text-muted-foreground">
							{emptyStateMessage ?? emptyStateCopy[activeTab]}
						</p>
						{(primaryEmptyStateAction || secondaryEmptyStateAction) && (
							<div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
								{primaryEmptyStateAction && (
									<Button size="sm" onClick={primaryEmptyStateAction.onClick}>
										{primaryEmptyStateAction.label}
									</Button>
								)}
								{secondaryEmptyStateAction && (
									<Button
										size="sm"
										variant="outline"
										onClick={secondaryEmptyStateAction.onClick}
									>
										{secondaryEmptyStateAction.label}
									</Button>
								)}
							</div>
						)}
					</div>
				</div>
			);
		}

		const virtualItems = virtualizer.getVirtualItems();

		return (
			<div className="min-w-0 rounded-xl border border-border bg-card shadow-sm">
				<div className="divide-y divide-border/40">
					<div className="flex items-center justify-between gap-3 px-4 py-2 opacity-100 transition-opacity sm:opacity-50 sm:hover:opacity-100">
						<label
							htmlFor="job-list-select-all"
							className="flex items-center gap-2 text-xs text-muted-foreground"
						>
							<Checkbox
								id="job-list-select-all"
								checked={
									activeJobs.length > 0 &&
									activeJobs.every((job) => selectedJobIds.has(job.id))
								}
								onCheckedChange={() => {
									const allSelected =
										activeJobs.length > 0 &&
										activeJobs.every((job) => selectedJobIds.has(job.id));
									onToggleSelectAll(!allSelected);
								}}
								aria-label="Select all filtered jobs"
							/>
							Select all filtered
						</label>
						<span className="text-xs text-muted-foreground tabular-nums">
							{selectedJobIds.size} selected
						</span>
					</div>
					<div
						className="relative"
						style={{
							height: `${virtualizer.getTotalSize()}px`,
						}}
					>
						{virtualItems.map((virtualRow) => {
							const job = activeJobs[virtualRow.index];
							if (!job) return null;

							const isSelected = job.id === selectedJobId;
							const isChecked = selectedJobIds.has(job.id);
							const stackMeta = companyStackMeta[virtualRow.index];
							const statusToken =
								statusTokens[job.status] ?? defaultStatusToken;
							const statusDotClassName = job.appliedDuplicateMatch
								? appliedDuplicateIndicator.dot
								: statusToken.dot;
							const statusDotTitle = job.appliedDuplicateMatch
								? appliedDuplicateIndicator.label
								: statusToken.label;

							return (
								<div
									key={virtualRow.key}
									ref={virtualizer.measureElement}
									data-index={virtualRow.index}
									data-job-id={job.id}
									data-virtual-row="true"
									className={cn(
										// Base row layout and hover behavior.
										"group absolute left-0 top-0 flex w-full items-center gap-3 border-l-2 border-b px-4 py-3 transition-colors cursor-pointer",
										// selected or checked
										(isChecked || isSelected) &&
											"shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]",
										// Checked rows keep their left border and background emphasized.
										isChecked
											? "border-l! border-l-primary bg-primary/15! hover:bg-primary/25!"
											: "border-l border-l-border/40",
										// Selected rows use the primary tint so the active job stands out.
										isSelected
											? "bg-primary/15 hover:bg-primary/25"
											: "border-b-border/40 hover:bg-muted/80",
										// If the row is both selected and checked, add a subtle focus outline.
										isChecked &&
											isSelected &&
											"bg-primary/40 hover:bg-primary/20",
										stackMeta?.count > 1 &&
											"ml-1 w-[calc(100%-0.5rem)] border-x border-x-border/35 bg-muted/20",
										stackMeta?.position === "first" && "rounded-t-lg border-t",
										stackMeta?.position === "last" && "rounded-b-lg",
									)}
									style={{
										transform: `translateY(${virtualRow.start}px)`,
									}}
								>
									<div className="relative h-4 w-4 shrink-0">
										<span
											className={cn(
												"absolute inset-0 m-auto h-2 w-2 rounded-full transition-opacity duration-150 ease-out",
												statusDotClassName,
												isChecked || isSelected
													? "opacity-0"
													: "opacity-100 group-hover:opacity-0",
											)}
											title={statusDotTitle}
										/>
										<Checkbox
											checked={isChecked}
											onCheckedChange={() => onToggleSelectJob(job.id)}
											onClick={(event) => event.stopPropagation()}
											aria-label={`Select ${job.title}`}
											className={cn(
												"absolute inset-0 m-0 border-border/80 cursor-pointer text-muted-foreground/70 transition-opacity duration-150 ease-out data-[state=checked]:border-primary group-hover:border-primary data-[state=checked]:bg-primary/20 data-[state=checked]:text-primary",
												isChecked || isSelected
													? "opacity-100 pointer-events-auto border-primary/50"
													: "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto",
											)}
										/>
									</div>
									<button
										type="button"
										onClick={() => onSelectJob(job.id)}
										data-testid={`select-${job.id}`}
										className="flex min-w-0 flex-1 cursor-pointer text-left"
										aria-pressed={isSelected}
									>
										<JobRowContent
											job={job}
											isSelected={isSelected}
											showStatusDot={false}
											companyStackCount={
												stackMeta?.position === "first" ? stackMeta.count : 1
											}
										/>
									</button>
									{(onHideJob || onHideCompany) && (
										<div className="absolute right-4 bottom-3 flex w-[6.5rem] items-center justify-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
											{onHideJob && (
												<Tip content="Hide this job" side="bottom" asChild>
													<button
														type="button"
														aria-label={`Hide ${job.title}`}
														className="rounded-full p-1.5 text-red-600 transition-colors hover:bg-red-100 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
														onClick={(event) => {
															event.stopPropagation();
															void onHideJob(job);
														}}
													>
														<EyeOff className="h-3.5 w-3.5" />
													</button>
												</Tip>
											)}
											{onHideCompany && (
												<Tip content="Hide this company" side="bottom" asChild>
													<button
														type="button"
														aria-label={`Hide company ${job.employer}`}
														className="rounded-full p-1.5 text-red-600 transition-colors hover:bg-red-100 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
														onClick={(event) => {
															event.stopPropagation();
															void onHideCompany(job);
														}}
													>
														<Building2 className="h-3.5 w-3.5" />
													</button>
												</Tip>
											)}
										</div>
									)}
								</div>
							);
						})}
					</div>
				</div>
			</div>
		);
	},
);

JobListPanel.displayName = "JobListPanel";
