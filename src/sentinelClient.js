import { config } from './config.js';

class SentinelApiError extends Error {
  constructor(status, detail) {
    super(detail || `Sentinel API error (${status})`);
    this.status = status;
    this.detail = detail;
  }
}

async function request(path, options = {}) {
  const url = `${config.sentinelBaseUrl}${path}`;
  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch (err) {
    throw new SentinelApiError(0, `Could not reach Sentinel at ${config.sentinelBaseUrl}: ${err.message}`);
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new SentinelApiError(res.status, body?.detail || res.statusText);
  }
  return body;
}

export function listPendingProposals() {
  return request('/ai/proposals?status=pending');
}

export function approveProposal(proposalId) {
  return request(`/ai/proposals/${encodeURIComponent(proposalId)}/approve`, { method: 'POST' });
}

export function rejectProposal(proposalId) {
  return request(`/ai/proposals/${encodeURIComponent(proposalId)}/reject`, { method: 'POST' });
}

export { SentinelApiError };
