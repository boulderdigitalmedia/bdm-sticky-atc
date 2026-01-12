(function () {
  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  const productForm = document.querySelector('form[action="/cart/add"]');
  if (!productForm) return;

  const variantSelect = productForm.querySelector('select[name="id"]');
  const submitBtn = productForm.querySelector('[type="submit"]');
  const themePrice = document.querySelector('[data-product-price], .price');

  const stickyVariant = document.getElementById("bdm-variant");
  const stickyQty = document.getElementById("bdm-qty");
  const stickyATC = document.getElementById("bdm-atc");
  const stickyTitle = document.getElementById("bdm-title");
  const stickyPrice = document.getElementById("bdm-price");

  /* ---------- Populate title ---------- */
  const titleEl = document.querySelector("h1");
  if (titleEl) stickyTitle.textContent = titleEl.textContent;

  /* ---------- Populate variants ---------- */
  if (variantSelect) {
    variantSelect.querySelectorAll("option").forEach(opt => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.textContent;
      stickyVariant.appendChild(o);
    });

    stickyVariant.value = variantSelect.value;

    stickyVariant.addEventListener("change", () => {
      variantSelect.value = stickyVariant.value;
      variantSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
  } else {
    stickyVariant.style.display = "none";
  }

  /* ---------- Sync price ---------- */
  if (themePrice) {
    stickyPrice.textContent = themePrice.textContent;

    new MutationObserver(() => {
      stickyPrice.textContent = themePrice.textContent;
    }).observe(themePrice, { childList: true, subtree: true });
  }

  /* ---------- Add to cart ---------- */
  stickyATC.addEventListener("click", () => {
    let qtyInput = productForm.querySelector('input[name="quantity"]');
    if (!qtyInput) {
      qtyInput = document.createElement("input");
      qtyInput.type = "hidden";
      qtyInput.name = "quantity";
      productForm.appendChild(qtyInput);
    }

    qtyInput.value = stickyQty.value;
    submitBtn.click();
  });

  /* ---------- Show on scroll ---------- */
  const triggerPoint = productForm.getBoundingClientRect().bottom + window.scrollY;

  window.addEventListener("scroll", () => {
    if (window.scrollY > triggerPoint) {
      bar.classList.add("visible");
      bar.setAttribute("aria-hidden", "false");
    } else {
      bar.classList.remove("visible");
      bar.setAttribute("aria-hidden", "true");
    }
  });
})();
