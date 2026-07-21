import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const THEME_STORAGE_KEY = "meow-ai.theme";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
	if (typeof window === "undefined") return "dark";
	const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
	if (stored === "light" || stored === "dark") return stored;
	return window.matchMedia("(prefers-color-scheme: light)").matches
		? "light"
		: "dark";
}

export function ThemeToggle() {
	const [theme, setTheme] = useState<Theme>(getInitialTheme);

	useEffect(() => {
		document.documentElement.classList.toggle("dark", theme === "dark");
		document.documentElement.style.colorScheme = theme;
		window.localStorage.setItem(THEME_STORAGE_KEY, theme);
	}, [theme]);

	const isDark = theme === "dark";

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			className="h-8 w-8 shrink-0 rounded-full bg-background/30 text-muted-foreground shadow-none hover:bg-background/55 hover:text-foreground"
			aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
			title={`Switch to ${isDark ? "light" : "dark"} mode`}
			onClick={() => setTheme(isDark ? "light" : "dark")}
		>
			{isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
		</Button>
	);
}
