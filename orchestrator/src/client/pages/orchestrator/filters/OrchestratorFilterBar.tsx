import type React from "react";

export type OrchestratorFilterBarProps = {
	children: React.ReactNode;
};

export const OrchestratorFilterBar: React.FC<OrchestratorFilterBarProps> = ({
	children,
}) => (
	<div
		id="orchestrator-filter-bar"
		className="min-w-0 overflow-hidden rounded-full border border-border bg-card px-1.5 py-1 shadow-none"
	>
		<div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto rounded-full [scrollbar-width:none] [&>*]:shrink-0 [&_button]:shadow-none [&_input]:shadow-none [&::-webkit-scrollbar]:hidden">
			{children}
		</div>
	</div>
);
