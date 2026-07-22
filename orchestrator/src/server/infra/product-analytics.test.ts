import { trackServerProductEvent } from "./product-analytics";

describe("server product analytics", () => {
  it("does not send inherited product telemetry", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      trackServerProductEvent("job_viewed", { jobId: "private-job" }),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
