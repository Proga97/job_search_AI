import { mkdir } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { resolve } from "node:path";
import {
  type BrowserContext,
  chromium,
  type Locator,
  type Page,
} from "playwright";

type ApplicationProfile = {
  fullName?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedIn?: string;
  github?: string;
  address?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
};

type LaunchRequest = {
  sessionId: string;
  workspaceKey: string;
  jobId: string;
  url: string;
  profile: ApplicationProfile;
  resume: {
    fileName: string;
    mimeType: "application/pdf";
    dataBase64: string;
  };
};

type FillValue = { key: keyof ApplicationProfile; value: string };

const port = Number.parseInt(process.env.APPLY_ASSISTANT_PORT ?? "4317", 10);
const token = process.env.APPLY_ASSISTANT_TOKEN?.trim();
const dataDir = resolve(
  process.env.APPLY_ASSISTANT_DATA_DIR ?? ".data/apply-assistant-browser",
);
let browserContext: BrowserContext | null = null;
const activeSessions = new Map<
  string,
  { stop: () => void; workspaceKey: string; jobId: string }
>();

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function isAuthorized(req: IncomingMessage): boolean {
  if (!token) return true;
  return req.headers.authorization === `Bearer ${token}`;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 15 * 1024 * 1024) throw new Error("Request is too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function isLaunchRequest(value: unknown): value is LaunchRequest {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.sessionId === "string" &&
    typeof input.workspaceKey === "string" &&
    typeof input.jobId === "string" &&
    typeof input.url === "string" &&
    input.profile !== null &&
    typeof input.profile === "object" &&
    input.resume !== null &&
    typeof input.resume === "object" &&
    typeof (input.resume as Record<string, unknown>).fileName === "string" &&
    typeof (input.resume as Record<string, unknown>).dataBase64 === "string"
  );
}

async function getContext(): Promise<BrowserContext> {
  if (browserContext) return browserContext;
  await mkdir(dataDir, { recursive: true });
  browserContext = await chromium.launchPersistentContext(dataDir, {
    headless: false,
    viewport: null,
  });
  browserContext.on("close", () => {
    browserContext = null;
  });
  return browserContext;
}

function splitName(fullName: string | undefined): {
  first?: string;
  last?: string;
} {
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
  return { first: parts[0], last: parts.length > 1 ? parts.at(-1) : undefined };
}

function fieldValue(
  hint: string,
  profile: ApplicationProfile,
): FillValue | null {
  const normalized = hint.toLowerCase().replace(/[_-]+/g, " ");
  const { first, last } = splitName(profile.fullName);
  const candidates: Array<
    [RegExp, keyof ApplicationProfile, string | undefined]
  > = [
    [/\bfirst\s*name\b|\bgiven\s*name\b/, "fullName", first],
    [/\blast\s*name\b|\bsurname\b|\bfamily\s*name\b/, "fullName", last],
    [
      /\b(full|legal|preferred)\s*name\b|\bname\b/,
      "fullName",
      profile.fullName,
    ],
    [/\be[ -]?mail\b/, "email", profile.email],
    [/\b(phone|mobile|telephone)\b/, "phone", profile.phone],
    [/\blinkedin\b/, "linkedIn", profile.linkedIn],
    [/\bgithub\b/, "github", profile.github],
    [
      /\b(portfolio|personal website|website|homepage)\b/,
      "website",
      profile.website,
    ],
    [/\bpostal\b|\bzip\b/, "postalCode", profile.postalCode],
    [/\b(city|town)\b/, "city", profile.city],
    [/\b(state|province|region)\b/, "region", profile.region],
    [/\bcountry\b/, "country", profile.country],
    [/\bstreet\b|\baddress\b/, "address", profile.address],
  ];
  for (const [pattern, key, value] of candidates) {
    if (pattern.test(normalized) && value?.trim())
      return { key, value: value.trim() };
  }
  return null;
}

async function describe(locator: Locator): Promise<string> {
  return locator.evaluate((element) => {
    const input = element as HTMLInputElement;
    const labels = input.labels
      ? Array.from(input.labels).map((label) => label.textContent ?? "")
      : [];
    return [
      ...labels,
      input.getAttribute("aria-label"),
      input.getAttribute("placeholder"),
      input.getAttribute("name"),
      input.id,
      input.getAttribute("autocomplete"),
    ]
      .filter(Boolean)
      .join(" ");
  });
}

async function uploadResume(page: Page, input: LaunchRequest): Promise<boolean> {
  const file = {
    name: input.resume.fileName,
    mimeType: input.resume.mimeType,
    buffer: Buffer.from(input.resume.dataBase64, "base64"),
  };

  for (const frame of page.frames()) {
    const inputs = frame.locator('input[type="file"]');
    const count = await inputs.count();
    let fallback: Locator | null = null;
    for (let index = 0; index < count; index += 1) {
      const candidate = inputs.nth(index);
      const hint = (await describe(candidate)).toLowerCase();
      if (/cover\s*letter|portfolio|photo|image/.test(hint)) continue;
      fallback ??= candidate;
      if (!/resume|résumé|cv|curriculum/.test(hint)) continue;
      await candidate.setInputFiles(file);
      return true;
    }
    if (fallback) {
      await fallback.setInputFiles(file);
      return true;
    }
  }
  return false;
}

async function enterApplicationForm(page: Page): Promise<boolean> {
  const candidates = page.locator("button, a");
  const count = await candidates.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    try {
      if (!(await candidate.isVisible())) continue;
      const label = (await candidate.innerText()).trim();
      if (
        !/^(apply now|apply for this job|start application|apply)$/i.test(label)
      ) {
        continue;
      }
      await candidate.click();
      return true;
    } catch {
      // Try the next visible application entry point.
    }
  }
  return false;
}

