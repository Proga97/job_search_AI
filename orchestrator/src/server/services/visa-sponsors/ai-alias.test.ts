import * as aliasCache from "@server/repositories/visa-sponsor-alias-cache";
import * as modelSelection from "@server/services/modelSelection";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveEmployerLegalNameWithAi } from "./ai-alias";

vi.mock("@server/repositories/visa-sponsor-alias-cache", () => ({
	getVisaSponsorAlias: vi.fn(),
	setVisaSponsorAlias: vi.fn(),
}));
vi.mock("@server/services/modelSelection", () => ({
	createConfiguredLlmService: vi.fn(),
	resolveLlmModel: vi.fn(),
}));

describe("AI visa sponsor employer aliases", () => {
	const callJson = vi.fn();
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(aliasCache.getVisaSponsorAlias).mockResolvedValue(null);
		vi.mocked(aliasCache.setVisaSponsorAlias).mockResolvedValue();
		vi.mocked(modelSelection.resolveLlmModel).mockResolvedValue("test-model");
		vi.mocked(modelSelection.createConfiguredLlmService).mockResolvedValue({
			callJson,
		} as never);
	});

	it("reuses a fresh cached alias without calling AI", async () => {
		vi.mocked(aliasCache.getVisaSponsorAlias).mockResolvedValue({
			legalEmployerName: "Google LLC",
			confidence: 98,
			checkedAt: new Date().toISOString(),
		});
		await expect(
			resolveEmployerLegalNameWithAi("YouTube", "united states"),
		).resolves.toBe("Google LLC");
		expect(callJson).not.toHaveBeenCalled();
	});

	it("caches a confident legal employer name returned by AI", async () => {
		callJson.mockResolvedValue({
			success: true,
			data: { legalEmployerName: "HCL America, Inc.", confidence: 0.96 },
		});
		await expect(
			resolveEmployerLegalNameWithAi("HCLTech", "united states"),
		).resolves.toBe("HCL America, Inc.");
		expect(aliasCache.setVisaSponsorAlias).toHaveBeenCalledWith(
			"united states",
			expect.any(String),
			expect.objectContaining({ confidence: 96 }),
		);
	});

	it("negative-caches uncertain answers", async () => {
		callJson.mockResolvedValue({
			success: true,
			data: { legalEmployerName: "Possible Corp", confidence: 40 },
		});
		await expect(
			resolveEmployerLegalNameWithAi("Ambiguous Brand", "united states"),
		).resolves.toBeNull();
		expect(aliasCache.setVisaSponsorAlias).toHaveBeenCalled();
	});
});
