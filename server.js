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
const HOST = process.env.HOST; // e.g., https://sticky-add-to-cart-bar-pro.onrender.com

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// ================= Health Check =================
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// ================= Root =================
app.get("/", (req, res) => {
  const { shop, host } = req.query;
  if (!shop) return res.status(400).send("Missing shop parameter");
  const redirectUrl = `/auth?shop=${shop}&host=${encodeURIComponent(host || "")}`;
  res.redirect(redirectUrl);
});

// ================= OAuth Step 1 =================
app.get("/auth", (req, res) => {
  const { shop, host } = req.query;
  if (!shop) return res.status(400).send("Missing shop parameter");

  const redirectUri = `${HOST}/auth/callback`;
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${API_KEY}&scope=${SCOPES}&redirect_uri=${redirectUri}&state=${host || "nonce"}&grant_options[]=per-user`;

  res.redirect(installUrl);
});

// ================= OAuth Step 2: Callback =================
app.get("/auth/callback", async (req, res) => {
  try {
    const { shop, code, hmac, state } = req.query;
    if (!shop || !code || !hmac) {
      return res.status(400).send("Missing parameters");
    }

    // Validate HMAC
    const map = { ...req.query };
    delete map.hmac;
    const message = Object.keys(map)
      .sort()
      .map((key) => `${key}=${map[key]}`)
      .join("&");

    const generatedHash = crypto.createHmac("sha256", API_SECRET).update(message).digest("hex");
    if (generatedHash !== hmac) {
      return res.status(400).send("HMAC validation failed");
    }

    // Exchange code for access token
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

    if (!accessToken) {
      console.error("Access token fetch failed:", tokenData);
      return res.status(400).send("Failed to get access token");
    }

    // Inject sticky-bar ScriptTag
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

    // Redirect back to the embedded app view
    const redirectTo = `https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/apps/sticky-add-to-cart-bar-pro`;
    res.redirect(redirectTo);
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.status(500).send("Error during OAuth: " + err.message);
  }
});

// ================= Embedded App Route =================
app.get("/apps", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
