import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { OrchestratorHeader } from "./OrchestratorHeader";

beforeAll(() => {
	window.matchMedia = vi.fn().mockReturnValue({
		matches: false,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	});
});

vi.mock("@/components/ui/sheet", () => ({
	Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	SheetTrigger: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SheetContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SheetHeader: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SheetTitle: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
	DropdownMenu: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
	DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
	DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
		<div role="menu">{children}</div>
	),
	DropdownMenuItem: ({
		children,
		onSelect,
	}: {
		children: React.ReactNode;
		onSelect?: () => void;
	}) => (
		<button type="button" role="menuitem" onClick={() => onSelect?.()}>
			{children}
		</button>
	),
	DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuSeparator: () => <hr />,
}));

const renderHeader = (
	overrides: Partial<React.ComponentProps<typeof OrchestratorHeader>> = {},
) => {
	const props: React.ComponentProps<typeof OrchestratorHeader> = {
		navOpen: false,
		onNavOpenChange: vi.fn(),
		isPipelineRunning: false,
		isCancelling: false,
		pipelineSources: ["gradcracker"],
		onOpenAutomaticRun: vi.fn(),
		onRefreshSearch: vi.fn(),
		autoRefreshEnabled: false,
		autoRefreshIntervalLabel: "1h",
		onAutoRefreshToggle: vi.fn(),
		onClearAllJobs: vi.fn().mockResolvedValue(undefined),
		onCancelPipeline: vi.fn(),
		onOpenManualImport: vi.fn(),
		...overrides,
	};

	return {
		props,
		...render(
			<MemoryRouter>
				<OrchestratorHeader {...props} />
			</MemoryRouter>,
		),
	};
};

describe("OrchestratorHeader", () => {
	it("opens search settings from the navbar button", () => {
		const { props } = renderHeader();
		fireEvent.click(screen.getByRole("button", { name: /edit search/i }));
		expect(props.onOpenAutomaticRun).toHaveBeenCalled();
	});

	it("refreshes the current search from the navbar button", () => {
		const { props } = renderHeader();
		fireEvent.click(screen.getByRole("button", { name: /refresh jobs/i }));
		expect(props.onRefreshSearch).toHaveBeenCalled();
	});

	it("toggles automatic refresh from the navbar", () => {
		const { props } = renderHeader({ autoRefreshEnabled: true });
		const button = screen.getByRole("button", { name: "Auto-refresh on" });
		expect(button).toHaveAttribute("aria-pressed", "true");
		fireEvent.click(button);
		expect(props.onAutoRefreshToggle).toHaveBeenCalled();
	});

	it("uses the navbar button as the search composer close toggle", () => {
		const { props } = renderHeader({ isSearchComposerOpen: true });
		const button = screen.getByRole("button", { name: /close search/i });

		expect(button).toHaveAttribute("aria-pressed", "true");
		fireEvent.click(button);

		expect(props.onOpenAutomaticRun).toHaveBeenCalled();
	});

	it("opens manual import from the overflow menu", () => {
		const { props } = renderHeader();

		expect(
			screen.getByRole("button", { name: /more job actions/i }),
		).toBeInTheDocument();

		fireEvent.click(
			screen.getByRole("menuitem", { name: /import job manually/i }),
		);

		expect(props.onOpenManualImport).toHaveBeenCalled();
	});

	it("requires confirmation before clearing all job listings", () => {
		const { props } = renderHeader();

		fireEvent.click(
			screen.getByRole("menuitem", { name: /clear all job listings/i }),
		);

		expect(screen.getByText("Clear all job listings?")).toBeInTheDocument();
		expect(props.onClearAllJobs).not.toHaveBeenCalled();
	});

	it("hides the run action while keeping manual import reachable", () => {
		renderHeader({ hideRunAction: true });
		expect(
			screen.queryByRole("button", { name: /edit search/i }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /more job actions/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("menuitem", { name: /import job manually/i }),
		).toBeInTheDocument();
	});

	it("renders cancel button while running and triggers cancel", () => {
		const { props } = renderHeader({ isPipelineRunning: true });
		fireEvent.click(screen.getByRole("button", { name: /cancel run/i }));
		expect(props.onCancelPipeline).toHaveBeenCalled();
	});
});
