// SOLMARA main: boot, input, camera, the game loop, menus and the
// deterministic screenshot modes (?shot=start|play|chase|end).
(function () {
  "use strict";
  const SOL = window.SOL;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const G = SOL.State.freshState();
  G.world = SOL.World.buildWorld();
  SOL.State.populate(G, SOL.makeRng(4242));

  window.__solmara = G;
  window.__errors = [];
  window.addEventListener("error", (e) => {
    window.__errors.push(String((e.error && e.error.stack) || e.message || e.error));
  });

  // Restore saved progress for the Continue button.
  const saved = SOL.loadSave();
  if (saved) {
    G.cash = saved.cash || 250;
    if (Array.isArray(saved.completed)) G.completed = saved.completed.slice(0, 5);
    G.starsCollected = saved.starsCollected || 0;
    G.kills = saved.kills || 0;
    G.carsStolen = saved.carsStolen || 0;
    if (saved.starsCollected) {
      G.world.stars.forEach((s, i) => {
        if (i < saved.starsCollected) s.taken = true;
      });
    }
  }

  // --- Input ---
  const KEYMAP = {
    KeyW: true, KeyA: true, KeyS: true, KeyD: true,
    ArrowUp: true, ArrowDown: true, ArrowLeft: true, ArrowRight: true,
    Space: true, KeyE: true, KeyF: true, Escape: true, KeyP: true,
  };

  window.addEventListener("keydown", (e) => {
    if (KEYMAP[e.code]) e.preventDefault();
    if (e.repeat) return;
    G.keys[e.code] = true;
    SOL.AudioSys.init();
    SOL.AudioSys.resume();
    if (e.code === "KeyE" && G.mode === "playing") {
      // One press does one thing: enter a nearby car, or step out of one.
      if (G.player.onFoot) SOL.Entities.tryEnterCar(G);
      else SOL.Entities.exitCar(G);
    }
    if ((e.code === "Escape" || e.code === "KeyP") && G.mode === "playing") {
      pauseGame();
    } else if ((e.code === "Escape" || e.code === "KeyP") && G.mode === "paused") {
      resumeGame();
    }
    if (e.code === "KeyM") {
      SOL.AudioSys.enabled = !SOL.AudioSys.enabled;
    }
  });
  window.addEventListener("keyup", (e) => {
    G.keys[e.code] = false;
  });
  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    G.mouse.x = ((e.clientX - r.left) / r.width) * 1280;
    G.mouse.y = ((e.clientY - r.top) / r.height) * 720;
  });
  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      G.mouse.down = true;
      SOL.AudioSys.init();
      SOL.AudioSys.resume();
    }
  });
  window.addEventListener("mouseup", () => {
    G.mouse.down = false;
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  function updateMouseWorld() {
    G.mouse.worldX = G.camera.x - 640 + G.mouse.x;
    G.mouse.worldY = G.camera.y - 360 + G.mouse.y;
  }

  // --- Menus (DOM overlays) ---
  function showOnly(id) {
    const ids = ["title-screen", "pause-menu", "howto-screen", "mission-screen", "end-screen"];
    for (const x of ids) {
      const el = document.getElementById(x);
      if (el) el.classList.toggle("hidden", x !== id);
    }
  }
  function hideAllMenus() {
    showOnly("");
  }

  function startFreeRoam() {
    SOL.State.resetRun(G, true);
    G.mode = "playing";
    hideAllMenus();
    G.banner = "FREE ROAM";
    G.bannerT = 2.5;
    G.subBanner = "Solmara is yours. Steal cars, find the 10 Solmara Stars, or open Missions from the pause menu.";
    G.subBannerT = 5;
  }

  function startNewGame() {
    SOL.State.resetRun(G, false);
    G.mode = "playing";
    hideAllMenus();
    SOL.Missions.startMission(G, 0);
  }

  function continueGame() {
    SOL.State.resetRun(G, true);
    G.mode = "playing";
    hideAllMenus();
    const next = G.completed.findIndex((c) => !c);
    if (next >= 0) {
      SOL.Missions.startMission(G, next);
    } else {
      G.banner = "ALL MISSIONS COMPLETE";
      G.bannerT = 3;
      G.subBanner = "You finished Rico's story. Free roam Solmara as you like.";
      G.subBannerT = 5;
    }
  }

  function pauseGame() {
    if (G.mode !== "playing") return;
    G.mode = "paused";
    showOnly("pause-menu");
  }

  function resumeGame() {
    if (G.mode !== "paused") return;
    G.mode = "playing";
    hideAllMenus();
  }

  function quitToTitle() {
    G.mode = "title";
    G.mission = null;
    G.missionIndex = -1;
    SOL.Entities.hideEndScreen();
    showOnly("title-screen");
    refreshTitleButtons();
  }

  function refreshTitleButtons() {
    const cont = document.getElementById("btn-continue");
    if (cont) cont.disabled = !G.completed.some((c) => c) && G.cash <= 250 && G.starsCollected === 0;
  }

  function refreshMissionList() {
    const list = document.getElementById("mission-list");
    if (!list) return;
    list.innerHTML = "";
    SOL.Missions.MISSIONS.forEach((m, i) => {
      const row = document.createElement("div");
      row.className = "mission-row";
      const unlocked = i === 0 || G.completed[i - 1];
      const done = G.completed[i];
      row.innerHTML =
        "<span class='mission-name'>" + (done ? "✓ " : "") + m.name + "</span>" +
        "<span class='mission-reward'>" + SOL.fmtMoney(m.reward) + "</span>" +
        "<span class='mission-state'>" + (done ? "DONE" : unlocked ? "OPEN" : "LOCKED") + "</span>";
      if (unlocked) {
        row.style.cursor = "pointer";
        row.addEventListener("click", () => {
          SOL.State.resetRun(G, true);
          G.mode = "playing";
          hideAllMenus();
          SOL.Missions.startMission(G, i);
        });
      } else {
        row.style.opacity = "0.45";
      }
      list.appendChild(row);
    });
  }

  function wireMenus() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", fn);
    };
    on("btn-continue", continueGame);
    on("btn-new", startNewGame);
    on("btn-freeroam", startFreeRoam);
    on("btn-missions", () => { refreshMissionList(); showOnly("mission-screen"); });
    on("btn-howto", () => showOnly("howto-screen"));
    on("btn-resume", resumeGame);
    on("btn-restart-mission", () => {
      const idx = G.mission ? G.mission.index : 0;
      SOL.State.resetRun(G, true);
      G.mode = "playing";
      hideAllMenus();
      SOL.Missions.startMission(G, idx);
    });
    on("btn-quit-title", quitToTitle);
    on("btn-howto-back", () => showOnly("title-screen"));
    on("btn-missions-back", () => showOnly("title-screen"));
    on("btn-end-continue", () => {
      SOL.Entities.hideEndScreen();
      if (G.mode === "wasted") {
        // Respawn on foot near the plaza, heat cleared, health restored.
        SOL.State.resetRun(G, true);
        G.mode = "playing";
        G.player.health = 100;
        G.wanted = 0;
      } else if (G.mode === "failed") {
        // Retry the same mission.
        const idx = G.lastMissionIndex || 0;
        SOL.State.resetRun(G, true);
        G.mode = "playing";
        SOL.Missions.startMission(G, idx);
      } else {
        // Mission passed: start the next one, or free roam if the story is done.
        const next = G.completed.findIndex((c) => !c);
        G.mode = "playing";
        if (next >= 0) SOL.Missions.startMission(G, next);
        else {
          G.banner = "FREE ROAM";
          G.bannerT = 2.5;
          G.subBanner = "Every mission is done. Solmara is yours, Rico.";
          G.subBannerT = 5;
        }
      }
      hideAllMenus();
    });
    on("btn-end-title", () => {
      SOL.Entities.hideEndScreen();
      quitToTitle();
    });
  }

  // --- Screenshot modes: deterministic staged scenes ---
  function applyShotMode() {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get("shot");
    if (!shot) return;
    G.shot = shot;
    hideAllMenus();
    if (shot === "start") {
      G.mode = "title";
      showOnly("title-screen");
      G.camera.x = 2400;
      G.camera.y = 1800;
      return;
    }
    if (shot === "play" || shot === "chase" || shot === "end") {
      G.mode = "playing";
      // Spawn on the open north-south road at x=1200, heading north, and
      // hold the throttle so the shot shows the car actually driving.
      const car = SOL.State.makeCar("cometa", 1200, 2000, -Math.PI / 2, null);
      G.cars.push(car);
      G.player.car = car;
      G.player.onFoot = false;
      G.player.x = car.x;
      G.player.y = car.y;
      G.camera.x = car.x;
      G.camera.y = car.y;
      G.keys["KeyW"] = true;
      if (shot === "play") {
        SOL.Missions.startMission(G, 1);
        G.mission.stage = 1;
        G.mission.hasPackage = true;
        G.mission.timer = 74;
        G.mission.target = { x: 4000, y: 600, r: 60, label: "Deliver to Neon Row" };
        G.wanted = 2;
        G.player.health = 86;
        G.player.armor = 40;
        G.cash = 1240;
        car.speed = 300;
        SOL.Entities.spawnPoliceCarForShot(G);
        // Clear the mission brief banner so it does not cover the action.
        G.bannerT = 0;
        G.subBannerT = 0;
      } else if (shot === "chase") {
        G.player.health = 62;
        G.player.armor = 25;
        G.cash = 1980;
        car.speed = 380;
        SOL.Missions.startMission(G, 3);
        G.wanted = 4;
        SOL.Entities.spawnPoliceCarForShot(G);
        SOL.Entities.spawnPoliceCarForShot(G);
        G.bannerT = 0;
        G.subBannerT = 0;
      } else if (shot === "end") {
        G.mode = "complete";
        G.endInfo = {
          title: "MISSION PASSED",
          text: "The Courier complete. $400 added to your pocket.",
          reward: 400,
        };
        SOL.Entities.showEndScreen(G);
      }
    }
  }

  // --- Game loop ---
  let last = performance.now();
  let titlePan = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    G.time += dt;
    updateMouseWorld();

    if (G.mode === "title") {
      // Slow cinematic pan over the city behind the title screen.
      titlePan += dt * 0.12;
      G.camera.x = 2400 + Math.cos(titlePan) * 700;
      G.camera.y = 1800 + Math.sin(titlePan * 0.8) * 420;
      SOL.Entities.updateTraffic(G, dt);
      SOL.Entities.updatePeds(G, dt);
    } else if (G.mode === "playing") {
      const p = G.player;
      if (p.onFoot) SOL.Entities.updatePlayerFoot(G, dt);
      else SOL.Entities.updatePlayerCar(G, dt);
      SOL.Entities.updateTraffic(G, dt);
      SOL.Entities.updatePeds(G, dt);
      SOL.Entities.updatePolice(G, dt);
      SOL.Missions.updateGuards(G, dt);
      SOL.Entities.updateBullets(G, dt);
      SOL.Entities.updatePickups(G, dt);
      SOL.Entities.updateWanted(G, dt);
      SOL.Missions.updateMission(G, dt);
      if (p.invuln > 0) p.invuln -= dt;
      if (G.bannerT > 0) G.bannerT -= dt;
      if (G.subBannerT > 0) G.subBannerT -= dt;
      if (G.messageT > 0) G.messageT -= dt;
      // Camera follows the player, clamped to the world.
      G.camera.x = SOL.clamp(p.x, 640, G.world.w - 640);
      G.camera.y = SOL.clamp(p.y, 360, G.world.h - 360);
      SOL.AudioSys.updateMusic(dt);
    }
    SOL.Entities.updateParticles(G, dt);
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);

    // --- Draw ---
    ctx.save();
    ctx.clearRect(0, 0, 1280, 720);
    const shx = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
    const shy = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
    ctx.translate(-G.camera.x + 640 + shx, -G.camera.y + 360 + shy);
    SOL.Render.drawWorld(ctx, G);
    SOL.Render.drawMissionMarker(ctx, G);
    // Draw cars, people and the player sorted by y for a top-down feel.
    const drawables = [];
    for (const car of G.cars) if (!car.dead) drawables.push({ y: car.y, fn: () => SOL.Render.drawCar(ctx, car, G.time) });
    for (const ped of G.peds) if (!ped.dead) drawables.push({ y: ped.y, fn: () => SOL.Render.drawPed(ctx, ped, G.time) });
    for (const cop of G.cops) {
      if (cop.dead || cop.kind !== "cop") continue;
      drawables.push({ y: cop.y, fn: () => SOL.Render.drawPed(ctx, { x: cop.x, y: cop.y, angle: cop.angle, walkPhase: G.time * 8, color: "#1f3a93", state: "walk" }, G.time) });
    }
    for (const gd of G.guards) if (!gd.dead) drawables.push({ y: gd.y, fn: () => SOL.Render.drawPed(ctx, { x: gd.x, y: gd.y, angle: gd.angle, walkPhase: G.time * 8, color: "#5b2333", state: "walk" }, G.time) });
    drawables.push({ y: G.player.y, fn: () => SOL.Render.drawPlayer(ctx, G) });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();
    SOL.Render.drawEffects(ctx, G);
    ctx.restore();

    if (G.mode === "playing" || G.mode === "paused") {
      SOL.Hud.drawHud(ctx, G);
    }
    if (G.mode === "paused") {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, 1280, 720);
    }
  }

  wireMenus();
  refreshTitleButtons();
  applyShotMode();
  if (G.mode === "title") showOnly("title-screen");
  window.__solmaraReady = true;
  requestAnimationFrame(frame);
})();
