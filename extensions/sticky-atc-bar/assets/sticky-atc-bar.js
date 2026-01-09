(async function () {
  const shop = Shopify.shop;
  const res = await fetch(`/api/settings?shop=${shop}`);
  const settings = await res.json();

  if (!settings.enabled) return;

  const path = window.location.pathname;

  if (settings.includePages) {
    const includes = JSON.parse(settings.includePages);
    if (!includes.some(p => path.includes(p))) return;
  }

  if (settings.excludePages) {
    const excludes = JSON.parse(settings.excludePages);
    if (excludes.some(p => path.includes(p))) return;
  }

  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  bar.style.background = settings.bgColor;
  bar.style.color = settings.textColor;
  bar.style[settings.position] = "0";

  window.addEventListener("scroll", () => {
    if (window.scrollY >= settings.showAfterScroll) {
      bar.classList.add("visible");
    } else {
      bar.classList.remove("visible");
    }
  });
})();
