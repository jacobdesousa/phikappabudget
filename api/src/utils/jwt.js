const crypto = require("crypto");

function b64urlEncode(buf) {
  return Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(str) {
  const s = String(str).replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s + pad, "base64");
}

function signHs256(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const h = b64urlEncode(JSON.stringify(header));
  const p = b64urlEncode(JSON.stringify(payload));
  const data = `${h}.${p}`;
  const sig = crypto.createHmac("sha256", String(secret)).update(data).digest();
  return `${data}.${b64urlEncode(sig)}`;
}

function verifyHs256(token, secret) {
  const t = String(token ?? "");
  const parts = t.split(".");
  if (parts.length !== 3) return { ok: false, error: "Invalid token" };
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = crypto.createHmac("sha256", String(secret)).update(data).digest();
  const got = b64urlDecode(s);
  if (got.length !== expected.length) return { ok: false, error: "Invalid token" };
  if (!crypto.timingSafeEqual(got, expected)) return { ok: false, error: "Invalid token" };
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(p).toString("utf8"));
  } catch {
    return { ok: false, error: "Invalid token" };
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload?.exp && now >= payload.exp) return { ok: false, error: "Token expired" };
  return { ok: true, payload };
}

module.exports = { signHs256, verifyHs256, b64urlEncode, b64urlDecode };


