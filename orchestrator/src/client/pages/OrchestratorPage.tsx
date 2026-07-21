import * as api from "@client/api";
import { ManualImportSheet } from "@client/components/ManualImportSheet";
import { useSettings } from "@client/hooks/useSettings";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { showErrorToast } from "@/client/lib/error-toast";
import { OrchestratorHeader } from "./orchestrator/OrchestratorHeader";
import { OrchestratorJobWorkspaceContainer } from "./orchestrator/OrchestratorJobWorkspaceContainer";
import { OrchestratorSearchComposer } from "./orchestrator/OrchestratorSearchComposer";
import { useOrchestratorData } from "./orchestrator/useOrchestratorData";
import { useOrchestratorFilters } from "./orchestrator/useOrchestratorFilters";
import {
	useNavigationRefresh,
	useOrchestratorNavigation,
} from "./orchestrator/useOrchestratorNavigation";
import { useOrchestratorUiState } from "./orchestrator/useOrchestratorUiState";
import { usePipelineControls } from "./orchestrator/usePipelineControls";
import { usePipelineSearchPresets } from "./orchestrator/usePipelineSearchPresets";
import { usePipelineSources } from "./orchestrator/usePipelineSources";
import { useWatchlistPipelineSources } from "./orchestrator/useWatchlistPipelineSources";
import { getEnabledSources } from "./orchestrator/utils";

