import type { JobStatus } from "@shared/types/jobs";
import type React from "react";
import { cn } from "@/lib/utils";
import {
  defaultStatusToken,
  statusTokens,
} from "../pages/orchestrator/constants";
import { Tip } from "./Tip";

const STATUS_INDICATOR_BASE_CLASS =
  "inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80";
const STATUS_INDICATOR_DOT_CLASS = "h-1.5 w-1.5 rounded-full opacity-80";

const badgeVariantClasses = {
  amber: {
    badge:
      "border-amber-500/40 bg-amber-100/95 text-amber-900 dark:border-amber-400/35 dark:bg-amber-400/15 dark:text-amber-100",
    dot: "bg-amber-600 dark:bg-amber-400",
  },
  emerald: {
    badge:
      "border-emerald-500/40 bg-emerald-100/95 text-emerald-900 dark:border-emerald-400/35 dark:bg-emerald-400/15 dark:text-emerald-100",
    dot: "bg-emerald-600 dark:bg-emerald-400",
  },
  sky: {
    badge:
      "border-sky-500/40 bg-sky-100/95 text-sky-900 dark:border-sky-400/35 dark:bg-sky-400/15 dark:text-sky-100",
    dot: "bg-sky-600 dark:bg-sky-400",
  },
};

type StatusIndicatorProps = {
  dotColor?: string;
  label: React.ReactNode;
  className?: string;
  dotClassName?: string;
  variant?: keyof typeof badgeVariantClasses;
  appearance?: "inline" | "badge";
  animateDot?: boolean;
  tooltip?: React.ReactNode;
  tooltipClassName?: string;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  tooltipDelayDuration?: number;
};

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  dotColor,
  label,
  className,
  dotClassName,
  variant = "amber",
  appearance = "inline",
  animateDot = appearance === "badge",
  tooltip,
  tooltipClassName,
  tooltipSide = "top",
  tooltipDelayDuration = 0,
}) => {
  const badgeTokens = badgeVariantClasses[variant];
  const resolvedDotColor = dotColor ?? badgeTokens.dot;

  const content = (
    <span
      className={cn(
        "whitespace-nowrap",
        appearance === "badge"
          ? "inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide"
          : STATUS_INDICATOR_BASE_CLASS,
        appearance === "badge" ? badgeTokens.badge : undefined,
        className,
      )}
    >
      <span
        className={cn(
          appearance === "badge"
            ? "h-1.5 w-1.5 rounded-full"
            : STATUS_INDICATOR_DOT_CLASS,
          animateDot ? "animate-pulse" : undefined,
          resolvedDotColor,
          dotClassName,
        )}
      />
      {label}
    </span>
  );

  if (!tooltip) return content;

  return (
    <Tip
      content={tooltip}
      contentClassName={tooltipClassName}
      side={tooltipSide}
      delayDuration={tooltipDelayDuration}
    >
      {content}
    </Tip>
  );
};

const getJobStatusIndicator = (status: JobStatus) => {
  const tokens = statusTokens[status] ?? defaultStatusToken;
  return { label: tokens.label, dotColor: tokens.dot };
};

const getTracerStatusIndicator = (enabled: boolean) => ({
  label: enabled ? "Tracer On" : "Tracer Off",
  dotColor: enabled ? "bg-violet-500" : "bg-slate-500",
});

const StatusBadgeIndicator: React.FC<
  Omit<StatusIndicatorProps, "appearance"> & { appearance?: "badge" }
> = (props) => <StatusIndicator {...props} appearance="badge" />;

export {
  StatusIndicator,
  getJobStatusIndicator,
  getTracerStatusIndicator,
  StatusBadgeIndicator,
};
