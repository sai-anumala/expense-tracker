import { describe, expect, it } from "vitest";
import { alertText, maskAlert, parseBankAlert } from "../bankAlertParser";

// All alerts are synthetic, with made-up numbers and names. Never add real bank emails here.
const captured = (text: string) => {
  const p = parseBankAlert(text);
  if (!p.captured) throw new Error(`Expected capture, got ignored: ${p.reason}`);
  return p;
};

describe("card bill wording", () => {
  it("is not confused by a dot inside the amount", () => {
    expect(captured("Thank you. We got your payment of Rs.1,000.50 on your card").kind).toBe("cardBill");
  });
});

describe("alertText", () => {
  it("joins subject and body, collapses whitespace, and keeps only the start", () => {
    expect(alertText(" Alert ", "Dear Customer,\n\n  Rs.5 debited")).toBe("Alert. Dear Customer, Rs.5 debited");
    expect(alertText("", "x".repeat(2000))).toHaveLength(800);
  });
});

describe("parseBankAlert: HDFC UPI email format", () => {
  const body = `Dear Customer,

Greetings from HDFC Bank!

Rs.120.00 is debited from your account ending 1234 towards VPA *************9999@demobank (DEMO CINEMAS LIMITED) on 01-11-26.

UPI transaction reference no.: 012345678901.

If you did not authorize this transaction, please report it immediately at:
a. When in India (Toll free): 1800 000 0000
b. When abroad: 9100 00000000
c. Or SMS 'BLOCK UPI' to 7000000000.

We're here to support you in every step of the way.

Warm regards,
HDFC Bank`;

  it("reads the amount, UPI and the merchant in brackets", () => {
    expect(captured(alertText("View: Account update for your HDFC Bank A/c", body))).toMatchObject({
      amount: 120,
      kind: "expense",
      account: "UPI",
      merchant: "DEMO CINEMAS LIMITED",
    });
  });
  it("stores no account, VPA, reference or phone numbers", () => {
    expect(captured(alertText("", body)).maskedText).not.toMatch(/\d{4,}/);
  });
});

describe("parseBankAlert: spending", () => {
  it("credit card purchase", () => {
    expect(captured("Rs.1,250.50 spent on your Demo Bank Credit Card ending 1234 at ZOMATO on 05/11/26. Avl Lmt: Rs 45,000")).toMatchObject({
      amount: 1250.5,
      kind: "expense",
      account: "Credit Card",
      merchant: "ZOMATO",
    });
  });
  it("'Thank you for using your card' style", () => {
    expect(captured("Thank you for using your Demo Bank Credit Card ending 1234 for Rs 500.00 at AMAZON on 05-11-2026.")).toMatchObject({
      amount: 500,
      kind: "expense",
      account: "Credit Card",
      merchant: "AMAZON",
    });
  });
  it("generic 'card' leaves the payment method for the user to choose", () => {
    const p = captured("Spent Rs.500 On Demo Bank Card x1234 At AMAZON On 2026-11-05");
    expect(p.account).toBeUndefined();
    expect(p.merchant).toBe("AMAZON");
  });
  it("debit card", () => {
    expect(captured("INR 300.00 spent on Demo Bank Debit Card XX9876 at BIG BAZAAR on 05-Nov-26").account).toBe("Debit Card");
  });
  it("'debited by' without a currency sign; the first verb wins over 'credited'", () => {
    expect(captured("A/C X1234 debited by 75.00 on date 05Nov26 UPI trf to CHAI POINT Refno 512345678901")).toMatchObject({
      amount: 75,
      kind: "expense",
      account: "UPI",
      merchant: "CHAI POINT",
    });
    expect(captured("Acct XX123 debited for Rs 450.00 on 05-Nov-26; ASHA S credited. UPI:512345678901.")).toMatchObject({
      amount: 450,
      kind: "expense",
      merchant: "ASHA S",
    });
  });
  it("account debit with no UPI mention is a bank transfer", () => {
    expect(captured("Your A/c XX1234 is debited with INR 2,000.00 by NEFT on 05-11-2026.").account).toBe("Bank Transfer");
  });
  it("amount formats: ₹, INR without a space, Indian grouping", () => {
    expect(captured("₹1,00,000 debited from a/c XX12").amount).toBe(100000);
    expect(captured("INR1,234.5 debited from a/c XX12").amount).toBe(1234.5);
  });
  it("uses the spent amount, not the balance listed first", () => {
    expect(captured("Avl Bal Rs 9,999.00. A/c XX12 debited for Rs 100.00 on 05-11-26").amount).toBe(100);
  });
  it("a genuine alert that warns about OTPs is still captured", () => {
    expect(captured("Rs.200 spent on Credit Card XX12 at CAFE on 05/11/26. Never share your OTP with anyone.").amount).toBe(200);
    expect(captured("Rs.200 spent on Credit Card XX12 at CAFE on 05/11/26. The bank will never ask for your OTP.").amount).toBe(200);
  });
  it("a trailing advert doesn't hide a real debit", () => {
    expect(captured("Rs.200 debited from a/c XX12 on 05/11/26. Get great offers on our app!").amount).toBe(200);
  });
});

