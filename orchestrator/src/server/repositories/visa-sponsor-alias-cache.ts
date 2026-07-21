import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import {
	getPrivateDataScope,
	privateDataScopeFilter,
} from "../tenancy/private-scope";

const { settings } = schema;
const KEY_PREFIX = "visaSponsorAiAlias:";

export interface VisaSponsorAliasCacheEntry {
	legalEmployerName: string | null;
	confidence: number;
	checkedAt: string;
}

function cacheKey(countryKey: string, normalizedEmployer: string): string {
	return `${KEY_PREFIX}${countryKey}:${normalizedEmployer}`;
}

export async function getVisaSponsorAlias(
	countryKey: string,
	normalizedEmployer: string,
): Promise<VisaSponsorAliasCacheEntry | null> {
	const key = cacheKey(countryKey, normalizedEmployer);
	const [row] = await db
		.select({ value: settings.value })
		.from(settings)
		.where(and(privateDataScopeFilter(settings), eq(settings.key, key)));
	if (!row) return null;
	try {
		return JSON.parse(row.value) as VisaSponsorAliasCacheEntry;
	} catch {
		return null;
	}
}

export async function setVisaSponsorAlias(
	countryKey: string,
	normalizedEmployer: string,
	entry: VisaSponsorAliasCacheEntry,
): Promise<void> {
	const key = cacheKey(countryKey, normalizedEmployer);
	const value = JSON.stringify(entry);
	const now = new Date().toISOString();
	const scope = getPrivateDataScope();
	const [existing] = await db
		.select({ key: settings.key })
		.from(settings)
		.where(and(privateDataScopeFilter(settings), eq(settings.key, key)));

	if (existing) {
		await db
			.update(settings)
			.set({ value, updatedAt: now })
			.where(and(privateDataScopeFilter(settings), eq(settings.key, key)));
		return;
	}

	await db.insert(settings).values({
		tenantId: scope.tenantId,
		userId: scope.userId,
		key,
		value,
		createdAt: now,
		updatedAt: now,
	});
}
