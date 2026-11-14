import { describe, it, expect } from "vitest";
import { bookingResponseText } from "./bookingResponseText";

const EV = { name: "Acme Cars", phone: "07700 900123", site: "https://www.acme-cars.test" };
const OTHER = { name: "Coastal Cars", phone: "07123 456789", site: "https://coastal.test" };
const NOTHING = { name: "", phone: "", site: "" };
const base = { first: "Jo", ref: "ACM-1", when: "14/03/2099 09:30", payUrl: "https://www.acme-cars.test/booking?id=abc" };

// The wording Acme Cars's customers have always received (before the text became per business).
const oldAccepted = (needsPay: boolean, free: string) =>
  `Acme Cars: Hi Jo, your booking ACM-1 (14/03/2099 09:30) is confirmed.${needsPay ? ` Pay by card or choose cash: ${base.payUrl}` : ""} ${free ? `${free} ` : ""}Terms: acme-cars.test/terms#cancellation Questions: 07700 900123`;
const oldRejected = `Acme Cars: Hi Jo, unfortunately Acme Cars cannot accommodate your requested journey (14/03/2099 09:30, Ref ACM-1). We apologise for the inconvenience. No payment has been taken. Questions: 07700 900123`;

describe("bookingResponseText", () => {
  it.each([
    [true, "Free cancellation until 12:00 on 12/03/2099."],
    [true, ""],
    [false, "Free cancellation until 12:00 on 12/03/2099."],
    [false, ""],
  ])("Acme Cars's confirmation text is exactly as before (pay=%s, free=%j)", (needsPayment, freeCancellation) => {
    expect(bookingResponseText({ ...base, accepted: true, brand: EV, needsPayment, freeCancellation })).toBe(oldAccepted(needsPayment, freeCancellation));
  });

  it("Acme Cars's 'not available' text is exactly as before", () => {
    expect(bookingResponseText({ ...base, accepted: false, brand: EV, needsPayment: true, freeCancellation: "" })).toBe(oldRejected);
  });

  it("another business's texts carry its own name, number and website, never Acme Cars's", () => {
    const yes = bookingResponseText({ ...base, accepted: true, brand: OTHER, needsPayment: true, freeCancellation: "" });
    const no = bookingResponseText({ ...base, accepted: false, brand: OTHER, needsPayment: true, freeCancellation: "" });
    expect(yes).toMatch(/^Coastal Cars: Hi Jo/);
    expect(yes).toMatch(/Terms: coastal\.test\/terms#cancellation Questions: 07123 456789$/);
    expect(no).toMatch(/^Coastal Cars: Hi Jo, unfortunately Coastal Cars cannot accommodate/);
    for (const t of [yes, no]) expect(t).not.toMatch(/Acme Cars|07700 900123/);
  });

  it("a business with no name, number or website leaves them out cleanly", () => {
    const yes = bookingResponseText({ ...base, accepted: true, brand: NOTHING, needsPayment: false, freeCancellation: "" });
    const no = bookingResponseText({ ...base, accepted: false, brand: NOTHING, needsPayment: false, freeCancellation: "" });
    expect(yes).toBe("Hi Jo, your booking ACM-1 (14/03/2099 09:30) is confirmed.");
    expect(no).toBe("Hi Jo, unfortunately we cannot accommodate your requested journey (14/03/2099 09:30, Ref ACM-1). We apologise for the inconvenience. No payment has been taken.");
  });
});
