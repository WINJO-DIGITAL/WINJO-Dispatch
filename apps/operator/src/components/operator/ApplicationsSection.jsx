"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtDateTime } from "@/lib/dates";
import { formatFee } from "@/lib/operator/fees";
import { actionsFor, sortApplications, statusLabel } from "@/lib/operator/applications";

// Settings → Platform → Applications: businesses that applied on the website's sign-up page.
// The owner sends the invoice (outside the app), confirms the set-up fee is paid, then approves,
// which creates the business. The applicant never gets a login from this screen: after approving,
// use "Invite a business's first admin" below. The database only lets the platform owner call
// these functions, and re-checks every step.

const INPUT = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F1B33] outline-none focus:border-amber-400/40 disabled:opacity-60";
const BTN = "rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50";

function Application({ app, toast, onChanged }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const actions = actionsFor(app);

  async function run(fn, args, done, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { toast({ message: error.message, type: "error" }); return; }
    toast({ message: done, type: "success" });
    setNote("");
    onChanged(fn === "approve_signup_application");
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[#0F1B33]">{app.business_name} <span className="font-normal text-slate-500">({app.slug})</span></p>
          <p className="text-xs text-slate-500">
            {app.contact_name} · {app.contact_email}{app.contact_phone ? ` · ${app.contact_phone}` : ""}
          </p>
          <p className="text-xs text-slate-500">
            Applied {fmtDateTime(app.created_at)} · {formatFee(app.setup_pence)} set-up, {formatFee(app.monthly_pence)} a month · agreement v{app.contract_version}, Schedule A v{app.responsibilities_version} accepted {fmtDateTime(app.terms_accepted_at)}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${app.status === "paid" ? "bg-emerald-100 text-emerald-800" : app.status === "awaiting_payment" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600"}`}>
          {statusLabel(app.status)}
        </span>
      </div>

      {app.message && <p className="mt-2 whitespace-pre-line rounded-lg bg-white px-3 py-2 text-xs text-slate-600">{app.message}</p>}
      {app.paid_at && <p className="mt-2 text-xs text-slate-500">Payment confirmed {fmtDateTime(app.paid_at)}{app.paid_note ? `: ${app.paid_note}` : ""}</p>}
      {app.status === "approved" && <p className="mt-2 text-xs font-medium text-emerald-700">Approved {fmtDateTime(app.decided_at)}. The business now exists: invite its first admin below.</p>}
      {app.status === "rejected" && <p className="mt-2 text-xs text-slate-500">Rejected {fmtDateTime(app.decided_at)}{app.decision_note ? `: ${app.decision_note}` : ""}</p>}

      {actions.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input className={INPUT} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={actions.includes("confirm_payment") ? "Note, for example the bank reference (optional)" : "Note (optional, kept with a rejection)"} aria-label="Note" />
          {actions.includes("confirm_payment") && (
            <button disabled={busy} className={`${BTN} bg-amber-500 text-black hover:bg-amber-400`}
              onClick={() => run("mark_signup_paid", { p_id: app.id, p_note: note || null }, "Payment confirmed", `Confirm that ${formatFee(app.setup_pence)} has been received from ${app.business_name}?`)}>
              Payment received
            </button>
          )}
          {actions.includes("approve") && (
            <button disabled={busy} className={`${BTN} bg-amber-500 text-black hover:bg-amber-400`}
              onClick={() => run("approve_signup_application", { p_id: app.id }, `${app.business_name} created`, `Create the business "${app.business_name}" (${app.slug})? This cannot be undone here.`)}>
              Approve and create business
            </button>
          )}
          {actions.includes("reject") && (
            <button disabled={busy} className={`${BTN} border border-slate-200 text-slate-600 hover:bg-white`}
              onClick={() => run("reject_signup_application", { p_id: app.id, p_note: note || null }, "Application rejected", `Reject the application from ${app.business_name}? Nothing is refunded or emailed from here.`)}>
              Reject
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ApplicationsSection({ toast, onApproved }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc("list_signup_applications");
    if (e) { setError(e.message); return; }
    setError(null);
    setRows(sortApplications(data ?? []));
  }, []);
  // First load: the effect only starts the request; state is set after it answers.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error: e } = await supabase.rpc("list_signup_applications");
      if (!active) return;
      if (e) { setError(e.message); return; }
      setRows(sortApplications(data ?? []));
    })();
    return () => { active = false; };
  }, []);

  if (error) return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (!rows) return <p className="text-sm text-slate-500">Loading applications…</p>;
  if (rows.length === 0) return <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No applications yet.</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Send the applicant an invoice for the set-up fee yourself, confirm here when it is paid, then approve. Approving creates the business but not a login.
      </p>
      {rows.map((a) => (
        <Application key={a.id} app={a} toast={toast} onChanged={(approved) => { load(); if (approved && onApproved) onApproved(); }} />
      ))}
    </div>
  );
}
