import { Gauge } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { scoreThresholdOptions } from "../constants";
import { FilterPill } from "./FilterPill";
import type { ScoreFilterPillProps } from "./types";

export const ScoreFilterPill: React.FC<ScoreFilterPillProps> = ({
	minimumScore,
	onMinimumScoreChange,
}) => (
	<FilterPill
		icon={<Gauge />}
		label="Score"
		active={minimumScore != null}
		summary={minimumScore == null ? null : `${minimumScore}+`}
	>
		<div className="flex flex-wrap gap-2">
			{scoreThresholdOptions.map((score) => (
				<Button
					key={score}
					type="button"
					size="sm"
					variant={minimumScore === score ? "default" : "outline"}
					onClick={() =>
						onMinimumScoreChange(minimumScore === score ? null : score)
					}
				>
					{score}+
				</Button>
			))}
		</div>
	</FilterPill>
);
