// Sign-up applications (Settings → Platform → Applications): what the platform owner can do with
// each one. The database enforces all of this too (and only lets the platform owner call it).
//
//   awaiting_payment  the applicant has applied; the owner has sent an invoice. Can: confirm payment, reject.
//   paid              payment confirmed. Can: approve (creates the business), reject.
//   approved          the business exists. Next: invite its first admin.
//   rejected          closed.

export const STATUS_LABEL = {
  awaiting_payment: "Waiting for payment",
  paid: "Paid, ready to approve",
  approved: "Approved",
  rejected: "Rejected",
};

export function statusLabel(status) {
  return STATUS_LABEL[status] || "Unknown";
}

/** Which buttons to show for an application. A £0 set-up can be approved without a payment step. */
export function actionsFor(app) {
  if (!app) return [];
  if (app.status === "awaiting_payment") {
    return app.setup_pence === 0 ? ["approve", "reject"] : ["confirm_payment", "reject"];
  }
  if (app.status === "paid") return ["approve", "reject"];
  return [];
}

/** Open ones first (oldest first, so nobody waits longest), then closed ones (newest first). */
export function sortApplications(list) {
  const open = (a) => a.status === "awaiting_payment" || a.status === "paid";
  const t = (a) => new Date(a.created_at).getTime() || 0;
  return [...(list || [])].sort((a, b) => {
    if (open(a) !== open(b)) return open(a) ? -1 : 1;
    return open(a) ? t(a) - t(b) : t(b) - t(a);
  });
}

export function openCount(list) {
  return (list || []).filter((a) => a.status === "awaiting_payment" || a.status === "paid").length;
}
