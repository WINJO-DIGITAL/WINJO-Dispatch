// Settings → Subscription: small display rules, kept apart from the screen so they can be tested.

/** Pence as pounds: 9900 -> "£99", 9950 -> "£99.50". */
export function money(pence) {
  const n = Number(pence);
  if (!Number.isFinite(n)) return "";
  const pounds = n / 100;
  return `£${Number.isInteger(pounds) ? pounds.toLocaleString("en-GB") : pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** What the admin can do next: "pay" (nothing active) or "manage" (active or a failed payment). */
export function nextStep(state) {
  return state?.status === "active" || state?.status === "past_due" ? "manage" : "pay";
}

/** The status in words. */
export function statusLabel(state) {
  switch (state?.status) {
    case "active": return state.cancelAtPeriodEnd ? "Active, ending" : "Active";
    case "past_due": return "Payment failed";
    case "cancelled": return "Cancelled";
    default: return "Not started";
  }
}
