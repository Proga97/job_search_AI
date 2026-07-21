import type { JobSource } from "@shared/types.js";
import { useMemo, useState } from "react";
import type {
	EmploymentType,
	ExperienceLevel,
	JobDateFilter,
	JobSort,
	SalaryFilter,
	SponsorFilter,
} from "../constants";
import { postedWithinOptions } from "../constants";
import { sponsorOptions } from "./filterOptions";
import {
	formatSalarySummary,
	getDirectionOptions,
	isSalaryFilterActive,
} from "./filterUtils";

interface UseFilterBarDerivedStateArgs {
	sourceFilter: JobSource | "all";
	sponsorFilter: SponsorFilter;
	dateFilter: JobDateFilter;
	postedWithinDays: number | null;
	minimumScore: number | null;
	employmentTypes: EmploymentType[];
	experienceLevels: ExperienceLevel[];
	locationFilter: string;
	salaryFilter: SalaryFilter;
	sort: JobSort;
	isFiltersOpen?: boolean;
	onFiltersOpenChange?: (open: boolean) => void;
}

export const useFilterBarDerivedState = ({
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
}: UseFilterBarDerivedStateArgs) => {
	const [internalFiltersOpen, setInternalFiltersOpen] = useState(false);
	const isFiltersOpen = isFiltersOpenProp ?? internalFiltersOpen;
	const onFiltersOpenChange = onFiltersOpenChangeProp ?? setInternalFiltersOpen;

	const salaryActive = isSalaryFilterActive(salaryFilter);

	const activeFilterCount = useMemo(
		() =>
			Number(sourceFilter !== "all") +
			Number(sponsorFilter.length > 0) +
			Number(dateFilter.dimensions.length > 0) +
			Number(postedWithinDays != null) +
			Number(minimumScore != null) +
			Number(employmentTypes.length > 0) +
			Number(experienceLevels.length > 0) +
			Number(locationFilter.trim() !== "") +
			Number(salaryActive),
		[
			sourceFilter,
			sponsorFilter,
			dateFilter.dimensions.length,
			postedWithinDays,
			minimumScore,
			employmentTypes.length,
			experienceLevels.length,
			locationFilter,
			salaryActive,
		],
	);

	const postedWithinLabel =
		postedWithinOptions.find((option) => option.value === postedWithinDays)
			?.label ?? null;

	const sponsorLabel =
		sponsorFilter.length === 0
			? null
			: sponsorFilter.length === 1
				? (sponsorOptions.find((option) => option.value === sponsorFilter[0])
						?.label ?? null)
				: `${sponsorFilter.length} selected`;

	const sortDirectionLabel = getDirectionOptions(sort.key).find(
		(option) => option.value === sort.direction,
	)?.label;

	const salarySummary = formatSalarySummary(salaryFilter);

	return {
		isFiltersOpen,
		onFiltersOpenChange,
		salaryActive,
		activeFilterCount,
		postedWithinLabel,
		sponsorLabel,
		sortDirectionLabel,
		salarySummary,
	};
};
