const { chromium } = require("playwright");

const BASE = "http://47.84.106.210:3001";
const API_BASE = "http://47.84.106.210:3000/api";

const PAGES = [
  { path: "/", name: "Dashboard", expectations: ["SAF", "Routing", "Anomaly", "Pipeline"] },
  { path: "/monitoring", name: "Monitoring", expectations: ["CPU", "RAM", "Disk", "RCA", "Causal Chain"] },
  { path: "/containers", name: "Containers", expectations: ["container", "Container"] },
  { path: "/topology", name: "Topology", expectations: ["topology", "Topology", "node", "Node"] },
  { path: "/agent", name: "Agent Terminal", expectations: ["terminal", "Terminal", "agent", "Agent"] },
  { path: "/analytics", name: "Analytics", expectations: ["analytics", "Analytics", "chart"] },
  { path: "/decisions", name: "Decisions", expectations: ["decision", "Decision", "DRE"] },
  { path: "/approvals", name: "Approvals", expectations: ["approval", "Approval", "pending"] },
  { path: "/deployments", name: "Deployments", expectations: ["deployment", "Deployment"] },
  { path: "/compliance", name: "Compliance", expectations: ["compliance", "Compliance", "audit"] },
  { path: "/security", name: "Security", expectations: ["security", "Security"] },
  { path: "/files", name: "File Browser", expectations: ["file", "File", "directory"] },
  { path: "/memory", name: "Memory", expectations: ["memory", "Memory"] },
  { path: "/settings", name: "Settings", expectations: ["setting", "Setting", "config"] },
  { path: "/remote", name: "Remote SSH", expectations: ["SSH", "remote", "Remote"] },
  { path: "/terminal", name: "Terminal", expectations: ["terminal", "Terminal"] },
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  let totalIssues = 0;
  let totalPassed = 0;

  for (const page of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    const issues = [];
    const consoleErrors = [];
    const networkErrors = [];
    let title = "";

    p.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    p.on("pageerror", (err) => {
      issues.push({ type: "JS Error", severity: "high", detail: err.message });
    });
    p.on("requestfailed", (req) => {
      networkErrors.push(`${req.url()} - ${req.failure()?.errorText || "failed"}`);
    });

    try {
      const response = await p.goto(`${BASE}${page.path}`, { waitUntil: "domcontentloaded", timeout: 15000 });
      const status = response?.status() || 0;

      if (status !== 200) {
        issues.push({ type: "HTTP Status", severity: "high", detail: `Page returned ${status}` });
      }

      await p.waitForTimeout(3000);

      title = await p.title();
      const bodyText = await p.textContent("body").catch(() => "");
      const bodyLen = bodyText?.length || 0;

      if (bodyLen < 100) {
        issues.push({ type: "Empty Content", severity: "high", detail: `Body text only ${bodyLen} chars - page may be blank` });
      }

      for (const expected of page.expectations) {
        if (!bodyText || !bodyText.toLowerCase().includes(expected.toLowerCase())) {
          issues.push({ type: "Missing Content", severity: "medium", detail: `Expected text "${expected}" not found on page` });
        }
      }

      const buttons = await p.$$eval("button", els => els.length).catch(() => 0);
      const links = await p.$$eval("a", els => els.length).catch(() => 0);
      const inputs = await p.$$eval("input, textarea, select", els => els.length).catch(() => 0);

      if (buttons === 0 && links === 0 && inputs === 0) {
        issues.push({ type: "No Interactive Elements", severity: "medium", detail: "No buttons, links, or inputs found" });
      }

      const images = await p.$$eval("img", els => els.map(e => ({ src: e.src, alt: e.alt, naturalWidth: e.naturalWidth }))).catch(() => []);
      for (const img of images) {
        if (img.naturalWidth === 0) {
          issues.push({ type: "Broken Image", severity: "low", detail: `Image not loaded: ${img.src}` });
        }
        if (!img.alt) {
          issues.push({ type: "Accessibility", severity: "low", detail: `Image missing alt text: ${img.src}` });
        }
      }

      const headings = await p.$$eval("h1, h2, h3", els => els.length).catch(() => 0);
      if (headings === 0) {
        issues.push({ type: "Accessibility", severity: "low", detail: "No heading elements (h1-h3) found" });
      }

      const navLinks = await p.$$eval("nav a", els => els.map(e => ({ href: e.getAttribute("href"), text: e.textContent?.trim() }))).catch(() => []);
      for (const link of navLinks) {
        if (link.href && link.href.startsWith(BASE)) {
          const linkPath = link.href.replace(BASE, "");
          if (linkPath !== page.path && !PAGES.find(pg => pg.path === linkPath)) {
            issues.push({ type: "Broken Nav Link", severity: "low", detail: `Nav link "${link.text}" -> ${linkPath} not in known pages` });
          }
        }
      }

      const filteredConsole = consoleErrors.filter(e => !e.includes("_rsc") && !e.includes("prefetch") && !e.includes("Failed to fetch"));
      for (const err of filteredConsole.slice(0, 5)) {
        issues.push({ type: "Console Error", severity: "medium", detail: err.substring(0, 200) });
      }
      for (const err of networkErrors.slice(0, 5)) {
        if (!err.includes("favicon") && !err.includes("_rsc") && !err.includes("prefetch")) {
          issues.push({ type: "Network Error", severity: "medium", detail: err.substring(0, 200) });
        }
      }

      if (page.path === "/monitoring") {
        const rcaPanel = await p.textContent("body").catch(() => "");
        if (rcaPanel && !rcaPanel.toLowerCase().includes("rca")) {
          issues.push({ type: "RCA Panel Missing", severity: "high", detail: "RCA panel not found on monitoring page" });
        }
      }

    } catch (e) {
      issues.push({ type: "Navigation Error", severity: "high", detail: e.message.substring(0, 300) });
    }

    const passed = issues.length === 0;
    if (passed) totalPassed++;
    else totalIssues += issues.length;

    results.push({
      ...page,
      url: `${BASE}${page.path}`,
      title: title || "",
      issues,
      passed,
      issueCount: issues.length,
    });

    await ctx.close();
  }

  await browser.close();

  const report = generateHTML(results, totalPassed, totalIssues);
  require("fs").writeFileSync("audit-report.html", report);
  console.log(`Audit complete: ${totalPassed}/${results.length} pages passed, ${totalIssues} issues found`);
  console.log("Report written to audit-report.html");
}

