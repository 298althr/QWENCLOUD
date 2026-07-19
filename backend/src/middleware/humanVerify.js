// backend/src/middleware/humanVerify.js
// Proof-of-Work human verification layer.
// Free, open-source, self-hosted anti-bot protection.
// Browser must compute a SHA-256 hash with N leading zero bytes.
// Takes ~100-300ms in a real browser, expensive for bots to mass-produce.

const crypto = require("crypto");

const DIFFICULTY = Number(process.env.HUMAN_POW_DIFFICULTY || 4); // 4 = ~65k attempts
const TOKEN_TTL_MS = Number(process.env.HUMAN_TOKEN_TTL_MS || 2 * 60 * 60 * 1000); // 2 hours
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 min to solve

const SECRET = process.env.JWT_SECRET || process.env.ALTHR_API_KEY || "althr-pow-fallback";

// In-memory store for issued challenges and valid tokens
const challenges = new Map();
const validTokens = new Map();

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of challenges) {
    if (now - val.issued > CHALLENGE_TTL_MS) challenges.delete(key);
  }
  for (const [key, val] of validTokens) {
    if (now > val.expires) validTokens.delete(key);
  }
}, 60000);

function signPayload(payload) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

function issueChallenge() {
  const salt = crypto.randomBytes(16).toString("hex");
  const issued = Date.now();
  const challengeId = crypto.randomBytes(8).toString("hex");
  const payload = `${challengeId}:${salt}:${issued}`;
  const signature = signPayload(payload);
  const challenge = `${payload}:${signature}`;

  challenges.set(challengeId, { salt, issued, signature });

  return {
    challenge,
    difficulty: DIFFICULTY,
    algorithm: "SHA-256",
    expires_in: CHALLENGE_TTL_MS,
  };
}

function verifySolution(challenge, nonce) {
  // Parse challenge
  const parts = challenge.split(":");
  if (parts.length !== 4) return { valid: false, reason: "Malformed challenge" };

  const [challengeId, salt, issuedStr, signature] = parts;
  const issued = Number(issuedStr);
  const payload = `${challengeId}:${salt}:${issuedStr}`;

  // Check signature
  const expectedSig = signPayload(payload);
  if (signature !== expectedSig) return { valid: false, reason: "Invalid signature" };

  // Check expiry
  if (Date.now() - issued > CHALLENGE_TTL_MS) {
    challenges.delete(challengeId);
    return { valid: false, reason: "Challenge expired" };
  }

  // Check challenge was actually issued by us
  const stored = challenges.get(challengeId);
  if (!stored) return { valid: false, reason: "Challenge not found or already used" };

  // Verify proof-of-work: SHA-256(challenge + nonce) must start with DIFFICULTY zero bytes
  const data = `${challenge}:${nonce}`;
  const hash = crypto.createHash("sha256").update(data).digest();

  for (let i = 0; i < DIFFICULTY; i++) {
    if (hash[i] !== 0) return { valid: false, reason: "Insufficient difficulty" };
  }

  // Challenge consumed
  challenges.delete(challengeId);

  // Issue token
  const tokenPayload = `${challengeId}:${Date.now()}:${TOKEN_TTL_MS}`;
  const tokenSig = signPayload(tokenPayload);
  const token = `${tokenPayload}:${tokenSig}`;

  validTokens.set(token, { expires: Date.now() + TOKEN_TTL_MS, challengeId });

  return { valid: true, token, expires_in: TOKEN_TTL_MS };
}

function isTokenValid(token) {
  if (!token) return false;
  const entry = validTokens.get(token);
  if (!entry) return false;
  if (Date.now() > entry.expires) {
    validTokens.delete(token);
    return false;
  }

  // Verify signature
  const parts = token.split(":");
  if (parts.length !== 4) return false;
  const [challengeId, issuedStr, ttlStr, sig] = parts;
  const expectedSig = signPayload(`${challengeId}:${issuedStr}:${ttlStr}`);
  if (sig !== expectedSig) return false;

  return true;
}

// Endpoints that don't need human verification
const HUMAN_PUBLIC_ENDPOINTS = new Set([
  "/api/health",
  "/api/alibaba/health",
  "/api/alibaba/instance",
  "/api/human/challenge",
  "/api/human/verify",
  "/api/deployments/webhook",
]);

function humanVerifyMiddleware(req, res, next) {
  // Skip if disabled
  if (process.env.HUMAN_VERIFY_DISABLED === "true") return next();

  // Skip public endpoints
  if (HUMAN_PUBLIC_ENDPOINTS.has(req.path)) return next();

  // Check for token in header or cookie
  const token = req.headers["x-human-token"] || req.cookies?.human_token;

  if (isTokenValid(token)) {
    return next();
  }

  // No valid token
  return res.status(403).json({
    error: "Human verification required",
    code: "HUMAN_VERIFY_REQUIRED",
    challenge_endpoint: "/api/human/challenge",
    verify_endpoint: "/api/human/verify",
  });
}

module.exports = {
  issueChallenge,
  verifySolution,
  isTokenValid,
  humanVerifyMiddleware,
};
