import * as api from "@client/api";
import type { ManualImportResult } from "@client/components/ManualImportFlow";
import { useSettings } from "@client/hooks/useSettings";
import {
	createLocationIntent,
	planLocationSources,
} from "@shared/location-intelligence.js";
import {
	type AppSettings,
	type JobSource,
	normalizePipelineRunBudget,
} from "@shared/types.js";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { showErrorToast } from "@/client/lib/error-toast";
import { trackProductEvent } from "@/lib/analytics";
import type { AutomaticRunValues } from "./automatic-run";
import {
	deriveExtractorLimits,
	loadAutomaticRunMemory,
	normalizeWorkplaceTypes,
	parseCityLocationsSetting,
	serializeCityLocationsSetting,
} from "./automatic-run";
import type { RunMode } from "./run-mode";

type UsePipelineControlsArgs = {
	isPipelineRunning: boolean;
	setIsPipelineRunning: (value: boolean) => void;
	pipelineTerminalEvent: { status: string; errorMessage: string | null } | null;
	pipelineSources: JobSource[];
	watchlistSelectedSourceIds?: string[];
	loadJobs: () => Promise<void>;
	navigateWithContext: (
		newTab: string,
		newJobId?: string | null,
		isReplace?: boolean,
	) => void;
};

export type UsePipelineControlsResult = {
	isRunModeModalOpen: boolean;
	setIsRunModeModalOpen: (open: boolean) => void;
	runMode: RunMode;
	setRunMode: (mode: RunMode) => void;
	isCancelling: boolean;
	isScoringPipelineRunning: boolean;
	openRunMode: (mode: RunMode) => void;
	handleCancelPipeline: () => Promise<void>;
	handleRefreshSearch: () => Promise<void>;
	handleRunScoringPipeline: () => Promise<void>;
	handleSaveAndRunAutomatic: (values: AutomaticRunValues) => Promise<void>;
	handleManualImported: (result: ManualImportResult) => Promise<void>;
	refreshSettings: () => Promise<AppSettings | null>;
};

