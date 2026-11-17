// SOLMARA state: the live game state, car models, and the spawn/reset logic.
(function () {
  "use strict";
  const SOL = window.SOL;

  const CAR_MODELS = {
    viento: { name: "Viento", kind: "sedan", color: "#c94f4f", topSpeed: 340, accel: 260, grip: 3.2, hp: 100 },
    cometa: { name: "Cometa GT", kind: "sports", color: "#f2b705", topSpeed: 460, accel: 380, grip: 4.2, hp: 80 },
    bison: { name: "Bison", kind: "van", color: "#7a8a99", topSpeed: 280, accel: 200, grip: 2.6, hp: 160 },
    solcab: { name: "SolCab", kind: "taxi", color: "#ffcf3f", topSpeed: 330, accel: 250, grip: 3.0, hp: 90 },
    interceptor: { name: "SCPD Interceptor", kind: "police", color: "#1f3a93", topSpeed: 430, accel: 360, grip: 4.0, hp: 120 },
  };

  const PED_NAMES = [
    "Mara", "Dario", "Luz", "Kiko", "Tessa", "Rafi", "Nia", "Omar",
    "Bea", "Cato", "Ines", "Yusuf", "Pilar", "Marco", "Sana", "Leo",
  ];

  function makeCar(modelKey, x, y, angle, driver) {
    const m = CAR_MODELS[modelKey];
    return {
      model: modelKey, name: m.name, kind: m.kind, color: m.color,
      x: x, y: y, angle: angle, speed: 0,
      topSpeed: m.topSpeed, accel: m.accel, grip: m.grip,
      hp: m.hp, maxHp: m.hp, driver: driver || null,
      traffic: false, roadAxis: null, roadPos: 0, dir: 1, lane: 0,
      burning: false, dead: false, brakeLight: false, hitT: 0,
      siren: 0, wobble: Math.random() * 6.28,
    };
  }

  function makePed(x, y, rng) {
    const palette = ["#e07a5f", "#81b29a", "#f2cc8f", "#6d6875", "#e5989b", "#90be6d"];
    return {
      x: x, y: y, angle: rng() * Math.PI * 2, speed: 26 + rng() * 22,
      name: PED_NAMES[Math.floor(rng() * PED_NAMES.length)],
      color: palette[Math.floor(rng() * palette.length)],
      state: "walk", fleeX: 0, fleeY: 0, panic: 0,
      walkPhase: rng() * 6.28, targetX: x, targetY: y,
      dead: false, hp: 30,
    };
  }

  function freshState() {
    return {
      mode: "title", // title | playing | paused | complete | failed | wasted | howto | missions
      time: 0,
      world: null,
      player: {
        x: 2400, y: 2050, angle: -Math.PI / 2, speed: 0,
        onFoot: true, car: null, health: 100, armor: 0,
        weapon: "pistol", smgAmmo: 0, aimAngle: -Math.PI / 2,
        fireCooldown: 0, invuln: 0, walkPhase: 0,
      },
      cars: [], peds: [], cops: [], guards: [],
      bullets: [], enemyBullets: [], particles: [], floaters: [],
      wanted: 0, heat: 0, heatTimer: 0, cash: 250,
      missionIndex: -1, mission: null, lastMissionIndex: 0,
      completed: [false, false, false, false, false],
      starsCollected: 0, kills: 0, carsStolen: 0,
      camera: { x: 2400, y: 1800 },
      keys: {}, mouse: { x: 640, y: 360, down: false, clicked: false },
      shot: null, shotT: 0,
      banner: "", bannerT: 0, subBanner: "", subBannerT: 0,
      endInfo: { title: "", text: "", reward: 0 },
      garageTimer: 0, garagePaid: false,
      policeTimer: 0, sirenTimer: 0,
      spawnTimer: 0, message: "", messageT: 0,
      shake: 0, slowmo: 0,
    };
  }

  // Fill the city with parked cars, traffic and pedestrians.
  function populate(G, rng) {
    const world = G.world;
    const models = ["viento", "cometa", "bison", "solcab"];
    // Parked cars along the roads.
    for (let i = 0; i < 14; i++) {
      const vertical = rng() < 0.5;
      const road = vertical
        ? world.roadX[Math.floor(rng() * world.roadX.length)]
        : world.roadY[Math.floor(rng() * world.roadY.length)];
      const along = 300 + rng() * 3000;
      const x = vertical ? road + (rng() < 0.5 ? -38 : 38) : along;
      const y = vertical ? along : road + (rng() < 0.5 ? -38 : 38);
      const angle = vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
      const car = makeCar(models[Math.floor(rng() * models.length)], x, y, angle, null);
      G.cars.push(car);
    }
    // A Cometa GT waits near the plaza for the first mission.
    G.cars.push(makeCar("cometa", 2400, 2150, 0, null));
    // Moving traffic.
    for (let i = 0; i < 16; i++) {
      const vertical = rng() < 0.5;
      let car;
      if (vertical) {
        const rx = world.roadX[Math.floor(rng() * world.roadX.length)];
        const dir = rng() < 0.5 ? 1 : -1;
        car = makeCar(models[Math.floor(rng() * models.length)], rx + dir * -22, 300 + rng() * 3000, dir > 0 ? Math.PI / 2 : -Math.PI / 2, makePed(0, 0, rng));
        car.traffic = true; car.roadAxis = "v"; car.roadPos = rx; car.dir = dir; car.lane = -22 * dir;
        car.speed = 120 + rng() * 60;
      } else {
        const ry = world.roadY[Math.floor(rng() * world.roadY.length)];
        const dir = rng() < 0.5 ? 1 : -1;
        car = makeCar(models[Math.floor(rng() * models.length)], 300 + rng() * 4000, ry + dir * -22, dir > 0 ? 0 : Math.PI, makePed(0, 0, rng));
        car.traffic = true; car.roadAxis = "h"; car.roadPos = ry; car.dir = dir; car.lane = -22 * dir;
        car.speed = 120 + rng() * 60;
      }
      G.cars.push(car);
    }
    // Pedestrians on the sidewalks.
    for (let i = 0; i < 34; i++) {
      const vertical = rng() < 0.5;
      let x, y;
      if (vertical) {
        const rx = world.roadX[Math.floor(rng() * world.roadX.length)];
        x = rx + (rng() < 0.5 ? -62 : 62);
        y = 200 + rng() * 3200;
      } else {
        const ry = world.roadY[Math.floor(rng() * world.roadY.length)];
        x = 200 + rng() * 4400;
        y = ry + (rng() < 0.5 ? -62 : 62);
      }
      G.peds.push(makePed(x, y, rng));
    }
  }

  function resetRun(G, keepProgress) {
    const saved = keepProgress
      ? { cash: G.cash, completed: G.completed.slice(), stars: G.starsCollected }
      : { cash: 250, completed: [false, false, false, false, false], stars: 0 };
    const fresh = freshState();
    fresh.cash = saved.cash;
    fresh.completed = saved.completed;
    fresh.starsCollected = saved.stars;
    fresh.world = G.world;
    Object.keys(G).forEach((k) => delete G[k]);
    Object.assign(G, fresh);
    const rng = SOL.makeRng(777 + Math.floor(Math.random() * 100000));
    populate(G, rng);
    // Restore taken stars.
    if (keepProgress && G.world) {
      G.world.stars.forEach((s, i) => {
        if (i < saved.stars) s.taken = true;
      });
    }
    if (!keepProgress && G.world) {
      // A brand-new game starts with every star hidden again.
      G.world.stars.forEach((s) => { s.taken = false; });
      G.world.pickups.forEach((pk) => { pk.taken = false; });
    }
  }

  window.SOL.State = {
    CAR_MODELS: CAR_MODELS,
    PED_NAMES: PED_NAMES,
    makeCar: makeCar,
    makePed: makePed,
    freshState: freshState,
    populate: populate,
    resetRun: resetRun,
  };
})();
