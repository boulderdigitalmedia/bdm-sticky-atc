router.post("/track", express.json(), async (req, res) => {
  try {
    const body = req.body || {};
    const { shop, event } = body;

    if (!shop || !event) {
      return res.status(400).json({ ok: false });
    }

    // Support both legacy + current payloads
    const data = body.data ?? body;

    const {
      productId,
      variantId,
      checkoutToken,
      sessionId
    } = data || {};

    const timestamp = new Date();

    // 1️⃣ Always record generic analytics
    await prisma.analyticsEvent.create({
      data: {
        shop,
        event,
        payload: data ?? {}
      }
    });

    // 2️⃣ Sticky events (dashboard)
    if (event.includes("sticky")) {
      await prisma.stickyEvent.create({
        data: {
          id: crypto.randomUUID(),
          shop,
          event,
          productId: productId ? String(productId) : null,
          variantId: variantId ? String(variantId) : null,
          quantity: null,
          price: null,
          timestamp
        }
      });
    }

    // 3️⃣ Sticky ATC intent (attribution)
    if (
      (event === "sticky_atc_click" || event === "sticky_atc_success") &&
      variantId &&
      sessionId
    ) {
      try {
        await prisma.stickyAtcEvent.create({
          data: {
            shop,
            productId: productId ? BigInt(String(productId)) : null,
            variantId: BigInt(String(variantId)),
            checkoutToken: checkoutToken || null,
            sessionId
          }
        });
      } catch (e) {
        console.warn("Sticky ATC intent skipped:", e.message);
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Track error", err);
    return res.status(500).json({ ok: false });
  }
});
