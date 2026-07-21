import { GraduationCap } from "lucide-react";
import type React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { experienceLevelOptions } from "../constants";
import { FilterPill } from "./FilterPill";
import type { ExperienceFilterPillProps } from "./types";

export const ExperienceFilterPill: React.FC<ExperienceFilterPillProps> = ({
	experienceLevels,
	onExperienceLevelsChange,
}) => (
	<FilterPill
		icon={<GraduationCap />}
		label="Experience"
		active={experienceLevels.length > 0}
		badge={experienceLevels.length}
	>
		<div className="space-y-2">
			{experienceLevelOptions.map((option) => {
				const checked = experienceLevels.includes(option.value);
				const inputId = `experience-${option.value}`;
				return (
					<label
						key={option.value}
						htmlFor={inputId}
						className="flex cursor-pointer items-center gap-2 text-sm"
					>
						<Checkbox
							id={inputId}
							checked={checked}
							onCheckedChange={(next) =>
								onExperienceLevelsChange(
									next === true
										? [...experienceLevels, option.value]
										: experienceLevels.filter(
												(level) => level !== option.value,
											),
								)
							}
						/>
						<span>{option.label}</span>
					</label>
				);
			})}
		</div>
	</FilterPill>
);
