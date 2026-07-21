import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
	({ className, type, ...props }, ref) => {
		return (
			<input
				type={type}
				className={cn(
					"flex h-12 w-full rounded-[1rem] border border-input bg-background/55 px-4 py-2 text-base shadow-inner transition-[border-color,background-color,box-shadow] placeholder:text-muted-foreground/80 focus-visible:border-ring/70 focus-visible:bg-background/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
					className,
				)}
				ref={ref}
				{...props}
			/>
		);
	},
);
Input.displayName = "Input";

export { Input };
