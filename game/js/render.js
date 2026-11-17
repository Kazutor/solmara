// SOLMARA render: draws the whole city, cars, people, effects and the
// in-world markers on the main canvas, following the camera.
(function () {
  "use strict";
  const SOL = window.SOL;

  function drawStar(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawCar(ctx, car, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(-32, -14, 64, 32);
    // Body.
    ctx.fillStyle = car.color;
    const len = car.kind === "van" ? 66 : 58;
    const wid = car.kind === "van" ? 30 : 26;
    ctx.beginPath();
    ctx.roundRect(-len / 2, -wid / 2, len, wid, 7);
    ctx.fill();
    // Cabin / windshield.
    ctx.fillStyle = "rgba(20,30,45,0.85)";
    ctx.beginPath();
    ctx.roundRect(car.kind === "van" ? -20 : -8, -wid / 2 + 4, car.kind === "van" ? 34 : 22, wid - 8, 4);
    ctx.fill();
    // Headlights and tail lights.
    ctx.fillStyle = "#fff8c9";
    ctx.fillRect(len / 2 - 3, -wid / 2 + 3, 3, 5);
    ctx.fillRect(len / 2 - 3, wid / 2 - 8, 3, 5);
    ctx.fillStyle = "#ff2d2d";
    ctx.fillRect(-len / 2, -wid / 2 + 3, 3, 5);
    ctx.fillRect(-len / 2, wid / 2 - 8, 3, 5);
    // Taxi checker stripe.
    if (car.kind === "taxi") {
      ctx.fillStyle = "#111";
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(-len / 2 + 6 + i * 8, -3, 4, 6);
      }
      ctx.fillStyle = "#ffd166";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("TAXI", 0, -wid / 2 - 4);
    }
    // Police livery and flashing light bar.
    if (car.kind === "police") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(-len / 2 + 8, -wid / 2, len - 16, 6);
      ctx.fillStyle = "#111";
      ctx.font = "bold 8px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SCPD", 0, -wid / 2 - 4);
      const flash = Math.sin(car.siren || 0) > 0;
      ctx.fillStyle = flash ? "#ff2d2d" : "#2d6bff";
      ctx.beginPath();
      ctx.arc(-4, -wid / 2 + 1, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = flash ? "#2d6bff" : "#ff2d2d";
      ctx.beginPath();
      ctx.arc(6, -wid / 2 + 1, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Burning car: smoke and flame.
    if (car.burning) {
      ctx.fillStyle = "rgba(255,120,20,0.85)";
      ctx.beginPath();
      ctx.arc(-6 + Math.sin(time * 9) * 3, 0, 9 + Math.sin(time * 12) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(80,80,80,0.6)";
      ctx.beginPath();
      ctx.arc(-10, -6, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPed(ctx, ped, time) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.rotate(ped.angle);
    const bob = Math.sin(ped.walkPhase) * 2;
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(0, 4, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body and head.
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.roundRect(-7, -6 + bob * 0.3, 14, 12, 5);
    ctx.fill();
    ctx.fillStyle = "#f2c89b";
    ctx.beginPath();
    ctx.arc(9, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(9, -2, 5, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (ped.state === "flee") {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("!", ped.x, ped.y - 16);
    }
  }

  function drawPlayer(ctx, G) {
    const p = G.player;
    if (!p.onFoot) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    const bob = Math.sin(p.walkPhase) * 2;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(0, 6, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(p.angle);
    // Rico Vega: teal jacket, dark jeans.
    ctx.fillStyle = "#0f766e";
    ctx.beginPath();
    ctx.roundRect(-8, -7 + bob * 0.3, 16, 14, 6);
    ctx.fill();
    ctx.fillStyle = "#f2c89b";
    ctx.beginPath();
    ctx.arc(10, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(10, -2, 6, Math.PI, Math.PI * 2);
    ctx.fill();
    // Gun in hand, pointing at the aim angle.
    ctx.rotate(p.aimAngle - p.angle);
    ctx.fillStyle = "#222";
    ctx.fillRect(8, -2, 12, 4);
    ctx.restore();
  }

  function drawWorld(ctx, G) {
    const world = G.world;
    const cam = G.camera;
    const vw = 1280, vh = 720;
    const x0 = cam.x - vw / 2, y0 = cam.y - vh / 2;

    // District ground.
    for (const d of world.districts) {
      ctx.fillStyle = d.ground;
      ctx.fillRect(d.x, d.y, d.w, d.h);
    }
    // Beach sand and animated sea.
    ctx.fillStyle = "#f2e3b3";
    ctx.fillRect(world.beach.x0, 0, world.beach.x1 - world.beach.x0, world.h);
    const wave = Math.sin(G.time * 1.4) * 6;
    ctx.fillStyle = "#2f9dc9";
    ctx.fillRect(world.sea.x0, 0, world.sea.x1 + wave, world.h);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let y = 0; y < world.h; y += 140) {
      ctx.fillRect(world.sea.x1 - 8 + wave, y + ((G.time * 30) % 140), 26, 4);
    }
    // Park grass and pond.
    ctx.fillStyle = "#7fb35e";
    ctx.fillRect(world.park.x - world.park.w / 2, world.park.y - world.park.h / 2, world.park.w, world.park.h);
    ctx.fillStyle = "#3d8fc4";
    ctx.beginPath();
    ctx.ellipse(world.pond.x, world.pond.y, world.pond.rx, world.pond.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(world.pond.x - 20, world.pond.y - 12, 60, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    // Roads, sidewalks and crosswalks.
    for (const rx of world.roadX) {
      ctx.fillStyle = "#5b5b60";
      ctx.fillRect(rx - world.roadW / 2, 0, world.roadW, world.h);
      ctx.fillStyle = "#c9c9c9";
      ctx.fillRect(rx - world.roadW / 2 - 12, 0, 12, world.h);
      ctx.fillRect(rx + world.roadW / 2, 0, 12, world.h);
      ctx.fillStyle = "#f7d154";
      for (let y = 0; y < world.h; y += 64) {
        ctx.fillRect(rx - 2, y, 4, 30);
      }
    }
    for (const ry of world.roadY) {
      ctx.fillStyle = "#5b5b60";
      ctx.fillRect(0, ry - world.roadW / 2, world.w, world.roadW);
      ctx.fillStyle = "#c9c9c9";
      ctx.fillRect(0, ry - world.roadW / 2 - 12, world.w, 12);
      ctx.fillRect(0, ry + world.roadW / 2, world.w, 12);
      ctx.fillStyle = "#f7d154";
      for (let x = 0; x < world.w; x += 64) {
        ctx.fillRect(x, ry - 2, 30, 4);
      }
    }
    // Crosswalk stripes at every intersection.
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (const rx of world.roadX) {
      for (const ry of world.roadY) {
        for (let i = -3; i <= 3; i++) {
          ctx.fillRect(rx + i * 12 - 4, ry - world.roadW / 2 - 12, 8, 12);
          ctx.fillRect(rx + i * 12 - 4, ry + world.roadW / 2, 8, 12);
        }
      }
    }

    // Plaza fountain.
    const pl = world.plaza;
    ctx.fillStyle = "#bcd6e2";
    ctx.beginPath();
    ctx.arc(pl.x, pl.y, pl.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3d8fc4";
    ctx.beginPath();
    ctx.arc(pl.x, pl.y, pl.r - 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9ecbff";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + G.time * 0.6;
      ctx.beginPath();
      ctx.arc(pl.x + Math.cos(a) * (pl.r - 46), pl.y + Math.sin(a) * (pl.r - 46), 5 + Math.sin(G.time * 3 + i) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#e8e8e8";
    ctx.beginPath();
    ctx.arc(pl.x, pl.y, 26, 0, Math.PI * 2);
    ctx.fill();

    // QuickFix garage forecourt.
    const g = world.garage;
    ctx.fillStyle = "#3f7a4d";
    ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("QUICKFIX", g.x + g.w / 2, g.y + 34);
    ctx.font = "14px sans-serif";
    ctx.fillText("Hold F — repair $150, clear 2 stars", g.x + g.w / 2, g.y + 58);
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 4;
    ctx.strokeRect(g.x + 6, g.y + 6, g.w - 12, g.h - 12);

    // Docks yard with containers.
    ctx.fillStyle = "#8a8378";
    ctx.fillRect(world.docks.x, world.docks.y, world.docks.w, world.docks.h);
    const contColors = ["#c94f4f", "#2f7ea8", "#e07a5f", "#7a8a3f"];
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = contColors[i % contColors.length];
      ctx.fillRect(world.docks.x + 40 + (i % 4) * 170, world.docks.y + 340 + Math.floor(i / 4) * 70, 130, 50);
    }

    // Buildings.
    for (const b of world.buildings) {
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      ctx.fillStyle = "rgba(255,240,180,0.8)";
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          if ((cx * 7 + cy * 3 + b.windows) % 3 === 0) {
            ctx.fillRect(b.x + 10 + cx * 30, b.y + 10 + cy * 30, 12, 14);
          }
        }
      }
      if (b.tall) {
        ctx.fillStyle = "#2b2d42";
        ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h / 2 - 8, 16, 16);
      }
    }

    // Palm trees.
    for (const palm of world.palms) {
      const sway = Math.sin(G.time * 1.2 + palm.x) * 3;
      ctx.strokeStyle = "#8a6d4b";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(palm.x, palm.y);
      ctx.lineTo(palm.x + sway, palm.y - 26 * palm.s);
      ctx.stroke();
      ctx.fillStyle = "#3f9e4d";
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.ellipse(
          palm.x + sway + Math.cos(a) * 12 * palm.s,
          palm.y - 26 * palm.s + Math.sin(a) * 8 * palm.s,
          12 * palm.s, 5 * palm.s, a, 0, Math.PI * 2
        );
        ctx.fill();
      }
    }

    // Billboards.
    for (const bb of world.billboards) {
      ctx.fillStyle = "#222";
      ctx.fillRect(bb.x - 110, bb.y - 34, 220, 58);
      ctx.fillStyle = bb.color;
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(bb.text, bb.x, bb.y + 8);
    }

    // Pickups.
    for (const pk of world.pickups) {
      if (pk.taken) continue;
      const bob = Math.sin(G.time * 3 + pk.x) * 3;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      if (pk.kind === "health") {
        ctx.fillStyle = "#fff";
        ctx.fillRect(-12, -12, 24, 24);
        ctx.fillStyle = "#e63946";
        ctx.fillRect(-3, -9, 6, 18);
        ctx.fillRect(-9, -3, 18, 6);
      } else if (pk.kind === "armor") {
        ctx.fillStyle = "#39d5ff";
        ctx.beginPath();
        ctx.moveTo(0, -13);
        ctx.lineTo(11, -6);
        ctx.lineTo(11, 4);
        ctx.lineTo(0, 13);
        ctx.lineTo(-11, 4);
        ctx.lineTo(-11, -6);
        ctx.closePath();
        ctx.fill();
      } else if (pk.kind === "cash") {
        ctx.fillStyle = "#7ee081";
        ctx.fillRect(-13, -8, 26, 16);
        ctx.fillStyle = "#1d6b2f";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("$", 0, 5);
      } else if (pk.kind === "smg") {
        ctx.fillStyle = "#222";
        ctx.fillRect(-14, -4, 28, 8);
        ctx.fillRect(6, -8, 6, 6);
      }
      ctx.restore();
    }

    // Hidden Solmara Stars.
    for (const s of world.stars) {
      if (s.taken) continue;
      const pulse = 1 + Math.sin(G.time * 4 + s.x) * 0.15;
      drawStar(ctx, s.x, s.y, 15 * pulse, "#ffd166");
      ctx.strokeStyle = "#b8860b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 20 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawEffects(ctx, G) {
    // Bullets as bright tracers.
    for (const b of G.bullets) {
      ctx.strokeStyle = "#ffe066";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const b of G.enemyBullets) {
      ctx.strokeStyle = "#ff6b6b";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Particles.
    for (const pt of G.particles) {
      ctx.globalAlpha = 1 - pt.t / pt.life;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Floating score text.
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    for (const f of G.floaters) {
      ctx.globalAlpha = 1 - f.t / 1.6;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - f.t * 30);
    }
    ctx.globalAlpha = 1;
  }

  function drawMissionMarker(ctx, G) {
    const m = G.mission;
    if (!m || !m.target) return;
    const t = m.target;
    const pulse = 1 + Math.sin(G.time * 5) * 0.18;
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,209,102,0.18)";
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r * pulse, 0, Math.PI * 2);
    ctx.fill();
    // A bouncing diamond above the marker.
    const dy = Math.sin(G.time * 4) * 8;
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - t.r - 26 + dy);
    ctx.lineTo(t.x + 10, t.y - t.r - 14 + dy);
    ctx.lineTo(t.x, t.y - t.r - 2 + dy);
    ctx.lineTo(t.x - 10, t.y - t.r - 14 + dy);
    ctx.closePath();
    ctx.fill();
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.fillText(t.label || "", t.x, t.y - t.r - 34 + dy);
  }

  function drawCrosshair(ctx, G) {
    if (G.mode !== "playing") return;
    const mx = G.mouse.x, my = G.mouse.y;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 14, my);
    ctx.lineTo(mx - 5, my);
    ctx.moveTo(mx + 5, my);
    ctx.lineTo(mx + 14, my);
    ctx.moveTo(mx, my - 14);
    ctx.lineTo(mx, my - 5);
    ctx.moveTo(mx, my + 5);
    ctx.lineTo(mx, my + 14);
    ctx.stroke();
    ctx.fillStyle = "#ff2d2d";
    ctx.beginPath();
    ctx.arc(mx, my, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  window.SOL.Render = {
    drawStar: drawStar,
    drawCar: drawCar,
    drawPed: drawPed,
    drawPlayer: drawPlayer,
    drawWorld: drawWorld,
    drawEffects: drawEffects,
    drawMissionMarker: drawMissionMarker,
    drawCrosshair: drawCrosshair,
  };
})();
