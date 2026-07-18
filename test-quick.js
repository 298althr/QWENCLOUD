const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("http://47.84.106.210:3001/", { waitUntil: "networkidle", timeout: 15000 });
  await p.waitForTimeout(2000);
  const body = await p.textContent("body");
  const checks = ["SAF", "Routing", "Anomaly", "Pipeline"];
  checks.forEach(c => console.log(c + ":", body.toLowerCase().includes(c.toLowerCase())));
  console.log("---");
  const btns = await p.$$eval("button", e => e.length);
  const links = await p.$$eval("a", e => e.length);
  console.log("Buttons:", btns, "Links:", links);
  console.log("Body length:", body.length);
  
  // Check monitoring page
  const p2 = await b.newPage();
  await p2.goto("http://47.84.106.210:3001/monitoring", { waitUntil: "networkidle", timeout: 15000 });
  await p2.waitForTimeout(2000);
  const body2 = await p2.textContent("body");
  const monChecks = ["CPU", "RAM", "Disk", "RCA", "Causal"];
  monChecks.forEach(c => console.log("Monitoring " + c + ":", body2.toLowerCase().includes(c.toLowerCase())));
  console.log("Monitoring body length:", body2.length);
  
  await b.close();
})();
