/** Addresses production must not try to deliver. Preview and local runs are unchanged. */

const RESERVED = /^(.*\.)?example\.(com|org|net)$|\.example$|\.test$|\.invalid$|\.localhost$/i;

export function isProductionMail(): boolean {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === "production";
  return process.env.NODE_ENV === "production";
}

export function isReservedRecipient(address: string): boolean {
  const raw = address.trim().toLowerCase();
  const at = raw.lastIndexOf("@");
  const host = at === -1 ? "" : raw.slice(at + 1);
  return Boolean(host) && !host.includes(" ") && RESERVED.test(host);
}

/** True when this address must not be emailed. Logs the skip. */
export function skipReserved(address: string, label = "Email"): boolean {
  if (!isProductionMail() || !isReservedRecipient(address)) return false;
  console.info(`${label} skipped: a reserved address was not emailed from production`);
  return true;
}
