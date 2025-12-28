(function () {
  console.log("✅ BDM STICKY ATC LOADED v2025-URL-VARIANT-FINAL");

  const PRODUCT = window.ShopifyAnalytics?.meta?.product;
  const VARIANTS = PRODUCT?.variants || [];
  if (!PRODUCT || !VARIANTS.length) return;

  function getVariantIdFromUrl() {
    try {
      return new URL(window.location.href).searchParams.get("variant");
    } catch {
      return null;
    }
  }

  function getActiveVariantId() {
    const urlVariant = getVariantIdFromUrl();
    if (urlVariant) return String(urlVariant);

    // Fallbacks only if URL is missing
    const idInput = document.querySelector('input[name="id"]');
    if (idInput?.value) return String(idInput.value);

    const checked = document.querySelector('input[name="id"][type="radio"]:checked');
    if (checked?.value) return String(checked.value);

    const select = document.querySelector('select[name="id"]');
    if (select?.value) return String(select.value);

    return String(VARIANTS[0].id);
  }

  function getQuantity() {
    const q = document.querySelector('input[name="quantity"]');
    return q ? Math.max(1, parseInt(q.value, 10) || 1) : 1;
  }

  async function addToCart(variantId, quantity) {
    console.log("🛒 BDM ADD TO CART", { variantId, quantity });

    const res = await fetch("/cart/add.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        id: String(variantId),
        quantity,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("❌ ATC failed:", err);
      throw new Error(err);
    }

    return res.json();
  }

  // ─── UI ──────────────────────────────────────────────

  function mount() {
    const bar = document.createElement("div");
    bar.style.cssText = `
      position:fixed;
      left:0;
      right:0;
      bottom:0;
      z-index:999999;
      background:#fff;
      border-top:1px solid #eee;
      padding:12px;
      box-shadow:0 -6px 22px rgba(0,0,0,0.08);
      display:none;
    `;

    const btn = document.createElement("button");
    btn.textContent = "Add to cart";
    btn.style.cssText = `
      width:100%;
      padding:14px 16px;
      border-radius:12px;
      border:none;
      background:#111;
      color:#fff;
      font-weight:700;
      font-size:16px;
      cursor:pointer;
    `;

    btn.addEventListener("click", async () => {
      const variantId = getActiveVariantId();
      const qty = getQuantity();

      console.log("✅ BDM CLICK → variant from URL:", variantId);

      try {
        await addToCart(variantId, qty);
      } catch (e) {
        alert("Could not add to cart. See console.");
      }
    });

    bar.appendChild(btn);
    document.body.appendChild(bar);

    window.addEventListener("scroll", () => {
      bar.style.display = window.scrollY > 300 ? "block" : "none";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
