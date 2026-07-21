import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import type {
	VisaSponsor,
	VisaSponsorProviderManifest,
} from "@shared/types/visa-sponsors";
import ExcelJS from "exceljs";

const DOL_PERFORMANCE_DATA_URL =
	"https://www.dol.gov/agencies/eta/foreign-labor/performance";
const LCA_FILE_PATTERN =
	/href=(['"])([^'"]*LCA_(?:Dislclosure|Disclosure)_Data_FY\d{4}_Q\d\.xlsx(?:\?[^'"]*)?)\1/gi;

function cellText(value: ExcelJS.CellValue): string {
	if (value == null) return "";
	if (typeof value === "object") {
		if ("text" in value && typeof value.text === "string") return value.text;
		if ("result" in value && value.result != null) return String(value.result);
		if ("richText" in value && Array.isArray(value.richText)) {
			return value.richText.map((part) => part.text).join("");
		}
	}
	return String(value).trim();
}

export function extractLatestLcaWorkbookUrl(html: string): string | null {
	const matches = [...html.matchAll(LCA_FILE_PATTERN)];
	if (matches.length === 0) return null;

	const candidates = matches
		.map((match) => {
			const path = match[2].replace(/&amp;/g, "&");
			const period = path.match(/FY(\d{4})_Q(\d)/i);
			return {
				path,
				year: Number(period?.[1] ?? 0),
				quarter: Number(period?.[2] ?? 0),
			};
		})
		.sort((a, b) => b.year - a.year || b.quarter - a.quarter);

	return new URL(candidates[0].path, DOL_PERFORMANCE_DATA_URL).toString();
}

export async function parseLcaWorkbook(
	content: ArrayBuffer,
): Promise<VisaSponsor[]> {
	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.load(Buffer.from(content));
	const worksheet = workbook.worksheets[0];
	if (!worksheet) return [];

	const headers = new Map<string, number>();
	worksheet.getRow(1).eachCell((cell, column) => {
		headers.set(cellText(cell.value).toUpperCase(), column);
	});

	const employerColumn = headers.get("EMPLOYER_NAME");
	const cityColumn = headers.get("EMPLOYER_CITY");
	const stateColumn = headers.get("EMPLOYER_STATE");
	const statusColumn = headers.get("CASE_STATUS");
	const visaColumn = headers.get("VISA_CLASS");
	if (!employerColumn) return [];

	const sponsors = new Map<string, VisaSponsor>();
	worksheet.eachRow((row, rowNumber) => {
		if (rowNumber === 1) return;

		const organisationName = cellText(row.getCell(employerColumn).value);
		const caseStatus = statusColumn
			? cellText(row.getCell(statusColumn).value)
			: "";
		if (!organisationName || (caseStatus && !/certified/i.test(caseStatus))) {
			return;
		}

		const townCity = cityColumn ? cellText(row.getCell(cityColumn).value) : "";
		const county = stateColumn ? cellText(row.getCell(stateColumn).value) : "";
		const visaClass = visaColumn ? cellText(row.getCell(visaColumn).value) : "";
		const key = `${organisationName.toUpperCase()}::${townCity.toUpperCase()}::${county.toUpperCase()}`;
		if (sponsors.has(key)) return;

		sponsors.set(key, {
			organisationName,
			townCity,
			county,
			typeRating: "Certified LCA filing",
			route: visaClass || "H-1B / H-1B1 / E-3",
		});
	});

	return [...sponsors.values()];
}

