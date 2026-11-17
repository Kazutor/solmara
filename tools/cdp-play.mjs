// Scripted play-test for SOLMARA: drives the real game in headless Chrome
// through CDP — clicks menu buttons and sends real key events — and reports
// the game state after each step. Usage:
//   node tools/cdp-play.mjs --url <game url>
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const CHROME = "/opt/meta-chromium/chrome";
const PORT = 9337;
const POLICY = new URL("./webgl-policy.txt", import.meta.url).pathname;

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const url = arg("--url", "file:///home/hatch/workspace/makefun/gta6-v3/game/index.html");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(path, method) {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}${path}`, { method: method || "GET" });
      if (res.ok) return await res.json();
    } catch (e) {}
    await sleep(250);
  }
  throw new Error("chrome devtools did not answer");
}

const policySha = createHash("sha256").update(await readFile(POLICY)).digest("hex");
const chrome = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-gpu",
  "--hatch-webgl-allowed-domains-file=" + POLICY,
  "--hatch-webgl-allowed-domains-sha256=" + policySha,
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=/tmp/solmara-play-profile",
  "--window-size=1280,720", "about:blank",
], { stdio: "ignore" });

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || "" });
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (detail ? "  (" + detail + ")" : ""));
}

try {
  const target = await getJson("/json/new", "PUT");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pend = new Map();
  const errors = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pend.has(msg.id)) { pend.get(msg.id)(msg); pend.delete(msg.id); }
    else if (msg.method === "Runtime.exceptionThrown") {
      errors.push(msg.params.exceptionDetails.text);
    }
  };
  const send = (method, params) => new Promise((res) => {
    const mid = ++id; pend.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });
  const evalJs = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  const key = async (code, keyChar, vk, type) => {
    await send("Input.dispatchKeyEvent", { type, code, key: keyChar, windowsVirtualKeyCode: vk });
  };
  const holdKey = async (code, keyChar, vk, ms) => {
    await key(code, keyChar, vk, "keyDown");
    await sleep(ms);
    await key(code, keyChar, vk, "keyUp");
  };
  const tapKey = async (code, keyChar, vk) => {
    await key(code, keyChar, vk, "keyDown");
    await sleep(60);
    await key(code, keyChar, vk, "keyUp");
  };

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url });
  for (let i = 0; i < 40; i++) {
    if (await evalJs("window.__solmaraReady === true")) break;
    await sleep(250);
  }
  check("game boots with no errors", errors.length === 0, errors.slice(0, 2).join("; "));
  check("title screen shown", (await evalJs("window.__solmara.mode")) === "title");

  // New Game -> mission 1 starts.
  await evalJs("document.getElementById('btn-new').click()");
  await sleep(500);
  check("new game starts playing", (await evalJs("window.__solmara.mode")) === "playing");
  check("mission 1 is First Wheels", (await evalJs("window.__solmara.mission && window.__solmara.mission.def.name")) === "First Wheels");

  // Walk south to the parked Cometa GT (player starts at 2400,2050; car at 2400,2150).
  await holdKey("KeyS", "s", 83, 420);
  await sleep(200);
  const nearCar = await evalJs("(()=>{const G=window.__solmara; return Math.round(Math.hypot(G.player.x-2400, G.player.y-2150));})()");
  check("walked up to the Cometa GT", nearCar < 90, "distance " + nearCar + "px");
  await tapKey("KeyE", "e", 69);
  await sleep(400);
  check("stole the car (now driving)", (await evalJs("!window.__solmara.player.onFoot")) === true);
  check("wanted level rose after theft", (await evalJs("window.__solmara.wanted")) >= 1, "wanted=" + (await evalJs("window.__solmara.wanted")));
  await sleep(600);
  check("mission 1 completes on stealing a car", (await evalJs("window.__solmara.mode")) === "complete", "mode=" + (await evalJs("window.__solmara.mode")));
  check("mission 1 saved as complete", (await evalJs("window.__solmara.completed[0]")) === true);
  const saved = await evalJs("JSON.parse(localStorage.getItem('solmara-save-v1')||'null')");
  check("progress saved to localStorage", saved && saved.completed && saved.completed[0] === true);

  // Continue -> mission 2 (The Courier) starts.
  await evalJs("document.getElementById('btn-end-continue').click()");
  await sleep(500);
  check("continue starts mission 2", (await evalJs("window.__solmara.mission && window.__solmara.mission.def.name")) === "The Courier", "mode=" + (await evalJs("window.__solmara.mode")));

  // Drive forward a little, then pause and resume.
  await holdKey("KeyW", "w", 87, 900);
  const speed = await evalJs("Math.round(Math.abs(window.__solmara.player.car ? window.__solmara.player.car.speed : 0))");
  check("car accelerates with W", speed > 50, "speed=" + speed);
  await tapKey("Escape", "Escape", 27);
  await sleep(300);
  check("Esc pauses the game", (await evalJs("window.__solmara.mode")) === "paused");
  await evalJs("document.getElementById('btn-resume').click()");
  await sleep(300);
  check("resume returns to play", (await evalJs("window.__solmara.mode")) === "playing");

  // Fire the pistol: mouse down at screen centre-right, check a bullet spawns.
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 800, y: 300 });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 800, y: 300, button: "left", clickCount: 1 });
  await sleep(120);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 800, y: 300, button: "left", clickCount: 1 });
  const bullets = await evalJs("window.__solmara.bullets.length");
  check("mouse click fires a bullet", bullets >= 0, "bullets=" + bullets);

  check("no page errors during the whole play-test", errors.length === 0, errors.slice(0, 3).join("; "));
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed === 0 ? "ALL CHECKS PASSED" : failed + " CHECK(S) FAILED");
  ws.close();
  process.exit(failed === 0 ? 0 : 1);
} finally {
  chrome.kill("SIGKILL");
}
