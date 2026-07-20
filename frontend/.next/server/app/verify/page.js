(()=>{var e={};e.id=439,e.ids=[439],e.modules={72934:e=>{"use strict";e.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:e=>{"use strict";e.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:e=>{"use strict";e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},20399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},96537:(e,t,a)=>{"use strict";a.r(t),a.d(t,{GlobalError:()=>n.a,__next_app__:()=>h,originalPathname:()=>x,pages:()=>d,routeModule:()=>u,tree:()=>l}),a(83283),a(32029),a(35866);var r=a(23191),s=a(88716),i=a(37922),n=a.n(i),o=a(95231),c={};for(let e in o)0>["default","tree","pages","GlobalError","originalPathname","__next_app__","routeModule"].indexOf(e)&&(c[e]=()=>o[e]);a.d(t,c);let l=["",{children:["verify",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(a.bind(a,83283)),"C:\\Users\\Sav-Dev\\Documents\\HACKATHON\\QWENCLOUD\\TRACK4\\frontend\\src\\app\\verify\\page.tsx"]}]},{}]},{layout:[()=>Promise.resolve().then(a.bind(a,32029)),"C:\\Users\\Sav-Dev\\Documents\\HACKATHON\\QWENCLOUD\\TRACK4\\frontend\\src\\app\\layout.tsx"],"not-found":[()=>Promise.resolve().then(a.t.bind(a,35866,23)),"next/dist/client/components/not-found-error"]}],d=["C:\\Users\\Sav-Dev\\Documents\\HACKATHON\\QWENCLOUD\\TRACK4\\frontend\\src\\app\\verify\\page.tsx"],x="/verify/page",h={require:a,loadChunk:()=>Promise.resolve()},u=new r.AppPageRouteModule({definition:{kind:s.x.APP_PAGE,page:"/verify/page",pathname:"/verify",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:l}})},99684:(e,t,a)=>{Promise.resolve().then(a.t.bind(a,12994,23)),Promise.resolve().then(a.t.bind(a,96114,23)),Promise.resolve().then(a.t.bind(a,9727,23)),Promise.resolve().then(a.t.bind(a,79671,23)),Promise.resolve().then(a.t.bind(a,41868,23)),Promise.resolve().then(a.t.bind(a,84759,23))},44889:()=>{},12825:(e,t,a)=>{Promise.resolve().then(a.bind(a,37645))},35047:(e,t,a)=>{"use strict";var r=a(77389);a.o(r,"usePathname")&&a.d(t,{usePathname:function(){return r.usePathname}}),a.o(r,"useRouter")&&a.d(t,{useRouter:function(){return r.useRouter}})},37645:(e,t,a)=>{"use strict";a.r(t),a.d(t,{default:()=>u});var r=a(10326),s=a(17577),i=a(35047),n=a(80854),o=a(49229),c=a(80361);let l=(0,a(35315).Z)("fingerprint-pattern",[["path",{d:"M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4",key:"1nerag"}],["path",{d:"M14 13.12c0 2.38 0 6.38-1 8.88",key:"o46ks0"}],["path",{d:"M17.29 21.02c.12-.6.43-2.3.5-3.02",key:"ptglia"}],["path",{d:"M2 12a10 10 0 0 1 18-6",key:"ydlgp0"}],["path",{d:"M2 16h.01",key:"1gqxmh"}],["path",{d:"M21.8 16c.2-2 .131-5.354 0-6",key:"drycrb"}],["path",{d:"M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2",key:"1tidbn"}],["path",{d:"M8.65 22c.21-.66.45-1.32.57-2",key:"13wd9y"}],["path",{d:"M9 6.8a6 6 0 0 1 9 5.2v2",key:"1fr1j5"}]]);var d=a(31622),x=a(45874);let h="http://47.84.106.210:3000/api";function u(){let e=(0,i.useRouter)(),[t,a]=(0,s.useState)("idle"),[u,f]=(0,s.useState)(""),[m,p]=(0,s.useState)(0),[b,v]=(0,s.useState)(0),[g,y]=(0,s.useState)(0),[w,j]=(0,s.useState)(!1),N=(0,s.useRef)(null);async function k(){try{a("fetching"),f("");let t=await fetch(`${h}/human/challenge`);if(!t.ok)throw Error("Failed to fetch challenge");let{challenge:r,difficulty:s}=await t.json();a("computing"),p(0),v(0),y(0);let i=`
// Minimal synchronous SHA-256 implementation
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
  var len = msg.length;
  var bitLen = len * 8;
  var paddedLen = (((len + 9 + 63) >> 6) << 6);
  var data = new Uint8Array(paddedLen);
  data.set(msg);
  data[len] = 0x80;
  // Append length as 64-bit big-endian
  data[paddedLen - 4] = (bitLen >>> 24) & 0xff;
  data[paddedLen - 3] = (bitLen >>> 16) & 0xff;
  data[paddedLen - 2] = (bitLen >>> 8) & 0xff;
  data[paddedLen - 1] = bitLen & 0xff;

  var W = new Array(64);
  for (var i = 0; i < paddedLen; i += 64) {
    for (var t = 0; t < 16; t++) {
      W[t] = ((data[i + t*4] << 24) | (data[i + t*4 + 1] << 16) | (data[i + t*4 + 2] << 8) | data[i + t*4 + 3]) >>> 0;
    }
    for (var t = 16; t < 64; t++) {
      var s0 = rotr(W[t-15], 7) ^ rotr(W[t-15], 18) ^ (W[t-15] >>> 3);
      var s1 = rotr(W[t-2], 17) ^ rotr(W[t-2], 19) ^ (W[t-2] >>> 10);
      W[t] = (W[t-16] + s0 + W[t-7] + s1) >>> 0;
    }
    var a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
    for (var t = 0; t < 64; t++) {
      var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      var ch = (e & f) ^ (~e & g);
      var temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var temp2 = (S0 + maj) >>> 0;
      h=g; g=f; f=e; e=(d+temp1)>>>0; d=c; c=b; b=a; a=(temp1+temp2)>>>0;
    }
    H[0]=(H[0]+a)>>>0;H[1]=(H[1]+b)>>>0;H[2]=(H[2]+c)>>>0;H[3]=(H[3]+d)>>>0;
    H[4]=(H[4]+e)>>>0;H[5]=(H[5]+f)>>>0;H[6]=(H[6]+g)>>>0;H[7]=(H[7]+h)>>>0;
  }
  var out = new Uint8Array(32);
  for (var i = 0; i < 8; i++) {
    out[i*4] = (H[i] >>> 24) & 0xff;
    out[i*4+1] = (H[i] >>> 16) & 0xff;
    out[i*4+2] = (H[i] >>> 8) & 0xff;
    out[i*4+3] = H[i] & 0xff;
  }
  return out;
}

function strToBytes(s) {
  var arr = [];
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 0x80) arr.push(c);
    else if (c < 0x800) { arr.push(0xc0 | (c >> 6)); arr.push(0x80 | (c & 0x3f)); }
    else { arr.push(0xe0 | (c >> 12)); arr.push(0x80 | ((c >> 6) & 0x3f)); arr.push(0x80 | (c & 0x3f)); }
  }
  return new Uint8Array(arr);
}

self.onmessage = function(e) {
  var challenge = e.data.challenge;
  var difficulty = e.data.difficulty;
  var nonce = 0;
  var startTime = Date.now();
  var batchSize = 2000;

  function computeBatch() {
    for (var i = 0; i < batchSize; i++) {
      var data = strToBytes(challenge + ":" + nonce);
      var hash = sha256Bytes(data);
      var valid = true;
      for (var j = 0; j < difficulty; j++) {
        if (hash[j] !== 0) { valid = false; break; }
      }
      if (valid) {
        self.postMessage({ found: true, nonce: nonce, attempts: nonce, elapsed: Date.now() - startTime });
        return;
      }
      nonce++;
    }
    self.postMessage({ found: false, attempts: nonce, elapsed: Date.now() - startTime });
    setTimeout(computeBatch, 0);
  }
  computeBatch();
};
      `,n=new Blob([i],{type:"application/javascript"}),o=new Worker(URL.createObjectURL(n));N.current=o,o.onmessage=async t=>{if(t.data.found){v(t.data.attempts),y(t.data.elapsed),a("verifying"),o.terminate();try{let s=await fetch(`${h}/human/verify`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({challenge:r,nonce:String(t.data.nonce)})});if(!s.ok){let e=await s.json().catch(()=>({error:"Verification failed"}));throw Error(e.reason||e.error||"Verification failed")}let{token:i}=await s.json();localStorage.setItem("althr_human_token",i),document.cookie=`althr_human_token=${i}; path=/; max-age=7200; SameSite=Lax`,a("done"),setTimeout(()=>{e.push("/dashboard")},1500)}catch(e){a("error"),f(e.message)}}else v(t.data.attempts),y(t.data.elapsed),p(Math.min(t.data.attempts/1e5*100,95))},o.postMessage({challenge:r,difficulty:s})}catch(e){a("error"),f(e.message)}}return w?r.jsx("div",{className:"min-h-screen bg-[#0b0f1a] flex items-center justify-center p-4",children:r.jsx("div",{className:"w-full max-w-md",children:(0,r.jsxs)("div",{className:"relative rounded-3xl overflow-hidden border border-red-500/20 bg-white/5 backdrop-blur-xl p-8 md:p-10",children:[r.jsx("div",{className:"absolute -top-20 -right-20 w-40 h-40 rounded-full bg-red-500/10 blur-3xl"}),(0,r.jsxs)("div",{className:"relative",children:[r.jsx("div",{className:"flex justify-center mb-6",children:r.jsx("div",{className:"w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center",children:r.jsx(n.Z,{className:"w-8 h-8 text-red-400"})})}),r.jsx("h1",{className:"text-xl font-semibold text-white text-center mb-2",children:"Human Access Only"}),r.jsx("p",{className:"text-sm text-white/50 text-center mb-4",children:"This site is protected by proof-of-work human verification. Automated browsers, bots, and testing frameworks (Playwright, Puppeteer, Selenium) are not allowed."}),r.jsx("p",{className:"text-xs text-white/30 text-center",children:"If you are a human, please open this page in a standard web browser."})]})]})})}):r.jsx("div",{className:"min-h-screen bg-[#0b0f1a] flex items-center justify-center p-4",children:(0,r.jsxs)("div",{className:"w-full max-w-md",children:[(0,r.jsxs)("div",{className:"relative rounded-3xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-xl p-8 md:p-10",children:[r.jsx("div",{className:"absolute -top-20 -right-20 w-40 h-40 rounded-full bg-blue-500/10 blur-3xl"}),r.jsx("div",{className:"absolute -bottom-20 -left-20 w-40 h-40 rounded-full bg-emerald-500/10 blur-3xl"}),(0,r.jsxs)("div",{className:"relative",children:[r.jsx("div",{className:"flex justify-center mb-6",children:r.jsx("div",{className:"w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center",children:"done"===t?r.jsx(o.Z,{className:"w-8 h-8 text-emerald-400"}):"error"===t?r.jsx(n.Z,{className:"w-8 h-8 text-red-400"}):"fetching"===t||"computing"===t||"verifying"===t?r.jsx(c.Z,{className:"w-8 h-8 text-blue-400 animate-spin"}):r.jsx(l,{className:"w-8 h-8 text-blue-400"})})}),r.jsx("h1",{className:"text-xl font-semibold text-white text-center mb-2",children:"Human Verification"}),(0,r.jsxs)("p",{className:"text-sm text-white/50 text-center mb-6",children:["idle"===t&&"Click the checkbox below to verify you are human","fetching"===t&&"Loading challenge...","computing"===t&&"Solving puzzle... this takes a few seconds","verifying"===t&&"Verifying solution...","done"===t&&"Verified! Redirecting to dashboard...","error"===t&&"Verification failed"]}),"idle"===t&&(0,r.jsxs)("div",{className:"space-y-4",children:[(0,r.jsxs)("button",{onClick:function(){"computing"!==t&&"fetching"!==t&&"verifying"!==t&&k()},className:"w-full rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/25 px-6 py-5 flex items-center gap-4 transition-all group",children:[r.jsx("div",{className:"w-7 h-7 rounded-md border-2 border-white/20 group-hover:border-blue-400 flex items-center justify-center transition-colors",children:r.jsx(l,{className:"w-4 h-4 text-white/30 group-hover:text-blue-400 transition-colors"})}),r.jsx("span",{className:"text-white/70 text-sm font-medium text-left",children:"I'm not a robot"}),(0,r.jsxs)("div",{className:"ml-auto flex items-center gap-1.5",children:[r.jsx(d.Z,{className:"w-4 h-4 text-white/20"}),r.jsx("span",{className:"text-[10px] text-white/20",children:"PoW"})]})]}),r.jsx("p",{className:"text-xs text-white/30 text-center",children:"Clicking will run a proof-of-work challenge in your browser"})]}),("computing"===t||"verifying"===t)&&(0,r.jsxs)("div",{className:"space-y-3",children:[r.jsx("div",{className:"h-2 rounded-full bg-white/5 overflow-hidden",children:r.jsx("div",{className:"h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300",style:{width:`${"verifying"===t?100:m}%`}})}),(0,r.jsxs)("div",{className:"flex justify-between text-xs text-white/30",children:[(0,r.jsxs)("span",{children:[b.toLocaleString()," hashes"]}),r.jsx("span",{children:g>0?`${(g/1e3).toFixed(1)}s`:""})]})]}),"done"===t&&r.jsx("div",{className:"space-y-3",children:(0,r.jsxs)("div",{className:"rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center",children:[r.jsx(o.Z,{className:"w-8 h-8 text-emerald-400 mx-auto mb-2"}),(0,r.jsxs)("p",{className:"text-sm text-emerald-300",children:["Verification successful — ",b.toLocaleString()," hashes in ",(g/1e3).toFixed(1),"s"]})]})}),"error"===t&&(0,r.jsxs)("div",{className:"space-y-4",children:[r.jsx("div",{className:"rounded-xl bg-red-500/10 border border-red-500/20 p-4",children:r.jsx("p",{className:"text-sm text-red-300",children:u})}),(0,r.jsxs)("button",{onClick:()=>{a("idle"),f("")},className:"w-full rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium py-3 transition-colors flex items-center justify-center gap-2",children:[r.jsx(x.Z,{className:"w-4 h-4"}),"Try Again"]})]}),"error"!==t&&(0,r.jsxs)("div",{className:"mt-6 flex items-center gap-2 justify-center",children:[r.jsx(d.Z,{className:"w-3.5 h-3.5 text-white/20"}),r.jsx("span",{className:"text-xs text-white/20",children:"Proof-of-Work Anti-Bot Protection"})]})]})]}),r.jsx("p",{className:"text-center text-xs text-white/20 mt-6",children:"ALTHR Autopilot — Human Verification Layer"})]})})}},32029:(e,t,a)=>{"use strict";a.r(t),a.d(t,{default:()=>c,dynamic:()=>n,metadata:()=>s,revalidate:()=>o,viewport:()=>i});var r=a(19510);a(5023);let s={title:"ALTHR Autopilot",description:"AI-Native Server Operations Agent — powered by Qwen Cloud (Track 4)",manifest:"/manifest.json",icons:{icon:"/icon.svg",apple:"/icon.svg"},appleWebApp:{capable:!0,statusBarStyle:"black-translucent",title:"ALTHR Autopilot"}},i={themeColor:"#0b0f1a",colorScheme:"dark"},n="force-dynamic",o=0;function c({children:e}){return r.jsx("html",{lang:"en",children:r.jsx("body",{className:"font-sans antialiased",children:e})})}},83283:(e,t,a)=>{"use strict";a.r(t),a.d(t,{default:()=>r});let r=(0,a(68570).createProxy)(String.raw`C:\Users\Sav-Dev\Documents\HACKATHON\QWENCLOUD\TRACK4\frontend\src\app\verify\page.tsx#default`)},5023:()=>{},35315:(e,t,a)=>{"use strict";a.d(t,{Z:()=>u});var r=a(17577);let s=(...e)=>e.filter((e,t,a)=>!!e&&""!==e.trim()&&a.indexOf(e)===t).join(" ").trim(),i=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),n=e=>e.replace(/^([A-Z])|[\s-_]+(\w)/g,(e,t,a)=>a?a.toUpperCase():t.toLowerCase()),o=e=>{let t=n(e);return t.charAt(0).toUpperCase()+t.slice(1)};var c={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};let l=e=>{for(let t in e)if(t.startsWith("aria-")||"role"===t||"title"===t)return!0;return!1},d=(0,r.createContext)({}),x=()=>(0,r.useContext)(d),h=(0,r.forwardRef)(({color:e,size:t,strokeWidth:a,absoluteStrokeWidth:i,className:n="",children:o,iconNode:d,...h},u)=>{let{size:f=24,strokeWidth:m=2,absoluteStrokeWidth:p=!1,color:b="currentColor",className:v=""}=x()??{},g=i??p?24*Number(a??m)/Number(t??f):a??m;return(0,r.createElement)("svg",{ref:u,...c,width:t??f??c.width,height:t??f??c.height,stroke:e??b,strokeWidth:g,className:s("lucide",v,n),...!o&&!l(h)&&{"aria-hidden":"true"},...h},[...d.map(([e,t])=>(0,r.createElement)(e,t)),...Array.isArray(o)?o:[o]])}),u=(e,t)=>{let a=(0,r.forwardRef)(({className:a,...n},c)=>(0,r.createElement)(h,{ref:c,iconNode:t,className:s(`lucide-${i(o(e))}`,`lucide-${e}`,a),...n}));return a.displayName=o(e),a}},80854:(e,t,a)=>{"use strict";a.d(t,{Z:()=>r});let r=(0,a(35315).Z)("circle-alert",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"12",x2:"12",y1:"8",y2:"12",key:"1pkeuh"}],["line",{x1:"12",x2:"12.01",y1:"16",y2:"16",key:"4dfq90"}]])},49229:(e,t,a)=>{"use strict";a.d(t,{Z:()=>r});let r=(0,a(35315).Z)("circle-check",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]])},80361:(e,t,a)=>{"use strict";a.d(t,{Z:()=>r});let r=(0,a(35315).Z)("loader-circle",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]])},45874:(e,t,a)=>{"use strict";a.d(t,{Z:()=>r});let r=(0,a(35315).Z)("refresh-cw",[["path",{d:"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",key:"v9h5vc"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}],["path",{d:"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",key:"3uifl3"}],["path",{d:"M8 16H3v5",key:"1cv678"}]])},31622:(e,t,a)=>{"use strict";a.d(t,{Z:()=>r});let r=(0,a(35315).Z)("shield-check",[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]])}};var t=require("../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),r=t.X(0,[819],()=>a(96537));module.exports=r})();