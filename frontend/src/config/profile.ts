// frontend/src/config/profile.ts
// Editable profile data for the top-bar profile dropdown.
// For hackathon demos, update these values directly; for production, move to env vars.

export const USER_PROFILE = {
  name: process.env.NEXT_PUBLIC_USER_NAME || "Sav Dev",
  role: process.env.NEXT_PUBLIC_USER_ROLE || "Founder & Systems Architect",
  avatar: process.env.NEXT_PUBLIC_USER_AVATAR || "",
  email: process.env.NEXT_PUBLIC_USER_EMAIL || "sav@althr.dev",
  bio: process.env.NEXT_PUBLIC_USER_BIO ||
    "Building ALTHR Autopilot — an AI-powered, multi-agent operations platform with DRE reasoning, SAF guardrails, and self-healing infrastructure.",
  location: process.env.NEXT_PUBLIC_USER_LOCATION || "Singapore / APAC",
  portfolioUrl: process.env.NEXT_PUBLIC_USER_PORTFOLIO || "https://github.com/298althr",
  resume: {
    headline: "AI Systems & Cloud Infrastructure Engineer",
    summary:
      "Full-stack systems engineer specializing in autonomous operations, AI orchestration, and cloud infrastructure. Creator of ALTHR Autopilot for the Qwen Cloud Hackathon — a real-time monitoring, decision intelligence, and deployment engine built on Alibaba Cloud ECS.",
    highlights: [
      "Built ALTHR Autopilot: AI agent platform with 7-layer SAF, DRE/DREV/CRDS pipelines",
      "Deployed end-to-end stack on Alibaba Cloud ECS using Docker Compose",
      "Implemented real-time monitoring, anomaly detection, and self-healing remediation",
      "Designed compliance framework, audit logging, and multi-model AI routing",
    ],
  },
};
