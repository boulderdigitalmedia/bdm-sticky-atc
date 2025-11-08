import express from "express";
import path from "path";
import fetch from "node-fetch";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.SHOPIFY_API_KEY;
const API_SECRET = process.env.SHOPIFY_API_SECRET;
const SCOPES = process.env.SCOPES || "write_script_tags,read_products";
const HOST = process.env.HOST; // e.g., https://sticky-add-to-cart-bar-pro.onrender.com

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from /public
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(express.json());

// Root route - Shopify app installation
app.get("/", (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).send("⚙️ Missing 'shop' parameter");
  res.redirect(`/auth?shop=${shop}`);
});

// Step 1: OAuth redirect
app.get("/auth", (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send("Missing shop parameter");

  const redirectUri = `${HOST}/auth/callback`;
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${API_KEY}&scope=${SCOPES}&redirect_uri=${redirectUri}&state=randomstring&grant_options[]=per-user`;
  res.redirect(installUrl);
});

// Step 2: OAuth callback
app.get("/auth/callback", async (req, res) => {
  const { shop, hmac, code } = req.query;
  if (!shop || !hmac || !code) return res.status(400).send("Missing required parameters");

  // Validate HMAC
  const params = { ...req.query };
  delete params.hmac;
  const message = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&");
  const generated = crypto.createHmac("sha256", API_SECRET).update(message).digest("hex");
  if (generated !== hmac) return res.status(400).send("HMAC validation failed");

  // Exchange code for access token
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: API_KEY, client_secret: API_SECRET, code }),
  });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  // Inject sticky-bar ScriptTag
  const scriptRes = await fetch(`https://${shop}/admin/api/2025-01/script_tags.json`, {
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

  if (scriptRes.ok) {
    res.send("✅ App installed! Sticky bar script injected.");
  } else {
    const err = await scriptRes.text();
    res.status(500).send(`❌ Failed to inject script tag: ${err}`);
  }
});

// Health check
app.get("/health", (_, res) => res.send("OK"));

app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
