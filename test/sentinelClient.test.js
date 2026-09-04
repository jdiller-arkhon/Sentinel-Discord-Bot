const { fetchWithRetry, SentinelClient, SentinelApiError } = require("../src/sentinelClient");

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  };
}

describe("fetchWithRetry", () => {
  afterEach(() => {
    global.fetch = undefined;
  });

  test("returns immediately on success", async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    const res = await fetchWithRetry("http://example.test", {}, { retries: 3, baseDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("retries on 5xx then succeeds", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const res = await fetchWithRetry("http://example.test", {}, { retries: 3, baseDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("does not retry on a plain 4xx", async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(404, { detail: "not found" }));
    const res = await fetchWithRetry("http://example.test", {}, { retries: 3, baseDelayMs: 1 });
    expect(res.status).toBe(404);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("gives up after exhausting retries on repeated 5xx", async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(500, {}));
    const res = await fetchWithRetry("http://example.test", {}, { retries: 2, baseDelayMs: 1 });
    expect(res.status).toBe(500);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test("retries on a thrown network error and eventually throws", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down"));
    await expect(fetchWithRetry("http://example.test", {}, { retries: 2, baseDelayMs: 1 })).rejects.toThrow("network down");
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});

describe("SentinelClient", () => {
  afterEach(() => {
    global.fetch = undefined;
  });

  test("sends the X-Sentinel-Token header when a token is configured", async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, []));
    const client = new SentinelClient({ baseUrl: "http://sentinel.test", token: "secret123" });
    await client.getPendingProposals();
    const headers = global.fetch.mock.calls[0][1].headers;
    expect(headers["X-Sentinel-Token"]).toBe("secret123");
  });

  test("throws SentinelApiError with status/detail on a 400", async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(400, { detail: "proposal is already approved" }));
    const client = new SentinelClient({ baseUrl: "http://sentinel.test" });
    await expect(client.approveProposal("abc")).rejects.toMatchObject({
      status: 400,
      detail: "proposal is already approved",
    });
  });
});
