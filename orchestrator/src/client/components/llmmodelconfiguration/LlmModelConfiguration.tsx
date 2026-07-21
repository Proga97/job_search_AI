import * as api from "@client/api";
import { CodexAuthPanel } from "@client/components/CodexAuthPanel";
import { GeminiCliSetupHint } from "@client/components/GeminiCliSetupHint";
import PurposeOverrideCard from "@client/components/llmmodelconfiguration/PurposeOverrideCard";
import { SettingsInput } from "@client/pages/settings/components/SettingsInput";
import {
	formatSecretHint,
	getLlmProviderConfig,
	LLM_PROVIDER_LABELS,
	LLM_PROVIDERS,
	type LlmProviderId,
	supportsLlmModelSuggestions,
} from "@client/pages/settings/utils";
import { getDefaultModelForProvider } from "@shared/settings-registry";
import type {
	LlmPurpose,
	LlmPurposeApiKeyHints,
	LlmPurposeOverrides,
} from "@shared/types";
import { Check, KeyRound, Loader2, Trash2 } from "lucide-react";
import type React from "react";
import { useDeferredValue, useEffect, useState } from "react";
import { toast } from "sonner";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
	buildModelOptions,
	LLM_PURPOSES,
	renderKeyHelper,
} from "./llm-model-configuration-helpers";
import ModelField from "./ModelField";

type TextFieldBinding = {
	value: string;
	onChange: (value: string) => void;
	error?: string;
};

type PurposeOverrideBinding = {
	values: LlmPurposeOverrides;
	apiKeys: Partial<Record<LlmPurpose, string | null>>;
	apiKeyHints: LlmPurposeApiKeyHints;
	models: Record<LlmPurpose, string>;
	onChange: (
		purpose: LlmPurpose,
		field: "provider" | "baseUrl" | "model",
		value: string | null,
	) => void;
	onApiKeyChange: (purpose: LlmPurpose, value: string) => void;
};

type LlmModelConfigurationProps = {
	mode: "compact" | "settings";
	disabled: boolean;
	selectedProvider: LlmProviderId;
	savedProvider?: string | null;
	savedBaseUrl?: string | null;
	apiKeyHint?: string | null;
	effectiveModel?: string | null;
	defaultModel?: string | null;
	provider: TextFieldBinding;
	baseUrl: TextFieldBinding;
	apiKey: TextFieldBinding;
	model: TextFieldBinding;
	modelScorer?: TextFieldBinding;
	modelTailoring?: TextFieldBinding;
	modelProjectSelection?: TextFieldBinding;
	purposeOverrides?: PurposeOverrideBinding;
	validationSlot?: React.ReactNode;
	onCodexAuthStatusChange?: React.ComponentProps<
		typeof CodexAuthPanel
	>["onStatusChange"];
};

