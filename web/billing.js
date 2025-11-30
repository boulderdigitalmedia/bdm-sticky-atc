// web/billing.js
import { BillingInterval } from "@shopify/shopify-api";

export const BILLING_PLAN_NAME = "Sticky Add-to-Cart Bar Pro";

export const billingConfig = {
  [BILLING_PLAN_NAME]: {
    amount: 4.99,
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    trialDays: 14,
  },
};
