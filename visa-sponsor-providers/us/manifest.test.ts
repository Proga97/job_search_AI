import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { extractLatestLcaWorkbookUrl, parseLcaWorkbook } from "./manifest";

describe("United States visa sponsor provider", () => {
	it("selects the newest quarterly DOL LCA workbook", () => {
		const html = `
      <a href="/files/LCA_Disclosure_Data_FY2025_Q4.xlsx">FY25</a>
      <a href="/files/LCA_Dislclosure_Data_FY2026_Q2.xlsx">FY26</a>
      <a href="/files/LCA_Disclosure_Data_FY2026_Q1.xlsx">FY26 Q1</a>
    `;

		expect(extractLatestLcaWorkbookUrl(html)).toBe(
			"https://www.dol.gov/files/LCA_Dislclosure_Data_FY2026_Q2.xlsx",
		);
	});

	it("parses and deduplicates certified employer filings", async () => {
		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet("LCA");
		sheet.addRow([
			"EMPLOYER_NAME",
			"EMPLOYER_CITY",
			"EMPLOYER_STATE",
			"CASE_STATUS",
			"VISA_CLASS",
		]);
		sheet.addRow(["Acme LLC", "Austin", "TX", "Certified", "H-1B"]);
		sheet.addRow(["Acme LLC", "Austin", "TX", "Certified", "H-1B"]);
		sheet.addRow(["Denied Corp", "Boston", "MA", "Denied", "H-1B"]);

		const buffer = await workbook.xlsx.writeBuffer();
		const sponsors = await parseLcaWorkbook(buffer as ArrayBuffer);

		expect(sponsors).toEqual([
			{
				organisationName: "Acme LLC",
				townCity: "Austin",
				county: "TX",
				typeRating: "Certified LCA filing",
				route: "H-1B",
			},
		]);
	});
});
