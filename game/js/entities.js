// SOLMARA entities: movement, driving, traffic, pedestrians, police,
// combat and pickups. All behaviour is simulated here each frame.
(function () {
  "use strict";
  const SOL = window.SOL;

  function addFloater(G, x, y, text, color) {
    G.floaters.push({ x: x, y: y, text: text, color: color || "#fff", t: 0 });
  }

  function addParticles(G, x, y, n, color, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (speed || 120) * (0.4 + Math.random() * 0.8);
      G.particles.push({
        x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        t: 0, life: 0.4 + Math.random() * 0.5, color: color, size: 2 + Math.random() * 3,
      });
    }
  }

  function explodeCar(G, car) {
    if (car.dead) return;
    car.dead = true;
    car.burning = false;
    addParticles(G, car.x, car.y, 40, "#ff9f1c", 260);
    addParticles(G, car.x, car.y, 24, "#ff5714", 200);
    addParticles(G, car.x, car.y, 18, "#666", 120);
    SOL.AudioSys.explosion();
    G.shake = 10;
    // Splash damage to anyone nearby. A driver inside a car is shielded:
    // the blast hurts the car instead of the person.
    const hurt = (e) => {
      if (SOL.dist(e.x, e.y, car.x, car.y) < 130) {
        if (e === G.player && !G.player.onFoot && G.player.car) {
          G.player.car.hp -= 40;
          if (G.player.car.hp <= 0 && !G.player.car.burning) G.player.car.burning = true;
        } else {
          damageEntity(G, e, 70, "explosion");
        }
      }
    };
    hurt(G.player);
    G.peds.forEach(hurt);
    G.cops.forEach(hurt);
    G.guards.forEach(hurt);
    G.cars.forEach((c) => {
      if (c !== car && SOL.dist(c.x, c.y, car.x, car.y) < 130) {
        c.hp -= 60;
        if (c.hp <= 0) explodeCar(G, c);
      }
    });
  }

  function damageEntity(G, ent, dmg, source) {
    if (ent === G.player) {
      if (G.player.invuln > 0) return;
      let left = dmg;
      if (G.player.armor > 0) {
        const absorbed = Math.min(G.player.armor, left * 0.6);
        G.player.armor -= absorbed;
        left -= absorbed;
      }
      G.player.health -= left;
      G.player.invuln = 0.35;
      if (G.player.health <= 0) {
        G.player.health = 0;
        wasted(G);
      }
      return;
    }
    ent.hp -= dmg;
    if (ent.hp <= 0 && !ent.dead) {
      ent.dead = true;
      addParticles(G, ent.x, ent.y, 16, "#c1121f", 160);
      if (ent.kind === "ped" || ent.isPed) {
        G.kills++;
        raiseWanted(G, 1);
      } else {
        G.kills++;
        if (source === "player") raiseWanted(G, 0);
      }
    }
  }

  function raiseWanted(G, stars) {
    if (stars <= 0) return;
    G.wanted = SOL.clamp(G.wanted + stars, 0, 5);
    G.heat = 100;
    G.heatTimer = 0;
  }

  function wasted(G) {
    if (G.mode !== "playing") return;
    G.mode = "wasted";
    G.endInfo = {
      title: "WASTED",
      text: "Solmara's streets got the better of you. The crew will remember this one.",
      reward: 0,
    };
    SOL.AudioSys.missionFail();
    showEndScreen(G);
  }

  function showEndScreen(G) {
    const el = document.getElementById("end-screen");
    const title = document.getElementById("end-title");
    const text = document.getElementById("end-text");
    const reward = document.getElementById("end-reward");
    if (!el) return;
    title.textContent = G.endInfo.title;
    title.style.color = G.endInfo.title === "WASTED" ? "#ff4d4d" : "#ffd166";
    text.textContent = G.endInfo.text;
    reward.textContent = G.endInfo.reward > 0
      ? "Reward: " + SOL.fmtMoney(G.endInfo.reward)
      : "";
    el.classList.remove("hidden");
  }

  function hideEndScreen() {
    const el = document.getElementById("end-screen");
    if (el) el.classList.add("hidden");
  }

  // --- Player on foot ---
  function updatePlayerFoot(G, dt) {
    const p = G.player;
    const k = G.keys;
    let mx = 0, my = 0;
    if (k["KeyW"] || k["ArrowUp"]) my -= 1;
    if (k["KeyS"] || k["ArrowDown"]) my += 1;
    if (k["KeyA"] || k["ArrowLeft"]) mx -= 1;
    if (k["KeyD"] || k["ArrowRight"]) mx += 1;
    const len = Math.hypot(mx, my) || 1;
    const speed = 210;
    p.x += (mx / len) * speed * dt * (mx || my ? 1 : 0);
    p.y += (my / len) * speed * dt * (mx || my ? 1 : 0);
    if (mx || my) {
      p.angle = Math.atan2(my, mx);
      p.walkPhase += dt * 10;
    }
    p.x = SOL.clamp(p.x, 30, G.world.w - 30);
    p.y = SOL.clamp(p.y, 30, G.world.h - 30);
    SOL.World.collideBuildings(G.world, p, 16);
    // Aim follows the mouse.
    p.aimAngle = Math.atan2(
      G.mouse.worldY - p.y, G.mouse.worldX - p.x
    );
    p.fireCooldown -= dt;
    if (G.mouse.down && p.fireCooldown <= 0) shoot(G, p);
  }

  function shoot(G, shooter) {
    const p = G.player;
    const smg = p.weapon === "smg" && p.smgAmmo > 0;
    const rate = smg ? 0.09 : 0.28;
    p.fireCooldown = rate;
    if (smg) p.smgAmmo--;
    if (p.weapon === "smg" && p.smgAmmo <= 0) p.weapon = "pistol";
    const spread = smg ? 0.09 : 0.02;
    const a = p.aimAngle + (Math.random() - 0.5) * spread;
    G.bullets.push({
      x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22,
      vx: Math.cos(a) * 900, vy: Math.sin(a) * 900,
      t: 0, life: 0.7, damage: smg ? 16 : 26, fromPlayer: true,
    });
    SOL.AudioSys.shoot(smg);
    addParticles(G, p.x + Math.cos(a) * 26, p.y + Math.sin(a) * 26, 3, "#ffd166", 90);
    // Gunfire scares pedestrians and draws police attention.
    G.peds.forEach((ped) => {
      if (SOL.dist(ped.x, ped.y, p.x, p.y) < 420) {
        ped.state = "flee";
        ped.fleeX = p.x; ped.fleeY = p.y; ped.panic = 3;
      }
    });
    raiseWanted(G, 0);
    if (G.wanted === 0) {
      G.heat += 12;
      if (G.heat >= 100) { G.wanted = 1; G.heat = 0; }
    }
  }

  // --- Driving ---
  function nearestCar(G, x, y, maxDist) {
    let best = null, bestD = maxDist;
    for (const c of G.cars) {
      if (c.dead) continue;
      const d = SOL.dist(c.x, c.y, x, y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function tryEnterCar(G) {
    const p = G.player;
    const car = nearestCar(G, p.x, p.y, 90);
    if (!car) return;
    if (car.driver) {
      // The driver bails out and runs for the sidewalk.
      const d = car.driver;
      d.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
      d.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
      d.state = "flee"; d.fleeX = car.x; d.fleeY = car.y; d.panic = 4;
      G.peds.push(d);
      car.driver = null;
      car.traffic = false;
      addFloater(G, car.x, car.y - 30, "CAR STOLEN!", "#ffcf3f");
      G.carsStolen++;
    }
    // Any theft draws heat, parked car or not.
    raiseWanted(G, 1);
    p.car = car;
    p.onFoot = false;
    p.x = car.x; p.y = car.y;
    SOL.AudioSys.blip(180, 0.15, "triangle", 0.15, 320);
  }

  function exitCar(G) {
    const p = G.player;
    const car = p.car;
    if (!car) return;
    p.car = null;
    p.onFoot = true;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    p.speed = 0;
    car.speed *= 0.3;
  }

  function updatePlayerCar(G, dt) {
    const p = G.player;
    const car = p.car;
    const k = G.keys;
    const accelIn = (k["KeyW"] || k["ArrowUp"]) ? 1 : 0;
    const brakeIn = (k["KeyS"] || k["ArrowDown"]) ? 1 : 0;
    const steerIn = ((k["KeyA"] || k["ArrowLeft"]) ? -1 : 0) + ((k["KeyD"] || k["ArrowRight"]) ? 1 : 0);
    if (accelIn) car.speed += car.accel * dt;
    if (brakeIn) car.speed -= car.accel * 1.4 * dt;
    car.speed -= car.speed * 0.55 * dt; // drag
    if (k["Space"]) car.speed -= car.speed * 2.2 * dt; // handbrake
    car.speed = SOL.clamp(car.speed, -car.topSpeed * 0.35, car.topSpeed);
    const steer = steerIn * (car.speed >= 0 ? 1 : -1);
    car.angle += steer * car.grip * 0.55 * dt * SOL.clamp(Math.abs(car.speed) / 120, 0, 1);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const beforeX = car.x, beforeY = car.y;
    car.x = SOL.clamp(nx, 40, G.world.w - 40);
    car.y = SOL.clamp(ny, 40, G.world.h - 40);
    const hitBuilding = SOL.World.collideBuildings(G.world, car, 24);
    if (hitBuilding && Math.abs(car.speed) > 120) {
      car.hp -= Math.abs(car.speed) * 0.06;
      SOL.AudioSys.crash();
      addParticles(G, car.x, car.y, 8, "#ccc", 120);
      car.speed *= 0.4;
    }
    // Bumping other cars. Impact damage is rate-limited so a long overlap
    // (a police car shoving you) does not shred the car in one second.
    car.hitT -= dt;
    for (const other of G.cars) {
      if (other === car || other.dead) continue;
      const d = SOL.dist(car.x, car.y, other.x, other.y);
      if (d < 44 && d > 0.01) {
        const push = (44 - d) / 2;
        const ux = (car.x - other.x) / d, uy = (car.y - other.y) / d;
        car.x += ux * push; car.y += uy * push;
        other.x -= ux * push; other.y -= uy * push;
        const impact = Math.abs(car.speed) + Math.abs(other.speed || 0);
        if (impact > 160 && car.hitT <= 0) {
          car.hitT = 0.6;
          car.hp -= impact * 0.02;
          other.hp -= impact * 0.02;
          SOL.AudioSys.crash();
          addParticles(G, (car.x + other.x) / 2, (car.y + other.y) / 2, 6, "#ddd", 100);
        }
        car.speed *= 0.85;
        if (other.traffic) other.speed *= 0.5;
      }
    }
    if (car.hp <= 0 && !car.burning && !car.dead) {
      car.burning = true;
      addFloater(G, car.x, car.y - 30, "ENGINE FIRE!", "#ff5714");
    }
    if (car.burning) {
      car.hp -= 14 * dt;
      addParticles(G, car.x, car.y, 2, "#ff9f1c", 80);
      if (car.hp <= -30) explodeCar(G, car);
    }
    p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
    p.aimAngle = Math.atan2(G.mouse.worldY - p.y, G.mouse.worldX - p.x);
    p.fireCooldown -= dt;
    if (G.mouse.down && p.fireCooldown <= 0 && !car.traffic) shoot(G, p);
    SOL.AudioSys.setEngine(Math.abs(car.speed) / car.topSpeed, true);
  }

  // --- Traffic ---
  function updateTraffic(G, dt) {
    for (const car of G.cars) {
      if (!car.traffic || car.dead) continue;
      // Stop for a car ahead in the same lane.
      let blocked = false;
      for (const other of G.cars) {
        if (other === car || other.dead) continue;
        if (car.roadAxis === "v") {
          if (Math.abs(other.x - car.x) < 40) {
            const ahead = (other.y - car.y) * car.dir;
            if (ahead > 0 && ahead < 90) blocked = true;
          }
        } else {
          if (Math.abs(other.y - car.y) < 40) {
            const ahead = (other.x - car.x) * car.dir;
            if (ahead > 0 && ahead < 90) blocked = true;
          }
        }
      }
      const target = blocked ? 0 : 130;
      car.speed += (target - car.speed) * dt * 1.2;
      if (car.roadAxis === "v") {
        car.y += car.speed * car.dir * dt;
        car.x = car.roadPos + car.lane;
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (car.y < 150) { car.y = 150; car.dir = 1; }
        if (car.y > G.world.h - 150) { car.y = G.world.h - 150; car.dir = -1; }
      } else {
        car.x += car.speed * car.dir * dt;
        car.y = car.roadPos + car.lane;
        car.angle = car.dir > 0 ? 0 : Math.PI;
        if (car.x < 150) { car.x = 150; car.dir = 1; }
        if (car.x > G.world.w - 150) { car.x = G.world.w - 150; car.dir = -1; }
      }
      if (car.hp <= 0 && !car.dead) explodeCar(G, car);
    }
  }

  // --- Pedestrians ---
  function updatePeds(G, dt) {
    for (const ped of G.peds) {
      if (ped.dead) continue;
      ped.walkPhase += dt * 8;
      if (ped.state === "flee") {
        ped.panic -= dt;
        const a = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
        ped.x += Math.cos(a) * 190 * dt;
        ped.y += Math.sin(a) * 190 * dt;
        ped.angle = a;
        if (ped.panic <= 0) ped.state = "walk";
      } else {
        // Stroll toward a nearby waypoint, then pick a new one.
        if (SOL.dist(ped.x, ped.y, ped.targetX, ped.targetY) < 24) {
          ped.targetX = SOL.clamp(ped.x + (Math.random() - 0.5) * 500, 60, G.world.w - 60);
          ped.targetY = SOL.clamp(ped.y + (Math.random() - 0.5) * 500, 60, G.world.h - 60);
        }
        const a = Math.atan2(ped.targetY - ped.y, ped.targetX - ped.x);
        ped.angle = a;
        ped.x += Math.cos(a) * ped.speed * dt;
        ped.y += Math.sin(a) * ped.speed * dt;
      }
      ped.x = SOL.clamp(ped.x, 30, G.world.w - 30);
      ped.y = SOL.clamp(ped.y, 30, G.world.h - 30);
      SOL.World.collideBuildings(G.world, ped, 12);
    }
    G.peds = G.peds.filter((p) => !p.dead || p.hp > -100);
  }

  // --- Police ---
  function spawnPoliceCar(G) {
    const p = G.player;
    const a = Math.random() * Math.PI * 2;
    const d = 700 + Math.random() * 300;
    const x = SOL.clamp(p.x + Math.cos(a) * d, 80, G.world.w - 80);
    const y = SOL.clamp(p.y + Math.sin(a) * d, 80, G.world.h - 80);
    const car = SOL.State.makeCar("interceptor", x, y, Math.atan2(p.y - y, p.x - x), null);
    car.police = true;
    G.cars.push(car);
    G.cops.push({ kind: "car", car: car, shootT: 1 + Math.random() });
    return car;
  }

  function spawnPoliceCarForShot(G) {
    // Deterministic-ish chase setup for screenshots: a police car right
    // behind the player, already in pursuit.
    const p = G.player;
    const a = p.angle + Math.PI + (Math.random() - 0.5) * 0.6;
    const x = SOL.clamp(p.x + Math.cos(a) * 260, 80, G.world.w - 80);
    const y = SOL.clamp(p.y + Math.sin(a) * 260, 80, G.world.h - 80);
    const car = SOL.State.makeCar("interceptor", x, y, Math.atan2(p.y - y, p.x - x), null);
    car.police = true;
    car.speed = 300;
    G.cars.push(car);
    G.cops.push({ kind: "car", car: car, shootT: 1 });
    return car;
  }

  function spawnFootCop(G) {
    const p = G.player;
    const a = Math.random() * Math.PI * 2;
    const x = SOL.clamp(p.x + Math.cos(a) * 320, 60, G.world.w - 60);
    const y = SOL.clamp(p.y + Math.sin(a) * 320, 60, G.world.h - 60);
    const cop = {
      x: x, y: y, angle: 0, hp: 60, dead: false, isPed: false,
      kind: "cop", shootT: 1.2 + Math.random(), speed: 170,
    };
    G.cops.push(cop);
    return cop;
  }

  function updatePolice(G, dt) {
    // Spawn pressure scales with the wanted level.
    const wantCars = G.wanted >= 1 ? Math.min(G.wanted, 3) : 0;
    const liveCars = G.cops.filter((c) => c.kind === "car" && !c.car.dead).length;
    G.policeTimer -= dt;
    if (G.wanted > 0 && liveCars < wantCars && G.policeTimer <= 0) {
      spawnPoliceCar(G);
      G.policeTimer = 2.5;
      if (Math.random() < 0.6) SOL.AudioSys.siren();
    }
    const wantCops = G.wanted >= 3 ? G.wanted - 2 : 0;
    const liveCops = G.cops.filter((c) => c.kind === "cop" && !c.dead).length;
    if (G.wanted > 0 && liveCops < wantCops && G.policeTimer <= 0) {
      spawnFootCop(G);
      G.policeTimer = 3;
    }
    for (const cop of G.cops) {
      if (cop.dead) continue;
      const p = G.player;
      if (cop.kind === "car") {
        const car = cop.car;
        if (car.dead) { cop.dead = true; continue; }
        const d = SOL.dist(car.x, car.y, p.x, p.y);
        const targetAngle = Math.atan2(p.y - car.y, p.x - car.x);
        car.angle += SOL.angleDiff(car.angle, targetAngle) * SOL.clamp(dt * 2.2, 0, 1);
        const wantSpeed = d > 120 ? car.topSpeed * 0.92 : car.topSpeed * 0.5;
        car.speed += (wantSpeed - car.speed) * dt * 0.9;
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
        car.x = SOL.clamp(car.x, 40, G.world.w - 40);
        car.y = SOL.clamp(car.y, 40, G.world.h - 40);
        SOL.World.collideBuildings(G.world, car, 24);
        car.siren += dt * 6;
        // Ram the player's car or the player.
        if (d < 52) {
          if (!p.onFoot && p.car) {
            p.car.hp -= 22 * dt * 10 * 0.12;
            p.car.speed *= 0.94;
          } else {
            damageEntity(G, p, 12 * dt * 4, "ram");
          }
          if (Math.random() < dt * 4) SOL.AudioSys.crash();
        }
        if (car.hp <= 0 && !car.dead) explodeCar(G, car);
      } else {
        // Foot cop chases, then stops and shoots from range.
        const d = SOL.dist(cop.x, cop.y, p.x, p.y);
        cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
        if (d > 260) {
          cop.x += Math.cos(cop.angle) * cop.speed * dt;
          cop.y += Math.sin(cop.angle) * cop.speed * dt;
        } else {
          cop.shootT -= dt;
          if (cop.shootT <= 0) {
            cop.shootT = 0.9 + Math.random() * 0.7;
            const a = cop.angle + (Math.random() - 0.5) * 0.12;
            G.enemyBullets.push({
              x: cop.x + Math.cos(a) * 20, y: cop.y + Math.sin(a) * 20,
              vx: Math.cos(a) * 620, vy: Math.sin(a) * 620,
              t: 0, life: 1.0, damage: 8,
            });
            SOL.AudioSys.shoot(false);
          }
        }
        SOL.World.collideBuildings(G.world, cop, 12);
      }
    }
    G.cops = G.cops.filter((c) => !c.dead || (c.kind === "car" && !c.car.dead));
  }

  // --- Bullets, particles, pickups, wanted decay ---
  function updateBullets(G, dt) {
    for (const b of G.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.t += dt;
      // Hit a building?
      let blocked = false;
      for (const bd of G.world.buildings) {
        if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) {
          blocked = true;
          addParticles(G, b.x, b.y, 4, "#d9d9d9", 90);
          break;
        }
      }
      if (blocked) { b.t = b.life; continue; }
      // Hit a pedestrian, cop, guard or car.
      const targets = [];
      G.peds.forEach((e) => targets.push(e));
      G.cops.forEach((c) => { if (c.kind === "cop") targets.push(c); });
      G.guards.forEach((e) => targets.push(e));
      for (const e of targets) {
        if (e.dead) continue;
        if (SOL.dist(b.x, b.y, e.x, e.y) < 18) {
          damageEntity(G, e, b.damage, "player");
          addParticles(G, b.x, b.y, 6, "#c1121f", 130);
          b.t = b.life;
          break;
        }
      }
      if (b.t >= b.life) continue;
      for (const car of G.cars) {
        if (car.dead) continue;
        const dx = b.x - car.x, dy = b.y - car.y;
        const ca = Math.cos(-car.angle), sa = Math.sin(-car.angle);
        const lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;
        if (Math.abs(lx) < 34 && Math.abs(ly) < 17) {
          car.hp -= b.damage;
          addParticles(G, b.x, b.y, 5, "#ffd166", 110);
          if (car.hp <= 0 && !car.burning && !car.dead) {
            car.burning = true;
            if (car.driver) {
              const d = car.driver;
              d.x = car.x; d.y = car.y; d.state = "flee";
              d.fleeX = car.x; d.fleeY = car.y; d.panic = 4;
              G.peds.push(d);
              car.driver = null;
            }
          }
          b.t = b.life;
          break;
        }
      }
    }
    G.bullets = G.bullets.filter((b) => b.t < b.life);

    for (const b of G.enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.t += dt;
      const p = G.player;
      const inCar = !p.onFoot && p.car;
      const tx = inCar ? p.car.x : p.x;
      const ty = inCar ? p.car.y : p.y;
      const radius = inCar ? 30 : 15;
      if (SOL.dist(b.x, b.y, tx, ty) < radius) {
        if (inCar) {
          p.car.hp -= b.damage;
          if (p.car.hp <= 0 && !p.car.burning) p.car.burning = true;
        } else {
          damageEntity(G, p, b.damage, "enemy");
        }
        b.t = b.life;
      }
    }
    G.enemyBullets = G.enemyBullets.filter((b) => b.t < b.life);
  }

  function updatePickups(G, dt) {
    const p = G.player;
    for (const pk of G.world.pickups) {
      if (pk.taken) continue;
      if (SOL.dist(p.x, p.y, pk.x, pk.y) < 34) {
        pk.taken = true;
        if (pk.kind === "health") { p.health = Math.min(100, p.health + 50); addFloater(G, pk.x, pk.y - 20, "+50 HEALTH", "#7ee081"); }
        if (pk.kind === "armor") { p.armor = Math.min(100, p.armor + 50); addFloater(G, pk.x, pk.y - 20, "+50 ARMOR", "#39d5ff"); }
        if (pk.kind === "cash") { G.cash += 150; addFloater(G, pk.x, pk.y - 20, "+$150", "#ffd166"); }
        if (pk.kind === "smg") { p.weapon = "smg"; p.smgAmmo += 120; addFloater(G, pk.x, pk.y - 20, "SMG +120 AMMO", "#ff9f1c"); }
        SOL.AudioSys.pickup();
      }
    }
    for (const s of G.world.stars) {
      if (s.taken) continue;
      if (SOL.dist(p.x, p.y, s.x, s.y) < 34) {
        s.taken = true;
        G.starsCollected++;
        G.cash += 150;
        addFloater(G, s.x, s.y - 20, "SOLMARA STAR +$150", "#ffd166");
        SOL.AudioSys.star();
      }
    }
  }

  function updateWanted(G, dt) {
    if (G.wanted > 0) {
      // Heat cools when the player is far from police and not committing crimes.
      const nearCop = G.cops.some((c) => {
        const cx = c.kind === "car" ? c.car.x : c.x;
        const cy = c.kind === "car" ? c.car.y : c.y;
        return SOL.dist(cx, cy, G.player.x, G.player.y) < 500;
      });
      if (!nearCop) {
        G.heatTimer += dt;
        if (G.heatTimer > 6) {
          G.wanted--;
          G.heatTimer = 0;
          addFloater(G, G.player.x, G.player.y - 30, "HEAT COOLING...", "#9ecbff");
        }
      } else {
        G.heatTimer = 0;
      }
    }
    // Garage: hold F on the forecourt to repair and clear up to 2 stars.
    const g = G.world.garage;
    const inZone = G.player.x > g.x && G.player.x < g.x + g.w &&
      G.player.y > g.y && G.player.y < g.y + g.h;
    if (inZone && !G.player.onFoot && G.player.car && G.keys["KeyF"]) {
      if (!G.garagePaid) {
        if (G.cash >= 150) {
          G.cash -= 150;
          G.garagePaid = true;
          G.garageTimer = 0;
          addFloater(G, G.player.x, G.player.y - 30, "QUICKFIX -$150", "#7ee081");
        } else {
          G.message = "Not enough cash for QuickFix ($150)";
          G.messageT = 2;
        }
      }
      if (G.garagePaid) {
        G.garageTimer += dt;
        G.player.car.hp = Math.min(G.player.car.maxHp, G.player.car.hp + 60 * dt);
        G.player.car.burning = false;
        if (G.garageTimer > 1.5 && G.wanted > 0) {
          G.wanted = Math.max(0, G.wanted - 2);
          G.garageTimer = 0;
          G.garagePaid = false;
          addFloater(G, G.player.x, G.player.y - 30, "WANTED CLEARED", "#7ee081");
        }
      }
    } else {
      G.garagePaid = false;
      G.garageTimer = 0;
    }
  }

  function updateParticles(G, dt) {
    for (const pt of G.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.96; pt.vy *= 0.96;
      pt.t += dt;
    }
    G.particles = G.particles.filter((pt) => pt.t < pt.life);
    for (const f of G.floaters) f.t += dt;
    G.floaters = G.floaters.filter((f) => f.t < 1.6);
  }

  window.SOL.Entities = {
    addFloater: addFloater,
    addParticles: addParticles,
    explodeCar: explodeCar,
    damageEntity: damageEntity,
    raiseWanted: raiseWanted,
    wasted: wasted,
    showEndScreen: showEndScreen,
    hideEndScreen: hideEndScreen,
    updatePlayerFoot: updatePlayerFoot,
    shoot: shoot,
    nearestCar: nearestCar,
    tryEnterCar: tryEnterCar,
    exitCar: exitCar,
    updatePlayerCar: updatePlayerCar,
    updateTraffic: updateTraffic,
    updatePeds: updatePeds,
    updatePolice: updatePolice,
    updateBullets: updateBullets,
    updatePickups: updatePickups,
    updateWanted: updateWanted,
    updateParticles: updateParticles,
    spawnPoliceCarForShot: spawnPoliceCarForShot,
  };
})();
