import { TokenizedInput } from "@client/pages/orchestrator/TokenizedInput";
import { SettingsSectionFrame } from "@client/pages/settings/components/SettingsSectionFrame";
import type { DisplayValues } from "@client/pages/settings/types";
import type { UpdateSettingsInput } from "@shared/settings-schema.js";
import type React from "react";
import { useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const AUTO_REFRESH_INTERVALS = [30, 60, 120, 300, 720, 1440] as const;
const formatInterval = (minutes: number) =>
	minutes < 60
		? `${minutes} minutes`
		: `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;

const parseCompanyNames = (input: string) =>
	input
		.split(/[\n,]/g)
		.map((value) => value.trim())
		.filter(Boolean);

type DisplaySettingsSectionProps = {
	values: DisplayValues;
	isLoading: boolean;
	isSaving: boolean;
	layoutMode?: "accordion" | "panel";
};

export const DisplaySettingsSection: React.FC<DisplaySettingsSectionProps> = ({
	values,
	isLoading,
	isSaving,
	layoutMode,
}) => {
	const {
		renderMarkdownInJobDescriptions,
		autoTailorOnManualImport,
		autoRefreshJobsEnabled,
		autoRefreshJobsIntervalMinutes,
		hiddenCompanies,
	} = values;
	const { control, setValue, watch } = useFormContext<UpdateSettingsInput>();
	const [hiddenCompanyDraft, setHiddenCompanyDraft] = useState("");
	const hiddenCompanyValues =
		watch("hiddenCompanies") ?? hiddenCompanies.default;

	return (
		<SettingsSectionFrame
			mode={layoutMode}
			title="Display Settings"
			value="display"
		>
			<div className="space-y-4">
				<div className="space-y-3">
					<div>
						<label className="text-sm font-medium" htmlFor="hidden-companies">
							Hidden companies
						</label>
						<p className="mt-1 text-xs text-muted-foreground">
							Listings from these exact company names are excluded from future
							searches. Remove a name here to allow it again.
						</p>
					</div>
					<TokenizedInput
						id="hidden-companies"
						values={hiddenCompanyValues}
						draft={hiddenCompanyDraft}
						parseInput={parseCompanyNames}
						onDraftChange={setHiddenCompanyDraft}
						onValuesChange={(value) =>
							setValue("hiddenCompanies", value, { shouldDirty: true })
						}
						placeholder="Add a company name"
						helperText={
							hiddenCompanyValues.length === 0
								? "No companies hidden."
								: `${hiddenCompanyValues.length} hidden ${hiddenCompanyValues.length === 1 ? "company" : "companies"}`
						}
						removeLabelPrefix="Unhide company"
						disabled={isLoading || isSaving}
					/>
				</div>

				<Separator />

				<div className="flex items-start justify-between gap-4">
					<div className="flex items-start space-x-3">
						<Controller
							name="autoRefreshJobsEnabled"
							control={control}
							render={({ field }) => (
								<Checkbox
									id="autoRefreshJobsEnabled"
									checked={field.value ?? autoRefreshJobsEnabled.default}
									onCheckedChange={(checked) =>
										field.onChange(
											checked === "indeterminate" ? null : checked === true,
										)
									}
									disabled={isLoading || isSaving}
								/>
							)}
						/>
						<div className="flex flex-col gap-1.5">
							<label
								htmlFor="autoRefreshJobsEnabled"
								className="cursor-pointer text-sm font-medium leading-none"
							>
								Auto-refresh job search
							</label>
							<p className="text-xs text-muted-foreground">
								Re-run the current discovery search while the Jobs workspace is
								open.
							</p>
						</div>
					</div>
					<Controller
						name="autoRefreshJobsIntervalMinutes"
						control={control}
						render={({ field }) => (
							<Select
								value={String(
									field.value ?? autoRefreshJobsIntervalMinutes.default,
								)}
								onValueChange={(value) => field.onChange(Number(value))}
								disabled={isLoading || isSaving}
							>
								<SelectTrigger
									className="w-36"
									aria-label="Auto-refresh interval"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{AUTO_REFRESH_INTERVALS.map((minutes) => (
										<SelectItem key={minutes} value={String(minutes)}>
											{formatInterval(minutes)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					/>
				</div>

				<Separator />

				<div className="flex items-start space-x-3">
					<Controller
						name="renderMarkdownInJobDescriptions"
						control={control}
						render={({ field }) => (
							<Checkbox
								id="renderMarkdownInJobDescriptions"
								checked={field.value ?? renderMarkdownInJobDescriptions.default}
								onCheckedChange={(checked) => {
									field.onChange(
										checked === "indeterminate" ? null : checked === true,
									);
								}}
								disabled={isLoading || isSaving}
							/>
						)}
					/>
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="renderMarkdownInJobDescriptions"
							className="text-sm font-medium leading-none cursor-pointer"
						>
							Render Markdown in job descriptions
						</label>
						<p className="text-xs text-muted-foreground">
							Show headings, bold text, lists, and code blocks as formatted
							content when you expand a full job description. Turn this off if
							you prefer the raw source text.
						</p>
					</div>
				</div>

				<Separator />

				<div className="flex items-start space-x-3">
					<Controller
						name="autoTailorOnManualImport"
						control={control}
						render={({ field }) => (
							<Checkbox
								id="autoTailorOnManualImport"
								checked={field.value ?? autoTailorOnManualImport.default}
								onCheckedChange={(checked) => {
									field.onChange(
										checked === "indeterminate" ? null : checked === true,
									);
								}}
								disabled={isLoading || isSaving}
							/>
						)}
					/>
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="autoTailorOnManualImport"
							className="text-sm font-medium leading-none cursor-pointer"
						>
							Auto-tailor manually imported jobs
						</label>
						<p className="text-xs text-muted-foreground">
							When enabled, jobs added via Manual Import are immediately scored
							and have a tailored resume PDF generated. Turn off to save LLM
							tokens and tailor later from the job detail view. You can override
							this per import in the review step.
						</p>
					</div>
				</div>

				<Separator />

				<div className="grid gap-3 text-sm sm:grid-cols-2">
					<div>
						<div className="text-xs text-muted-foreground">
							Markdown rendering effective
						</div>
						<div className="break-words font-mono text-xs">
							{renderMarkdownInJobDescriptions.effective
								? "Enabled"
								: "Disabled"}
						</div>
					</div>
					<div>
						<div className="text-xs text-muted-foreground">
							Markdown rendering default
						</div>
						<div className="break-words font-mono text-xs font-semibold">
							{renderMarkdownInJobDescriptions.default ? "Enabled" : "Disabled"}
						</div>
					</div>
					<div>
						<div className="text-xs text-muted-foreground">
							Auto-tailor on import effective
						</div>
						<div className="break-words font-mono text-xs">
							{autoTailorOnManualImport.effective ? "Enabled" : "Disabled"}
						</div>
					</div>
					<div>
						<div className="text-xs text-muted-foreground">
							Auto-tailor on import default
						</div>
						<div className="break-words font-mono text-xs font-semibold">
							{autoTailorOnManualImport.default ? "Enabled" : "Disabled"}
						</div>
					</div>
				</div>
			</div>
		</SettingsSectionFrame>
	);
};
