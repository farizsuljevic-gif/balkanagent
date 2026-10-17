/* BALKAN AGENT — payment integration configuration.
   Activation checklist: confirm legal permission to sell, complete provider KYC,
   confirm eligible payout account, create the real product/checkout in provider,
   test authorised transactions. NEVER place private API keys in this file.
   Leave approved:false until everything above is complete. */
window.BA_PAYMENT_CONFIG = Object.freeze({
  approved: false,
  provider: "disabled",           // "disabled", "whop" or "contra"
  whopPlanId: "",                 // public plan_... from Whop Dashboard
  contraPaymentUrl: ""           // public https://contra.com/... payment link
});
