const DEFAULT_REQUESTS_PER_MINUTE = 8;

let tail = Promise.resolve();
let nextStartAt = 0;

function requestsPerMinute(): number {
	const configured = Number.parseInt(
		process.env.GEMINI_REQUESTS_PER_MINUTE ?? "",
		10,
	);
	return Number.isFinite(configured) && configured > 0
		? configured
		: DEFAULT_REQUESTS_PER_MINUTE;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
	if (ms <= 0) return Promise.resolve();
	return new Promise((resolve, reject) => {
		const timer = setTimeout(resolve, ms);
		signal?.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				reject(new Error("Gemini request was cancelled while queued."));
			},
			{ once: true },
		);
	});
}

/** Gemini quotas are project-wide, so this intentionally gates all tenants. */
export async function waitForGeminiRequestSlot(
	signal?: AbortSignal,
): Promise<void> {
	const previous = tail;
	let release: () => void = () => undefined;
	tail = new Promise<void>((resolve) => {
		release = resolve;
	});

	await previous;
	try {
		if (signal?.aborted) {
			throw new Error("Gemini request was cancelled while queued.");
		}
		const intervalMs = Math.ceil(60_000 / requestsPerMinute());
		await wait(Math.max(0, nextStartAt - Date.now()), signal);
		nextStartAt = Date.now() + intervalMs;
	} finally {
		release();
	}
}

export const GEMINI_DEFAULT_REQUESTS_PER_MINUTE = DEFAULT_REQUESTS_PER_MINUTE;
