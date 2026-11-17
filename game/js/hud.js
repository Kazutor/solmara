// SOLMARA HUD: wanted stars, health and armor bars, cash, district,
// speed, the live minimap, the off-screen objective arrow and banners.
(function () {
  "use strict";
  const SOL = window.SOL;

  function drawStars(ctx, G) {
    for (let i = 0; i < 5; i++) {
      const x = 1160 + i * 22;
      const y = 34;
      const active = i < G.wanted;
      SOL.Render.drawStar(ctx, x, y, 11, active ? "#ffd166" : "rgba(255,255,255,0.25)");
      if (!active) {
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawBar(ctx, x, y, w, h, frac, fill, label) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, Math.max(0, (w - 4) * SOL.clamp(frac, 0, 1)), h - 4, 3);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(label, x + 6, y + h - 5);
  }

  function drawMinimap(ctx, G) {
    const mw = 220, mh = 165;
    const mx = 16, my = 720 - mh - 16;
    const sx = mw / G.world.w;
    const sy = mh / G.world.h;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(mx - 4, my - 4, mw + 8, mh + 8, 8);
    ctx.fill();
    // District tint.
    for (const d of G.world.districts) {
      ctx.fillStyle = d.ground;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(mx + d.x * sx, my + d.y * sy, d.w * sx, d.h * sy);
    }
    ctx.globalAlpha = 1;
    // Sea and roads.
    ctx.fillStyle = "#2f9dc9";
    ctx.fillRect(mx, my, G.world.sea.x1 * sx, mh);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1;
    for (const rx of G.world.roadX) {
      ctx.beginPath();
      ctx.moveTo(mx + rx * sx, my);
      ctx.lineTo(mx + rx * sx, my + mh);
      ctx.stroke();
    }
    for (const ry of G.world.roadY) {
      ctx.beginPath();
      ctx.moveTo(mx, my + ry * sy);
      ctx.lineTo(mx + mw, my + ry * sy);
      ctx.stroke();
    }
    // Mission marker.
    const m = G.mission;
    if (m && m.target) {
      const pulse = 1 + Math.sin(G.time * 5) * 0.3;
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.arc(mx + m.target.x * sx, my + m.target.y * sy, 5 * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police blips.
    for (const cop of G.cops) {
      if (cop.dead) continue;
      const cx = cop.kind === "car" ? cop.car.x : cop.x;
      const cy = cop.kind === "car" ? cop.car.y : cop.y;
      ctx.fillStyle = cop.kind === "car" ? "#2d6bff" : "#7aa8ff";
      ctx.beginPath();
      ctx.arc(mx + cx * sx, my + cy * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const p = G.player;
    ctx.save();
    ctx.translate(mx + p.x * sx, my + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    // Camera view rectangle.
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + (G.camera.x - 640) * sx, my + (G.camera.y - 360) * sy, 1280 * sx, 720 * sy);
  }

  function drawObjectiveArrow(ctx, G) {
    const m = G.mission;
    if (!m || !m.target) return;
    const t = m.target;
    const p = G.player;
    const dx = t.x - p.x, dy = t.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 420) return; // marker is on screen already
    const cx = 640, cy = 360;
    const a = Math.atan2(dy, dx);
    const ax = cx + Math.cos(a) * 260;
    const ay = cy + Math.sin(a) * 200;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(Math.round(d) + "m", ax, ay + 30);
  }

  function drawHud(ctx, G) {
    const p = G.player;
    // Top-left: health, armor, cash.
    drawBar(ctx, 16, 16, 220, 20, p.health / 100, "#4caf50", "HEALTH " + Math.round(p.health));
    drawBar(ctx, 16, 42, 220, 16, p.armor / 100, "#39d5ff", "ARMOR " + Math.round(p.armor));
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(16, 64, 220, 26, 6);
    ctx.fill();
    ctx.fillStyle = "#7ee081";
    ctx.font = "bold 17px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(SOL.fmtMoney(G.cash), 26, 83);
    ctx.fillStyle = "#fff";
    ctx.font = "13px sans-serif";
    ctx.fillText("★ " + G.starsCollected + "/10  •  " + (p.weapon === "smg" ? "SMG " + p.smgAmmo : "PISTOL ∞"), 110, 83);
    // Top-right: wanted stars and district.
    drawStars(ctx, G);
    const district = SOL.World.districtAt(G.world, p.x, p.y);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(1000, 52, 264, 30, 6);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(district + " — Solmara", 1252, 73);
    // Speed and car, bottom-right.
    if (!p.onFoot && p.car) {
      const kmh = Math.round(Math.abs(p.car.speed) * 0.36);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.roundRect(1100, 640, 164, 64, 8);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(kmh + "", 1248, 668);
      ctx.font = "12px sans-serif";
      ctx.fillText("km/h", 1248, 686);
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(p.car.name, 1112, 668);
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "#ffb3b3";
      const hpFrac = p.car.hp / p.car.maxHp;
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(1112, 688, 140, 6);
      ctx.fillStyle = hpFrac > 0.4 ? "#7ee081" : "#ff5714";
      ctx.fillRect(1112, 688, 140 * SOL.clamp(hpFrac, 0, 1), 6);
    } else {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.roundRect(1100, 660, 164, 44, 8);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("On foot — press E near a car", 1182, 678);
      ctx.fillText("to steal it", 1182, 695);
    }
    // Mission tracker, top-centre.
    const m = G.mission;
    if (m) {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      const label = m.def.name + (m.target && m.target.label ? " — " + m.target.label : "");
      ctx.font = "bold 15px sans-serif";
      const w = ctx.measureText(label).width + 28;
      ctx.beginPath();
      ctx.roundRect(640 - w / 2, 12, w, 30, 8);
      ctx.fill();
      ctx.fillStyle = "#ffd166";
      ctx.textAlign = "center";
      ctx.fillText(label, 640, 32);
      if (m.timer > 0) {
        ctx.fillStyle = m.timer < 15 ? "#ff5714" : "#fff";
        ctx.font = "bold 18px sans-serif";
        ctx.fillText(SOL.fmtTime(m.timer), 640, 60);
      }
      if (m.index === 3) {
        ctx.fillStyle = "#fff";
        ctx.font = "bold 18px sans-serif";
        ctx.fillText("Survive: " + SOL.fmtTime(m.chaseT), 640, 60);
      }
    }
    // Banners.
    if (G.bannerT > 0) {
      ctx.globalAlpha = SOL.clamp(G.bannerT, 0, 1);
      ctx.fillStyle = "#ffd166";
      ctx.font = "bold 44px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(G.banner, 640, 240);
      ctx.globalAlpha = 1;
    }
    if (G.subBannerT > 0) {
      ctx.globalAlpha = SOL.clamp(G.subBannerT, 0, 1) * 0.9;
      ctx.fillStyle = "#fff";
      ctx.font = "17px sans-serif";
      ctx.textAlign = "center";
      const words = G.subBanner.split(" ");
      let line = "";
      let y = 272;
      const lines = [];
      for (const w of words) {
        if ((line + " " + w).trim().length > 62) {
          lines.push(line.trim());
          line = w;
        } else {
          line += " " + w;
        }
      }
      lines.push(line.trim());
      for (const ln of lines) {
        ctx.fillText(ln, 640, y);
        y += 22;
      }
      ctx.globalAlpha = 1;
    }
    // Transient message.
    if (G.messageT > 0) {
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.font = "bold 15px sans-serif";
      const w = ctx.measureText(G.message).width + 24;
      ctx.beginPath();
      ctx.roundRect(640 - w / 2, 620, w, 30, 8);
      ctx.fill();
      ctx.fillStyle = "#ffd166";
      ctx.textAlign = "center";
      ctx.fillText(G.message, 640, 640);
    }
    drawMinimap(ctx, G);
    drawObjectiveArrow(ctx, G);
    SOL.Render.drawCrosshair(ctx, G);
  }

  window.SOL.Hud = {
    drawHud: drawHud,
    drawMinimap: drawMinimap,
  };
})();
