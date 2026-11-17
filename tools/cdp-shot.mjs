// CDP screenshot driver for SOLMARA. Launches desktop Chromium with remote
// debugging, opens a URL (file:// or http://), waits for the game to report
// ready, optionally sends key events, then captures a 1280x720 screenshot.
// It also logs console errors and every network request the page makes.
// Usage: node tools/cdp-shot.mjs --url <url> --out <png> [--wait ms]
//        [--keys W,A,S] [--click x,y]
import { spawn } from "node:child_process";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CHROME = "/opt/meta-chromium/chrome";
const PORT = 9333;
const POLICY = join(dirname(fileURLToPath(import.meta.url)), "webgl-policy.txt");

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const url = arg("--url");
const out = arg("--out");
const format = arg("--format", "png");
const waitMs = Number(arg("--wait", "2500"));
const keys = arg("--keys", "");
const click = arg("--click", "");
if (!url || !out) {
  console.error("usage: node tools/cdp-shot.mjs --url <url> --out <png> [--wait ms] [--keys A,B] [--click x,y]");
  process.exit(2);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getJson(path, method) {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}${path}`, { method: method || "GET" });
      if (res.ok) return await res.json();
    } catch (e) {}
    await sleep(250);
  }
  throw new Error("chrome devtools did not answer at " + path);
}

const policyBytes = await readFile(POLICY);
const policySha = createHash("sha256").update(policyBytes).digest("hex");

const chrome = spawn(CHROME, [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--hatch-webgl-allowed-domains-file=" + POLICY,
  "--hatch-webgl-allowed-domains-sha256=" + policySha,
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=/tmp/solmara-chrome-profile",
  "--window-size=1280,720",
  "--hide-scrollbars",
  "about:blank",
], { stdio: "ignore" });

let ws = null;
try {
  const target = await getJson("/json/new", "PUT");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  const requests = [];
  const consoleErrors = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === "Network.requestWillBeSent") {
      requests.push(msg.params.request.url);
    } else if (msg.method === "Runtime.exceptionThrown") {
      consoleErrors.push(msg.params.exceptionDetails.text + " " + (msg.params.exceptionDetails.exception?.description || ""));
    } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      consoleErrors.push(msg.params.args.map((a) => a.value || a.description || "").join(" "));
    }
  };
  function send(method, params) {
    return new Promise((resolve) => {
      const mid = ++id;
      pending.set(mid, resolve);
      ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
    });
  }
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Page.enable");
  await send("Page.navigate", { url });
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

  // Wait until the game reports ready, then let the scene settle.
  let ready = false;
  for (let i = 0; i < 40; i++) {
    const r = await send("Runtime.evaluate", { expression: "window.__solmaraReady === true", returnByValue: true });
    if (r.result && r.result.result && r.result.result.value === true) { ready = true; break; }
    await sleep(250);
  }
  console.log("ready:", ready);
  await sleep(waitMs);

  // Optional key events (raw key codes, e.g. KeyW) with a small hold each.
  if (keys) {
    for (const code of keys.split(",")) {
      const key = code.replace("Key", "").replace("Arrow", "").toLowerCase();
      await send("Input.dispatchKeyEvent", { type: "keyDown", code, key, windowsVirtualKeyCode: code.charCodeAt(0) });
      await sleep(120);
      await send("Input.dispatchKeyEvent", { type: "keyUp", code, key, windowsVirtualKeyCode: code.charCodeAt(0) });
      await sleep(80);
    }
    await sleep(600);
  }
  if (click) {
    const [x, y] = click.split(",").map(Number);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    await sleep(600);
  }

  const state = await send("Runtime.evaluate", {
    expression: "({mode: window.__solmara && window.__solmara.mode, errors: window.__errors || [], wanted: window.__solmara && window.__solmara.wanted, mission: window.__solmara && window.__solmara.mission && window.__solmara.mission.def.name})",
    returnByValue: true,
  });
  console.log("state:", JSON.stringify(state.result && state.result.result && state.result.result.value));
  console.log("network requests:", requests.length);
  for (const r of requests) console.log("  req:", r);
  console.log("console errors:", consoleErrors.length);
  for (const e of consoleErrors) console.log("  err:", e);

  const shot = await send("Page.captureScreenshot", { format, quality: format === "jpeg" ? 85 : undefined });
  const data = shot.result && shot.result.data;
  if (!data) throw new Error("no screenshot data: " + JSON.stringify(shot).slice(0, 300));
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, Buffer.from(data, "base64"));
  console.log("wrote", out);
} finally {
  if (ws) ws.close();
  chrome.kill("SIGKILL");
}
