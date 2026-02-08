export function apiFetch(path) {
  const shop = window.Shopify?.shop;

  if (!shop) {
    console.warn("Shop missing from Shopify App Bridge");
  }

  const join = path.includes("?") ? "&" : "?";
  return fetch(`${path}${join}shop=${shop}`);
}
