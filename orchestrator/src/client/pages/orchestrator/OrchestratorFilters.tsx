import type React from "react";
import { Tabs } from "@/components/ui/tabs";
import type { FilterTab } from "./constants";
import { DateFilterPill } from "./filters/DateFilterPill";
import { EmploymentTypeFilterPill } from "./filters/EmploymentTypeFilterPill";
import { ExperienceFilterPill } from "./filters/ExperienceFilterPill";
import { LocationFilterInput } from "./filters/LocationFilterInput";
import { OrchestratorFilterBar } from "./filters/OrchestratorFilterBar";
import { OrchestratorTabRow } from "./filters/OrchestratorTabRow";
import { PostedWithinFilterPill } from "./filters/PostedWithinFilterPill";
import { SalaryFilterPill } from "./filters/SalaryFilterPill";
import { ScoreFilterPill } from "./filters/ScoreFilterPill";
import { SortFilterPill } from "./filters/SortFilterPill";
import { SourceFilterPill } from "./filters/SourceFilterPill";
import { SponsorFilterPill } from "./filters/SponsorFilterPill";
import type { OrchestratorFiltersProps } from "./filters/types";
import { useFilterBarDerivedState } from "./filters/useFilterBarDerivedState";

export type { OrchestratorFiltersProps } from "./filters/types";

export const OrchestratorFilters: React.FC<OrchestratorFiltersProps> = ({
	activeTab,
	onTabChange,
	counts,
	onOpenCommandBar,
	sourceFilter,
	onSourceFilterChange,
	sponsorFilter,
	onSponsorFilterChange,
	salaryFilter,
	onSalaryFilterChange,
	postedWithinDays,
	onPostedWithinChange,
	minimumScore,
	onMinimumScoreChange,
	employmentTypes,
	onEmploymentTypesChange,
	experienceLevels,
	onExperienceLevelsChange,
	locationFilter,
	onLocationFilterChange,
	dateFilter,
	onDateFilterChange,
	sourcesWithJobs,
	sort,
	onSortChange,
	onResetFilters,
	filteredCount,
	isFiltersOpen: isFiltersOpenProp,
	onFiltersOpenChange: onFiltersOpenChangeProp,
}) => {
	const {
		isFiltersOpen,
		onFiltersOpenChange,
		activeFilterCount,
		postedWithinLabel,
		sponsorLabel,
		sortDirectionLabel,
		salaryActive,
		salarySummary,
	} = useFilterBarDerivedState({
		sourceFilter,
		sponsorFilter,
		dateFilter,
		postedWithinDays,
		minimumScore,
		employmentTypes,
		experienceLevels,
		locationFilter,
		salaryFilter,
		sort,
		isFiltersOpen: isFiltersOpenProp,
		onFiltersOpenChange: onFiltersOpenChangeProp,
	});

	return (
		<Tabs
			value={activeTab}
			onValueChange={(value) => onTabChange(value as FilterTab)}
		>
			<div className="space-y-3">
				<OrchestratorTabRow
					counts={counts}
					onOpenCommandBar={onOpenCommandBar}
					isFiltersOpen={isFiltersOpen}
					onFiltersOpenChange={onFiltersOpenChange}
					activeFilterCount={activeFilterCount}
					onResetFilters={onResetFilters}
				/>

				{isFiltersOpen ? (
					<OrchestratorFilterBar>
						<SortFilterPill
							activeTab={activeTab}
							sort={sort}
							onSortChange={onSortChange}
							filteredCount={filteredCount}
							sortDirectionLabel={sortDirectionLabel}
						/>

						<span className="mx-0.5 h-5 w-px bg-border/60" aria-hidden="true" />

						<LocationFilterInput
							locationFilter={locationFilter}
							onLocationFilterChange={onLocationFilterChange}
						/>

						<PostedWithinFilterPill
							postedWithinDays={postedWithinDays}
							onPostedWithinChange={onPostedWithinChange}
							postedWithinLabel={postedWithinLabel}
						/>

						<ScoreFilterPill
							minimumScore={minimumScore}
							onMinimumScoreChange={onMinimumScoreChange}
						/>

						<ExperienceFilterPill
							experienceLevels={experienceLevels}
							onExperienceLevelsChange={onExperienceLevelsChange}
						/>

						<DateFilterPill
							dateFilter={dateFilter}
							onDateFilterChange={onDateFilterChange}
						/>

						<SponsorFilterPill
							sponsorFilter={sponsorFilter}
							onSponsorFilterChange={onSponsorFilterChange}
							sponsorLabel={sponsorLabel}
						/>

						<SalaryFilterPill
							salaryFilter={salaryFilter}
							onSalaryFilterChange={onSalaryFilterChange}
							salaryActive={salaryActive}
							salarySummary={salarySummary}
						/>

						<EmploymentTypeFilterPill
							employmentTypes={employmentTypes}
							onEmploymentTypesChange={onEmploymentTypesChange}
						/>

						<SourceFilterPill
							sourceFilter={sourceFilter}
							onSourceFilterChange={onSourceFilterChange}
							sourcesWithJobs={sourcesWithJobs}
						/>
					</OrchestratorFilterBar>
				) : null}
			</div>
		</Tabs>
	);
};
