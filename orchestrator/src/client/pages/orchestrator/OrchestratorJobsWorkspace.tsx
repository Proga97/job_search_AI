import type { VirtualListHandle } from "@client/lib/virtual-list";
import type { Job, JobListItem, JobSource, JobStatus } from "@shared/types.js";
import type React from "react";
import { toast } from "sonner";
import * as api from "@/client/api";
import type {
	EmploymentType,
	ExperienceLevel,
	FilterTab,
	JobDateFilter,
	JobSort,
	SalaryFilter,
	SponsorFilter,
} from "./constants";
import { JobCommandBar } from "./JobCommandBar";
import { JobDetailPanel } from "./JobDetailPanel";
import { JobListPanel } from "./JobListPanel";
import { OrchestratorFilters } from "./OrchestratorFilters";
import { OrchestratorSummary } from "./OrchestratorSummary";

interface EmptyStateAction {
	label: string;
	onClick: () => void;
}

interface OrchestratorJobsWorkspaceProps {
	stats: Record<JobStatus, number>;
	isPipelineRunning: boolean;
	jobs: JobListItem[];
	activeJobs: JobListItem[];
	selectedJob: Job | null;
	selectedJobId: string | null;
	selectedJobIds: Set<string>;
	activeTab: FilterTab;
	counts: Record<FilterTab, number>;
	isDesktop: boolean;
	isLoading: boolean;
	isCommandBarOpen: boolean;
	commandBarEnabled: boolean;
	sourceFilter: JobSource | "all";
	sponsorFilter: SponsorFilter;
	salaryFilter: SalaryFilter;
	postedWithinDays: number | null;
	minimumScore: number | null;
	employmentTypes: EmploymentType[];
	experienceLevels: ExperienceLevel[];
	locationFilter: string;
	dateFilter: JobDateFilter;
	sourcesWithJobs: JobSource[];
	sort: JobSort;
	filteredCount: number;
	isFiltersOpen: boolean;
	jobListHandleRef: React.Ref<VirtualListHandle>;
	primaryEmptyStateAction?: EmptyStateAction;
	secondaryEmptyStateAction?: EmptyStateAction;
	emptyStateMessage?: string;
	onCommandBarOpenChange: (open: boolean) => void;
	onCommandSelectJob: (targetTab: FilterTab, id: string) => void;
	onTabChange: (tab: FilterTab) => void;
	onFiltersOpenChange: (open: boolean) => void;
	onSourceFilterChange: (value: JobSource | "all") => void;
	onSponsorFilterChange: (value: SponsorFilter) => void;
	onSalaryFilterChange: (value: SalaryFilter) => void;
	onPostedWithinChange: (value: number | null) => void;
	onMinimumScoreChange: (value: number | null) => void;
	onEmploymentTypesChange: (value: EmploymentType[]) => void;
	onExperienceLevelsChange: (value: ExperienceLevel[]) => void;
	onLocationFilterChange: (value: string) => void;
	onDateFilterChange: (value: JobDateFilter) => void;
	onSortChange: (sort: JobSort) => void;
	onResetFilters: () => void;
	onSelectJob: (jobId: string) => void;
	onToggleSelectJob: (jobId: string) => void;
	onToggleSelectAll: (checked: boolean) => void;
	onSelectJobId: (jobId: string | null) => void;
	onJobUpdated: () => Promise<void>;
	onHideCompany: (job: JobListItem) => Promise<void>;
	onPauseRefreshChange: (paused: boolean) => void;
}

export const OrchestratorJobsWorkspace: React.FC<
	OrchestratorJobsWorkspaceProps
