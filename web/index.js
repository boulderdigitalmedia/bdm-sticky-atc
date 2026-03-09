import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

import prisma from "./prisma.js";
import * as shopifyModule from "./shopify.js";

import settingsRouter from "./routes/settings.js";
import trackRouter from "./routes/track.js";
import stickyAnalyticsRouter from "./routes/stickyAnalytics.js";
import attributionRouter from "./routes/attribution.js";

console.log("🚀 INDEX FILE LOADED");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", true);

/* =========================================================
   COMPLIANCE WEBHOOK
========================================================= */

app.post(
  "/webhooks",
  express.raw({ type: "*/*" }),
  (req, res) => {
    const hmac = req.headers["x-shopify-hmac-sha256"];
    const secret = process.env.SHOPIFY_API_SECRET;

    const digest = crypto
      .createHmac("sha256", secret)
      .update(req.body)
      .digest("base64");

    if (digest !== hmac) {
      console.log("❌ Invalid webhook HMAC");
      return res.status(401).send("Invalid webhook");
    }

    console.log("✅ Valid compliance webhook received");
    return res.status(200).send("OK");
  }
);

/* =========================================================
   SHOPIFY HEAD VALIDATION
========================================================= */

app.head("*", (req, res) => {
  console.log("🧪 Shopify HEAD validation");
  res.status(200).end();
});

/* =========================================================
   REQUEST LOGGER
========================================================= */

app.use((req, res, next) => {
  console.log("🌍 Incoming:", req.method, req.originalUrl);
  next();
});

/* =========================================================
   WEBHOOK PROCESSOR
========================================================= */

app.post(
  "/webhooks/*",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    try {
      await shopifyModule.shopify.webhooks.process({
        rawBody: req.body.toString("utf8"),
        rawRequest: req,
        rawResponse: res,
      });
    } catch (error) {
      console.error("❌ Universal webhook failed:", error);
      return res.status(401).send("Webhook Error");
    }
  }
);

/* =========================================================
   CORS
========================================================= */

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Shopify-Shop-Domain"],
    credentials: true,
  })
);

app.options("*", cors());

/* =========================================================
   BODY PARSING
========================================================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   SHOPIFY INIT
========================================================= */

shopifyModule.initShopify(app);
const shopify = shopifyModule.shopify;

/* =========================================================
   🔐 OAUTH ROUTES (FIX)
========================================================= */

app.get("/auth", async (req, res) => {
  return shopify.auth.begin({
    shop: req.query.shop,
    callbackPath: "/auth/callback",
    isOnline: false,
    rawRequest: req,
    rawResponse: res,
  });
});

app.get("/auth/callback", async (req, res) => {
  try {
    const session = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    console.log("🔑 OAuth session received:", session.shop);

    await shopify.webhooks.register({ session });

    /* -------------------------
       CHECK BILLING
    -------------------------- */

    const billing = shopify.billing;

    const billingCheck = await billing.check({
      session,
      plans: ["Pro"], // MUST match Partner Dashboard plan name
      isTest: true    // remove in production
    });

    if (!billingCheck.hasActivePayment) {
      console.log("💳 No payment found — redirecting to charge");

      const confirmationUrl = await billing.request({
        session,
        plan: "Pro",
        isTest: true
      });

      return res.redirect(confirmationUrl);
    }

    console.log("💰 Billing already active");

    /* -------------------------
       LOAD APP
    -------------------------- */

    res.redirect(`/?shop=${session.shop}&host=${req.query.host}`);

  } catch (error) {
    console.error("❌ OAuth callback failed:", error);
    res.status(500).send("OAuth Error");
  }
});


/* =========================================================
   RE-REGISTER WEBHOOKS
========================================================= */

(async () => {
  const sessions = await shopify.config.sessionStorage.findSessionsByShop();

  for (const session of sessions || []) {
    if (!session.isOnline) {
      try {
        await shopify.webhooks.register({ session });
        console.log("📡 Re-registered webhooks for", session.shop);
      } catch (e) {
        console.error("⚠️ Failed webhook register:", session.shop, e);
      }
    }
  }
})();

/* =========================================================
   ROUTES
========================================================= */

app.use("/api/settings", settingsRouter);
app.use("/api/analytics", stickyAnalyticsRouter);

/* Shopify App Proxy Tracking */
app.use("/track", trackRouter);

/* Optional API access */
app.use("/api/track", trackRouter);

app.use("/attribution", attributionRouter);

/* =========================================================
   STATIC FILES
========================================================= */

app.use("/web", express.static(path.join(__dirname, "public")));

app.use(
  express.static(path.join(__dirname, "frontend", "dist"), {
    index: false,
  })
);

/* =========================================================
   DEBUG ROUTE
========================================================= */

app.get("/__debug/conversions", async (req, res) => {
  const rows = await prisma.stickyConversion.findMany({
    orderBy: { occurredAt: "desc" },
    take: 5,
  });

  res.json(rows);
});

/* =========================================================
   EMBEDDED APP LOADER
========================================================= */

app.use("/*", async (req, res, next) => {
  if (req.method !== "GET") return next();

  if (!req.query.host && req.query.embedded) {
    return res.status(200).send("Loading...");
  }

  const p = req.path || "";

  if (
    p.startsWith("/auth") ||
    p.startsWith("/webhooks") ||
    p.startsWith("/api") ||
    p.startsWith("/track") ||
    p.startsWith("/__debug")
  ) {
    return next();
  }

  if (!req.query.shop) {
    return res.status(200).send("OK");
  }

  let shop = shopify.utils.sanitizeShop(String(req.query.shop));
  if (!shop) return res.status(400).send("Invalid shop");

  let session = null;

  try {
    const sessions =
      await shopify.config.sessionStorage.findSessionsByShop(shop);

    session = Array.isArray(sessions)
      ? sessions.find((s) => !s.isOnline)
      : null;
  } catch (e) {
    console.error("Session lookup failed:", e);
  }

  if (!session) {
    const host = String(req.query.host || "");

    return res.status(200).send(`
      <html>
        <body>
          <script>
            window.top.location.href =
              "/auth?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}";
          </script>
        </body>
      </html>
    `);
  }

  const indexPath = path.join(__dirname, "frontend", "dist", "index.html");

  const apiKey = process.env.SHOPIFY_API_KEY || "";

  const html = fs
    .readFileSync(indexPath, "utf8")
    .replace(
      "</head>",
      `<script>window.__SHOPIFY_API_KEY__ = ${JSON.stringify(apiKey)};</script></head>`
    );

  res.send(html);
});

/* =========================================================
   START SERVER
========================================================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ App running on port ${PORT}`);
});