async function fillPage(
  page: Page,
  profile: ApplicationProfile,
): Promise<{ filled: number; skipped: number }> {
  let filled = 0;
  let skipped = 0;
  for (const frame of page.frames()) {
    const fields = frame.locator(
      'input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea, select',
    );
    const count = await fields.count();
    for (let index = 0; index < count; index += 1) {
      const field = fields.nth(index);
      try {
        if (!(await field.isVisible()) || !(await field.isEditable())) continue;
        if ((await field.inputValue()).trim()) continue;
        const match = fieldValue(await describe(field), profile);
        if (!match) {
          skipped += 1;
          continue;
        }
        const tag = await field.evaluate((element) =>
          element.tagName.toLowerCase(),
        );
        if (tag === "select")
          await field
            .selectOption({ label: match.value })
            .catch(() => field.selectOption(match.value));
        else await field.fill(match.value);
        filled += 1;
      } catch {
        skipped += 1;
      }
    }
  }
  return { filled, skipped };
}

function watchApplicationSession(
  page: Page,
  input: LaunchRequest,
): { stop: () => void } {
  let stopped = false;
  let filling = false;
  const watchedPages = new Set<Page>();
  const timers = new Set<NodeJS.Timeout>();

  const scan = async (target: Page): Promise<void> => {
    if (stopped || filling || target.isClosed()) return;
    filling = true;
    try {
      const result = await fillPage(target, input.profile);
      if (result.filled > 0) {
        process.stdout.write(
          `Apply Assistant filled ${result.filled} field${result.filled === 1 ? "" : "s"}; review the application before submitting.\n`,
        );
      }
    } catch {
      if (!target.isClosed()) {
        process.stdout.write(
          "Apply Assistant could not rescan this page; continuing to watch the other application pages.\n",
        );
      }
    } finally {
      filling = false;
    }
  };

  const attach = (target: Page): void => {
    if (watchedPages.has(target)) return;
    watchedPages.add(target);
    target.on("domcontentloaded", () => void scan(target));
    target.on("framenavigated", () => void scan(target));
    target.on("popup", attach);
    void scan(target);
  };

  attach(page);
  for (const existingPage of page.context().pages()) attach(existingPage);
  // React-based ATS forms commonly render or replace fields well after load.
  // A bounded watcher is more reliable than DOM mutation hooks across frames.
  const timer = setInterval(() => {
    for (const target of watchedPages) {
      if (target.isClosed()) watchedPages.delete(target);
      else void scan(target);
    }
  }, 1_500);
  timers.add(timer);

  const expiry = setTimeout(
    () => activeSessions.get(input.sessionId)?.stop(),
    60 * 60 * 1_000,
  );
  timers.add(expiry);

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      for (const activeTimer of timers) clearTimeout(activeTimer);
      activeSessions.delete(input.sessionId);
    },
  };
}

async function launch(input: LaunchRequest) {
  const url = new URL(input.url);
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new Error("Unsupported job URL");
  const context = await getContext();
  const page = await context.newPage();
  await page.goto(url.toString(), {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForTimeout(1_000);
  let applicationPages = [page];
  let resumeUploaded = await uploadResume(page, input);
  if (!resumeUploaded && (await enterApplicationForm(page))) {
    await page.waitForTimeout(2_500);
    applicationPages = context.pages().filter((candidate) => !candidate.isClosed());
    for (const candidate of [...applicationPages].reverse()) {
      if (await uploadResume(candidate, input)) {
        resumeUploaded = true;
        break;
      }
    }
  }
  if (resumeUploaded) {
    process.stdout.write(
      "Apply Assistant uploaded the resume and is waiting for the ATS to parse it…\n",
    );
    await page.waitForTimeout(4_000);
  }
  const result = { filled: 0, skipped: 0 };
  for (const candidate of applicationPages) {
    const pageResult = await fillPage(candidate, input.profile);
    result.filled += pageResult.filled;
    result.skipped += pageResult.skipped;
  }
  process.stdout.write(
    `Apply Assistant initial scan: resume ${resumeUploaded ? "uploaded" : "upload control not found"}; ${result.filled} filled, ${result.skipped} unmatched. Watching for the application form…\n`,
  );
  activeSessions.get(input.sessionId)?.stop();
  const watcher = watchApplicationSession(page, input);
  activeSessions.set(input.sessionId, {
    ...watcher,
    workspaceKey: input.workspaceKey,
    jobId: input.jobId,
  });
  await page.bringToFront();
  return { sessionId: input.sessionId, status: "review_required", ...result };
}

const server = createServer(async (req, res) => {
  try {
    if (!isAuthorized(req)) {
      send(res, 401, { ok: false, error: "Unauthorized" });
      return;
    }
    if (req.method === "GET" && req.url === "/health") {
      send(res, 200, {
        ok: true,
        data: { ready: true, browserOpen: browserContext !== null },
      });
      return;
    }
    if (req.method === "POST" && req.url === "/sessions") {
      const body = await readJson(req);
      if (!isLaunchRequest(body)) {
        send(res, 400, { ok: false, error: "Invalid launch request" });
        return;
      }
      const result = await launch(body);
      send(res, 201, { ok: true, data: result });
      return;
    }
    send(res, 404, { ok: false, error: "Not found" });
  } catch (error) {
    send(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Apply assistant failed",
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(
    `Meow AI Apply Assistant ready at http://127.0.0.1:${port}\n`,
  );
  if (!token)
    process.stdout.write(
      "Warning: APPLY_ASSISTANT_TOKEN is not set; localhost requests are unauthenticated.\n",
    );
});
