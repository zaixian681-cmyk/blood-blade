/* ═══════════════════════════════════════════════════════════
   art.js — 武侠山水补完
   层叠远山 / 青竹林 / 苍松 / 岩壁 / 石阶山路 /
   悬崖栈道 / 绳索吊桥 / 石拱桥 / 青石板街
   ═══════════════════════════════════════════════════════════ */
J.Art = (function () {
  var A = { ridge: null, groups: [], t: 0 };

  var CO = {
    stone: 0x8e8b80, stoneD: 0x6c695f, stoneL: 0xaaa79b,
    wood: 0x77522f, woodD: 0x4a3220, woodL: 0x9a7046,
    bamboo: 0x6c8c3e, bambooL: 0x87a44f, leaf: 0x53772e,
    pine: 0x3b5226, pineL: 0x4a6430, rock: 0x8b887e, rockD: 0x6b6860,
    dirt: 0x7d6a4b
  };
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var H = function (x, z) { return J.Terrain.heightAt(x, z); };

  /* ── 层叠远山：4 层，随高度变色，带雾 ── */
  function buildRidges() {
    var layer = [];
    var cfg = [
      { r: 520, h: 130, c: 0x8fa6b8, y: 0 },
      { r: 430, h: 104, c: 0x7c95a8, y: 2 },
      { r: 340, h: 78, c: 0x6b8598, y: 4 },
      { r: 258, h: 54, c: 0x5c7688, y: 6 }
    ];
    for (var li = 0; li < cfg.length; li++) {
      var cf = cfg[li], N = 92;
      var pos = [], col = [], idx = [];
      var cTop = new THREE.Color(cf.c).lerp(new THREE.Color(0xbcd2dc), 0.35);
      var cBot = new THREE.Color(cf.c).clone().multiplyScalar(0.55);
      var ph = li * 2.1;
      for (var i = 0; i <= N; i++) {
        var a = i / N * Math.PI * 2;
        var n = Math.sin(a * 3.1 + ph) * 0.40 + Math.sin(a * 6.7 + ph * 2.3) * 0.22 +
          Math.sin(a * 12.9 + ph * 0.7) * 0.10 + Math.sin(a * 25.3 + ph) * 0.04;
        var hgt = cf.h * (0.68 + n * 0.75);
        var x = Math.cos(a) * cf.r, z = Math.sin(a) * cf.r;
        pos.push(x, -80, z); col.push(cBot.r, cBot.g, cBot.b);
        pos.push(x, hgt * 0.55, z); col.push((cBot.r + cTop.r) / 2, (cBot.g + cTop.g) / 2, (cBot.b + cTop.b) / 2);
        pos.push(x, hgt, z); col.push(cTop.r, cTop.g, cTop.b);
      }
      for (var k = 0; k < N; k++) {
        var b = k * 3, m = (k + 1) * 3;
        idx.push(b, m, b + 1, b + 1, m, m + 1);
        idx.push(b + 1, m + 1, b + 2, b + 2, m + 1, m + 2);
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      var mat = new THREE.MeshBasicMaterial({
        vertexColors: true, side: THREE.DoubleSide, fog: true, depthWrite: false
      });
      var mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = -880 + li;
      mesh.position.y = cf.y;
      J.S.add(mesh);
      layer.push(mesh);
    }
    A.ridge = layer;
  }

  /* ── 竹林：成片，带竹节与竹叶 ── */
  function bambooGrove(mbLeaf, mbStalk, cx, cz, n, rad) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * rad;
      var x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      var y = H(x, z);
      if (y < 4) continue;
      var hh = rnd(4.4, 7.6), seg = 4;
      for (var s = 0; s < seg; s++) {
        mbStalk.cyl(x, y + s * (hh / seg), z, 0.075 - s * 0.004, hh / seg * 0.97, 5,
          s % 2 ? CO.bamboo : CO.bambooL);
      }
      for (var lf = 0; lf < 5; lf++) {
        var la = Math.random() * 6.28, lr = rnd(0.35, 1.05);
        mbLeaf.box(x + Math.cos(la) * lr, y + hh * rnd(0.62, 1.0), z + Math.sin(la) * lr,
          rnd(0.5, 1.0), 0.03, rnd(0.18, 0.3), Math.random() > 0.4 ? CO.leaf : CO.bamboo,
          { ry: la, rz: rnd(-0.3, 0.2) });
      }
    }
  }

  /* ── 苍松 ── */
  function pine(mb, x, z, s) {
    var y = H(x, z);
    mb.cyl(x, y - 0.2, z, 0.20 * s, 2.6 * s, 6, CO.woodD);
    for (var i = 0; i < 4; i++) {
      var yy = y + 1.7 * s + i * 0.78 * s;
      var rr = (1.9 - i * 0.38) * s;
      mb.cyl(x, yy, z, rr, 0.9 * s, 9, i % 2 ? CO.pine : CO.pineL, { r2: rr * 0.55 });
    }
    J.Col.add(x - 0.24, y, z - 0.24, x + 0.24, y + 4 * s, z + 0.24, 'thin');
  }

  /* ── 岩壁：沿崖面的层叠巨岩 ── */
  function cliffRock(mb, x, z, s) {
    var y = H(x, z);
    var ry = Math.random() * 3.14;
    mb.taper(x, y - s * 0.2, z, s * 1.6, s * 1.35, s * 1.1, s * 0.95, s * 1.25, CO.rock, { ry: ry });
    mb.box(x + s * 0.6, y + s * 0.4, z + s * 0.25, s * 0.8, s * 0.85, s * 0.7, CO.rockD,
      { ry: ry + 0.6, rz: rnd(-0.2, 0.2), tint: 0.92 + Math.random() * 0.12 });
    mb.box(x - s * 0.45, y + s * 0.95, z - s * 0.3, s * 0.7, s * 0.45, s * 0.6, CO.rock,
      { ry: ry - 0.4, rz: rnd(-0.25, 0.25), tint: 1.04 });
    if (s > 1.2) J.Col.add(x - s * 0.75, y, z - s * 0.65, x + s * 0.75, y + s * 1.3, z + s * 0.65, 'wall');
  }

  /* ── 山路石阶（沿地形铺） ── */
  function stoneStairs(mb, x0, z0, x1, z1, n, wide) {
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      var x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      var y = H(x, z);
      var ang = Math.atan2(x1 - x0, z1 - z0);
      mb.box(x, y + 0.06, z, wide, 0.16, 1.05, i % 2 ? CO.stoneD : CO.stoneL, { ry: ang });
      /* 两侧护石 */
      if (i % 3 === 0) {
        for (var sd = -1; sd <= 1; sd += 2) {
          var sx = x + Math.cos(ang) * sd * wide * 0.55;
          var sz = z - Math.sin(ang) * sd * wide * 0.55;
          mb.box(sx, H(sx, sz) + 0.26, sz, 0.34, 0.5, 0.34, CO.stoneD);
        }
      }
    }
  }

  /* ── 悬崖栈道：木板 + 立柱 + 绳栏 ── */
  function plankWalk(mbWood, mbStone, x0, z0, x1, z1, n, wide) {
    var ang = Math.atan2(x1 - x0, z1 - z0);
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      var x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      var y = H(x, z) + 0.28;
      mbWood.box(x, y, z, wide, 0.16, 1.05, i % 2 ? CO.wood : CO.woodL, { ry: ang });
      /* 承托横木 */
      if (i % 2 === 0) {
        mbWood.box(x, y - 0.28, z, wide + 0.6, 0.16, 0.16, CO.woodD, { ry: ang, rz: 0.05 });
        /* 支桩打进崖壁 */
        for (var sd = -1; sd <= 1; sd += 2) {
          var px = x + Math.cos(ang) * sd * wide * 0.5;
          var pz = z - Math.sin(ang) * sd * wide * 0.5;
          var gy = H(px, pz);
          if (gy < y - 0.4) {
            mbStone.cyl(px, y - 1.6, pz, 0.11, 1.5, 5, CO.woodD);
          }
          mbWood.box(px, y + 0.55, pz, 0.10, 1.1, 0.10, CO.woodD);
        }
      }
      /* 绳索（用细长盒近似） */
      if (i < n - 1) {
        var x2 = x0 + (x1 - x0) * ((i + 1) / (n - 1)), z2 = z0 + (z1 - z0) * ((i + 1) / (n - 1));
        var y2 = H(x2, z2) + 0.28;
        for (var s2 = -1; s2 <= 1; s2 += 2) {
          var ox = Math.cos(ang) * s2 * wide * 0.5, oz = -Math.sin(ang) * s2 * wide * 0.5;
          mbWood.box((x + x2) / 2 + ox, (y + y2) / 2 + 1.05, (z + z2) / 2 + oz,
            0.05, 0.05, Math.hypot(x2 - x, z2 - z) * 1.05, 0x6e5a3e,
            { ry: ang, rx: Math.atan2(y2 - y, Math.hypot(x2 - x, z2 - z)) });
        }
      }
      J.Col.add(x - wide / 2, y - 0.2, z - 0.55, x + wide / 2, y + 0.1, z + 0.55, 'ground');
    }
  }

  /* ── 绳桥：两根主索 + 木板 ── */
  function ropeBridge(mbWood, x0, z0, x1, z1, n, wide) {
    var ang = Math.atan2(x1 - x0, z1 - z0);
    var len = Math.hypot(x1 - x0, z1 - z0);
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      var x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      var sag = Math.sin(t * Math.PI) * 1.15;
      var y = Math.max(H(x0, z0), H(x1, z1)) + 2.2 - sag;
      mbWood.box(x, y, z, wide, 0.12, len / n * 1.1, CO.woodL, { ry: ang });
      if (i % 2 === 0) {
        for (var sd = -1; sd <= 1; sd += 2) {
          var px = x + Math.cos(ang) * sd * wide * 0.5;
          var pz = z - Math.sin(ang) * sd * wide * 0.5;
          mbWood.box(px, y + 0.5, pz, 0.08, 1.0, 0.08, CO.woodD);
        }
      }
      J.Col.add(x - wide / 2, y - 0.25, z - 0.5, x + wide / 2, y + 0.12, z + 0.5, 'ground');
    }
    /* 主索 */
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      for (var k = 0; k < n - 1; k++) {
        var t1 = k / (n - 1), t2 = (k + 1) / (n - 1);
        var p1x = x0 + (x1 - x0) * t1, p1z = z0 + (z1 - z0) * t1;
        var p2x = x0 + (x1 - x0) * t2, p2z = z0 + (z1 - z0) * t2;
        var p1y = Math.max(H(x0, z0), H(x1, z1)) + 2.2 - Math.sin(t1 * Math.PI) * 1.15 + 1.0;
        var p2y = Math.max(H(x0, z0), H(x1, z1)) + 2.2 - Math.sin(t2 * Math.PI) * 1.15 + 1.0;
        var ox = Math.cos(ang) * s2 * wide * 0.5, oz = -Math.sin(ang) * s2 * wide * 0.5;
        mbWood.box((p1x + p2x) / 2 + ox, (p1y + p2y) / 2, (p1z + p2z) / 2 + oz,
          0.06, 0.06, len / n * 1.08, 0x6e5a3e,
          { ry: ang, rx: Math.atan2(p2y - p1y, len / n) });
      }
    }
  }

  /* ── 石拱桥 ── */
  function stoneBridge(mb, cx, cz, span, rise, wide) {
    var segs = 14;
    for (var i = 0; i <= segs; i++) {
      var t = i / segs;
      var x = cx - span / 2 + span * t;
      var y = H(cx, cz) + 1.4 + Math.sin(t * Math.PI) * rise;
      mb.box(x, y, cz, span / segs * 1.15, 0.28, wide, i % 2 ? CO.stone : CO.stoneL);
      J.Col.add(x - span / segs / 2, y - 0.4, cz - wide / 2, x + span / segs / 2, y + 0.14, cz + wide / 2, 'ground');
      /* 栏杆 */
      for (var sd = -1; sd <= 1; sd += 2) {
        mb.box(x, y + 0.55, cz + sd * wide * 0.48, 0.16, 0.85, 0.16, CO.stoneL);
      }
    }
    /* 拱券 */
    for (var a = 0; a <= 10; a++) {
      var aa = Math.PI * (a / 10);
      var ax = cx - Math.cos(aa) * span * 0.32;
      var ay = H(cx, cz) - 0.2 + Math.sin(aa) * rise * 0.9;
      mb.box(ax, ay, cz, 0.5, 0.42, wide * 0.96, CO.stoneD);
    }
  }

  /* ── 青石板路 ── */
  function cobbleRoad(mb, z0, z1, width) {
    for (var z = z0; z < z1; z += 1.6) {
      var x = J.Terrain.riverX(z);
      for (var s = -1; s <= 1; s += 2) {
        var cx = x + s * width * 0.26;
        var y = H(cx, z);
        mb.box(cx, y + 0.05, z, width * 0.52, 0.1, 1.62, CO.stone, { tint: 0.9 + Math.random() * 0.18 });
      }
      /* 路缘石 */
      for (var s2 = -1; s2 <= 1; s2 += 2) {
        var ex = x + s2 * width * 0.56;
        mb.box(ex, H(ex, z) + 0.08, z, 0.3, 0.16, 1.62, CO.stoneD);
      }
    }
  }

  /* ══ 组装 ══ */
  A.init = function () {
    var stoneMB = new J.MB(), woodMB = new J.MB(), vegMB = new J.MB(), roadMB = new J.MB();

    /* 1. 层叠远山 */
    buildRidges();

    /* 2. 青石板主街（渡口 → 镇中） */
    cobbleRoad(roadMB, 44, 108, 6.2);

    /* 3. 石拱桥（镇口跨河） */
    stoneBridge(stoneMB, J.Terrain.riverX(66), 66, 27, 2.4, 4.4);

    /* 4. 悬崖栈道 + 绳桥（飞瀑崖壁） */
    var cx0 = J.Terrain.riverX(176) + 14, cz0 = 176;
    var cx1 = J.Terrain.riverX(150) + 17, cz1 = 150;
    plankWalk(woodMB, stoneMB, cx0, cz0, cx1, cz1, 26, 2.6);
    ropeBridge(woodMB, cx1, cz1 - 1, cx1 - 6, cz1 - 22, 12, 2.2);

    /* 5. 通往古寺的石阶 */
    stoneStairs(stoneMB, J.Terrain.riverX(56) - 8, 56, -44, 30, 26, 3.0);
    stoneStairs(stoneMB, -44, 30, -52, 18, 10, 3.0);

    /* 6. 竹林（沿河两岸，成片） */
    var groves = [
      [J.Terrain.riverX(150) - 22, 150], [J.Terrain.riverX(138) + 24, 138],
      [J.Terrain.riverX(120) - 26, 120], [J.Terrain.riverX(104) + 26, 104],
      [J.Terrain.riverX(20) - 30, 20], [J.Terrain.riverX(-40) + 26, -40],
      [J.Terrain.riverX(-86) - 28, -86]
    ];
    for (var g = 0; g < groves.length; g++) {
      bambooGrove(vegMB, vegMB, groves[g][0], groves[g][1], 18, 11);
    }

    /* 7. 苍松（山坡、崖顶、寺后） */
    var pineSpots = [[18, 186], [-12, 176], [26, 168], [-30, 150], [34, 132], [-36, 118],
      [30, 96], [-40, 92], [36, 74], [-44, 60], [30, 30], [-40, 14], [34, -26], [-38, -46],
      [26, -74], [-34, -96], [22, -124], [-30, -150], [16, -172], [-20, -184]];
    for (var p = 0; p < pineSpots.length; p++) {
      pine(vegMB, pineSpots[p][0], pineSpots[p][1], rnd(0.85, 1.35));
    }

    /* 8. 崖壁巨岩 */
    for (var r = 0; r < 14; r++) {
      var zz = 132 + Math.random() * 58;
      var xx = J.Terrain.riverX(zz) + (Math.random() > 0.5 ? 1 : -1) * rnd(16, 34);
      var hh = H(xx, zz);
      if (hh < 16) continue;
      cliffRock(stoneMB, xx, zz, rnd(0.9, 1.8));
    }
    for (var r2 = 0; r2 < 8; r2++) {
      var zz2 = -108 + Math.random() * 40;
      var xx2 = J.Terrain.riverX(zz2) + (Math.random() > 0.5 ? 1 : -1) * rnd(14, 30);
      cliffRock(stoneMB, xx2, zz2, rnd(1.0, 2.2));
    }

    /* 9. 合并成 4 个网格 */
    var mats = {
      stone: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.02 }),
      wood: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.02 }),
      veg: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide })
    };
    var built = [
      [stoneMB, mats.stone, 'artStone'],
      [woodMB, mats.wood, 'artWood'],
      [vegMB, mats.veg, 'artVeg'],
      [roadMB, mats.stone, 'artRoad']
    ];
    for (var b = 0; b < built.length; b++) {
      if (!built[b][0].i.length) continue;
      var mesh = built[b][0].build(built[b][1]);
      mesh.name = built[b][2];
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      J.S.add(mesh);
      A.groups.push(mesh);
    }
    A.triCount = 0;
    for (var t = 0; t < A.groups.length; t++) {
      A.triCount += A.groups[t].geometry.index.count / 3;
    }
  };

  /* 远山随相机移动（永远到不了） */
  A.update = function (dt) {
    if (!A.ridge || !J.C) return;
    for (var i = 0; i < A.ridge.length; i++) {
      var m = A.ridge[i];
      m.position.x = J.C.position.x;
      m.position.z = J.C.position.z;
      m.position.y = (i * 2) + Math.max(0, (J.C.position.y - 40) * 0.05);
    }
  };

  return A;
})();
