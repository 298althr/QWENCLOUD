"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, CheckCircle2, AlertCircle, Fingerprint, RefreshCw, ArrowRight, ShieldCheck } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000/api";

type Status = "idle" | "fetching" | "computing" | "verifying" | "done" | "error";

export default function VerifyPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [isBot, setIsBot] = useState(false);
  const [slideProgress, setSlideProgress] = useState(0);
  const [slideComplete, setSlideComplete] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  // Slide gesture refs
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartTime = useRef(0);
  const gesturePoints = useRef<{ x: number; y: number; t: number }[]>([]);
  const maxDragX = useRef(0);

  // Bot detection
  useEffect(() => {
    const w = window as any;
    const nav = navigator as any;
    const botSignals = [
      w.__playwright,
      w.__pw_manual,
      nav.webdriver === true,
      nav.webdriver !== undefined && nav.webdriver !== false,
      w.__selenium_unwrapped,
      w.__webdriver_evaluate,
      w.__driver_evaluate,
      w.__webdriver_script_function,
      w.__driver_script_function,
      nav.languages === undefined,
      /HeadlessChrome/.test(nav.userAgent),
      /playwright/i.test(nav.userAgent),
    ];
    if (botSignals.some(Boolean)) {
      setIsBot(true);
    }
  }, []);

  // Slide gesture handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (slideComplete || status !== "idle") return;
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartTime.current = Date.now();
    gesturePoints.current = [{ x: e.clientX, y: e.clientY, t: Date.now() }];
    maxDragX.current = 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [slideComplete, status]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();

    const track = trackRef.current;
    if (!track) return;
    const trackWidth = track.offsetWidth;
    const handleWidth = 56;
    const maxOffset = trackWidth - handleWidth;

    const delta = e.clientX - dragStartX.current;
    const clamped = Math.max(0, Math.min(delta, maxOffset));
    setSlideProgress((clamped / maxOffset) * 100);
    maxDragX.current = clamped;

    gesturePoints.current.push({ x: e.clientX, y: e.clientY, t: Date.now() });

    if (clamped >= maxOffset * 0.95) {
      isDragging.current = false;
      setSlideComplete(true);
      setSlideProgress(100);
      gesturePoints.current.push({ x: e.clientX, y: e.clientY, t: Date.now() });
      startVerification();
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (!slideComplete) {
      setSlideProgress(0);
      gesturePoints.current = [];
    }
  }, [slideComplete]);

  async function startVerification() {
    try {
      setStatus("fetching");
      setError("");

      const res = await fetch(`${API_BASE}/human/challenge`);
      if (!res.ok) throw new Error("Failed to fetch challenge");
      const { challenge, difficulty } = await res.json();

      setStatus("computing");

      const workerCode = `
var K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];
function rotr(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }
function sha256Bytes(msg) {
  var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  var len = msg.length; var bitLen = len * 8;
  var paddedLen = (((len + 9 + 63) >> 6) << 6);
  var data = new Uint8Array(paddedLen); data.set(msg); data[len] = 0x80;
  data[paddedLen - 4] = (bitLen >>> 24) & 0xff; data[paddedLen - 3] = (bitLen >>> 16) & 0xff;
  data[paddedLen - 2] = (bitLen >>> 8) & 0xff; data[paddedLen - 1] = bitLen & 0xff;
  var W = new Array(64);
  for (var i = 0; i < paddedLen; i += 64) {
    for (var t = 0; t < 16; t++) { W[t] = ((data[i + t*4] << 24) | (data[i + t*4 + 1] << 16) | (data[i + t*4 + 2] << 8) | data[i + t*4 + 3]) >>> 0; }
    for (var t = 16; t < 64; t++) { var s0 = rotr(W[t-15], 7) ^ rotr(W[t-15], 18) ^ (W[t-15] >>> 3); var s1 = rotr(W[t-2], 17) ^ rotr(W[t-2], 19) ^ (W[t-2] >>> 10); W[t] = (W[t-16] + s0 + W[t-7] + s1) >>> 0; }
    var a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
    for (var t = 0; t < 64; t++) { var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25); var ch = (e & f) ^ (~e & g); var temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0; var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22); var maj = (a & b) ^ (a & c) ^ (b & c); var temp2 = (S0 + maj) >>> 0; h=g; g=f; f=e; e=(d+temp1)>>>0; d=c; c=b; b=a; a=(temp1+temp2)>>>0; }
    H[0]=(H[0]+a)>>>0;H[1]=(H[1]+b)>>>0;H[2]=(H[2]+c)>>>0;H[3]=(H[3]+d)>>>0;H[4]=(H[4]+e)>>>0;H[5]=(H[5]+f)>>>0;H[6]=(H[6]+g)>>>0;H[7]=(H[7]+h)>>>0;
  }
  var out = new Uint8Array(32);
  for (var i = 0; i < 8; i++) { out[i*4] = (H[i] >>> 24) & 0xff; out[i*4+1] = (H[i] >>> 16) & 0xff; out[i*4+2] = (H[i] >>> 8) & 0xff; out[i*4+3] = H[i] & 0xff; }
  return out;
}
function strToBytes(s) {
  var arr = [];
  for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); if (c < 0x80) arr.push(c); else if (c < 0x800) { arr.push(0xc0 | (c >> 6)); arr.push(0x80 | (c & 0x3f)); } else { arr.push(0xe0 | (c >> 12)); arr.push(0x80 | ((c >> 6) & 0x3f)); arr.push(0x80 | (c & 0x3f)); } }
  return new Uint8Array(arr);
}
self.onmessage = function(e) {
  var challenge = e.data.challenge; var difficulty = e.data.difficulty;
  var nonce = 0; var startTime = Date.now(); var batchSize = 2000;
  function computeBatch() {
    for (var i = 0; i < batchSize; i++) {
      var data = strToBytes(challenge + ":" + nonce); var hash = sha256Bytes(data); var valid = true;
      for (var j = 0; j < difficulty; j++) { if (hash[j] !== 0) { valid = false; break; } }
      if (valid) { self.postMessage({ found: true, nonce: nonce }); return; }
      nonce++;
    }
    self.postMessage({ found: false }); setTimeout(computeBatch, 0);
  }
  computeBatch();
};
      `;

      const blob = new Blob([workerCode], { type: "application/javascript" });
      const worker = new Worker(URL.createObjectURL(blob));
      workerRef.current = worker;

      worker.onmessage = async (e) => {
        if (e.data.found) {
          setStatus("verifying");
          worker.terminate();

          const gestureData = {
            startTime: dragStartTime.current,
            endTime: Date.now(),
            points: gesturePoints.current,
          };

          try {
            const verifyRes = await fetch(`${API_BASE}/human/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ challenge, nonce: String(e.data.nonce), gestureData }),
            });

            if (!verifyRes.ok) {
              const err = await verifyRes.json().catch(() => ({ error: "Verification failed" }));
              throw new Error(err.reason || err.error || "Verification failed");
            }

            const { token } = await verifyRes.json();
            localStorage.setItem("althr_human_token", token);
            document.cookie = `althr_human_token=${token}; path=/; max-age=7200; SameSite=Lax`;
            setStatus("done");

            setTimeout(() => {
              window.location.href = "/dashboard";
            }, 1000);
          } catch (err: any) {
            setStatus("error");
            setError(err.message);
            setSlideComplete(false);
            setSlideProgress(0);
          }
        }
      };

      worker.postMessage({ challenge, difficulty });
    } catch (err: any) {
      setStatus("error");
      setError(err.message);
      setSlideComplete(false);
      setSlideProgress(0);
    }
  }

  const isWorking = status === "fetching" || status === "computing" || status === "verifying";

  if (isBot) {
    return (
      <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="relative rounded-3xl overflow-hidden border border-red-500/20 bg-white/5 backdrop-blur-xl p-8 md:p-10">
            <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-red-500/10 blur-3xl" />
            <div className="relative">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
              </div>
              <h1 className="text-xl font-semibold text-white text-center mb-2">
                Human Access Only
              </h1>
              <p className="text-sm text-white/50 text-center mb-4">
                This site is protected by human verification.
                Automated browsers, bots, and testing frameworks (Playwright, Puppeteer, Selenium) are not allowed.
              </p>
              <p className="text-xs text-white/30 text-center">
                If you are a human, please open this page in a standard web browser.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-xl p-8 md:p-10">
          <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                {status === "done" ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                ) : status === "error" ? (
                  <AlertCircle className="w-8 h-8 text-red-400" />
                ) : isWorking ? (
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                ) : (
                  <Fingerprint className="w-8 h-8 text-blue-400" />
                )}
              </div>
            </div>

            {/* Title */}
            <h1 className="text-xl font-semibold text-white text-center mb-2">
              Human Verification
            </h1>
            <p className="text-sm text-white/50 text-center mb-6">
              {status === "idle" && "Slide to verify you are human"}
              {status === "fetching" && "Loading challenge..."}
              {status === "computing" && "Verifying..."}
              {status === "verifying" && "Confirming..."}
              {status === "done" && "Verified! Redirecting..."}
              {status === "error" && "Verification failed"}
            </p>

            {/* Slide-to-verify track */}
            {status === "idle" && (
              <div
                ref={trackRef}
                className="relative w-full h-14 rounded-2xl bg-white/5 border border-white/10 overflow-hidden select-none"
              >
                {/* Track label */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-sm text-white/30 font-medium">
                    {slideComplete ? "" : "Slide to verify"}
                  </span>
                </div>

                {/* Progress fill */}
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500/20 to-emerald-500/20 transition-all duration-75"
                  style={{ width: `${slideProgress}%` }}
                />

                {/* Draggable handle */}
                <div
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className={`absolute top-1 left-1 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none transition-transform ${
                    slideComplete ? "scale-90" : ""
                  }`}
                  style={{
                    transform: `translateX(${slideProgress * ((trackRef.current?.offsetWidth || 300) - 56) / 100}px)`,
                    transition: isDragging.current ? "none" : "transform 0.2s ease-out",
                  }}
                >
                  {slideComplete ? (
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  ) : (
                    <ArrowRight className="w-6 h-6 text-white" />
                  )}
                </div>
              </div>
            )}

            {/* Working state */}
            {isWorking && (
              <div className="space-y-3">
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
                    style={{ width: status === "verifying" ? "100%" : "60%" }}
                  />
                </div>
              </div>
            )}

            {/* Done state */}
            {status === "done" && (
              <div className="space-y-3">
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-emerald-300">
                    Verification successful
                  </p>
                </div>
              </div>
            )}

            {/* Error state */}
            {status === "error" && (
              <div className="space-y-4">
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
                <button
                  onClick={() => {
                    setStatus("idle");
                    setError("");
                    setSlideComplete(false);
                    setSlideProgress(0);
                    gesturePoints.current = [];
                  }}
                  className="w-full rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium py-3 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-white/20 mt-6">
          ALTHR Autopilot
        </p>
      </div>
    </div>
  );
}
