import { brandFor } from "@/lib/email/brand.js";

// Who an email is from and where replies go, per business.
//
// The sending ADDRESS is the platform's (INVOICE_FROM, one verified domain).
// The display name is the business's own name, and replies go to the business's
// own contact email, so a customer's reply reaches the business they dealt with.
// A dedicated deployment's own business (TENANT_ID) keeps its configured INVOICE_REPLY_TO;
// any other business with no contact email gets no reply-to at all (never the platform's inbox).

const CONFIGURED_FROM = (process.env.INVOICE_FROM ?? process.env.PLATFORM_FROM ?? "Winjo Dispatch <hello@winjodigital.co.uk>").trim();
const CONFIGURED_REPLY = (process.env.INVOICE_REPLY_TO ?? "").trim();
const DEFAULT_TENANT = () => (process.env.TENANT_ID ?? "").trim();

export function senderFor(tenantId?: string | null): { from: string; reply_to?: string } {
  const isDefault = !!DEFAULT_TENANT() && (!tenantId || tenantId === DEFAULT_TENANT());
  const brand = brandFor(tenantId || undefined);
  const address = (CONFIGURED_FROM.match(/<([^>]+)>/)?.[1] ?? CONFIGURED_FROM).trim();
  const display = String(brand.name || "").replace(/[<>",]/g, "").trim();
  const from = display ? `${display} <${address}>` : CONFIGURED_FROM;
  const reply = (isDefault ? CONFIGURED_REPLY : brand.email || "").trim();
  return reply ? { from, reply_to: reply } : { from };
}
