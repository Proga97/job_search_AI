import { PageHeader, StatusIndicator } from "@client/components/layout";
import type { JobSource } from "@shared/types.js";
import {
	Clock3,
	FileText,
	Loader2,
	MoreHorizontal,
	RefreshCw,
	SlidersHorizontal,
	Square,
	Trash2,
	X,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface OrchestratorHeaderProps {
	navOpen: boolean;
	onNavOpenChange: (open: boolean) => void;
	isPipelineRunning: boolean;
	isCancelling: boolean;
	pipelineSources: JobSource[];
	hideRunAction?: boolean;
	isSearchComposerOpen?: boolean;
	onOpenAutomaticRun: () => void;
	onRefreshSearch: () => void;
	autoRefreshEnabled: boolean;
	autoRefreshIntervalLabel: string;
	onAutoRefreshToggle: () => void;
	onClearAllJobs: () => Promise<void>;
	onCancelPipeline: () => void;
	onOpenManualImport: () => void;
}

export const OrchestratorHeader: React.FC<OrchestratorHeaderProps> = ({
	navOpen,
	onNavOpenChange,
	isPipelineRunning,
	isCancelling,
	pipelineSources,
	hideRunAction = false,
	isSearchComposerOpen = false,
	onOpenAutomaticRun,
	onRefreshSearch,
	autoRefreshEnabled,
	autoRefreshIntervalLabel,
	onAutoRefreshToggle,
	onClearAllJobs,
	onCancelPipeline,
	onOpenManualImport,
}) => {
	const [clearDialogOpen, setClearDialogOpen] = useState(false);
	const [isClearingJobs, setIsClearingJobs] = useState(false);
	const handleClearAllJobs = async () => {
		setIsClearingJobs(true);
		try {
			await onClearAllJobs();
			setClearDialogOpen(false);
		} finally {
			setIsClearingJobs(false);
		}
	};
	const primaryAction = hideRunAction ? null : isPipelineRunning ? (
		<Button
			size="sm"
			onClick={onCancelPipeline}
			disabled={isCancelling}
			variant="destructive"
			className="gap-2"
		>
			{isCancelling ? (
				<Loader2 className="h-4 w-4 animate-spin" />
			) : (
				<Square className="h-4 w-4" />
			)}
			<span className="hidden sm:inline">
				{isCancelling ? `Cancelling (${pipelineSources.length})` : `Cancel run`}
			</span>
		</Button>
	) : (
		<div className="flex items-center gap-2">
			<Button
				size="sm"
				onClick={onAutoRefreshToggle}
				variant="ghost"
				aria-pressed={autoRefreshEnabled}
				aria-label={`Auto-refresh ${autoRefreshEnabled ? "on" : "off"}`}
				title={`Auto-refresh every ${autoRefreshIntervalLabel}`}
				className={cn(
					"gap-2 rounded-full border shadow-none",
					autoRefreshEnabled
						? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
						: "border-border bg-card text-card-foreground hover:bg-accent",
				)}
			>
				<Clock3 className="h-4 w-4" />
				<span className="hidden xl:inline">
					Auto {autoRefreshIntervalLabel}
				</span>
			</Button>
			{!isSearchComposerOpen ? (
				<Button
					size="sm"
					onClick={onRefreshSearch}
					variant="ghost"
					className="gap-2 rounded-full border border-border bg-card text-card-foreground shadow-none hover:bg-accent"
					aria-label="Refresh jobs"
				>
					<RefreshCw className="h-4 w-4" />
					<span className="hidden sm:inline">Refresh</span>
				</Button>
			) : null}
			<Button
				size="sm"
				onClick={onOpenAutomaticRun}
				variant={isSearchComposerOpen ? "secondary" : "default"}
				className="gap-2"
				aria-pressed={isSearchComposerOpen}
			>
				{isSearchComposerOpen ? (
					<X className="h-4 w-4" />
				) : (
					<SlidersHorizontal className="h-4 w-4" />
				)}
				<span className="hidden sm:inline">
					{isSearchComposerOpen ? "Close search" : "Edit search"}
				</span>
			</Button>
		</div>
	);
	const actions = (
		<div className="flex items-center gap-2">
			{primaryAction}
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8 shrink-0 rounded-full shadow-none"
						aria-label="More job actions"
					>
						<MoreHorizontal className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-48">
					<DropdownMenuItem
						onSelect={onOpenManualImport}
						className="cursor-pointer gap-2"
					>
						<FileText className="h-4 w-4" />
						Import job manually
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() => setClearDialogOpen(true)}
						className="cursor-pointer gap-2 text-destructive focus:text-destructive"
					>
						<Trash2 className="h-4 w-4" />
						Clear all job listings
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Clear all job listings?</AlertDialogTitle>
						<AlertDialogDescription>
							This permanently deletes every job listing and its related notes,
							documents, and application history. Your search settings and
							pipeline runs will remain.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isClearingJobs}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={isClearingJobs}
							onClick={(event) => {
								event.preventDefault();
								void handleClearAllJobs();
							}}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{isClearingJobs ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<Trash2 className="mr-2 h-4 w-4" />
							)}
							Clear all listings
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);

	return (
		<PageHeader
			icon={() => (
				<img src="/favicon.png" alt="" className="size-8 rounded-lg" />
			)}
			title="Meow AI"
			subtitle="Orchestrator"
			navOpen={navOpen}
			onNavOpenChange={onNavOpenChange}
			statusIndicator={
				isPipelineRunning ? (
					<StatusIndicator label="Search running" variant="amber" />
				) : undefined
			}
			actions={actions}
		/>
	);
};
