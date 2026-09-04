class SentinelApiError extends Error {
  constructor(status, detail) {
    super(detail || `Sentinel API error (${status})`);
    this.status = status;
    this.detail = detail;
  }
}

export function createSentinelClient(baseUrl) {
  const root = baseUrl.replace(/\/+$/, '');

  async function request(path, options = {}) {
    const url = `${root}${path}`;
    let res;
    try {
      res = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      });
    } catch (err) {
      throw new SentinelApiError(0, `Could not reach Sentinel at ${root}: ${err.message}`);
    }

    const text = await res.text();
    const body = text ? JSON.parse(text) : null;

    if (!res.ok) {
      throw new SentinelApiError(res.status, body?.detail || res.statusText);
    }
    return body;
  }

  return {
    listPendingProposals: () => request('/ai/proposals?status=pending'),
    approveProposal: (proposalId) => request(`/ai/proposals/${encodeURIComponent(proposalId)}/approve`, { method: 'POST' }),
    rejectProposal: (proposalId) => request(`/ai/proposals/${encodeURIComponent(proposalId)}/reject`, { method: 'POST' }),
  };
}

export { SentinelApiError };
