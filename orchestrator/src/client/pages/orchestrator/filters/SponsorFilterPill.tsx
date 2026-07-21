import { BadgeCheck } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { FilterPill } from "./FilterPill";
import { sponsorOptions } from "./filterOptions";
import type { SponsorFilterPillProps } from "./types";

export const SponsorFilterPill: React.FC<SponsorFilterPillProps> = ({
	sponsorFilter,
	onSponsorFilterChange,
	sponsorLabel,
}) => (
	<FilterPill
		icon={<BadgeCheck />}
		label="Sponsor"
		active={sponsorFilter.length > 0}
		summary={sponsorLabel}
		contentClassName="w-72"
	>
		<div className="grid gap-1.5">
			{sponsorOptions.map((option) => (
				<Button
					key={option.value}
					type="button"
					size="sm"
					variant={sponsorFilter.includes(option.value) ? "default" : "outline"}
					aria-pressed={sponsorFilter.includes(option.value)}
					className="justify-start"
					onClick={() =>
						onSponsorFilterChange(
							sponsorFilter.includes(option.value)
								? sponsorFilter.filter((value) => value !== option.value)
								: [...sponsorFilter, option.value],
						)
					}
				>
					{option.label}
				</Button>
			))}
		</div>
	</FilterPill>
);
