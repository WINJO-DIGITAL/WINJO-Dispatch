"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { authHeaders } from "@/lib/operator/authHeaders";
import { fmtDate } from "@/lib/dates";
import { money, nextStep, statusLabel } from "@/lib/operator/subscription";

// Settings → Subscription. What the business pays the platform (the set-up fee once, then the
// monthly fee), paid by card on Stripe's own page. After paying, the person lands back here and
// sees a confirmation with a confirmation number. Only an admin can pay or manage it.

async function call(method, body) {
  const res = await fetch("/api/billing", {
    method,
    headers: { "content-type": "application/json", ...(await authHeaders()) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Something went wrong. Please try again.");
  return data;
}

function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-slate-100 py-3 first:border-t-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-semibold text-[#0F1B33]">{children}</dd>
    </div>
  );
}

export default function SubscriptionSettings({ toast }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState(null); // shown after returning from Stripe
  const [returned, setReturned] = useState(null); // "success" | "cancelled" | "pending"

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const outcome = params.get("billing");
      const sessionId = params.get("session_id");
      try {
        if (outcome === "success" && sessionId) {
          const c = await call("POST", { action: "confirm", sessionId });
          if (cancelled) return;
          if (c.paid) { setConfirmation(c); setReturned("success"); } else setReturned("pending");
        } else if (outcome === "cancelled") {
          setReturned("cancelled");
        }
      } catch (e) {
        if (!cancelled) { setReturned("pending"); setError(e.message); }
      }
      try {
        const s = await call("GET");
        if (!cancelled) setState(s);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
      // Tidy the address so a refresh does not run the confirmation again.
      if (outcome) window.history.replaceState(null, "", "/operator/settings?section=subscription");
    })();
    return () => { cancelled = true; };
  }, []);

  const go = async (action) => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await call("POST", { action });
      window.location.assign(url);
    } catch (e) {
      setError(e.message);
      toast?.({ message: e.message, type: "error" });
      setBusy(false);
    }
  };

  if (!state && !error) return <p className="text-sm text-slate-500">Loading your subscription…</p>;
  if (!state) return <p role="alert" className="text-sm text-red-700">{error}</p>;

  const step = nextStep(state);
  const firstPayment = state.monthlyPence + (state.setupPaid ? 0 : state.setupPence);

  return (
    <div className="space-y-6">
      {returned === "success" && confirmation && (
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 flex-shrink-0 text-emerald-700" />
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-emerald-900">Payment received. Your subscription is active.</h3>
              <dl className="mt-3 text-sm text-emerald-900">
                <div className="flex flex-wrap gap-x-2"><dt>Confirmation number:</dt><dd className="font-bold tracking-wide">{confirmation.confirmationNumber}</dd></div>
                {confirmation.amountPence != null && <div className="flex flex-wrap gap-x-2"><dt>Amount paid:</dt><dd className="font-semibold">{money(confirmation.amountPence)}</dd></div>}
                {confirmation.paidAt && <div className="flex flex-wrap gap-x-2"><dt>Paid on:</dt><dd className="font-semibold">{fmtDate(confirmation.paidAt)}</dd></div>}
                {confirmation.nextPaymentOn && <div className="flex flex-wrap gap-x-2"><dt>Next monthly payment:</dt><dd className="font-semibold">{fmtDate(confirmation.nextPaymentOn)}</dd></div>}
              </dl>
              <p className="mt-3 text-sm text-emerald-900">
                {confirmation.includedSetup ? "This covered the one-off set-up fee and your first month. " : "This covered your first month. "}
                Stripe has emailed you a receipt. Keep the confirmation number in case you need to ask us about this payment.
              </p>
            </div>
          </div>
        </div>
      )}
      {returned === "pending" && (
        <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">We have not seen your payment yet.</p>
          <p className="mt-1">If you finished paying, refresh this page in a minute: it can take a moment to arrive. If you were charged, you do not need to pay again.</p>
        </div>
      )}
      {returned === "cancelled" && (
        <div role="status" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold">Payment cancelled. Nothing was charged.</p>
          <p className="mt-1">You can pay whenever you are ready.</p>
        </div>
      )}
      {state.status === "past_due" && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-semibold">Your last monthly payment did not go through.</p>
              <p className="mt-1">Use Manage payment to update your card. If it stays unpaid, the agreement lets us suspend the service after written notice (clause 3.4).</p>
            </div>
          </div>
        </div>
      )}

      <div className="card p-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-[#0F1B33]">Your plan</h3>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${state.status === "active" ? "bg-emerald-100 text-emerald-800" : state.status === "past_due" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700"}`}>
            {statusLabel(state)}
          </span>
        </div>
        <dl>
          <Row label="Monthly fee">{money(state.monthlyPence)} a month, paid in advance</Row>
          <Row label="Set-up fee (one-off)">{money(state.setupPence)}{state.setupPaid ? " · paid" : ""}</Row>
          <Row label="VAT">Not VAT registered, so none charged</Row>
          {state.status === "active" && state.currentPeriodEnd && (
            <Row label={state.cancelAtPeriodEnd ? "Ends on" : "Next payment"}>{fmtDate(state.currentPeriodEnd)}</Row>
          )}
          {state.lastInvoice && (
            <Row label="Last payment">
              {state.lastInvoice.amountPence != null ? money(state.lastInvoice.amountPence) : ""}
              {state.lastInvoice.paidAt ? ` on ${fmtDate(state.lastInvoice.paidAt)}` : ""}
              {state.lastInvoice.number ? <span className="block text-xs font-normal text-slate-500">Confirmation number {state.lastInvoice.number}</span> : null}
            </Row>
          )}
        </dl>
      </div>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {!state.configured ? (
        <p className="text-sm text-slate-600">Card payment of the subscription is not switched on yet. Until it is, we invoice you by email as the agreement says.</p>
      ) : !state.canManage ? (
        <p className="text-sm text-slate-600">Only an admin of {state.businessName} can pay or manage the subscription.</p>
      ) : step === "pay" ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => go("checkout")}
            disabled={busy}
            className="w-full rounded-2xl bg-amber-500 px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50 sm:w-auto"
          >
            {busy ? "Opening the payment page…" : `Pay ${money(firstPayment)} and start your subscription`}
          </button>
          <p className="text-xs leading-relaxed text-slate-500">
            {state.setupPaid
              ? `Today you pay ${money(state.monthlyPence)} for your first month. `
              : `Today you pay ${money(firstPayment)}: the ${money(state.setupPence)} set-up fee and ${money(state.monthlyPence)} for your first month. `}
            After that, {money(state.monthlyPence)} is taken from the same card each month, in advance, until you cancel the card payment or the agreement ends.
            You pay on Stripe&apos;s secure page; we never see your card number. Paying by card is covered by clause 3.8 of the{" "}
            <a className="font-semibold text-amber-700 underline" href="/platform-terms#agreement" target="_blank" rel="noreferrer">Operator Services Agreement</a>,
            which you accepted when you applied.
          </p>
          {state.testMode && <p className="text-xs font-semibold text-amber-700">Test mode: no real money is taken. Use Stripe&apos;s test card 4242 4242 4242 4242.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => go("portal")}
            disabled={busy}
            className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-[#0F1B33] transition hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? "Opening…" : "Manage payment"}
          </button>
          <p className="text-xs leading-relaxed text-slate-500">
            Change your card, see your receipts or cancel the card payment on Stripe&apos;s page. Cancelling the card payment does not by itself end the agreement:
            to end it, follow clause 8 of the <a className="font-semibold text-amber-700 underline" href="/platform-terms#agreement" target="_blank" rel="noreferrer">agreement</a>.
          </p>
        </div>
      )}
    </div>
  );
}
