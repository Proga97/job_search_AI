import { MapPin, X } from "lucide-react";
import type React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { LocationFilterInputProps } from "./types";

export const LocationFilterInput: React.FC<LocationFilterInputProps> = ({
	locationFilter,
	onLocationFilterChange,
}) => (
	<div className="relative">
		<MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
		<Input
			aria-label="Filter by location"
			value={locationFilter}
			onChange={(event) => onLocationFilterChange(event.target.value)}
			placeholder="Location"
			className={cn(
				"h-9 w-[190px] rounded-full border-border/40 bg-background/45 pl-9 text-[13px] font-medium text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-primary/55 focus-visible:ring-2 focus-visible:ring-primary/20",
				locationFilter.trim() && "pr-8",
			)}
		/>
		{locationFilter.trim() ? (
			<button
				type="button"
				aria-label="Clear location"
				onClick={() => onLocationFilterChange("")}
				className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
			>
				<X className="h-3.5 w-3.5" />
			</button>
		) : null}
	</div>
);