export const OrchestratorPage: React.FC = () => {
	const [isManualImportOpen, setIsManualImportOpen] = useState(false);
	const filters = useOrchestratorFilters();
	const navigation = useOrchestratorNavigation({
		searchParams: filters.searchParams,
	});
	const { settings, refreshSettings } = useSettings();
	const {
		jobs,
		selectedJob,
		stats,
		isLoading,
		isPipelineRunning,
		setIsPipelineRunning,
		pipelineTerminalEvent,
		setIsRefreshPaused,
		loadJobs,
	} = useOrchestratorData(navigation.selectedJobId);

	useNavigationRefresh(loadJobs);

	const enabledSources = useMemo(
		() => getEnabledSources(settings ?? null),
		[settings],
	);
	const { pipelineSources, setPipelineSources, toggleSource } =
		usePipelineSources(enabledSources);
	const {
		watchlistSources,
		selectedWatchlistSourceIds,
		setSelectedWatchlistSourceIds,
		toggleWatchlistSource,
		isLoading: isWatchlistSourcesLoading,
	} = useWatchlistPipelineSources();

	const {
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
	} = usePipelineControls({
		isPipelineRunning,
		setIsPipelineRunning,
		pipelineTerminalEvent,
		pipelineSources,
		watchlistSelectedSourceIds: selectedWatchlistSourceIds,
		loadJobs,
		navigateWithContext: navigation.navigateWithContext,
	});
	const autoRefreshEnabled = settings?.autoRefreshJobsEnabled?.value ?? false;
	const autoRefreshIntervalMinutes =
		settings?.autoRefreshJobsIntervalMinutes?.value ?? 60;
	const autoRefreshIntervalLabel =
		autoRefreshIntervalMinutes < 60
			? `${autoRefreshIntervalMinutes}m`
			: `${autoRefreshIntervalMinutes / 60}h`;

	useEffect(() => {
		if (!autoRefreshEnabled) return;
		const intervalId = window.setInterval(
			() => {
				void handleRefreshSearch();
			},
			autoRefreshIntervalMinutes * 60 * 1000,
		);
		return () => window.clearInterval(intervalId);
	}, [autoRefreshEnabled, autoRefreshIntervalMinutes, handleRefreshSearch]);

	const handleAutoRefreshToggle = useCallback(async () => {
		try {
			await api.updateSettings({
				autoRefreshJobsEnabled: !autoRefreshEnabled,
			});
			await refreshSettings();
			toast.success(
				!autoRefreshEnabled ? "Auto-refresh enabled" : "Auto-refresh disabled",
				!autoRefreshEnabled
					? {
							description: `Jobs will refresh every ${autoRefreshIntervalLabel}.`,
						}
					: undefined,
			);
		} catch (error) {
			showErrorToast(error, "Failed to update auto-refresh");
		}
	}, [autoRefreshEnabled, autoRefreshIntervalLabel, refreshSettings]);

	// Once a run has started, leave the composer even when the database is still
	// empty so the workspace can show live pipeline progress immediately.
	const isFirstRunWorkspace =
		!isLoading &&
		jobs.length === 0 &&
		!isPipelineRunning &&
		pipelineTerminalEvent === null;
	const isSearchComposerVisible = isRunModeModalOpen || isFirstRunWorkspace;
	const canToggleSearchComposer = !isFirstRunWorkspace;
	const searchPresetProps = usePipelineSearchPresets({
		enabled: isSearchComposerVisible && runMode === "automatic",
	});
	const ui = useOrchestratorUiState({
		isSearchComposerVisible,
		selectedJobId: navigation.selectedJobId,
		onClearSelectedJob: () => navigation.handleSelectJobId(null),
	});
	const handleToggleAutomaticRun = useCallback(() => {
		if (isSearchComposerVisible && canToggleSearchComposer) {
			setIsRunModeModalOpen(false);
			return;
		}

		openRunMode("automatic");
	}, [
		canToggleSearchComposer,
		isSearchComposerVisible,
		openRunMode,
		setIsRunModeModalOpen,
	]);
	const handleClearAllJobs = useCallback(async () => {
		try {
			const result = await api.deleteAllJobs();
			navigation.handleSelectJobId(null);
			await loadJobs();
			toast.success("Job listings cleared", {
				description: `Deleted ${result.count} job${result.count === 1 ? "" : "s"}.`,
			});
		} catch (error) {
			showErrorToast(error, "Failed to clear job listings");
			throw error;
		}
	}, [loadJobs, navigation]);
	const handleHideCompany = useCallback(
		async (job: (typeof jobs)[number]) => {
			const employer = job.employer.trim();
			if (!employer) return;
			try {
				const hiddenCompanies = settings?.hiddenCompanies?.value ?? [];
				if (
					!hiddenCompanies.some(
						(value) => value.trim().toLowerCase() === employer.toLowerCase(),
					)
				) {
					await api.updateSettings({
						hiddenCompanies: [...hiddenCompanies, employer],
					});
					await refreshSettings();
				}
				const matchingJobs = jobs.filter(
					(candidate) =>
						candidate.employer.trim().toLowerCase() === employer.toLowerCase(),
				);
				await Promise.all(
					matchingJobs.map((candidate) =>
						api.updateJob(candidate.id, {
							status: "skipped",
							closedAt: Math.floor(Date.now() / 1000),
						}),
					),
				);
				navigation.handleSelectJobId(null);
				await loadJobs();
				toast.success(`${employer} hidden`, {
					description:
						"Current listings were removed. Future listings will be dropped during fetch.",
				});
			} catch (error) {
				showErrorToast(error, "Failed to hide company");
			}
		},
		[jobs, loadJobs, navigation, refreshSettings, settings],
	);

	return (
		<>
			<OrchestratorHeader
				navOpen={ui.navOpen}
				onNavOpenChange={ui.setNavOpen}
				isPipelineRunning={isPipelineRunning}
				isCancelling={isCancelling}
				pipelineSources={pipelineSources}
				hideRunAction={isSearchComposerVisible && !canToggleSearchComposer}
				isSearchComposerOpen={
					isSearchComposerVisible && canToggleSearchComposer
				}
				onOpenAutomaticRun={handleToggleAutomaticRun}
				onRefreshSearch={handleRefreshSearch}
				autoRefreshEnabled={autoRefreshEnabled}
				autoRefreshIntervalLabel={autoRefreshIntervalLabel}
				onAutoRefreshToggle={() => void handleAutoRefreshToggle()}
				onClearAllJobs={handleClearAllJobs}
				onCancelPipeline={handleCancelPipeline}
				onOpenManualImport={() => setIsManualImportOpen(true)}
			/>

			<main
				className={
					isSearchComposerVisible
						? "min-h-[calc(100dvh-6rem)]"
						: "container mx-auto space-y-6 px-4 py-6 pb-12 lg:max-w-[calc((100%+64rem)/2)] lg:px-1 xl:max-w-[calc((100%+80rem)/2)] 2xl:max-w-[calc((100%+96rem)/2)]"
				}
			>
				{isSearchComposerVisible ? (
					<OrchestratorSearchComposer
						mode={runMode}
						settings={settings ?? null}
						enabledSources={enabledSources}
						pipelineSources={pipelineSources}
						onToggleSource={toggleSource}
						onSetPipelineSources={setPipelineSources}
						watchlistSources={watchlistSources}
						selectedWatchlistSourceIds={selectedWatchlistSourceIds}
						onToggleWatchlistSource={toggleWatchlistSource}
						onSetSelectedWatchlistSourceIds={setSelectedWatchlistSourceIds}
						isWatchlistSourcesLoading={isWatchlistSourcesLoading}
						isPipelineRunning={isPipelineRunning}
						onOpenChange={setIsRunModeModalOpen}
						onModeChange={setRunMode}
						onSaveAndRunAutomatic={handleSaveAndRunAutomatic}
						onManualImported={handleManualImported}
						{...searchPresetProps}
					/>
				) : (
					<OrchestratorJobWorkspaceContainer
						jobs={jobs}
						selectedJob={selectedJob}
						stats={stats}
						isLoading={isLoading}
						isPipelineRunning={isPipelineRunning}
						isScoringPipelineRunning={isScoringPipelineRunning}
						loadJobs={loadJobs}
						setIsRefreshPaused={setIsRefreshPaused}
						filters={filters}
						navigation={navigation}
						ui={ui}
						openRunMode={openRunMode}
						onRunScoringPipeline={handleRunScoringPipeline}
						onHideCompany={handleHideCompany}
					/>
				)}
			</main>

			<ManualImportSheet
				open={isManualImportOpen}
				onOpenChange={setIsManualImportOpen}
				onImported={async (result) => {
					await handleManualImported(result);
				}}
			/>
		</>
	);
};