> = ({
	stats,
	isPipelineRunning,
	jobs,
	activeJobs,
	selectedJob,
	selectedJobId,
	selectedJobIds,
	activeTab,
	counts,
	isDesktop,
	isLoading,
	isCommandBarOpen,
	commandBarEnabled,
	sourceFilter,
	sponsorFilter,
	salaryFilter,
	postedWithinDays,
	minimumScore,
	employmentTypes,
	experienceLevels,
	locationFilter,
	dateFilter,
	sourcesWithJobs,
	sort,
	filteredCount,
	isFiltersOpen,
	jobListHandleRef,
	primaryEmptyStateAction,
	secondaryEmptyStateAction,
	emptyStateMessage,
	onCommandBarOpenChange,
	onCommandSelectJob,
	onTabChange,
	onFiltersOpenChange,
	onSourceFilterChange,
	onSponsorFilterChange,
	onSalaryFilterChange,
	onPostedWithinChange,
	onMinimumScoreChange,
	onEmploymentTypesChange,
	onExperienceLevelsChange,
	onLocationFilterChange,
	onDateFilterChange,
	onSortChange,
	onResetFilters,
	onSelectJob,
	onToggleSelectJob,
	onToggleSelectAll,
	onSelectJobId,
	onJobUpdated,
	onHideCompany,
	onPauseRefreshChange,
}) => (
	<>
		<OrchestratorSummary stats={stats} isPipelineRunning={isPipelineRunning} />

		<section className="mt-6 space-y-4">
			<JobCommandBar
				jobs={jobs}
				onSelectJob={onCommandSelectJob}
				open={isCommandBarOpen}
				onOpenChange={onCommandBarOpenChange}
				enabled={commandBarEnabled}
			/>
			<OrchestratorFilters
				activeTab={activeTab}
				onTabChange={onTabChange}
				counts={counts}
				onOpenCommandBar={() => onCommandBarOpenChange(true)}
				isFiltersOpen={isFiltersOpen}
				onFiltersOpenChange={onFiltersOpenChange}
				sourceFilter={sourceFilter}
				onSourceFilterChange={onSourceFilterChange}
				sponsorFilter={sponsorFilter}
				onSponsorFilterChange={onSponsorFilterChange}
				salaryFilter={salaryFilter}
				onSalaryFilterChange={onSalaryFilterChange}
				postedWithinDays={postedWithinDays}
				onPostedWithinChange={onPostedWithinChange}
				minimumScore={minimumScore}
				onMinimumScoreChange={onMinimumScoreChange}
				employmentTypes={employmentTypes}
				onEmploymentTypesChange={onEmploymentTypesChange}
				experienceLevels={experienceLevels}
				onExperienceLevelsChange={onExperienceLevelsChange}
				locationFilter={locationFilter}
				onLocationFilterChange={onLocationFilterChange}
				dateFilter={dateFilter}
				onDateFilterChange={onDateFilterChange}
				sourcesWithJobs={sourcesWithJobs}
				sort={sort}
				onSortChange={onSortChange}
				onResetFilters={onResetFilters}
				filteredCount={filteredCount}
			/>

			<div className="grid gap-4 lg:grid-cols-[clamp(440px,32vw,560px)_minmax(0,1fr)]">
				<JobListPanel
					ref={jobListHandleRef}
					isLoading={isLoading}
					jobs={jobs}
					activeJobs={activeJobs}
					selectedJobId={selectedJobId}
					selectedJobIds={selectedJobIds}
					activeTab={activeTab}
					onSelectJob={onSelectJob}
					onToggleSelectJob={onToggleSelectJob}
					onToggleSelectAll={onToggleSelectAll}
					onHideJob={async (job) => {
						try {
							await api.updateJob(job.id, {
								status: "skipped",
								closedAt: Math.floor(Date.now() / 1000),
							});
							if (selectedJobId === job.id) onSelectJobId(null);
							await onJobUpdated();
							toast.success("Job hidden", {
								description:
									"This listing will stay hidden after future searches.",
							});
						} catch {
							toast.error("Could not hide job");
						}
					}}
					onHideCompany={onHideCompany}
					primaryEmptyStateAction={primaryEmptyStateAction}
					secondaryEmptyStateAction={secondaryEmptyStateAction}
					emptyStateMessage={emptyStateMessage}
				/>

				{isDesktop && (
					<JobDetailPanel
						activeTab={activeTab}
						activeJobs={activeJobs}
						selectedJob={selectedJob}
						onSelectJobId={onSelectJobId}
						onJobUpdated={onJobUpdated}
						onPauseRefreshChange={onPauseRefreshChange}
					/>
				)}
			</div>
		</section>
	</>
);
