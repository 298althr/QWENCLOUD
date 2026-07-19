"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, CheckCircle2, AlertCircle, Fingerprint } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000/api";

export default function VerifyPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "fetching" | "computing" | "verifying" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // If already verified, redirect to dashboard
    const token = localStorage.getItem("althr_human_token");
    if (token) {
      router.push("/dashboard");
      return;
    }
    startVerification();
  }, []);

  async function startVerification() {
    try {
      setStatus("fetching");
      setError("");

      // Step 1: Get challenge from backend
      const res = await fetch(`${API_BASE}/human/challenge`);
      if (!res.ok) throw new Error("Failed to fetch challenge");
      const { challenge, difficulty, algorithm } = await res.json();

      // Step 2: Compute proof-of-work using Web Worker
      setStatus("computing");
      setProgress(0);
      setAttempts(0);

      const workerCode = `
        self.onmessage = function(e) {
          const { challenge, difficulty } = e.data;
          const target = new Uint8Array(difficulty);
          let nonce = 0;
          const batchSize = 5000;
          const startTime = Date.now();

          function computeBatch() {
            for (let i = 0; i < batchSize; i++) {
              const data = new TextEncoder().encode(challenge + ":" + nonce);
              crypto.subtle.digest("SHA-256", data).then(hash => {
                const bytes = new Uint8Array(hash);
                let valid = true;
                for (let j = 0; j < difficulty; j++) {
                  if (bytes[j] !== 0) { valid = false; break; }
                }
                if (valid) {
                  const elapsed = Date.now() - startTime;
                  self.postMessage({ found: true, nonce, attempts: nonce, elapsed });
                } else if (nonce % 10000 === 0) {
                  self.postMessage({ found: false, attempts: nonce });
                }
              });
              nonce++;
            }
            // Schedule next batch if not found
            setTimeout(computeBatch, 0);
          }
          computeBatch();
        };
      `;

      const blob = new Blob([workerCode], { type: "application/javascript" });
      const worker = new Worker(URL.createObjectURL(blob));
      workerRef.current = worker;

      worker.onmessage = async (e) => {
        if (e.data.found) {
          setAttempts(e.data.attempts);
          setStatus("verifying");
          worker.terminate();

          // Step 3: Submit solution to backend
          try {
            const verifyRes = await fetch(`${API_BASE}/human/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ challenge, nonce: String(e.data.nonce) }),
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
              router.push("/dashboard");
            }, 1000);
          } catch (err: any) {
            setStatus("error");
            setError(err.message);
          }
        } else {
          setAttempts(e.data.attempts);
          setProgress(Math.min((e.data.attempts / 100000) * 100, 95));
        }
      };

      worker.postMessage({ challenge, difficulty });
    } catch (err: any) {
      setStatus("error");
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-xl p-8 md:p-10">
          {/* Glow effect */}
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
                ) : (
                  <Fingerprint className="w-8 h-8 text-blue-400 animate-pulse" />
                )}
              </div>
            </div>

            {/* Title */}
            <h1 className="text-xl font-semibold text-white text-center mb-2">
              Human Verification
            </h1>
            <p className="text-sm text-white/50 text-center mb-8">
              {status === "fetching" && "Initializing challenge..."}
              {status === "computing" && "Solving proof-of-work puzzle..."}
              {status === "verifying" && "Verifying solution..."}
              {status === "done" && "Verified! Redirecting..."}
              {status === "error" && "Verification failed"}
              {status === "idle" && "Preparing..."}
            </p>

            {/* Progress bar */}
            {(status === "computing" || status === "verifying") && (
              <div className="mb-4">
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${status === "verifying" ? 100 : progress}%` }}
                  />
                </div>
                {status === "computing" && (
                  <p className="text-xs text-white/30 text-center mt-2">
                    {attempts.toLocaleString()} hashes computed
                  </p>
                )}
              </div>
            )}

            {/* Spinner */}
            {(status === "fetching" || status === "verifying") && (
              <div className="flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-white/40" />
              </div>
            )}

            {/* Error */}
            {status === "error" && (
              <div className="space-y-4">
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
                <button
                  onClick={startVerification}
                  className="w-full rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium py-3 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Done */}
            {status === "done" && (
              <div className="flex justify-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-pulse" />
              </div>
            )}

            {/* Info */}
            {status !== "error" && status !== "done" && (
              <div className="mt-6 flex items-center gap-2 justify-center">
                <ShieldCheck className="w-4 h-4 text-white/20" />
                <span className="text-xs text-white/30">Proof-of-Work Anti-Bot Protection</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-white/20 mt-6">
          ALTHR Autopilot — Human Verification Layer
        </p>
      </div>
    </div>
  );
}
