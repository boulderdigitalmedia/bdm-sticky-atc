import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import fetch from "node-fetch";
import crypto from "crypto";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// Shopify environment variables
const API_KEY = process.env.SHOPIFY_API_KEY;
const API_SECRET = process.env.SHOPIFY_API_SECRET;
const SCOPES = process.env.SCOPES || "write_script_tags,read_products";
const HOST = process.env.HOST || "https://sticky-add-to-cart-bar-pro.onrender.com";

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// ================= Health Check =================
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// ================= Root Route =================
// Redirect to /auth for embedded app
app.get("/", (req, res) => {
  const { shop, host } = req.query;
  if (!shop || !host)
    return res
      .status(400)
      .send("Missing shop or host query parameters in request");

  // Redirect to /auth with shop and host
  const redirectUrl = `/auth?shop=${shop}&host=${encodeURIComponent(host)}`;
  res.redirect(redirectUrl);
});

// ================= Shopify OAuth =================

// Step 1: Redirect merchant to Shopify for install
app.get("/auth", (req, res) => {
  const { shop, host } = req.query;
  if (!shop || !host) return res.status(400).send("Missing shop or host");

  const redirectUri = `${HOST}/auth/callback`;
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${API_KEY}&scope=${SCOPES}&redirect_uri=${redirectUri}&state=${host}&grant_options[]=per-user`;

  res.redirect(installUrl);
});

// Step 2: OAuth callback
app.get("/auth/callback", async (req, res) => {
  const { shop, code, hmac, state, host } = req.query;

  if (!shop || !code || !hmac)
    return res.status(400).send("Required parameters missing");

  // --- Validate HMAC ---
  const map = { ...req.query };
  delete map.hmac;
  const message = Object.keys(map)
    .sort()
    .map((key) => `${key}=${map[key]}`)
    .join("&");

  const generatedHash = crypto
    .createHmac("sha256", API_SECRET)
    .update(message)
    .digest("hex");

  if (generatedHash !== hmac)
    return res.status(400).send("HMAC validation failed");

  try {
    // --- Exchange code for access token ---
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: API_KEY,
        client_secret: API_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) throw new Error("Missing access token");

    // --- Store token (demo only; use DB for production) ---
    res.cookie("shop", shop, { maxAge: 900000 });
    res.cookie("accessToken", accessToken, { maxAge: 900000 });

    // --- Inject Sticky Bar ScriptTag ---
    await fetch(`https://${shop}/admin/api/2025-01/script_tags.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        script_tag: {
          event: "onload",
          src: `${HOST}/public/sticky-bar.js`,
        },
      }),
    });

    // --- Redirect back into embedded app inside Shopify ---
    const redirectUrl = `https://admin.shopify.com/store/${shop.replace(
      ".myshopify.com",
      ""
    )}/apps/sticky-add-to-cart-bar-pro?host=${encodeURIComponent(host)}`;

    res.redirect(redirectUrl);
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.status(500).send("App installation failed. Check your server logs.");
  }
});

// ================= Embedded App Home =================
app.get("/apps", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ================= Server Root =================
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
