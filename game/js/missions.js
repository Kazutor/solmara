// SOLMARA missions: the story of Rico Vega and five jobs across Solmara.
// Each mission is a small state machine with a target marker, optional
// timer, and a cash reward. Progress is saved after every completion.
(function () {
  "use strict";
  const SOL = window.SOL;

  const MISSIONS = [
    {
      id: "first-wheels",
      name: "First Wheels",
      brief: "Rico Vega is back in Solmara with empty pockets. Steal a ride — any car will do — and get moving.",
      reward: 200,
    },
    {
      id: "the-courier",
      name: "The Courier",
      brief: "Luz needs a package run across town to Neon Row. Grab the parcel, then deliver it in 90 seconds. No questions.",
      reward: 400,
    },
    {
      id: "dockside-heat",
      name: "Dockside Heat",
      brief: "A case of dock money is guarded at The Docks. Take down the four guards and grab the case.",
      reward: 600,
    },
    {
      id: "hot-pursuit",
      name: "Hot Pursuit",
      brief: "The SCPD is on you. Survive the chase for 45 seconds, then lose them and lay low until the heat dies.",
      reward: 800,
    },
    {
      id: "the-payday",
      name: "The Payday",
      brief: "The final job: hit the Marina Bay vault, grab the payout, and get to the getaway marker. Two minutes, Rico.",
      reward: 1500,
    },
  ];

  function startMission(G, index) {
    const def = MISSIONS[index];
    if (!def) return;
    G.missionIndex = index;
    G.lastMissionIndex = index;
    G.mission = {
      def: def, index: index, stage: 0, timer: 0,
      target: null, guardsLeft: 0, hasPackage: false, hasCase: false,
      chaseT: 0,
    };
    const p = G.player;
    if (index === 0) {
      G.mission.target = { x: 2400, y: 2150, r: 60, label: "Steal the Cometa GT" };
    } else if (index === 1) {
      G.mission.target = { x: 1200, y: 600, r: 50, label: "Pick up the package" };
    } else if (index === 2) {
      G.mission.target = { x: 2550, y: 1750, r: 70, label: "Reach the docks" };
    } else if (index === 3) {
      SOL.Entities.raiseWanted(G, 3);
      G.mission.target = { x: p.x, y: p.y, r: 90, label: "Survive the chase" };
      G.mission.chaseT = 45;
    } else if (index === 4) {
      G.mission.target = { x: 4000, y: 1800, r: 60, label: "Reach the Marina Bay vault" };
    }
    G.banner = def.name;
    G.bannerT = 3;
    G.subBanner = def.brief;
    G.subBannerT = 5;
    SOL.AudioSys.blip(523, 0.3, "triangle", 0.2, 784);
  }

  function completeMission(G) {
    const m = G.mission;
    if (!m) return;
    G.cash += m.def.reward;
    G.completed[m.index] = true;
    G.endInfo = {
      title: "MISSION PASSED",
      text: m.def.name + " complete. " + SOL.fmtMoney(m.def.reward) + " added to your pocket.",
      reward: m.def.reward,
    };
    G.mode = "complete";
    G.mission = null;
    G.missionIndex = -1;
    SOL.AudioSys.missionWin();
    SOL.Entities.showEndScreen(G);
    saveProgress(G);
  }

  function failMission(G, reason) {
    const m = G.mission;
    G.endInfo = {
      title: "MISSION FAILED",
      text: reason || (m ? m.def.name + " failed." : "Mission failed."),
      reward: 0,
    };
    G.mode = "failed";
    G.mission = null;
    G.missionIndex = -1;
    SOL.AudioSys.missionFail();
    SOL.Entities.showEndScreen(G);
  }

  function saveProgress(G) {
    SOL.storeSave({
      cash: G.cash,
      completed: G.completed,
      starsCollected: G.starsCollected,
      kills: G.kills,
      carsStolen: G.carsStolen,
    });
  }

  function spawnGuards(G) {
    const spots = [
      { x: 2400, y: 1600 }, { x: 2700, y: 1700 },
      { x: 2400, y: 1900 }, { x: 2750, y: 1950 },
    ];
    spots.forEach((s) => {
      G.guards.push({
        x: s.x, y: s.y, angle: 0, hp: 70, dead: false,
        kind: "guard", shootT: 1 + Math.random() * 1.5, speed: 140,
      });
    });
    G.mission.guardsLeft = 4;
  }

  function updateGuards(G, dt) {
    for (const gd of G.guards) {
      if (gd.dead) continue;
      const p = G.player;
      const d = SOL.dist(gd.x, gd.y, p.x, p.y);
      gd.angle = Math.atan2(p.y - gd.y, p.x - gd.x);
      if (d > 300) {
        gd.x += Math.cos(gd.angle) * gd.speed * dt;
        gd.y += Math.sin(gd.angle) * gd.speed * dt;
      } else {
        gd.shootT -= dt;
        if (gd.shootT <= 0) {
          gd.shootT = 1.1 + Math.random() * 0.8;
          const a = gd.angle + (Math.random() - 0.5) * 0.14;
          G.enemyBullets.push({
            x: gd.x + Math.cos(a) * 20, y: gd.y + Math.sin(a) * 20,
            vx: Math.cos(a) * 600, vy: Math.sin(a) * 600,
            t: 0, life: 1.0, damage: 7,
          });
          SOL.AudioSys.shoot(false);
        }
      }
      SOL.World.collideBuildings(G.world, gd, 12);
    }
    const alive = G.guards.filter((g) => !g.dead).length;
    if (G.mission && G.mission.index === 2 && G.mission.stage === 1) {
      if (alive === 0 && G.mission.guardsLeft > 0) {
        G.mission.stage = 2;
        G.mission.target = { x: 2550, y: 1750, r: 50, label: "Grab the case" };
        G.banner = "Guards down — grab the case!";
        G.bannerT = 2.5;
      }
    }
    G.guards = G.guards.filter((g) => !g.dead || g.hp > -50);
  }

  function updateMission(G, dt) {
    const m = G.mission;
    if (!m) return;
    const p = G.player;
    const t = m.target;

    if (m.index === 0) {
      // First Wheels: get into any car.
      if (!p.onFoot) completeMission(G);
      return;
    }

    if (m.index === 1) {
      if (m.stage === 0) {
        if (t && SOL.dist(p.x, p.y, t.x, t.y) < t.r) {
          m.hasPackage = true;
          m.stage = 1;
          m.timer = 90;
          m.target = { x: 4000, y: 600, r: 60, label: "Deliver to Neon Row" };
          G.banner = "Package secured — GO!";
          G.bannerT = 2;
          SOL.AudioSys.pickup();
        }
      } else if (m.stage === 1) {
        m.timer -= dt;
        if (t && SOL.dist(p.x, p.y, t.x, t.y) < t.r) {
          completeMission(G);
        } else if (m.timer <= 0) {
          failMission(G, "The Courier: you ran out of time. Luz found someone faster.");
        }
      }
      return;
    }

    if (m.index === 2) {
      if (m.stage === 0) {
        if (t && SOL.dist(p.x, p.y, t.x, t.y) < t.r) {
          m.stage = 1;
          spawnGuards(G);
          m.target = null;
          G.banner = "Four guards — take them down!";
          G.bannerT = 2.5;
        }
      } else if (m.stage === 2) {
        if (t && SOL.dist(p.x, p.y, t.x, t.y) < t.r) {
          m.hasCase = true;
          completeMission(G);
        }
      }
      return;
    }

    if (m.index === 3) {
      m.chaseT -= dt;
      if (m.chaseT <= 0 && m.stage === 0) {
        m.stage = 1;
        G.banner = "Chase survived — now LOSE them!";
        G.bannerT = 3;
      }
      if (m.stage === 1 && G.wanted === 0) {
        completeMission(G);
      }
      return;
    }

    if (m.index === 4) {
      if (m.stage === 0) {
        if (t && SOL.dist(p.x, p.y, t.x, t.y) < t.r) {
          m.stage = 1;
          m.timer = 120;
          m.target = { x: 800, y: 3000, r: 70, label: "Reach the getaway marker" };
          G.banner = "Vault cracked — run!";
          G.bannerT = 2.5;
          SOL.Entities.raiseWanted(G, 2);
          SOL.AudioSys.pickup();
        }
      } else if (m.stage === 1) {
        m.timer -= dt;
        if (t && SOL.dist(p.x, p.y, t.x, t.y) < t.r) {
          completeMission(G);
        } else if (m.timer <= 0) {
          failMission(G, "The Payday: the vault crew locked down before you got out.");
        }
      }
      return;
    }
  }

  window.SOL.Missions = {
    MISSIONS: MISSIONS,
    startMission: startMission,
    completeMission: completeMission,
    failMission: failMission,
    saveProgress: saveProgress,
    updateGuards: updateGuards,
    updateMission: updateMission,
  };
})();
