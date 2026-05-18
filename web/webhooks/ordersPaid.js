// DEPRECATED — do not import.
//
// The active ORDERS_PAID webhook handler is `ordersPaid` in
// web/routes/webhooks.js, which is what web/shopify.js registers with
// Shopify. This file previously held an older implementation that wrote
// to a `stickyEvent` model that no longer exists in the schema.
//
// Kept as a no-op (rather than deleted) so any stale import path or
// build-tool glob does not break a deploy. Safe to delete once you've
// confirmed nothing references this module.

export async function ordersPaidHandler() {
  // intentionally empty
}
