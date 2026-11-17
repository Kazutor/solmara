// SOLMARA world: the city of Solmara, its six districts, road grid, buildings,
// park, beach, docks, billboards and fixed pickup spots. Generated from one
// fixed seed so the city is identical on every load.
(function () {
  "use strict";
  const SOL = window.SOL;

  const WORLD_W = 4800;
  const WORLD_H = 3600;

  const DISTRICTS = [
    { name: "Palm Heights", x: 0, y: 0, w: 1600, h: 1200, ground: "#e8d9a8", accent: "#c9a86a" },
    { name: "Old Town", x: 1600, y: 0, w: 1600, h: 1200, ground: "#d9c9a3", accent: "#a8875e" },
    { name: "Neon Row", x: 3200, y: 0, w: 1600, h: 1200, ground: "#2c2440", accent: "#ff4fd8" },
    { name: "Harbor Park", x: 0, y: 1200, w: 1600, h: 1200, ground: "#8fbf6f", accent: "#4d8a3f" },
    { name: "The Docks", x: 1600, y: 1200, w: 1600, h: 1200, ground: "#9a938a", accent: "#5e6b7a" },
    { name: "Marina Bay", x: 3200, y: 1200, w: 1600, h: 1200, ground: "#bcd6e2", accent: "#2f7ea8" },
    { name: "Palm Heights", x: 0, y: 2400, w: 2400, h: 1200, ground: "#e8d9a8", accent: "#c9a86a" },
    { name: "Marina Bay", x: 2400, y: 2400, w: 2400, h: 1200, ground: "#bcd6e2", accent: "#2f7ea8" },
  ];

  // Road centre lines: a regular grid across the whole city.
  const ROAD_X = [];
  const ROAD_Y = [];
  for (let x = 400; x < WORLD_W; x += 400) ROAD_X.push(x);
  for (let y = 400; y < WORLD_H; y += 400) ROAD_Y.push(y);
  const ROAD_W = 96;

  // The plaza fountain and the park pond sit in the middle of the city.
  const PLAZA = { x: 2400, y: 1800, r: 150 };
  const PARK = { x: 800, y: 1800, w: 640, h: 560 };
  const POND = { x: 800, y: 1800, rx: 150, ry: 100 };
  const BEACH = { x0: 0, x1: 190 }; // sand strip on the west edge
  const SEA = { x0: 0, x1: 110 }; // animated water west of the sand
  const GARAGE = { x: 2000, y: 1000, w: 260, h: 160, name: "QuickFix Garage" };
  const DOCKS = { x: 2200, y: 1500, w: 700, h: 500 };

  function buildWorld() {
    const rng = SOL.makeRng(20261117);
    const buildings = [];
    const palms = [];
    const billboards = [
      { x: 2400, y: 380, text: "SOLMARA", color: "#ff4fd8" },
      { x: 1200, y: 2380, text: "SUN COAST", color: "#ffb347" },
      { x: 3600, y: 2620, text: "NEON ROW", color: "#39d5ff" },
      { x: 400, y: 1180, text: "PALM HEIGHTS", color: "#7ee081" },
    ];

    // Buildings fill each city block between roads, skipping the park,
    // the plaza, the docks yard and the beach.
    for (let bx = 0; bx < 11; bx++) {
      for (let by = 0; by < 8; by++) {
        const x0 = bx * 400 + 400 + 70;
        const y0 = by * 400 + 400 + 70;
        const x1 = (bx + 1) * 400 + 400 - 70;
        const y1 = (by + 1) * 400 + 400 - 70;
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        if (cx > PARK.x - PARK.w / 2 && cx < PARK.x + PARK.w / 2 &&
            cy > PARK.y - PARK.h / 2 && cy < PARK.y + PARK.h / 2) continue;
        if (SOL.dist(cx, cy, PLAZA.x, PLAZA.y) < 260) continue;
        if (cx > DOCKS.x && cx < DOCKS.x + DOCKS.w &&
            cy > DOCKS.y && cy < DOCKS.y + DOCKS.h) continue;
        if (cx < 300) continue;
        const n = 1 + Math.floor(rng() * 2);
        for (let i = 0; i < n; i++) {
          const w = 90 + rng() * 110;
          const h = 80 + rng() * 110;
          const x = x0 + rng() * Math.max(1, x1 - x0 - w);
          const y = y0 + rng() * Math.max(1, y1 - y0 - h);
          const tall = rng() < 0.22;
          const palette = ["#b08968", "#8d99ae", "#e07a5f", "#6d6875", "#c9ada7", "#457b9d"];
          buildings.push({
            x: x, y: y, w: w, h: h,
            color: SOL.pick(rng, palette),
            roof: tall ? "#3d405b" : "#5a5348",
            tall: tall,
            windows: Math.floor(rng() * 4),
          });
        }
      }
    }

    // Dock warehouses: long sheds with striped roofs.
    const warehouses = [];
    for (let i = 0; i < 4; i++) {
      warehouses.push({
        x: DOCKS.x + 40 + i * 170, y: DOCKS.y + 60, w: 140, h: 260,
        color: i % 2 ? "#7a6a58" : "#5e6b7a", roof: "#3a3f44", tall: false,
      });
    }
    warehouses.forEach((w) => buildings.push(w));

    // Palm trees line the beach, the park paths and Neon Row.
    for (let i = 0; i < 46; i++) {
      palms.push({ x: 150 + rng() * 40, y: 200 + rng() * 3200, s: 0.8 + rng() * 0.5 });
    }
    for (let i = 0; i < 24; i++) {
      palms.push({
        x: PARK.x - PARK.w / 2 + 40 + rng() * (PARK.w - 80),
        y: PARK.y - PARK.h / 2 + 40 + rng() * (PARK.h - 80),
        s: 0.8 + rng() * 0.5,
      });
    }
    for (let i = 0; i < 16; i++) {
      palms.push({ x: 3300 + rng() * 1400, y: 340 + rng() * 40, s: 0.9 + rng() * 0.4 });
    }

    // Fixed pickups scattered around the city.
    const pickups = [
      { kind: "health", x: 800, y: 600 },
      { kind: "armor", x: 3600, y: 600 },
      { kind: "cash", x: 1200, y: 2200 },
      { kind: "smg", x: 4000, y: 2200 },
      { kind: "health", x: 2800, y: 2600 },
      { kind: "armor", x: 600, y: 3000 },
      { kind: "cash", x: 4400, y: 1000 },
      { kind: "smg", x: 1600, y: 3400 },
      { kind: "health", x: 2400, y: 1800 },
      { kind: "cash", x: 3200, y: 1400 },
    ];

    // Ten hidden Solmara Stars, each worth $150.
    const stars = [
      { x: 2400, y: 1800 }, { x: 800, y: 1800 }, { x: 120, y: 600 },
      { x: 4600, y: 3400 }, { x: 4000, y: 400 }, { x: 400, y: 3400 },
      { x: 2800, y: 1000 }, { x: 1600, y: 2600 }, { x: 3600, y: 3000 },
      { x: 2000, y: 600 },
    ].map((p) => ({ x: p.x, y: p.y, taken: false }));

    return {
      w: WORLD_W, h: WORLD_H,
      districts: DISTRICTS,
      roadX: ROAD_X, roadY: ROAD_Y, roadW: ROAD_W,
      plaza: PLAZA, park: PARK, pond: POND,
      beach: BEACH, sea: SEA, garage: GARAGE, docks: DOCKS,
      buildings: buildings, palms: palms,
      billboards: billboards, pickups: pickups, stars: stars,
    };
  }

  function districtAt(world, x, y) {
    for (const d of world.districts) {
      if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
    }
    return "Solmara";
  }

  function onRoad(world, x, y) {
    for (const rx of world.roadX) {
      if (Math.abs(x - rx) < world.roadW / 2) return true;
    }
    for (const ry of world.roadY) {
      if (Math.abs(y - ry) < world.roadW / 2) return true;
    }
    return false;
  }

  // Push a circle out of every building it overlaps. Returns true on a hit.
  function collideBuildings(world, ent, r) {
    let hit = false;
    for (const b of world.buildings) {
      const push = SOL.circleRectPush(ent.x, ent.y, r, b);
      if (push) {
        ent.x += push.x;
        ent.y += push.y;
        hit = true;
      }
    }
    return hit;
  }

  window.SOL.World = {
    buildWorld: buildWorld,
    districtAt: districtAt,
    onRoad: onRoad,
    collideBuildings: collideBuildings,
  };
})();