export async function parseLcaWorkbookStream(
	stream: NodeJS.ReadableStream,
): Promise<VisaSponsor[]> {
	const workbook = new ExcelJS.stream.xlsx.WorkbookReader(stream, {
		entries: "emit",
		hyperlinks: "ignore",
		sharedStrings: "cache",
		styles: "ignore",
		worksheets: "emit",
	});

	for await (const worksheet of workbook) {
		const headers = new Map<string, number>();
		const sponsors = new Map<string, VisaSponsor>();

		for await (const row of worksheet) {
			if (row.number === 1) {
				row.eachCell((cell, column) => {
					headers.set(cellText(cell.value).toUpperCase(), column);
				});
				continue;
			}

			const employerColumn = headers.get("EMPLOYER_NAME");
			if (!employerColumn) continue;

			const cityColumn = headers.get("EMPLOYER_CITY");
			const stateColumn = headers.get("EMPLOYER_STATE");
			const statusColumn = headers.get("CASE_STATUS");
			const visaColumn = headers.get("VISA_CLASS");
			const organisationName = cellText(row.getCell(employerColumn).value);
			const caseStatus = statusColumn
				? cellText(row.getCell(statusColumn).value)
				: "";
			if (!organisationName || (caseStatus && !/certified/i.test(caseStatus))) {
				continue;
			}

			const townCity = cityColumn
				? cellText(row.getCell(cityColumn).value)
				: "";
			const county = stateColumn
				? cellText(row.getCell(stateColumn).value)
				: "";
			const visaClass = visaColumn
				? cellText(row.getCell(visaColumn).value)
				: "";
			const key = `${organisationName.toUpperCase()}::${townCity.toUpperCase()}::${county.toUpperCase()}`;
			if (sponsors.has(key)) continue;

			sponsors.set(key, {
				organisationName,
				townCity,
				county,
				typeRating: "Certified LCA filing",
				route: visaClass || "H-1B / H-1B1 / E-3",
			});
		}

		return [...sponsors.values()];
	}

	return [];
}

export const manifest: VisaSponsorProviderManifest = {
	id: "us",
	displayName: "United States",
	countryKey: "united states",
	scheduledUpdateHour: 2,
	employerAliases: {
		YouTube: "Google LLC",
		HCLTech: "HCL AMERICA INC",
		"JPMC Candidate Experience page": "JPMorgan Chase & Co.",
		"Microsoft – AI, Cloud, Productivity, Computing, Gaming & Apps":
			"Microsoft Corporation",
		"Microsoft \\u00096 AI, Cloud, Productivity, Computing, Gaming & Apps":
			"Microsoft Corporation",
		"Booz Allen": "Booz Allen Hamilton Inc.",
		Cognizant: "COGNIZANT TECHNOLOGY SOLUTIONS US CORP",
		"Cognizant US Corporation":
			"COGNIZANT TECHNOLOGY SOLUTIONS US CORP",
		Att: "AT&T SERVICES, INC.",
		SAIC: "Science Applications International Corporation",
		Stantec: "Stantec Consulting Services Inc.",
		"Honeywell Aerospace": "Honeywell International Inc.",
		"John Deere": "Deere & Company",
		"Mayo Career Site US": "Mayo Clinic",
		"PlayStation Global": "SONY INTERACTIVE ENTERTAINMENT LLC",
		"UnitedHealth Group / Optum": "Optum Services, Inc.",
		L3Harris: "L3Harris Technologies Inc",
		"Danfoss A/S": "Danfoss, LLC",
	},

	async fetchSponsors(): Promise<VisaSponsor[]> {
		const pageResponse = await fetch(DOL_PERFORMANCE_DATA_URL);
		if (!pageResponse.ok) {
			throw new Error(
				`Failed to fetch DOL performance data page: ${pageResponse.status} ${pageResponse.statusText}`,
			);
		}

		const workbookUrl = extractLatestLcaWorkbookUrl(await pageResponse.text());
		if (!workbookUrl) {
			throw new Error("Could not find the latest DOL LCA disclosure workbook");
		}

		const workbookResponse = await fetch(workbookUrl);
		if (!workbookResponse.ok) {
			throw new Error(
				`Failed to download DOL LCA workbook: ${workbookResponse.status} ${workbookResponse.statusText}`,
			);
		}

		if (!workbookResponse.body) {
			throw new Error("DOL LCA workbook response has no body");
		}

		const sponsors = await parseLcaWorkbookStream(
			Readable.fromWeb(workbookResponse.body),
		);
		if (sponsors.length === 0) {
			throw new Error("DOL LCA disclosure workbook appears empty or invalid");
		}

		return sponsors;
	},
};

export default manifest;
