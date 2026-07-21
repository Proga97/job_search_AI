import { KbdHint } from "@client/components/KbdHint";
import { getDisplayKey, SHORTCUTS } from "@client/lib/shortcut-map";
import { Filter, RotateCcw, Search } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { tabs } from "../constants";
import type { OrchestratorTabRowProps } from "./types";

export const OrchestratorTabRow: React.FC<OrchestratorTabRowProps> = ({
	counts,
	onOpenCommandBar,
	isFiltersOpen,
	onFiltersOpenChange,
	activeFilterCount,
	onResetFilters,
}) => {
	const commandShortcutLabel = getDisplayKey(SHORTCUTS.search);

	return (
		<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
			<TabsList className="grid h-11 w-full grid-cols-4 gap-1 rounded-2xl border border-border bg-card p-1 shadow-none lg:w-auto lg:min-w-[430px]">
				{tabs.map((tab, index) => {
					return (
						<TabsTrigger
							key={tab.id}
							value={tab.id}
							className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl border-0 px-3 text-xs font-medium text-muted-foreground shadow-none transition-colors duration-150 hover:bg-accent hover:text-foreground data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-none"
						>
							<KbdHint shortcut={String(index + 1)} className="mr-0.5" />
							<span>{tab.label}</span>
							{counts[tab.id] > 0 && (
								<span className="text-[10px] mt-[2px] tabular-nums opacity-60">
									{counts[tab.id]}
								</span>
							)}
						</TabsTrigger>
					);
				})}
			</TabsList>

			<div className="flex w-full items-center gap-1.5 rounded-2xl border border-border bg-card p-1 lg:w-auto">
				{isFiltersOpen && activeFilterCount > 0 ? (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={onResetFilters}
						className="h-9 rounded-xl px-3 text-xs text-muted-foreground hover:bg-background/65 hover:text-foreground"
					>
						<RotateCcw className="h-3.5 w-3.5" />
						Reset
					</Button>
				) : null}

				<Button
					type="button"
					variant="ghost"
					size="sm"
					aria-expanded={isFiltersOpen}
					aria-controls="orchestrator-filter-bar"
					onClick={() => onFiltersOpenChange(!isFiltersOpen)}
					className={cn(
						"h-9 flex-1 gap-1.5 rounded-xl px-3 text-xs font-medium lg:flex-none",
						isFiltersOpen && "bg-background/90 text-foreground shadow-sm",
					)}
				>
					<Filter className="h-3.5 w-3.5" />
					Filters
					{activeFilterCount > 0 ? (
						<span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
							{activeFilterCount}
						</span>
					) : null}
				</Button>

				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={onOpenCommandBar}
					aria-label="Search jobs"
					className="h-9 flex-1 gap-1.5 rounded-xl px-3 text-xs text-muted-foreground hover:bg-background/65 hover:text-foreground lg:flex-none"
				>
					<Search className="h-3.5 w-3.5" />
					Search
					<span className="rounded-md bg-foreground/[0.07] px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
						{commandShortcutLabel}
					</span>
				</Button>
			</div>
		</div>
	);
};
