import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
	beforeEach(() => {
		localStorage.clear();
		document.documentElement.className = "dark";
	});

	it("switches between dark and light mode and remembers the choice", () => {
		localStorage.setItem("meow-ai.theme", "dark");
		render(<ThemeToggle />);

		fireEvent.click(
			screen.getByRole("button", { name: "Switch to light mode" }),
		);

		expect(document.documentElement).not.toHaveClass("dark");
		expect(localStorage.getItem("meow-ai.theme")).toBe("light");
		expect(
			screen.getByRole("button", { name: "Switch to dark mode" }),
		).toBeInTheDocument();
	});
});
