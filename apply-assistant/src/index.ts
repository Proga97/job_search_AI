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
};

type FillValue = { key: keyof ApplicationProfile; value: string };

const port = Number.parseInt(process.env.APPLY_ASSISTANT_PORT ?? "4317", 10);
const token = process.env.APPLY_ASSISTANT_TOKEN?.trim();
const dataDir = resolve(
  process.env.APPLY_ASSISTANT_DATA_DIR ?? ".data/apply-assistant-browser",
);
let browserContext: BrowserContext | null = null;

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
    if (size > 64 * 1024) throw new Error("Request is too large");
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
    typeof input.profile === "object"
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
  const result = await fillPage(page, input.profile);
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