function generateHTML(results, totalPassed, totalIssues) {
  const now = new Date().toISOString();
  const passRate = ((totalPassed / results.length) * 100).toFixed(1);

  const rows = results.map(r => {
    const statusClass = r.passed ? "pass" : "fail";
    const statusIcon = r.passed ? "&#10004;" : "&#10008;";
    const issueList = r.issues.map(i => `
      <div class="issue ${i.severity}">
        <span class="issue-type">${i.type}</span>
        <span class="issue-severity severity-${i.severity}">${i.severity}</span>
        <span class="issue-detail">${escapeHtml(i.detail)}</span>
      </div>`).join("");

    return `
      <tr class="${statusClass}">
        <td>${statusIcon}</td>
        <td><a href="${r.url}" target="_blank">${r.name}</a></td>
        <td><code>${r.path}</code></td>
        <td>${r.title}</td>
        <td class="issue-count">${r.issueCount}</td>
        <td>${issueList || "<span class='no-issues'>No issues</span>"}</td>
      </tr>`;
  }).join("");

  const highCount = results.reduce((acc, r) => acc + r.issues.filter(i => i.severity === "high").length, 0);
  const medCount = results.reduce((acc, r) => acc + r.issues.filter(i => i.severity === "medium").length, 0);
  const lowCount = results.reduce((acc, r) => acc + r.issues.filter(i => i.severity === "low").length, 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Frontend Audit Report - ALTHR Autopilot</title>
<style>
  :root {
    --bg: #0b0f1a; --card: #131826; --border: #1e2436; --text: #e2e8f0;
    --muted: #64748b; --pass: #22c55e; --fail: #ef4444; --warn: #f59e0b;
    --high: #ef4444; --medium: #f59e0b; --low: #3b82f6;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); padding: 24px; }
  h1 { font-size: 28px; margin-bottom: 8px; }
  .subtitle { color: var(--muted); margin-bottom: 24px; font-size: 14px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
  .stat-label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
  .stat-value { font-size: 32px; font-weight: 700; }
  .stat-value.pass { color: var(--pass); }
  .stat-value.fail { color: var(--fail); }
  .stat-value.warn { color: var(--warn); }
  table { width: 100%; border-collapse: collapse; background: var(--card); border-radius: 12px; overflow: hidden; border: 1px solid var(--border); }
  th { background: #1a2030; padding: 12px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); border-bottom: 1px solid var(--border); }
  td { padding: 12px 16px; border-bottom: 1px solid var(--border); vertical-align: top; font-size: 14px; }
  tr.pass td { background: rgba(34, 197, 94, 0.03); }
  tr.fail td { background: rgba(239, 68, 68, 0.03); }
  tr:last-child td { border-bottom: none; }
  a { color: #60a5fa; text-decoration: none; }
  a:hover { text-decoration: underline; }
  code { background: #1a2030; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
  .issue { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; padding: 6px 8px; border-radius: 6px; background: rgba(255,255,255,0.02); }
  .issue-type { font-weight: 600; min-width: 140px; font-size: 13px; }
  .issue-severity { font-size: 11px; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; font-weight: 600; min-width: 60px; text-align: center; }
  .severity-high { background: rgba(239,68,68,0.15); color: var(--high); }
  .severity-medium { background: rgba(245,158,11,0.15); color: var(--medium); }
  .severity-low { background: rgba(59,130,246,0.15); color: var(--low); }
  .issue-detail { flex: 1; font-size: 13px; color: var(--muted); word-break: break-word; }
  .no-issues { color: var(--pass); font-size: 13px; }
  .issue-count { text-align: center; font-weight: 700; }
  .footer { margin-top: 32px; color: var(--muted); font-size: 12px; text-align: center; }
</style>
</head>
<body>
  <h1>Frontend Audit Report</h1>
  <p class="subtitle">ALTHR Autopilot &middot; ${now} &middot; Target: ${BASE}</p>

  <div class="summary">
    <div class="stat-card">
      <div class="stat-label">Pages Audited</div>
      <div class="stat-value">${results.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Pages Passed</div>
      <div class="stat-value pass">${totalPassed}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Issues</div>
      <div class="stat-value fail">${totalIssues}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Pass Rate</div>
      <div class="stat-value ${passRate >= 80 ? 'pass' : passRate >= 50 ? 'warn' : 'fail'}">${passRate}%</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">High Severity</div>
      <div class="stat-value fail">${highCount}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Medium Severity</div>
      <div class="stat-value warn">${medCount}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Low Severity</div>
      <div class="stat-value" style="color: var(--low)">${lowCount}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th></th>
        <th>Page</th>
        <th>Path</th>
        <th>Title</th>
        <th>Issues</th>
        <th>Details</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="footer">
    Generated by Playwright Audit &middot; ALTHR Autopilot Track 4
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

run().catch(console.error);