export function LlmModelConfiguration({
	mode,
	disabled,
	selectedProvider,
	savedProvider,
	savedBaseUrl,
	apiKeyHint,
	effectiveModel,
	defaultModel,
	provider,
	baseUrl,
	apiKey,
	model,
	modelScorer,
	modelTailoring,
	modelProjectSelection,
	purposeOverrides,
	validationSlot,
	onCodexAuthStatusChange,
}: LlmModelConfigurationProps) {
	const [availableModels, setAvailableModels] = useState<string[]>([]);
	const [isLoadingModels, setIsLoadingModels] = useState(false);
	const [modelsError, setModelsError] = useState<string | null>(null);
	const [savedConfigurations, setSavedConfigurations] = useState<
		api.SavedLlmConfiguration[]
	>([]);
	const [configurationAction, setConfigurationAction] = useState<string | null>(
		null,
	);
	const providerConfig = getLlmProviderConfig(selectedProvider);
	const { showApiKey, showBaseUrl } = providerConfig;
	const isCodexProvider = providerConfig.normalizedProvider === "codex";
	const isGeminiCliProvider =
		providerConfig.normalizedProvider === "gemini_cli";
	const requiresExplicitDefaultModel =
		providerConfig.normalizedProvider === "ollama";
	const deferredProvider = useDeferredValue(selectedProvider);
	const deferredBaseUrl = useDeferredValue(baseUrl.value);
	const deferredApiKey = useDeferredValue(apiKey.value);
	const supportsModelSuggestions =
		supportsLlmModelSuggestions(selectedProvider);
	const hasAvailableApiKey = providerConfig.requiresApiKey
		? Boolean(
				deferredApiKey.trim() ||
					(selectedProvider === savedProvider && apiKeyHint),
			)
		: true;
	const providerDefaultModel = getDefaultModelForProvider(
		selectedProvider,
		selectedProvider === savedProvider
			? (defaultModel ?? undefined)
			: undefined,
	);

	useEffect(() => {
		if (mode !== "settings") return;
		let cancelled = false;
		void api
			.getSavedLlmConfigurations()
			.then((configurations) => {
				if (!cancelled) setSavedConfigurations(configurations);
			})
			.catch((error) => {
				if (!cancelled) {
					toast.error(
						error instanceof Error
							? error.message
							: "Failed to load saved LLM configurations.",
					);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [mode]);

	useEffect(() => {
		if (showBaseUrl) return;
		if (baseUrl.value) {
			baseUrl.onChange("");
		}
	}, [baseUrl, showBaseUrl]);

	useEffect(() => {
		if (!supportsModelSuggestions) {
			setAvailableModels([]);
			setModelsError(null);
			setIsLoadingModels(false);
			return;
		}

		if (!hasAvailableApiKey) {
			setAvailableModels([]);
			setModelsError(null);
			setIsLoadingModels(false);
			return;
		}

		let cancelled = false;
		setIsLoadingModels(true);
		setModelsError(null);

		void api
			.getLlmModels({
				provider: deferredProvider,
				baseUrl: showBaseUrl ? deferredBaseUrl.trim() || undefined : undefined,
				apiKey: showApiKey ? deferredApiKey.trim() || undefined : undefined,
			})
			.then((models) => {
				if (cancelled) return;
				setAvailableModels(models);
				setModelsError(null);
			})
			.catch((error) => {
				if (cancelled) return;
				setAvailableModels([]);
				setModelsError(
					error instanceof Error ? error.message : "Failed to load models.",
				);
			})
			.finally(() => {
				if (cancelled) return;
				setIsLoadingModels(false);
			});

		return () => {
			cancelled = true;
		};
	}, [
		deferredApiKey,
		deferredBaseUrl,
		deferredProvider,
		hasAvailableApiKey,
		showApiKey,
		showBaseUrl,
		supportsModelSuggestions,
	]);

	const handleProviderChange = (value: string) => {
		provider.onChange(value);
		model.onChange("");
		modelScorer?.onChange("");
		modelTailoring?.onChange("");
		modelProjectSelection?.onChange("");
	};

	const formattedKeyHint = formatSecretHint(apiKeyHint ?? null);
	const hasSavedKey = Boolean(apiKeyHint);
	const apiKeyLabel = providerConfig.requiresApiKey
		? mode === "compact"
			? "API key"
			: "LLM API key"
		: mode === "compact"
			? "API key (optional)"
			: "LLM API key (optional)";
	const keyText = showApiKey ? formattedKeyHint : "Not required";
	const resolvedBaseUrl = baseUrl.value.trim() || savedBaseUrl || "-";
	const selectedDefaultModel = model.value.trim();
	const previewDefaultModel =
		selectedDefaultModel ||
		(selectedProvider === savedProvider
			? effectiveModel
			: providerDefaultModel) ||
		providerDefaultModel ||
		"-";
	const handleSaveConfiguration = async () => {
		if (previewDefaultModel === "-") {
			toast.error("Choose a default model before saving.");
			return;
		}
		setConfigurationAction("save");
		try {
			const configurations = await api.saveLlmConfiguration({
				provider: selectedProvider,
				baseUrl: showBaseUrl ? baseUrl.value.trim() || null : null,
				apiKey: showApiKey ? apiKey.value.trim() || null : null,
				model: previewDefaultModel,
			});
			setSavedConfigurations(configurations);
			model.onChange(previewDefaultModel);
			apiKey.onChange("");
			toast.success("LLM configuration saved");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to save LLM configuration.",
			);
		} finally {
			setConfigurationAction(null);
		}
	};
	const handleActivateConfiguration = async (
		configuration: api.SavedLlmConfiguration,
	) => {
		setConfigurationAction(configuration.id);
		try {
			await api.activateLlmConfiguration(configuration.id);
			provider.onChange(configuration.provider);
			baseUrl.onChange(configuration.baseUrl ?? "");
			apiKey.onChange("");
			model.onChange(configuration.model);
			modelScorer?.onChange("");
			modelTailoring?.onChange("");
			modelProjectSelection?.onChange("");
			toast.success(`Switched to ${configuration.model}`);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to switch LLM configuration.",
			);
		} finally {
			setConfigurationAction(null);
		}
	};
	const handleDeleteConfiguration = async (id: string) => {
		setConfigurationAction(`delete:${id}`);
		try {
			setSavedConfigurations(await api.deleteLlmConfiguration(id));
			toast.success("Saved configuration removed");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to remove LLM configuration.",
			);
		} finally {
			setConfigurationAction(null);
		}
	};
	const selectedScoringModel = modelScorer?.value.trim() ?? "";
	const selectedTailoringModel = modelTailoring?.value.trim() ?? "";
	const selectedProjectSelectionModel =
		modelProjectSelection?.value.trim() ?? "";
	const scoringModel = selectedScoringModel || previewDefaultModel;
	const tailoringModel = selectedTailoringModel || previewDefaultModel;
	const projectSelectionModel =
		selectedProjectSelectionModel || previewDefaultModel;
	const modelHelper: React.ReactNode = supportsModelSuggestions ? (
		!hasAvailableApiKey ? (
			`Add or save a ${providerConfig.label} API key to load available models.`
		) : isLoadingModels ? (
			"Loading available models..."
		) : modelsError ? (
			modelsError
		) : availableModels.length > 0 ? (
			"Choose from the available text-generation models."
		) : requiresExplicitDefaultModel ? (
			"No Ollama models were returned. Pull a model in Ollama, then choose it here before continuing."
		) : (
			"No text-generation models were returned."
		)
	) : isCodexProvider ? (
		<>
			Type the exact model name manually, or leave blank to use the{" "}
			{providerConfig.label} default model.{" "}
			<a
				href="https://developers.openai.com/codex/models"
				target="_blank"
				rel="noreferrer"
				className="text-foreground underline underline-offset-2"
			>
				find out what model name to use
			</a>
			.
		</>
	) : (
		`Type the exact model name manually, or leave blank to use the ${providerConfig.label} default model.`
	);
	const defaultModelOptions = buildModelOptions({
		models: availableModels,
		emptyLabel: requiresExplicitDefaultModel
			? `Select a ${providerConfig.label} model`
			: `Use ${providerConfig.label} default`,
		emptyValue: "",
		fallbackValue: model.value.trim(),
	});
	const scoringModelOptions = buildModelOptions({
		models: availableModels,
		emptyLabel: "Inherit default model",
		emptyValue: "",
		fallbackValue: modelScorer?.value.trim(),
	});
	const tailoringModelOptions = buildModelOptions({
		models: availableModels,
		emptyLabel: "Inherit default model",
		emptyValue: "",
		fallbackValue: modelTailoring?.value.trim(),
	});
	const projectSelectionModelOptions = buildModelOptions({
		models: availableModels,
		emptyLabel: "Inherit default model",
		emptyValue: "",
		fallbackValue: modelProjectSelection?.value.trim(),
	});
	const providerGridClass =
		mode === "compact"
			? "grid gap-5 lg:grid-cols-2"
			: "grid gap-4 md:grid-cols-2";
	const providerHintClass =
		mode === "compact"
			? "text-sm text-muted-foreground"
			: "text-xs text-muted-foreground";

	return (
		<>
			<div className={mode === "compact" ? "space-y-6" : "space-y-4"}>
				<div className="space-y-4">
					{mode === "settings" ? (
						<div className="text-sm font-medium">LLM Provider</div>
					) : null}
					<div className={providerGridClass}>
						<div className="space-y-2">
							<label htmlFor="llmProvider" className="text-sm font-medium">
								Provider
							</label>
							<Select
								value={selectedProvider}
								onValueChange={handleProviderChange}
								disabled={disabled}
							>
								<SelectTrigger
									id="llmProvider"
									className={mode === "compact" ? "h-10" : undefined}
								>
									<SelectValue placeholder="Select provider" />
								</SelectTrigger>
								<SelectContent>
									{LLM_PROVIDERS.map((llmProvider) => (
										<SelectItem key={llmProvider} value={llmProvider}>
											{LLM_PROVIDER_LABELS[llmProvider]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{provider.error ? (
								<p className="text-xs text-destructive">{provider.error}</p>
							) : null}
							{mode === "settings" ? (
								<p className="text-xs text-muted-foreground">
									Used for scoring, tailoring, ghostwriting, and email
									classification.
								</p>
							) : null}
							<p className={providerHintClass}>{providerConfig.providerHint}</p>
						</div>
						{isCodexProvider ? (
							<CodexAuthPanel
								isBusy={disabled}
								onStatusChange={onCodexAuthStatusChange}
							/>
						) : null}
						{isGeminiCliProvider ? <GeminiCliSetupHint /> : null}
						{showBaseUrl ? (
							<SettingsInput
								label={mode === "compact" ? "Base URL" : "LLM base URL"}
								inputProps={{
									name: "llmBaseUrl",
									value: baseUrl.value,
									onChange: (event) => baseUrl.onChange(event.target.value),
								}}
								placeholder={providerConfig.baseUrlPlaceholder}
								disabled={disabled}
								error={baseUrl.error}
								helper={providerConfig.baseUrlHelper}
								current={mode === "settings" ? resolvedBaseUrl : undefined}
							/>
						) : null}
						{showApiKey ? (
							<SettingsInput
								label={apiKeyLabel}
								inputProps={{
									name: "llmApiKey",
									value: apiKey.value,
									onChange: (event) => apiKey.onChange(event.target.value),
								}}
								type="password"
								placeholder={
									providerConfig.requiresApiKey
										? mode === "compact"
											? "Paste a new key"
											: "Enter new key"
										: "Optional bearer token"
								}
								disabled={disabled}
								error={apiKey.error}
								helper={renderKeyHelper(
									providerConfig.keyHelperText,
									providerConfig.keyHelperHref,
									hasSavedKey,
								)}
								current={mode === "settings" ? formattedKeyHint : undefined}
							/>
						) : mode === "compact" && !isCodexProvider ? (
							<div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
								No API key is required for this provider.
							</div>
						) : null}
					</div>

					<ModelField
						id="model"
						label="Default model"
						value={model.value}
						onChange={model.onChange}
						error={model.error}
						supportsModelSuggestions={supportsModelSuggestions}
						options={defaultModelOptions}
						placeholder={providerDefaultModel || "Select a model"}
						helper={modelHelper}
						current={previewDefaultModel}
						disabled={disabled || isLoadingModels}
					/>

					{mode === "settings" ? (
						<div className="space-y-4">
							<Button
								type="button"
								className="w-full sm:w-auto"
								disabled={
									disabled ||
									configurationAction !== null ||
									(providerConfig.requiresApiKey && !hasAvailableApiKey)
								}
								onClick={() => void handleSaveConfiguration()}
							>
								{configurationAction === "save" ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<KeyRound className="size-4" />
								)}
								Save configuration
							</Button>

							<div className="space-y-2">
								<div>
									<p className="text-sm font-medium">Saved configurations</p>
									<p className="text-xs text-muted-foreground">
										Switch provider, credentials, and model with one click.
									</p>
								</div>
								{savedConfigurations.length === 0 ? (
									<div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
										Your saved provider and model combinations will appear here.
									</div>
								) : (
									<div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
										{savedConfigurations.map((configuration) => {
											const isActive =
												configuration.provider === selectedProvider &&
												configuration.model === previewDefaultModel &&
												(configuration.baseUrl ?? "") ===
													(showBaseUrl ? baseUrl.value.trim() : "");
											const isSwitching =
												configurationAction === configuration.id;
											const isDeleting =
												configurationAction === `delete:${configuration.id}`;
											return (
												<div
													key={configuration.id}
													className="flex items-center gap-3 px-3 py-3"
												>
													<button
														type="button"
														className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent"
														disabled={
															disabled ||
															configurationAction !== null ||
															isActive
														}
														onClick={() =>
															void handleActivateConfiguration(configuration)
														}
													>
														<span className="flex items-center gap-2 text-sm font-medium">
															{
																getLlmProviderConfig(
																	configuration.provider as LlmProviderId,
																).label
															}
															{isActive ? (
																<span className="inline-flex items-center gap-1 text-xs font-normal text-primary">
																	<Check className="size-3" /> Active
																</span>
															) : null}
														</span>
														<span className="block truncate text-xs text-muted-foreground">
															{configuration.model}
															{configuration.hasApiKey
																? " · API key saved"
																: ""}
														</span>
													</button>
													{isSwitching ? (
														<Loader2 className="size-4 animate-spin text-muted-foreground" />
													) : null}
													<Button
														type="button"
														variant="ghost"
														size="icon"
														className="size-8 text-muted-foreground hover:text-destructive"
														disabled={disabled || configurationAction !== null}
														onClick={() =>
															void handleDeleteConfiguration(configuration.id)
														}
														aria-label={`Delete ${configuration.model}`}
													>
														{isDeleting ? (
															<Loader2 className="size-4 animate-spin" />
														) : (
															<Trash2 className="size-4" />
														)}
													</Button>
												</div>
											);
										})}
									</div>
								)}
							</div>
						</div>
					) : null}
				</div>

				{mode === "compact" ? validationSlot : null}
			</div>
			{mode === "settings" ? (
				<>
					<Separator />

					<div>
						<div className="font-medium mt-8">
							Purpose-specific model overrides
						</div>
						<div className="space-y-4">
							{purposeOverrides ? (
								<Accordion type="single" collapsible>
									{LLM_PURPOSES.map((purpose) => (
										<AccordionItem key={purpose.id} value={purpose.id}>
											<AccordionTrigger>
												<div className="flex flex-col items-start gap-1">
													<span className="font-medium text-sm">
														{purpose.label}
													</span>
													<span className="text-xs text-muted-foreground">
														{purpose.description}
													</span>
												</div>
											</AccordionTrigger>
											<AccordionContent>
												<PurposeOverrideCard
													key={purpose.id}
													purpose={purpose.id}
													defaultProvider={selectedProvider}
													defaultModel={previewDefaultModel}
													defaultBaseUrl={resolvedBaseUrl}
													defaultApiKeyHint={apiKeyHint ?? null}
													value={purposeOverrides.values[purpose.id]}
													apiKeyValue={
														purposeOverrides.apiKeys[purpose.id] ?? ""
													}
													apiKeyHint={
														purposeOverrides.apiKeyHints[purpose.id] ?? null
													}
													currentModel={purposeOverrides.models[purpose.id]}
													disabled={disabled}
													onChange={purposeOverrides.onChange}
													onApiKeyChange={purposeOverrides.onApiKeyChange}
												/>
											</AccordionContent>
										</AccordionItem>
									))}
								</Accordion>
							) : (
								<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
									<ModelField
										id="modelScorer"
										label="Scoring Model"
										value={modelScorer?.value ?? ""}
										onChange={(value) => modelScorer?.onChange(value)}
										error={modelScorer?.error}
										supportsModelSuggestions={supportsModelSuggestions}
										options={scoringModelOptions}
										placeholder={previewDefaultModel || "Inherit default model"}
										current={scoringModel}
										disabled={disabled || isLoadingModels}
									/>
									<ModelField
										id="modelTailoring"
										label="Tailoring Model"
										value={modelTailoring?.value ?? ""}
										onChange={(value) => modelTailoring?.onChange(value)}
										error={modelTailoring?.error}
										supportsModelSuggestions={supportsModelSuggestions}
										options={tailoringModelOptions}
										placeholder={previewDefaultModel || "Inherit default model"}
										current={tailoringModel}
										disabled={disabled || isLoadingModels}
									/>
									<ModelField
										id="modelProjectSelection"
										label="Project Selection Model"
										value={modelProjectSelection?.value ?? ""}
										onChange={(value) => modelProjectSelection?.onChange(value)}
										error={modelProjectSelection?.error}
										supportsModelSuggestions={supportsModelSuggestions}
										options={projectSelectionModelOptions}
										placeholder={previewDefaultModel || "Inherit default model"}
										current={projectSelectionModel}
										disabled={disabled || isLoadingModels}
									/>
								</div>
							)}
						</div>
					</div>

					<div className="space-y-3 text-sm">
						<div className="text-xs text-muted-foreground">Resolved config</div>
						<div className="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-[160px_1fr]">
							<div className="text-muted-foreground">Provider</div>
							<div className="font-mono">{selectedProvider || "-"}</div>

							<div className="text-muted-foreground">Base URL</div>
							<div className="font-mono">{resolvedBaseUrl}</div>

							<div className="text-muted-foreground">API key</div>
							<div className="font-mono">{keyText}</div>

							<div className="text-muted-foreground">Default model</div>
							<div className="font-mono">{previewDefaultModel}</div>

							<div className="text-muted-foreground">Scoring model</div>
							<div className="font-mono">
								{selectedScoringModel ? scoringModel : "inherits"}
							</div>

							<div className="text-muted-foreground">Tailoring model</div>
							<div className="font-mono">
								{selectedTailoringModel ? tailoringModel : "inherits"}
							</div>

							<div className="text-muted-foreground">Project selection</div>
							<div className="font-mono">
								{selectedProjectSelectionModel
									? projectSelectionModel
									: "inherits"}
							</div>
						</div>
					</div>
				</>
			) : null}
		</>
	);
}
