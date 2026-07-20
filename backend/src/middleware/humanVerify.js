// backend/src/middleware/humanVerify.js
// Proof-of-Work human verification layer.
// Free, open-source, self-hosted anti-bot protection.
// Browser must compute a SHA-256 hash with N leading zero bytes.
// Takes ~100-300ms in a real browser, expensive for bots to mass-produce.

const crypto = require("crypto");

// DIFFICULTY = number of leading zero BYTES required in the SHA-256 hash.
// Each byte of difficulty = 256x harder (8 bits). difficulty=2 -> ~65k avg attempts (~100-300ms in browser).
// difficulty=3 -> ~16.7M avg attempts (~10-30s). difficulty=4 -> ~4.3B avg attempts (infeasible in browser).
const DIFFICULTY = Number(process.env.HUMAN_POW_DIFFICULTY || 2); // 2 = ~65k attempts
const TOKEN_TTL_MS = Number(process.env.HUMAN_TOKEN_TTL_MS || 2 * 60 * 60 * 1000); // 2 hours
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 min to solve

const SECRET = process.env.JWT_SECRET || process.env.ALTHR_API_KEY || "althr-pow-fallback";

// In-memory store for issued challenges (tokens are stateless — verified by signature)
const challenges = new Map();

// Periodic cleanup for challenges only
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of challenges) {
    if (now - val.issued > CHALLENGE_TTL_MS) challenges.delete(key);
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

function verifySolution(challenge, nonce, gestureData) {
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

  // --- Slide gesture validation (anti-bot hardening) ---
  if (gestureData) {
    const { startTime, endTime, points } = gestureData;
    const slideDuration = endTime - startTime;

    // Must take between 300ms and 10s (humans take time to slide)
    if (slideDuration < 300) return { valid: false, reason: "Slide too fast — are you a bot?" };
    if (slideDuration > 10000) return { valid: false, reason: "Slide too slow — challenge expired" };

    // Must have enough movement points (humans produce many small mouse events)
    if (!points || points.length < 5) return { valid: false, reason: "Insufficient interaction data" };

    // Check movement entropy: bots move in perfectly straight lines, humans don't
    // Calculate variance in Y-axis deviation from the best-fit line
    if (points.length >= 10) {
      const n = points.length;
      const xs = points.map(p => p.x);
      const ys = points.map(p => p.y);
      const xMean = xs.reduce((a, b) => a + b, 0) / n;
      const yMean = ys.reduce((a, b) => a + b, 0) / n;

      // Linear regression slope
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) {
        num += (xs[i] - xMean) * (ys[i] - yMean);
        den += (xs[i] - xMean) ** 2;
      }
      const slope = den === 0 ? 0 : num / den;
      const intercept = yMean - slope * xMean;

      // Calculate residual variance (how much actual movement deviates from a straight line)
      let residualSum = 0;
      for (let i = 0; i < n; i++) {
        const predicted = slope * xs[i] + intercept;
        residualSum += (ys[i] - predicted) ** 2;
      }
      const residualVariance = residualSum / n;

      // Humans have natural jitter — residual variance should be > 0.5 pixels
      // Bots that automate mouse moves tend to have near-zero variance
      if (residualVariance < 0.5) {
        return { valid: false, reason: "Movement pattern too perfect — are you a bot?" };
      }
    }

    // Check velocity profile: humans accelerate and decelerate, bots often move at constant speed
    if (points.length >= 6) {
      const velocities = [];
      for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        const dt = points[i].t - points[i - 1].t || 1;
        velocities.push(Math.sqrt(dx * dx + dy * dy) / dt);
      }
      // Check that velocity varies (not constant)
      const vMean = velocities.reduce((a, b) => a + b, 0) / velocities.length;
      let vVar = 0;
      for (const v of velocities) vVar += (v - vMean) ** 2;
      vVar /= velocities.length;
      // If velocity variance is near zero, it's likely a bot
      if (vMean > 0 && vVar / (vMean * vMean) < 0.01) {
        return { valid: false, reason: "Movement speed too uniform — are you a bot?" };
      }
    }
  }

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

  // Token is stateless — no need to store in memory.
  // isTokenValid() verifies the HMAC signature and checks expiry from the token payload itself.

  return { valid: true, token, expires_in: TOKEN_TTL_MS };
}

function isTokenValid(token) {
  if (!token) return false;

  // Stateless verification: check HMAC signature + expiry from token payload
  const parts = token.split(":");
  if (parts.length !== 4) return false;
  const [challengeId, issuedStr, ttlStr, sig] = parts;

  // Verify signature
  const expectedSig = signPayload(`${challengeId}:${issuedStr}:${ttlStr}`);
  if (sig !== expectedSig) return false;

  // Check expiry: issued + ttl must be in the future
  const issued = Number(issuedStr);
  const ttl = Number(ttlStr);
  if (Date.now() > issued + ttl) return false;

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
  if (HUMAN_PUBLIC_ENDPOINTS.has(req.baseUrl + req.path)) return next();

  // Check for token in header or cookie (cookie name must match frontend)
  const token = req.headers["x-human-token"] || req.cookies?.althr_human_token || req.cookies?.human_token;

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
