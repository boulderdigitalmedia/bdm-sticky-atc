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
const HOST = process.env.HOST; // your Render app URL

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// ================= Health Check =================
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// ================= Shopify OAuth =================

// Step 1: Redirect to Shopify for install
app.get("/auth", (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send("Missing shop parameter");

  // Respond 200 OK first (fix for Shopify automated install check)
  res.status(200);

  const redirectUri = `${HOST}/auth/callback`;
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${API_KEY}&scope=${SCOPES}&redirect_uri=${redirectUri}&state=nonce123&grant_options[]=per-user`;

  res.redirect(installUrl);
});

// Step 2: OAuth callback
app.get("/auth/callback", async (req, res) => {
  const { shop, code, hmac } = req.query;

  // Validate HMAC
  const map = Object.assign({}, req.query);
  delete map["hmac"];
  const message = Object.keys(map)
    .sort()
    .map((key) => `${key}=${map[key]}`)
    .join("&");

  const generatedHash = crypto
    .createHmac("sha256", API_SECRET)
    .update(message)
    .digest("hex");

  if (generatedHash !== hmac) return res.status(400).send("HMAC validation failed");

  // Exchange code for access token
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: API_KEY, client_secret: API_SECRET, code }),
  });

  const data = await response.json();
  const accessToken = data.access_token;

  // Store accessToken in a cookie (demo only; in production use DB)
  res.cookie("shop", shop, { maxAge: 900000 });
  res.cookie("accessToken", accessToken, { maxAge: 900000 });

  // Inject ScriptTag
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

  res.send("App installed and sticky bar injected! ✅");
});

// ================= Embedded Admin =================
app.get("/apps", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Root health check
app.get("/", (req, res) => res.send("Sticky Add-to-Cart Bar app is running ✅"));

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
