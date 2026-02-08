(() => {
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  document.addEventListener("DOMContentLoaded", () => {
    const bar = document.getElementById("bdm-sticky-atc");
    if (!bar) return;

    /* ================================
       ONLY SHOW ON PRODUCT PAGES
    ================================= */
    if (!location.pathname.includes("/products/")) {
      bar.setAttribute("hidden", "");
      return;
    }

    /* ================================
       SETTINGS
    ================================= */
    const showDesktop = bar.hasAttribute("data-enable-desktop");
    const showMobile = bar.hasAttribute("data-enable-mobile");
    const showOnScroll = bar.hasAttribute("data-show-on-scroll");
    const scrollOffset = parseInt(bar.dataset.scrollOffset || "250", 10);

    const showTitle = bar.hasAttribute("data-show-title");
    const showPrice = bar.hasAttribute("data-show-price");
    const showQty = bar.hasAttribute("data-show-qty");

    /* ================================
       DEVICE VISIBILITY
    ================================= */
    const isMobile = matchMedia("(max-width: 768px)").matches;
    if ((isMobile && !showMobile) || (!isMobile && !showDesktop)) {
      bar.setAttribute("hidden", "");
      return;
    }
    bar.removeAttribute("hidden");

    /* ================================
       SCROLL VISIBILITY
    ================================= */
    const updateScrollVisibility = () => {
      const visible = !showOnScroll || scrollY >= scrollOffset;
      bar.classList.toggle("is-visible", visible);
      bar.setAttribute("aria-hidden", String(!visible));
    };
    updateScrollVisibility();
    addEventListener("scroll", updateScrollVisibility);

    /* ================================
       PRODUCT FORM (SAFE)
    ================================= */
    const productForm =
      document.querySelector('form[action*="/cart/add"]') ||
      document.querySelector("product-form form");

    if (!productForm) return;

    const variantInput = productForm.querySelector('[name="id"]');
    if (!variantInput) return;

    /* ================================
       BAR ELEMENTS
    ================================= */
    const titleEl = bar.querySelector("#bdm-title");
    const priceEl = bar.querySelector("#bdm-price");
    const qtyWrapper = bar.querySelector(".bdm-qty");
    const qtyEl = bar.querySelector("#bdm-qty");
    const atcBtn = bar.querySelector("#bdm-atc");

    if (!atcBtn) return;
    atcBtn.dataset.originalText = atcBtn.textContent;

    if (titleEl) titleEl.style.display = showTitle ? "" : "none";
    if (priceEl) priceEl.style.display = showPrice ? "" : "none";
    if (qtyWrapper) qtyWrapper.style.display = showQty ? "inline-flex" : "none";

    /* ================================
       PRODUCT DATA
    ================================= */
    const handle = location.pathname.split("/products/")[1];
    if (!handle) return;

    fetch(`/products/${handle}.js`)
      .then(r => r.json())
      .then(product => {
        if (showTitle && titleEl) titleEl.textContent = product.title;

        const updateVariantUI = id => {
          const v = product.variants.find(v => v.id == id);
          if (!v) return;

          if (showPrice && priceEl) {
            priceEl.textContent = (v.price / 100).toLocaleString(undefined, {
              style: "currency",
              currency: product.currency || "USD"
            });
          }

          if (!v.available) {
            atcBtn.textContent = "Sold Out";
            atcBtn.disabled = true;
          } else {
            atcBtn.textContent = atcBtn.dataset.originalText;
            atcBtn.disabled = false;
          }
        };

        updateVariantUI(variantInput.value);
        variantInput.addEventListener("change", e =>
          updateVariantUI(e.target.value)
        );
      });

    /* ================================
       QTY — SINGLE SOURCE OF TRUTH
    ================================= */
    let currentQty = 1;
    if (qtyEl) qtyEl.value = currentQty;

    qtyEl?.addEventListener("change", () => {
      currentQty = Math.max(1, parseInt(qtyEl.value || "1", 10));
      qtyEl.value = currentQty;
    });

    bar.querySelectorAll(".bdm-qty-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        e.preventDefault();
        if (btn.dataset.action === "increase") currentQty++;
        if (btn.dataset.action === "decrease") {
          currentQty = Math.max(1, currentQty - 1);
        }
        qtyEl.value = currentQty;
      });
    });

    /* ================================
       SUBMIT-TIME QUANTITY INJECTION
       (CRITICAL — DO NOT REMOVE)
    ================================= */
    productForm.addEventListener(
      "submit",
      () => {
        let q = productForm.querySelector('[name="quantity"]');
        if (!q) {
          q = document.createElement("input");
          q.type = "hidden";
          q.name = "quantity";
          productForm.appendChild(q);
        }
        q.value = currentQty;
      },
      true
    );

    /* ================================
   ADD TO CART (SMART MODE)
================================= */
atcBtn.addEventListener("click", async e => {
  e.preventDefault();
  if (atcBtn.disabled) return;

  const drawer =
    document.querySelector("cart-drawer") ||
    document.getElementById("CartDrawer");

  // 🔹 If drawer exists → AJAX add (stay on page)
  if (drawer) {
    atcBtn.disabled = true;

    const fd = new FormData();
    fd.append("id", variantInput.value);
    fd.append("quantity", currentQty);

    const res = await fetch("/cart/add.js", {
      method: "POST",
      body: fd,
      headers: { Accept: "application/json" }
    });

    atcBtn.disabled = false;
    if (!res.ok) return;

    // Refresh drawer + icon
    const sections = ["cart-drawer", "cart-icon-bubble"];
    const sectionRes = await fetch(`/?sections=${sections.join(",")}`);
    const data = await sectionRes.json();

    if (data["cart-icon-bubble"]) {
      const bubble = document.getElementById("cart-icon-bubble");
      if (bubble) bubble.innerHTML = data["cart-icon-bubble"];
    }

    if (data["cart-drawer"]) {
      const doc = new DOMParser().parseFromString(
        data["cart-drawer"],
        "text/html"
      );
      const fresh =
        doc.querySelector("cart-drawer") ||
        doc.getElementById("CartDrawer");

      if (fresh) drawer.innerHTML = fresh.innerHTML;
    }

    drawer.classList.add("active");
    drawer.setAttribute("open", "");
    drawer.dispatchEvent(new Event("open", { bubbles: true }));

    return;
  }

  // 🔹 No drawer → native submit (redirect)
  productForm.requestSubmit();
});

