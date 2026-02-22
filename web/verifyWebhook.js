import crypto from "crypto";

export function verifyWebhook(req, res, next) {
  try {
    const hmacHeader = req.get("X-Shopify-Hmac-Sha256");

    if (!hmacHeader) {
      console.error("❌ Missing HMAC header");
      return res.sendStatus(401);
    }

    const secret = process.env.SHOPIFY_API_SECRET;

    // IMPORTANT:
    // Shopify expects comparison against RAW binary digest
    const generatedHash = crypto
      .createHmac("sha256", secret)
      .update(req.body) // raw buffer from express.raw
      .digest(); // <-- NO "base64" here

    const hmacBuffer = Buffer.from(hmacHeader, "base64");

    if (
      generatedHash.length !== hmacBuffer.length ||
      !crypto.timingSafeEqual(generatedHash, hmacBuffer)
    ) {
      console.error("❌ Invalid webhook signature");
      return res.sendStatus(401);
    }

    next();
  } catch (err) {
    console.error("Webhook verification error:", err);
    res.sendStatus(500);
  }
}