export function usePipelineControls(
	args: UsePipelineControlsArgs,
): UsePipelineControlsResult {
	const {
		isPipelineRunning,
		setIsPipelineRunning,
		pipelineTerminalEvent,
		pipelineSources,
		watchlistSelectedSourceIds,
		loadJobs,
		navigateWithContext,
	} = args;

	const [isRunModeModalOpen, setIsRunModeModalOpen] = useState(false);
	const [runMode, setRunMode] = useState<RunMode>("automatic");
	const [isCancelling, setIsCancelling] = useState(false);
	const [isScoringPipelineRunning, setIsScoringPipelineRunning] =
		useState(false);

	const { settings, refreshSettings } = useSettings();

	useEffect(() => {
		if (!pipelineTerminalEvent) return;
		setIsPipelineRunning(false);
		setIsCancelling(false);
		setIsScoringPipelineRunning(false);

		if (pipelineTerminalEvent.status === "cancelled") {
			trackProductEvent("jobs_pipeline_run_finished", {
				status: "cancelled",
				had_error_message: false,
			});
			toast.message("Search cancelled");
			return;
		}

		if (pipelineTerminalEvent.status === "failed") {
			trackProductEvent("jobs_pipeline_run_finished", {
				status: "failed",
				had_error_message: Boolean(pipelineTerminalEvent.errorMessage),
			});
			toast.error(pipelineTerminalEvent.errorMessage || "Search failed");
			return;
		}

		trackProductEvent("jobs_pipeline_run_finished", {
			status: "completed",
			had_error_message: false,
		});
		toast.success("Search completed");
	}, [pipelineTerminalEvent, setIsPipelineRunning]);

	const openRunMode = useCallback((mode: RunMode) => {
		setRunMode(mode);
		setIsRunModeModalOpen(true);
	}, []);

	const startPipelineRun = useCallback(
		async (config: {
			topN: number;
			minSuitabilityScore: number;
			sources: JobSource[];
			runBudget: number;
			postingAgeHours?: number;
			searchTerms: string[];
			scoringInstructions: string;
			country: string;
			cityLocations: string[];
			workplaceTypes: Array<"remote" | "hybrid" | "onsite">;
			searchScope: AutomaticRunValues["searchScope"];
			matchStrictness: AutomaticRunValues["matchStrictness"];
			watchlistSelectedSourceIds?: string[];
		}) => {
			try {
				setIsScoringPipelineRunning(false);
				setIsPipelineRunning(true);
				setIsCancelling(false);
				await api.runPipeline({
					mode: "discover",
					topN: config.topN,
					minSuitabilityScore: config.minSuitabilityScore,
					sources: config.sources,
					runBudget: config.runBudget,
					postingAgeHours: config.postingAgeHours,
					searchTerms: config.searchTerms,
					scoringInstructions: config.scoringInstructions,
					country: config.country,
					cityLocations: config.cityLocations,
					workplaceTypes: config.workplaceTypes,
					searchScope: config.searchScope,
					matchStrictness: config.matchStrictness,
					watchlistSelectedSourceIds: config.watchlistSelectedSourceIds,
				});
				setIsRunModeModalOpen(false);
				navigateWithContext("discovered", null);
				toast.message("Search started", {
					description: `Sources: ${config.sources.join(", ")}. This may take a few minutes.`,
				});
			} catch (error) {
				setIsPipelineRunning(false);
				setIsCancelling(false);
				showErrorToast(error, "Failed to start search");
			}
		},
		[navigateWithContext, setIsPipelineRunning],
	);

	const handleCancelPipeline = useCallback(async () => {
		if (isCancelling || !isPipelineRunning) return;

		try {
			setIsCancelling(true);
			trackProductEvent("jobs_pipeline_run_cancel_requested", {
				was_running: isPipelineRunning,
			});
			const result = await api.cancelPipeline();
			toast.message(result.message);
		} catch (error) {
			setIsCancelling(false);
			showErrorToast(error, "Failed to cancel search");
		}
	}, [isCancelling, isPipelineRunning]);

	const handleRefreshSearch = useCallback(async () => {
		if (isPipelineRunning || pipelineSources.length === 0) return;

		try {
			setIsScoringPipelineRunning(false);
			setIsPipelineRunning(true);
			setIsCancelling(false);
			await api.runPipeline({
				mode: "discover",
				sources: pipelineSources,
				searchTerms: settings?.searchTerms?.value,
				country: settings?.jobspyCountryIndeed?.value,
				cityLocations: parseCityLocationsSetting(settings?.searchCities?.value),
				workplaceTypes: normalizeWorkplaceTypes(
					settings?.workplaceTypes?.value,
				),
				searchScope: settings?.locationSearchScope?.value,
				matchStrictness: settings?.locationMatchStrictness?.value,
				postingAgeHours: loadAutomaticRunMemory()?.postingAgeHours ?? 72,
				watchlistSelectedSourceIds,
			});
			toast.message("Refreshing jobs", {
				description:
					"Running your current search again with the same settings.",
			});
		} catch (error) {
			setIsScoringPipelineRunning(false);
			setIsPipelineRunning(false);
			setIsCancelling(false);
			showErrorToast(error, "Failed to refresh jobs");
		}
	}, [
		isPipelineRunning,
		pipelineSources,
		setIsPipelineRunning,
		settings,
		watchlistSelectedSourceIds,
	]);

	const handleRunScoringPipeline = useCallback(async () => {
		if (isPipelineRunning) return;
		try {
			setIsScoringPipelineRunning(true);
			setIsPipelineRunning(true);
			setIsCancelling(false);
			await api.runPipeline({ mode: "score" });
			toast.message("AI scoring started", {
				description:
					"Scoring unscored discovered jobs. Tailoring will not run.",
			});
		} catch (error) {
			setIsScoringPipelineRunning(false);
			setIsPipelineRunning(false);
			setIsCancelling(false);
			showErrorToast(error, "Failed to start AI scoring");
		}
	}, [isPipelineRunning, setIsPipelineRunning]);

	const handleSaveAndRunAutomatic = useCallback(
		async (values: AutomaticRunValues) => {
			const normalizedValues = {
				...values,
				runBudget: normalizePipelineRunBudget(values.runBudget),
			};
			const locationIntent = createLocationIntent({
				selectedCountry: normalizedValues.country,
				cityLocations: normalizedValues.cityLocations,
				workplaceTypes: normalizedValues.workplaceTypes,
				searchScope: normalizedValues.searchScope,
				matchStrictness: normalizedValues.matchStrictness,
			});
			const sourcePlan = planLocationSources({
				intent: locationIntent,
				sources: pipelineSources,
			});
			const incompatiblePlans = sourcePlan.plans.filter((plan) => !plan.canRun);
			const compatibleSources = sourcePlan.compatibleSources as JobSource[];

			if (incompatiblePlans.length > 0) {
				toast.error(
					incompatiblePlans[0]?.reasons[0] ??
						"Some selected sources do not support this location setup.",
				);
				return;
			}

			if (compatibleSources.length === 0) {
				toast.error(
					"No compatible sources for the selected location setup. Choose another country, city, or source.",
				);
				return;
			}

			const limits = deriveExtractorLimits({
				budget: normalizedValues.runBudget,
				searchTerms: normalizedValues.searchTerms,
				sources: compatibleSources,
			});
			try {
				const searchCities = serializeCityLocationsSetting(
					normalizedValues.cityLocations,
				);
				await api.updateSettings({
					searchTerms: normalizedValues.searchTerms,
					workplaceTypes: normalizedValues.workplaceTypes,
					locationSearchScope: normalizedValues.searchScope,
					locationMatchStrictness: normalizedValues.matchStrictness,
					jobspyResultsWanted: limits.jobspyResultsWanted,
					gradcrackerMaxJobsPerTerm: limits.gradcrackerMaxJobsPerTerm,
					ukvisajobsMaxJobs: limits.ukvisajobsMaxJobs,
					adzunaMaxJobsPerTerm: limits.adzunaMaxJobsPerTerm,
					startupjobsMaxJobsPerTerm: limits.startupjobsMaxJobsPerTerm,
					jobindexMaxJobsPerTerm: limits.jobindexMaxJobsPerTerm,
					seekMaxJobsPerTerm: limits.seekMaxJobsPerTerm,
					naukriMaxJobsPerTerm: limits.naukriMaxJobsPerTerm,
					jobspyCountryIndeed: normalizedValues.country,
					searchCities,
				});
				await refreshSettings();
				await startPipelineRun({
					...normalizedValues,
					sources: compatibleSources,
					topN: values.topN,
					minSuitabilityScore: values.minSuitabilityScore,
					watchlistSelectedSourceIds:
						values.watchlistSelectedSourceIds ?? watchlistSelectedSourceIds,
				});
				setIsRunModeModalOpen(false);
			} catch (error) {
				showErrorToast(error, "Failed to start search");
			}
		},
		[
			pipelineSources,
			refreshSettings,
			startPipelineRun,
			watchlistSelectedSourceIds,
		],
	);

	const handleManualImported = useCallback(
		async (imported: ManualImportResult) => {
			trackProductEvent("jobs_manual_import_completed", {
				manual_import_source: imported.source,
				manual_import_source_host: imported.sourceHost ?? undefined,
			});
			await loadJobs();
			navigateWithContext("ready", imported.jobId);
		},
		[loadJobs, navigateWithContext],
	);

	return {
		isRunModeModalOpen,
		setIsRunModeModalOpen,
		runMode,
		setRunMode,
		isCancelling,
		isScoringPipelineRunning,
		openRunMode,
		handleCancelPipeline,
		handleRefreshSearch,
		handleRunScoringPipeline,
		handleSaveAndRunAutomatic,
		handleManualImported,
		refreshSettings,
	};
}
