/**
 * HTTP client for a single customer's Sentinel instance. Every call goes
 * through fetchWithRetry so a transient network blip or a Sentinel 5xx
 * doesn't kill the customer's whole poll cycle — only a genuine failure
 * (retries exhausted) bubbles up, which the poller uses to distinguish
 * "hiccup" from "actually broken."
 */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries on network errors and 5xx/429 responses only — a 4xx (bad
 * token, 404, 400 already-reviewed) is never transient, so it's returned
 * immediately for the caller to handle as a real error.
 */
async function fetchWithRetry(url, options = {}, { retries = 3, baseDelayMs = 500 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429 || response.status >= 500) {
        if (attempt === retries) return response;
        const retryAfterHeader = response.headers.get("retry-after");
        const delay = retryAfterHeader
          ? Number(retryAfterHeader) * 1000
          : baseDelayMs * 2 ** attempt + Math.random() * 200;
        await sleep(delay);
        continue;
      }
      return response;
    } catch (err) {
      lastErr = err;
      if (attempt === retries) throw err;
      await sleep(baseDelayMs * 2 ** attempt + Math.random() * 200);
    }
  }
  throw lastErr;
}

class SentinelApiError extends Error {
  constructor(message, { status, detail } = {}) {
    super(message);
    this.name = "SentinelApiError";
    this.status = status;
    this.detail = detail;
  }
}

class SentinelClient {
  constructor({ baseUrl, token }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token || null;
  }

  _headers() {
    const headers = { "Content-Type": "application/json" };
    if (this.token) headers["X-Sentinel-Token"] = this.token;
    return headers;
  }

  async _request(pathname, options = {}) {
    const response = await fetchWithRetry(`${this.baseUrl}${pathname}`, {
      ...options,
      headers: this._headers(),
    });
    if (!response.ok) {
      let detail;
      try {
        detail = (await response.json())?.detail;
      } catch {
        // body wasn't JSON — fall through with no detail
      }
      throw new SentinelApiError(`Sentinel ${pathname} -> ${response.status}`, {
        status: response.status,
        detail,
      });
    }
    if (response.status === 204) return null;
    return response.json();
  }

  getPendingProposals() {
    return this._request("/ai/proposals?status=pending");
  }

  getProposals(status) {
    return this._request(status ? `/ai/proposals?status=${encodeURIComponent(status)}` : "/ai/proposals");
  }

  approveProposal(proposalId) {
    return this._request(`/ai/proposals/${encodeURIComponent(proposalId)}/approve`, { method: "POST" });
  }

  rejectProposal(proposalId) {
    return this._request(`/ai/proposals/${encodeURIComponent(proposalId)}/reject`, { method: "POST" });
  }
}

module.exports = { SentinelClient, SentinelApiError, fetchWithRetry };