describe("parseBankAlert: money in", () => {
  it("salary / money received", () => {
    expect(captured("Rs.50,000.00 credited to your A/c XX1234 on 01-11-26 by NEFT. Avl Bal Rs 75,000")).toMatchObject({
      amount: 50000,
      kind: "income",
      account: "Bank Transfer",
    });
  });
  it("names the sender", () => {
    expect(captured("Received Rs.500 in your A/C XX12 from NEHA via UPI on 05/11/26").merchant).toBe("NEHA");
  });
  it("refund to the credit card is income on the card", () => {
    expect(captured("Refund of Rs.300 credited to your Credit Card XX12 on 05/11/26")).toMatchObject({ kind: "income", account: "Credit Card" });
  });
});

describe("parseBankAlert: transfers, never income or spending", () => {
  it("card bill payment received", () => {
    expect(captured("Payment of Rs.5,000 received on your Demo Bank Credit Card XX12 on 05/11/26. Thank you.")).toMatchObject({
      amount: 5000,
      kind: "cardBill",
      account: "Credit Card",
    });
  });
  it("bank debit towards the card", () => {
    expect(captured("Rs.5,000 debited from A/c XX12 towards your credit card bill on 05/11/26").kind).toBe("cardBill");
  });
  it("ATM withdrawal", () => {
    expect(captured("Rs.2,000 withdrawn from A/c XX12 at ATM on 05/11/26").kind).toBe("atmWithdrawal");
  });
});

describe("parseBankAlert: ignored and never stored", () => {
  it.each([
    ["otp", "123456 is your OTP for a transaction of Rs 500 at AMAZON. Do not share it."],
    ["otp", "Use OTP 482913 to pay Rs.1,000 debited from your account."],
    ["otp", "Your verification code is 998877"],
    ["failed", "Your transaction of Rs.500 at AMAZON was declined due to insufficient funds."],
    ["failed", "UPI payment of Rs 100 failed. Money if debited will be refunded."],
    ["request", "ASHA has requested Rs.200 from you on UPI. Approve in your app."],
    ["upcoming", "Rs.1,499 will be debited from your A/c XX12 on 07/11/26 for your subscription."],
    ["upcoming", "Up to Rs.5,00,000 can be credited to your account instantly."],
    ["reminder", "Your credit card statement is generated. Total due Rs.5,000, min due Rs.250, due on 20/11/26."],
    ["reminder", "Bill payment due: Rs.3,000 on your card by 20 Nov."],
    ["promotion", "Congratulations! You are eligible for a pre-approved loan of Rs.2,00,000. Apply now."],
    ["not-a-transaction", "Your A/c XX12 balance is Rs.12,000 as on 05/11/26."],
    ["not-a-transaction", "Welcome to Demo Bank net banking."],
  ])("%s: %s", (reason, text) => {
    expect(parseBankAlert(text)).toEqual({ captured: false, reason });
  });
});

describe("maskAlert", () => {
  it("hides account, reference and phone numbers and balances; keeps amounts and dates", () => {
    expect(maskAlert("Sent Rs.500.00 From A/C x1234 To 9876543210@ybl On 05/11/26 Ref 512345678901. Avl Bal: Rs 12,345.67 on 2026-11-05")).toBe(
      "Sent Rs.500.00 From A/C XXXX To XXXX@ybl On 05/11/26 Ref XXXX. Avl Bal XXXX on 2026-11-05",
    );
  });
});
