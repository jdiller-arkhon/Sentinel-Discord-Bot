export function isValidSentinelUrl(url) {
  return /^https:\/\/.+/.test(url || '');
}

export function isValidLicenseKeyFormat(key) {
  return /^SENT-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(key || '');
}
