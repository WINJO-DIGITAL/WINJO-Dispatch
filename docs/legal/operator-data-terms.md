# Data processing terms for operators (version 1, 16/11/2026)

**Status: approved by the platform owner on 16/11/2026. Not legal advice and not a guarantee. No solicitor is used (owner decision).** Drafted from Article 28 of the UK GDPR (legislation.gov.uk, UK GDPR Art 28(3)). Every item below is a requirement the law sets for a controller and processor contract, and each one is covered.

## 1. Who is who

- **Controller:** the operator (the business that takes the booking and owns the customer relationship).
- **Processor:** Nitisat Sirisom, a sole trader trading as WINJO DIGITAL, of 3 Knoxwood Close, Thornton-Cleveleys, FY5 3UP, the supplier of the booking website, Operator app and Driver App the operator uses, under the Operator Services Agreement (`operator-contract.md`), which these terms form part of.
- Each operator is a controller in its own right. The platform only processes data on the operator's instructions.
- **Roles beyond data:** the platform is software only. It is not a private hire operator, is not a party to the operator's bookings, and does not provide, check or supervise the operator's licences, insurance, vehicles or drivers. Those are the operator's alone, as set out in `operator-responsibilities.md`, which forms part of these terms.

## 2. Subject matter, duration, nature and purpose (Art 28(3)(a))

- **Subject matter:** providing the booking, dispatch, driver, invoicing and customer messaging service to the operator.
- **Duration:** for as long as the operator uses the platform, and for any retention the operator requires under its own legal duties after that.
- **Nature and purpose:** storing, organising, displaying, sending and deleting the operator's booking, customer, driver and invoice records, as the operator instructs through the platform.

## 3. Types of personal data and people (Art 28(3)(a))

- **People:** the operator's customers, the operator's staff and office users, the operator's drivers, and people who send enquiries or quote requests.
- **Data:** names; phone numbers; email addresses; pickup and drop-off addresses; travel dates and times; flight numbers; passenger and luggage counts; payment status and a payment reference (card details are never stored by the platform, they are taken by Stripe); invoices; driver names, contact details and vehicle details; account login details (encrypted).

## 4. The processor's obligations (Art 28(3)(a)–(h))

The processor will:

a. **Act only on documented instructions** from the operator, including about transfers outside the UK, unless the law requires otherwise (in which case it tells the operator first, unless the law forbids it).

b. **Keep people sworn to confidentiality.** Anyone who handles the data is bound by a duty of confidence.

c. **Keep the data secure (Art 32).** Encryption in transit; access limited to each business's own staff and drivers through role-based rules; per-business isolation in the database; regular security reviews; no data shared between businesses.

d. **Use sub-processors only as listed in section 6, or as the operator agrees.** The processor puts the same data protection terms on each sub-processor and stays responsible for them. The operator is told before a new sub-processor is added, and may object on reasonable grounds.

e. **Help the operator answer people's rights requests (Art 28(3)(e)).** Access, correction, erasure, restriction, portability and objection. The processor provides the tools, and responds to the operator's requests within [five] working days.

f. **Help with security, breach notification and impact assessments (Art 28(3)(f)).** The processor notifies the operator of a personal data breach without undue delay, and in any case within [24 hours] of becoming aware of it, with the information the operator needs to meet its own 72-hour duty to report to the ICO.

g. **Delete or return the data at the end (Art 28(3)(g)).** When the operator leaves, the processor returns the data in a standard format or deletes it, as the operator chooses, within [30] days. Records the operator must keep under its own legal duties (such as six years of invoices) are kept by the operator's export, or retained until the period ends, as the operator decides.

h. **Make information available and allow audits (Art 28(3)(h)).** The processor provides the information needed to show compliance and allows reasonable checks by the operator or its auditor, on [30] days' notice, no more than once a year unless a breach has occurred.

## 5. The operator's obligations

- Give lawful instructions and keep its own privacy notice accurate. The operator's privacy policy must name the platform as a processor, using the standard policy's section on who we share data with.
- Hold its own ICO registration if required, and pay the ICO fee where it applies.
- Make sure its own customers, staff and drivers are told how their data is used.
- Be solely responsible for its licences, insurance, vehicles, driver checks and compliance with licensing law and conditions, as set out in `operator-responsibilities.md`, and confirm this in writing (Settings → Legal). The platform does not check any of it.
- Confirm in writing that it holds the insurance and DBS checks it states in its terms (see the Legal section in its Settings).

## 6. Sub-processors (the list the operator agrees to)

| Service | What it does | Where data is held | Transfer safeguard |
|---|---|---|---|
| Supabase | Database, sign-in and file storage | Stockholm, Sweden (EEA), project region eu-north-1 | Within the EEA (UK adequacy) |
| Vercel | Website and app hosting | Washington DC, USA (functions run in region iad1) | UK–US data bridge or contract clauses |
| Resend | Sends emails | Ireland (EU), sending region eu-west-1 | UK–US data bridge or contract clauses |
| Google | Address search in the booking form (Maps); analytics only if the customer accepts | Wherever Google handles the request; not fixed by the platform | UK–US data bridge or contract clauses |
| AeroDataBox | Flight times (flight number and date only); off by default | Not used unless the operator turns it on; not fixed by the platform | None needed while it is off |

Stripe is not a sub-processor of the platform: each operator connects its own Stripe account, so Stripe holds card payment data as the operator's own provider.

## 7. International transfers

Where data leaves the UK, it is protected by the UK–US data bridge or the UK's approved contract clauses (the International Data Transfer Agreement or Addendum). The processor keeps those in place for every sub-processor that needs them.

## 8. Liability and governing law

- Each party is responsible for its own part of the processing, as the UK GDPR sets out.
- This agreement is governed by the laws of England and Wales unless the operator is based in Scotland or Northern Ireland, in which case that jurisdiction applies.

## 9. Signing

- Operator: [legal name], by [name, role], signature, date (DD/MM/YYYY).
- Processor: [legal name], by [name, role], signature, date (DD/MM/YYYY).

## Decisions recorded (internal; not shown on the public page)

1. **Approval:** the platform owner approved these terms on 16/11/2026 and removed the draft label.
2. **Breach notice and response times:** 24 hours, five working days and 30 days (sections 4e, 4g and 4h) stand as written.
3. **Sub-processor table (section 6):** filled in on 16/11/2026 from the live set-up (database project region eu-north-1, hosting function region iad1, email sending region eu-west-1). The Supabase row said Frankfurt before; the live project is in Stockholm, so it was corrected. **Not verified:** the transfer safeguards ("UK–US data bridge or contract clauses") were carried over from the earlier text and were not re-checked against the providers' current terms or the ICO's guidance.
4. **Card payments:** nothing extra is needed here, since Stripe is the operator's own provider (see the note under section 6).
