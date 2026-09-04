export class SentinelApiError extends Error {
  constructor(status, detail) {
    super(detail || `Sentinel API error (${status})`);
    this.status = status;
    this.detail = detail;
  }
}

async function request(baseUrl, path, token, options = {}) {
  const root = baseUrl.replace(/\/+$/, '');
  let res;
  try {
    res = await fetch(`${root}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Sentinel-Token': token } : {}),
        ...(options.headers || {}),
      },
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

export const listPendingProposals = (baseUrl, token) => request(baseUrl, '/ai/proposals?status=pending', token);

export const approveProposal = (baseUrl, proposalId, token) =>
  request(baseUrl, `/ai/proposals/${encodeURIComponent(proposalId)}/approve`, token, { method: 'POST' });

export const rejectProposal = (baseUrl, proposalId, token) =>
  request(baseUrl, `/ai/proposals/${encodeURIComponent(proposalId)}/reject`, token, { method: 'POST' });
