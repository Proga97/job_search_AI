import { ChevronDown } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Trigger button shared by every filter dropdown ("faceted filter" style). */
export interface FilterPillProps {
	icon: React.ReactNode;
	label: string;
	active: boolean;
	/** Short value shown inline on the trigger when the filter is active. */
	summary?: string | null;
	/** Numeric badge shown when several values are selected. */
	badge?: number;
	contentClassName?: string;
	children: React.ReactNode;
}

export const FilterPill: React.FC<FilterPillProps> = ({
	icon,
	label,
	active,
	summary,
	badge,
	contentClassName,
	children,
}) => (
	<Popover>
		<PopoverTrigger asChild>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className={cn(
					"h-9 gap-2 whitespace-nowrap rounded-full border border-border bg-secondary px-3 text-[13px] font-medium text-secondary-foreground shadow-none transition-[background-color,border-color,color] hover:border-ring/50 hover:bg-accent hover:text-accent-foreground",
					active &&
						"border-primary/55 bg-primary text-primary-foreground hover:border-primary/70 hover:bg-primary/90 hover:text-primary-foreground dark:border-primary/55 dark:bg-primary dark:hover:border-primary/70 dark:hover:bg-primary/90",
				)}
			>
				<span className="[&_svg]:h-4 [&_svg]:w-4">{icon}</span>
				<span>{label}</span>
				{summary ? (
					<span
						className={cn(
							"max-w-[10rem] truncate border-l border-border/60 pl-2 font-semibold text-foreground",
							active && "border-primary-foreground/35 text-primary-foreground",
						)}
					>
						{summary}
					</span>
				) : null}
				{typeof badge === "number" && badge > 0 ? (
					<span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
						{badge}
					</span>
				) : null}
				<ChevronDown className="h-4 w-4 opacity-80" />
			</Button>
		</PopoverTrigger>
		<PopoverContent
			align="start"
			sideOffset={8}
			className={cn(
				"filter-popover w-64 rounded-2xl border-border bg-popover p-4 text-popover-foreground shadow-md [&_button]:rounded-xl",
				contentClassName,
			)}
		>
			<div className="space-y-3">
				<p className="text-[13px] font-semibold tracking-wide text-foreground">
					{label}
				</p>
				{children}
			</div>
		</PopoverContent>
	</Popover>
);
