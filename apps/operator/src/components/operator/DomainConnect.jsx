"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { tidySiteAddress, siteAddressProblem } from "@/lib/operator/siteAddress";

// Settings → Platform → Custom domain. The platform owner connects a business's own domain to the
// platform's project, shows the DNS records the business must add, and checks again later.
// Saving the business's website address (below, in Businesses) is still separate and is done after
// the domain is verified.

async function domainCall(domain, action) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/api/platform/domains", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token ?? ""}` },
    body: JSON.stringify({ domain, action }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Something went wrong. Please try again.");
  return data;
}

export default function DomainConnect({ toast }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);

  const run = async (action) => {
    const problem = siteAddressProblem(value);
    if (problem) { setError(problem); return; }
    const domain = tidySiteAddress(value).replace(/^https:\/\//, "");
    if (!domain) { setError("Enter the business's website address first."); return; }
    setBusy(true);
    setError(null);
    try {
      const s = await domainCall(domain, action);
      setState(s);
      toast?.({ message: s.verified ? "Domain connected" : "Domain added. The DNS records are below.", type: "success" });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-[#0F1B33]">Connect a business's own domain</p>
        <p className="mt-1 text-xs text-slate-500">
          Enter the address the business bought, for example https://www.example.co.uk. Then ask the business to add the DNS records shown below at its domain provider, and press Check.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://www.example.co.uk"
          autoComplete="off"
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#0F1B33] outline-none focus:border-amber-400"
        />
        <button type="button" disabled={busy} onClick={() => run("connect")}
          className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50">
          {busy ? "Working…" : "Connect"}
        </button>
        <button type="button" disabled={busy || !state} onClick={() => run("check")}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-[#0F1B33] transition hover:bg-slate-50 disabled:opacity-50">
          Check
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {state && (
        <div role="status" className={`rounded-xl border p-4 text-sm ${state.verified ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          <p className="font-semibold">{state.verified ? "Connected." : "Not connected yet."}</p>
          <p className="mt-1">{state.next}</p>
          {!state.verified && state.records.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead><tr><th className="pr-3 pb-1">Type</th><th className="pr-3 pb-1">Name</th><th className="pb-1">Value</th></tr></thead>
                <tbody>
                  {state.records.map((r, i) => (
                    <tr key={i} className="align-top">
                      <td className="pr-3 py-1 font-semibold">{r.type}</td>
                      <td className="pr-3 py-1 break-all">{r.name}</td>
                      <td className="py-1 break-all">{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {state.verified && (
            <p className="mt-2 text-xs">Next: save the address under Businesses, below, so visitors on this domain reach the business.</p>
          )}
        </div>
      )}
    </div>
  );
}
