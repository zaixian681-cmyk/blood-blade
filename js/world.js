/* ═══════════════════════════════════════════════
   world.js — 青崖山·断剑谷
   六区域：入口 / 竹海 / 吊桥 / 山寨 / 古寺 / 断剑谷
   ═══════════════════════════════════════════════ */
J.World = (function () {

  var W = {
    lanterns: [], fires: [], colliders: 0,
    spawn: { x: 0, z: 196, yaw: Math.PI },
    regions: []
  };

  var C = {
    stone: 0x6e6b62, stoneD: 0x4a473f, stoneL: 0x8a8579,
    dirt: 0x5e4f3a, wood: 0x4a3626, woodD: 0x2a1d14, woodL: 0x6d4e34,
    wall: 0xbfb6a4, wallD: 0x8a8172,
    tile: 0x2b3138, tileD: 0x1a1e23,
    red: 0x8a2e26, redD: 0x5a1c16, gold: 0xc09850,
    bamboo: 0x5c7830, bambooL: 0x6f8c3c, leaf: 0x486328,
    rock: 0x77746a, rockD: 0x57544c, moss: 0x4a5a34,
    grass: 0x5a6e3c, grass2: 0x4a5e30
  };
  var B;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function hAt(x, z) { return J.Terrain.heightAt(x, z); }

  /* ══ 远山环 ══ */
  function mountainRing(radius, height, yBase, colTop, colBot, seed) {
    var W2 = 2048, H2 = 512;
    var cv = document.createElement('canvas'); cv.width = W2; cv.height = H2;
    var g = cv.getContext('2d');
    g.clearRect(0, 0, W2, H2);
    function noise1(x, s) { var n = Math.sin(x * 127.1 + s * 311.7) * 43758.5453; return n - Math.floor(n); }
    function ridge(u) {
      var v = 0, amp = 1, f = 3;
      for (var o = 0; o < 5; o++) {
        v += amp * (0.5 + 0.5 * Math.sin(u * Math.PI * 2 * f + seed * 6.28 + o * 2.1)) * Math.pow(noise1(f * 7.3 + o, seed), 0.4);
        f *= 2; amp *= 0.48;
      }
      return v;
    }
    var grad = g.createLinearGradient(0, 0, 0, H2);
    grad.addColorStop(0, colTop); grad.addColorStop(1, colBot);
    g.fillStyle = grad;
    var pts = [];
    for (var px = 0; px <= W2; px += 4) {
      var u = px / W2;
      pts.push([px, H2 - (0.30 + ridge(u) * 0.62) * H2]);
    }
    pts[pts.length - 1][1] = pts[0][1];
    g.beginPath(); g.moveTo(0, H2); g.lineTo(0, pts[0][1]);
    for (var i = 0; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.lineTo(W2, H2); g.closePath(); g.fill();

    var tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    var geo = new THREE.CylinderGeometry(radius, radius, height, 96, 1, true);
    var mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, side: THREE.BackSide, fog: false,
      depthWrite: false, toneMapped: false
    });
    var m = new THREE.Mesh(geo, mat);
    m.position.y = yBase;
    m.renderOrder = -900;
    return m;
  }

  function cloudTex(seed) {
    var S = 256, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    var g = cv.getContext('2d');
    for (var i = 0; i < 10; i++) {
      var cx = S * 0.5 + (Math.random() - 0.5) * S * 0.66;
      var cy = S * 0.52 + (Math.random() - 0.5) * S * 0.3;
      var r = S * (0.11 + Math.random() * 0.2);
      var grd = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      grd.addColorStop(0, 'rgba(255,255,255,0.52)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0.26)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    }
    var t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* ══ 通用构件 ══ */
  function roof(x, yb, z, w, d, h, col, ridgeCol, ry) {
    ry = ry || 0;
    var over = 0.75, halfD = d / 2 + over;
    var slope = Math.sqrt(halfD * halfD + h * h), ang = Math.atan2(h, halfD);
    var pw = w + over * 2;
    for (var s = -1; s <= 1; s += 2) {
      var ox = Math.sin(ry) * s * halfD / 2, oz = Math.cos(ry) * s * halfD / 2;
      B.box(x + ox, yb + h / 2, z + oz, pw, 0.24, slope, col, { rx: s * ang, ry: ry });
      var ribs = Math.max(3, Math.round(pw / 1.0));
      for (var r = 0; r < ribs; r++) {
        var off = -pw / 2 + (r + 0.5) * (pw / ribs);
        B.box(x + ox + Math.cos(ry) * off, yb + h / 2 + 0.10, z + oz - Math.sin(ry) * off,
          0.09, 0.11, slope * 0.96, ridgeCol, { rx: s * ang, ry: ry });
      }
    }
    B.box(x, yb + h + 0.10, z, pw + 0.2, 0.24, 0.42, ridgeCol, { ry: ry });
    for (var e = -1; e <= 1; e += 2) {
      B.box(x + Math.cos(ry) * e * pw / 2, yb + h + 0.28, z - Math.sin(ry) * e * pw / 2,
        0.65, 0.16, 0.5, ridgeCol, { ry: ry, rz: e * 0.26 });
    }
  }

  function house(cx, cz, w, d, h, opt) {
    opt = opt || {};
    var y0 = hAt(cx, cz);
    B.box(cx, y0 - 1.2, cz, w + 0.8, 3.0, d + 0.8, C.stoneD);
    B.boxB(cx, y0, cz, w, h, d, opt.wall || C.wall);
    for (var sx = -1; sx <= 1; sx += 2)
      for (var sz = -1; sz <= 1; sz += 2)
        B.boxB(cx + sx * w / 2, y0, cz + sz * d / 2, 0.26, h, 0.26, C.woodD);
    var fz = cz + (opt.front === undefined ? 1 : opt.front) * (d / 2 + 0.03);
    B.box(cx, y0 + 1.1, fz, 1.1, 2.2, 0.12, C.wood);
    B.box(cx, y0 + 2.3, fz, 1.4, 0.22, 0.18, C.woodD);
    if (w > 4.6) {
      for (var s2 = -1; s2 <= 1; s2 += 2) {
        var wx = cx + s2 * (w / 2 - 1.25);
        B.box(wx, y0 + 1.6, fz, 1.15, 1.0, 0.12, C.woodD);
        B.box(wx, y0 + 1.6, fz + 0.04, 0.9, 0.76, 0.06, 0x1e1a16);
      }
    }
    roof(cx, y0 + h + 0.12, cz, w, d, opt.roofH || Math.max(1.2, d * 0.32), C.tile, C.tileD);
    J.Col.add(cx - w / 2, y0, cz - d / 2, cx + w / 2, y0 + h + 1.6, cz + d / 2, 'wall');
  }

  function lamp(x, z) {
    var y0 = hAt(x, z);
    B.box(x, y0 + 0.1, z, 0.5, 0.2, 0.5, C.stoneD);
    B.cyl(x, y0 + 0.2, z, 0.09, 1.6, 6, C.stone);
    B.box(x, y0 + 1.9, z, 0.38, 0.32, 0.38, C.stoneL);
    B.box(x, y0 + 2.08, z, 0.48, 0.10, 0.48, C.stoneD);
    B.box(x, y0 + 1.9, z, 0.24, 0.2, 0.24, 0xf0d090, { noShade: true });
    J.Col.add(x - 0.16, y0, z - 0.16, x + 0.16, y0 + 2.2, z + 0.16, 'thin');
  }

  function lantern(x, y, z, col) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8),
      new THREE.MeshStandardMaterial({ color: col || 0xc8382a, emissive: col || 0xc8382a, emissiveIntensity: 1.4, roughness: 0.6 }));
    body.scale.set(1, 1.2, 1);
    g.add(body);
    g.position.set(x, y, z);
    J.S.add(g);
    W.lanterns.push({ g: g, ph: Math.random() * 6.28 });
  }

  function bamboo(x, z, h) {
    var y0 = hAt(x, z);
    var seg = 4;
    for (var i = 0; i < seg; i++) {
      var r = 0.085 - i * 0.007;
      B.cyl(x, y0 + i * (h / seg), z, r, h / seg * 0.96, 5, i % 2 ? C.bamboo : C.bambooL);
    }
    var topY = y0 + h;
    for (var k = 0; k < 10; k++) {
      var a = Math.random() * 6.28, lf = 0.5 + Math.random() * 0.45;
      B.box(x + Math.cos(a) * lf * 0.7, topY - Math.random() * 2.0, z + Math.sin(a) * lf * 0.7,
        lf, 0.02, 0.24, Math.random() > 0.5 ? C.leaf : C.bamboo, { ry: a, rz: (Math.random() - 0.5) * 0.25 });
    }
    J.Col.add(x - 0.12, y0, z - 0.12, x + 0.12, topY, z + 0.12, 'thin');
  }

  function pine(x, z, s) {
    var y0 = hAt(x, z);
    B.cyl(x, y0, z, 0.16 * s, 2.4 * s, 6, C.woodD);
    var cols = [0x35481f, 0x3d5524, 0x2c3d1a];
    for (var i = 0; i < 3; i++) {
      var yy = y0 + 1.8 * s + i * 0.82 * s;
      var rr = (1.7 - i * 0.44) * s;
      B.cyl(x, yy, z, rr, 0.95 * s, 8, cols[i], { r2: rr * 0.62 });
    }
    J.Col.add(x - 0.2, y0, z - 0.2, x + 0.2, y0 + 4 * s, z + 0.2, 'thin');
  }

  function rock(x, z, s, col) {
    var y0 = hAt(x, z);
    var c = col || C.rock;
    var c2 = col || C.rockD;
    var ry = Math.random() * 3.14;
    /* 主块：上窄下宽，像被劈开的山岩 */
    B.taper(x, y0 - s * 0.15, z, s * 1.45, s * 1.25, s * 1.05, s * 0.9, s * 1.1, c, { ry: ry });
    /* 侧面碎块 */
    B.box(x + s * 0.62, y0 + s * 0.28, z + s * 0.3, s * 0.72, s * 0.75, s * 0.65, c2,
      { ry: ry + 0.7, rz: rnd(-0.22, 0.22), tint: 0.9 + Math.random() * 0.15 });
    B.box(x - s * 0.5, y0 + s * 0.2, z - s * 0.42, s * 0.6, s * 0.6, s * 0.55, c2,
      { ry: ry - 0.5, rz: rnd(-0.18, 0.18), tint: 0.85 + Math.random() * 0.2 });
    /* 顶部斜切块 */
    B.box(x + s * 0.1, y0 + s * 0.92, z - s * 0.08, s * 0.75, s * 0.4, s * 0.62, c,
      { ry: ry + 1.1, rz: rnd(-0.3, 0.3), tint: 1.02 });
    /* 青苔 */
    if (Math.random() > 0.35) {
      B.box(x, y0 + s * 1.02, z, s * 0.72, 0.05, s * 0.6, C.moss, { ry: ry });
    }
    if (s > 1.1) J.Col.add(x - s * 0.72, y0, z - s * 0.62, x + s * 0.72, y0 + s * 1.15, z + s * 0.62, 'wall');
  }

  /* ══ 地表细节：草丛 / 灌木 / 碎石 ══ */
  function grassTuft(x, z, s) {
    var y0 = hAt(x, z);
    var blades = 5 + Math.floor(Math.random() * 4);
    for (var i = 0; i < blades; i++) {
      var bx = x + rnd(-0.30, 0.30) * s;
      var bz = z + rnd(-0.30, 0.30) * s;
      var hh = (0.16 + Math.random() * 0.16) * s;
      var w = (0.14 + Math.random() * 0.10) * s;
      var col = Math.random() > 0.5 ? 0x4f6e34 : 0x3e5a2a;
      B.box(bx, y0 + hh / 2, bz, w, hh, 0.03, col,
        { ry: Math.random() * 3.14, rz: rnd(-0.35, 0.35) });
    }
  }

  function shrub(x, z, s) {
    var y0 = hAt(x, z);
    var n = 3 + Math.floor(Math.random() * 3);
    for (var i = 0; i < n; i++) {
      var bx = x + rnd(-0.5, 0.5) * s, bz = z + rnd(-0.5, 0.5) * s;
      var r = (0.35 + Math.random() * 0.3) * s;
      B.box(bx, y0 + r * 0.55, bz, r * 1.9, r * 1.1, r * 1.9,
        Math.random() > 0.5 ? 0x3c5226 : 0x475f2c, { ry: Math.random() * 3 });
    }
  }

  function pebble(x, z, s) {
    var y0 = hAt(x, z);
    var w = 0.16 * s;
    B.box(x, y0 + w * 0.35, z, w * 1.5, w * 0.9, w * 1.2, C.rock,
      { ry: Math.random() * 3.14, rz: rnd(-0.2, 0.2), tint: 0.65 + Math.random() * 0.5 });
    B.box(x + w * 0.4, y0 + w * 0.85, z - w * 0.2, w * 0.8, w * 0.6, w * 0.7, C.rockD,
      { ry: Math.random() * 3.14, tint: 0.8 + Math.random() * 0.4 });
  }

  /* 沿主路两侧与区域周边撒细节 */
  function scatterGround() {
    /* 1) 岩石群：成组散布，构成地表骨相（不用小方块草） */
    var rockClusters = [
      [-150, 60], [-90, 150], [40, 170], [120, 80], [-40, 40],
      [70, -30], [-130, -80], [110, -120], [-60, -140], [150, -60],
      [-170, -40], [30, -170], [-110, 10], [90, 20], [-20, -100]
    ];
    for (var c = 0; c < rockClusters.length; c++) {
      var ccx = rockClusters[c][0], ccz = rockClusters[c][1];
      var cnt = 3 + Math.floor(Math.random() * 4);
      for (var i = 0; i < cnt; i++) {
        var rx = ccx + rnd(-14, 14), rz = ccz + rnd(-14, 14);
        if (Math.abs(rx - J.Terrain.pathX(rz)) < 8) continue;
        var rh = hAt(rx, rz);
        if (rh < -10 || J.Terrain.slopeAt(rx, rz) > 0.9) continue;
        rock(rx, rz, rnd(0.9, 2.4));
      }
    }

    /* 2) 路边碎石：小、密、贴地 */
    for (var k = 0; k < 900; k++) {
      var z = rnd(-210, 190);
      var px = J.Terrain.pathX(z);
      var sd = Math.random() > 0.5 ? 1 : -1;
      var x = px + sd * rnd(3.2, 26);
      if (Math.abs(x) > 205) continue;
      var h = hAt(x, z);
      if (h < -10) continue;
      if (J.Terrain.slopeAt(x, z) > 0.88) continue;
      pebble(x, z, rnd(0.5, 0.95));
    }

    /* 3) 草丛：只在高草区，密度低、叶片细 */
    for (var g = 0; g < 260; g++) {
      var z2 = rnd(-200, 180);
      var side = Math.random() > 0.5 ? 1 : -1;
      var x2 = J.Terrain.pathX(z2) + side * rnd(13, 58);
      if (Math.abs(x2) > 200) continue;
      var h2 = hAt(x2, z2);
      if (h2 < -8 || J.Terrain.slopeAt(x2, z2) > 0.75) continue;
      grassTuft(x2, z2, rnd(1.0, 1.6));
    }
  }

  /* ═══════════════════════════════════════════════
     断崖吊桥
     ═══════════════════════════════════════════════ */
  function bridgeY(z) {
    var t = (z - J.Terrain.GORGE_Z0) / (J.Terrain.GORGE_Z1 - J.Terrain.GORGE_Z0);
    var tc = Math.max(0, Math.min(1, t));
    var sag = Math.sin(tc * Math.PI) * 2.1;
    var base = (11.2 + (10.2 - 11.2) * tc) - sag;
    /* 两端向岸边地形收拢 */
    if (t < 0) base = 11.2 + (-t) * 0.15;
    if (t > 1) base = 10.2 - (t - 1) * 0.2;
    return base;
  }

  function buildBridge() {
    var z0 = J.Terrain.GORGE_Z0 - 4, z1 = J.Terrain.GORGE_Z1 + 4;
    var N = 30;
    var span = z1 - z0;
    for (var i = 0; i < N; i++) {
      var t = (i + 0.5) / N;
      var z = z0 + t * span;
      var cx = J.Terrain.bridgeCenterX(z);
      var y = bridgeY(z);
      var slope = (bridgeY(z + 0.5) - bridgeY(z - 0.5));
      var ang = Math.atan(slope);
      /* 木板 */
      B.box(cx, y, z, 7.4, 0.16, span / N * 0.94, C.woodL, { rx: -ang });
      /* 侧绳 */
      for (var s = -1; s <= 1; s += 2) {
        B.box(cx + s * 3.75, y + 0.05, z, 0.12, 0.10, span / N * 0.94, C.woodD, { rx: -ang });
      }
      /* 碰撞：分段薄板，保证可行走 */
      J.Col.add(cx - 3.7, y - 0.5, z - span / N / 2, cx + 3.7, y + 0.08, z + span / N / 2, 'ground');
    }
    /* 栏杆立柱 + 扶手绳 */
    for (var k = 0; k <= 14; k++) {
      var t2 = k / 14;
      var z2 = z0 + t2 * span;
      var cx2 = J.Terrain.bridgeCenterX(z2);
      var y2 = bridgeY(z2);
      for (var s2 = -1; s2 <= 1; s2 += 2) {
        B.box(cx2 + s2 * 3.7, y2 + 0.62, z2, 0.16, 1.24, 0.16, C.woodD);
      }
    }
    /* 扶手（分段折线） */
    for (var k2 = 0; k2 < 14; k2++) {
      var ta = k2 / 14, tb = (k2 + 1) / 14;
      var za = z0 + ta * span, zb = z0 + tb * span;
      var ya = bridgeY(za) + 1.2, yb = bridgeY(zb) + 1.2;
      var cxa = J.Terrain.bridgeCenterX(za), cxb = J.Terrain.bridgeCenterX(zb);
      for (var s3 = -1; s3 <= 1; s3 += 2) {
        var mx = (cxa + cxb) / 2 + s3 * 3.7, my = (ya + yb) / 2, mz = (za + zb) / 2;
        var len = Math.hypot(zb - za, yb - ya);
        B.box(mx, my, mz, 0.09, 0.09, len, 0x6a5a42, { rx: -Math.atan2(yb - ya, zb - za) });
      }
    }
    /* 两端桥塔 */
    [[z0 - 1, 0], [z1 + 1, 0]].forEach(function (p) {
      var zz = p[0], cc = J.Terrain.bridgeCenterX(zz);
      var yy = hAt(cc, zz);
      for (var s4 = -1; s4 <= 1; s4 += 2) {
        B.boxB(cc + s4 * 4.2, yy - 1, zz, 0.55, 6.5, 0.55, C.woodD);
        B.boxB(cc + s4 * 4.2, yy + 5.2, zz, 0.9, 0.4, 0.9, C.wood);
      }
      B.box(cc, yy + 6.6, zz, 9.8, 0.5, 0.7, C.woodD);
      roof(cc, yy + 6.9, zz, 9.4, 2.4, 1.2, C.tile, C.tileD);
      /* 只给两根柱子加碰撞，中间必须留通道 */
      for (var s5 = -1; s5 <= 1; s5 += 2) {
        J.Col.add(cc + s5 * 4.2 - 0.35, yy, zz - 0.35, cc + s5 * 4.2 + 0.35, yy + 7, zz + 0.35, 'wall');
      }
    });
  }

  /* ═══════════════════════════════════════════════
     区域一：青崖山入口
     ═══════════════════════════════════════════════ */
  function buildEntrance() {
    var z = 186, cx = J.Terrain.pathX(z);
    var y = hAt(cx, z);

    /* 山门：三开间 */
    var gateW = 13, gateH = 6.2;
    for (var s = -1; s <= 1; s += 2) {
      B.boxB(cx + s * gateW / 2, y - 0.5, z, 0.9, gateH, 0.9, C.stoneD);
      B.box(cx + s * gateW / 2, y + gateH * 0.55, z, 1.15, 0.35, 1.15, C.stoneL);
      J.Col.add(cx + s * gateW / 2 - 0.5, y, z - 0.5, cx + s * gateW / 2 + 0.5, y + gateH, z + 0.5, 'wall');
    }
    /* 横梁 + 匾额 */
    B.box(cx, y + gateH - 0.5, z, gateW + 1.6, 0.7, 1.0, C.woodD);
    B.box(cx, y + gateH + 0.15, z + 0.55, 4.2, 1.3, 0.22, 0x2a2018);
    B.box(cx, y + gateH + 0.15, z + 0.62, 3.6, 0.95, 0.06, C.gold);
    roof(cx, y + gateH + 0.5, z, gateW + 2.2, 3.2, 1.9, C.tile, C.tileD);

    /* 残破石碑 */
    for (var i = 0; i < 3; i++) {
      var sx = cx - 9 + i * 9, sz = z - 6 + (i === 1 ? 3 : 0);
      var sy = hAt(sx, sz);
      var hh = i === 1 ? 2.4 : 1.6;
      B.boxB(sx, sy - 0.2, sz, 1.1, hh, 0.42, C.stone, { ry: rnd(-0.2, 0.2), rz: rnd(-0.05, 0.05) });
      B.box(sx, sy + hh - 0.4, sz, 0.9, 0.12, 0.42, C.stoneL);
      J.Col.add(sx - 0.6, sy, sz - 0.3, sx + 0.6, sy + hh, sz + 0.3, 'thin');
    }

    /* 路标木牌 */
    var px = cx + 6, pz = z + 8, py = hAt(px, pz);
    B.boxB(px, py - 0.2, pz, 0.22, 3.0, 0.22, C.woodD);
    B.box(px + 0.6, py + 2.1, pz, 1.5, 0.7, 0.12, 0x8a7048, { ry: 0.35 });
    J.Col.add(px - 0.2, py, pz - 0.2, px + 0.2, py + 3, pz + 0.2, 'thin');

    /* 空地石阶 */


    /* 两侧石灯 */
    lamp(cx - 7.5, z - 4);
    lamp(cx + 7.5, z - 4);
    lantern(cx - 5.6, y + gateH - 1.2, z + 0.6, 0xc8382a);
    lantern(cx + 5.6, y + gateH - 1.2, z + 0.6, 0xc8382a);

    W.regions.push({ id: 1, name: '青崖山入口', x: cx, z: z, r: 42 });
  }

  /* ═══════════════════════════════════════════════
     区域二：竹海山道
     ═══════════════════════════════════════════════ */
  function buildBamboo() {
    var z0 = 40, z1 = 160;
    for (var z = z0; z < z1; z += 5) {
      var cx = J.Terrain.pathX(z);
      var density = 5 + Math.floor(Math.random() * 4);
      for (var n = 0; n < density; n++) {
        var side = Math.random() > 0.5 ? 1 : -1;
        var off = 10 + Math.pow(Math.random(), 1.6) * 62;
        var bx = cx + side * off;
        var bz = z + rnd(-3, 3);
        if (J.Terrain.slopeAt(bx, bz) > 0.72) continue;
        bamboo(bx, bz, rnd(5.5, 9.5));
      }
    }
    /* 废弃木屋 */
    house(J.Terrain.pathX(112) + 15, 112, 7, 6.5, 3.2, { front: -1, roofH: 1.8 });
    house(J.Terrain.pathX(74) - 16, 74, 6.5, 6, 3.0, { front: 1, roofH: 1.7 });
    /* 倒木 */
    for (var i = 0; i < 7; i++) {
      var lx = J.Terrain.pathX(rnd(50, 180)) + rnd(-30, 30);
      var lz = rnd(50, 180);
      var ly = hAt(lx, lz);
      B.box(lx, ly + 0.35, lz, 5.2, 0.55, 0.7, C.woodD, { ry: rnd(0, 3.14), rz: rnd(-0.15, 0.15) });
      J.Col.add(lx - 2.4, ly, lz - 0.6, lx + 2.4, ly + 0.8, lz + 0.6, 'thin');
    }
    /* 石阶 */

    /* 隐藏山洞入口（路边凹处） */
    var caveZ = 138, caveX = J.Terrain.pathX(caveZ) - 22;
    var caveY = hAt(caveX, caveZ);
    B.box(caveX, caveY + 2.4, caveZ, 6.5, 4.8, 5.5, C.rockD);
    B.box(caveX + 1.2, caveY + 2.0, caveZ + 3.0, 3.2, 3.6, 1.2, 0x1a1a1a, { noShade: true });
    B.box(caveX, caveY + 5.0, caveZ, 7.6, 0.6, 6.4, C.rock);
    J.Col.add(caveX - 3.4, caveY, caveZ - 2.8, caveX + 3.4, caveY + 5, caveZ + 2.6, 'wall');
    W.cavePos = { x: caveX + 1.2, y: caveY, z: caveZ + 2.6 };

    W.regions.push({ id: 2, name: '竹海山道', x: J.Terrain.pathX(100), z: 100, r: 62 });
  }

  /* ═══════════════════════════════════════════════
     区域四：黑风山寨
     ═══════════════════════════════════════════════ */
  function buildVillage() {
    var cz = -46, cx = J.Terrain.pathX(cz);
    var y = hAt(cx, cz);

    /* 木围墙（留门） */
    var R = 26;
    for (var a = 0; a < 40; a++) {
      var ang = a / 40 * Math.PI * 2;
      var wx = cx + Math.cos(ang) * R;
      var wz = cz + Math.sin(ang) * R;
      /* 正门方向留口 */
      var doorAng = Math.atan2(1, 0);
      var diff = Math.abs(J.U.ang(ang, doorAng));
      if (diff < 0.30) continue;
      if (J.Terrain.slopeAt(wx, wz) > 0.85) continue;
      var wy = hAt(wx, wz);
      B.boxB(wx, wy - 0.6, wz, 0.34, 3.6, 0.34, C.woodD, { ry: ang });
      if (a % 2 === 0) {
        B.box(wx, wy + 1.5, wz, 0.16, 0.16, R * 0.16, C.woodD, { ry: ang });
      }
      J.Col.add(wx - 0.25, wy, wz - 0.25, wx + 0.25, wy + 3.2, wz + 0.25, 'thin');
    }

    /* 山门 */
    var gx = cx + R, gz = cz;
    var gy = hAt(gx, gz);
    for (var s = -1; s <= 1; s += 2) {
      B.boxB(gx, gy - 0.6, gz + s * 3.2, 0.5, 5.4, 0.5, C.woodD);
      J.Col.add(gx - 0.35, gy, gz + s * 3.2 - 0.35, gx + 0.35, gy + 5, gz + s * 3.2 + 0.35, 'wall');
    }
    B.box(gx, gy + 5.0, gz, 0.6, 0.55, 7.2, C.woodD);
    roof(gx, gy + 5.3, gz, 2.6, 7.6, 1.4, C.tile, C.tileD, Math.PI / 2);
    lantern(gx - 0.8, gy + 4.2, gz - 2.2, 0xc8382a);
    lantern(gx - 0.8, gy + 4.2, gz + 2.2, 0xc8382a);

    /* 瞭望塔 ×2 */
    [[cx - 18, cz + 20], [cx + 16, cz - 22]].forEach(function (p) {
      var tx = p[0], tz = p[1], ty = hAt(tx, tz);
      for (var sx = -1; sx <= 1; sx += 2)
        for (var sz = -1; sz <= 1; sz += 2)
          B.boxB(tx + sx * 1.7, ty - 1, tz + sz * 1.7, 0.32, 9, 0.32, C.woodD);
      B.box(tx, ty + 8.2, tz, 4.4, 0.35, 4.4, C.wood);
      for (var r2 = 0; r2 < 4; r2++) {
        B.box(tx, ty + 8.9, tz + (r2 - 1.5) * 1.4, 4.2, 1.2, 0.14, C.woodD);
      }
      roof(tx, ty + 9.6, tz, 4.6, 4.6, 1.5, C.tile, C.tileD);
      J.Col.add(tx - 2.2, ty, tz - 2.2, tx + 2.2, ty + 8.4, tz + 2.2, 'wall');
    });

    /* 木屋群 */
    var spots = [[-14, -12, 1], [-6, 16, -1], [14, 8, -1], [8, -18, 1], [-20, 2, 1]];
    spots.forEach(function (p) {
      house(cx + p[0], cz + p[1], 7.5, 7, 3.4, { front: p[2], roofH: 1.9 });
    });

    /* 练武空地 */
    var ax = cx - 2, az = cz + 2, ay = hAt(ax, az);
    B.box(ax, ay + 0.06, az, 16, 0.14, 16, 0x6a5a44);
    /* 兵器架 */
    B.box(ax + 5, ay + 0.9, az - 5, 3.2, 0.16, 0.3, C.woodD);
    for (var w = 0; w < 5; w++) {
      B.box(ax + 3.6 + w * 0.7, ay + 1.4, az - 5, 0.08, 1.9, 0.08, 0x8a8a90, { rz: rnd(-0.1, 0.1) });
    }
    J.Col.add(ax + 3.4, ay, az - 5.3, ax + 6.6, ay + 2.4, az - 4.7, 'thin');

    /* 营火 */
    var fx = cx + 8, fz = cz + 16, fy = hAt(fx, fz);
    for (var st = 0; st < 8; st++) {
      var sa = st / 8 * 6.28;
      B.box(fx + Math.cos(sa) * 0.9, fy + 0.12, fz + Math.sin(sa) * 0.9, 0.55, 0.28, 0.55, C.stoneD, { ry: sa });
    }
    B.box(fx, fy + 0.25, fz, 1.3, 0.3, 1.3, 0x2a2018);
    var fire = new THREE.PointLight(0xff7a30, 2.2, 14, 2);
    fire.position.set(fx, fy + 1.2, fz);
    J.S.add(fire);
    W.fires.push({ l: fire, ph: Math.random() * 6.28 });
    lantern(fx, fy + 1.6, fz, 0xff8a3a);

    /* 物资箱 */
    W.cratePos = [];
    [[cx - 8, cz - 6], [cx + 12, cz + 2], [cx - 17, cz + 8]].forEach(function (p) {
      var bx = p[0], bz = p[1], by = hAt(bx, bz);
      B.boxB(bx, by, bz, 1.3, 1.1, 1.3, 0x6a5030);
      B.boxB(bx, by + 1.1, bz, 1.36, 0.12, 1.36, C.woodD);
      J.Col.add(bx - 0.7, by, bz - 0.7, bx + 0.7, by + 1.2, bz + 0.7, 'thin');
      W.cratePos.push({ x: bx, y: by, z: bz });
    });

    W.regions.push({ id: 4, name: '黑风山寨', x: cx, z: cz, r: 38 });
    W.villageCenter = { x: cx, z: cz };
  }

  /* ═══════════════════════════════════════════════
     区域五：废弃古寺
     ═══════════════════════════════════════════════ */
  function buildTemple() {
    var cz = -116, cx = J.Terrain.pathX(cz);
    var y = hAt(cx, cz);

    /* 山门（残） */
    for (var s = -1; s <= 1; s += 2) {
      B.boxB(cx + s * 5, y - 0.6, cz + 26, 0.8, 5.0, 0.8, C.stoneD);
      B.box(cx + s * 5, y + 4.2, cz + 26, 1.0, 0.4, 1.0, C.stoneL);
    }
    B.box(cx + 5, y + 5.2, cz + 26, 4.0, 0.5, 0.7, C.stoneD, { rz: 0.06 });
    J.Col.add(cx - 5.6, y, cz + 25.6, cx - 4.4, y + 5, cz + 26.4, 'wall');
    J.Col.add(cx + 4.4, y, cz + 25.6, cx + 5.6, y + 5.4, cz + 26.4, 'wall');

    /* 石阶 */
    for (var i = 0; i < 12; i++) {
      var sz = cz + 22 - i * 1.8;
      var sy = hAt(cx, sz);
      B.box(cx, sy + 0.07, sz, 11 - i * 0.15, 0.18, 2.0, C.stone, { tint: 0.8 + i * 0.02 });
    }

    /* 主殿（可进入） */
    var hx = cx, hz = cz + 2, hy = hAt(hx, hz);
    var HW = 13, HD = 11, HH = 5.6;
    B.box(hx, hy - 0.5, hz, HW + 2, 1.6, HD + 2, C.stoneD);

    /* 墙体：留门口 */
    B.boxB(hx, hy, hz - HD / 2, HW, HH, 0.7, C.wall);                    // 后墙
    B.boxB(hx - HW / 2, hy, hz, 0.7, HH, HD, C.wall);                    // 左墙
    B.boxB(hx + HW / 2, hy, hz, 0.7, HH, HD, C.wall);                    // 右墙
    /* 前墙分两段，中间留 3.2m 门洞 */
    B.boxB(hx - (HW / 2 + 1.6) / 2 - 1.6, hy, hz + HD / 2, HW / 2 - 1.6, HH, 0.7, C.wall);
    B.boxB(hx + (HW / 2 + 1.6) / 2 + 1.6, hy, hz + HD / 2, HW / 2 - 1.6, HH, 0.7, C.wall);

    /* 门框 */
    B.boxB(hx - 1.9, hy, hz + HD / 2, 0.45, 4.4, 0.9, C.redD);
    B.boxB(hx + 1.9, hy, hz + HD / 2, 0.45, 4.4, 0.9, C.redD);
    B.box(hx, hy + 4.5, hz + HD / 2, 4.4, 0.5, 0.9, C.woodD);

    /* 柱子 */
    for (var c2 = -1; c2 <= 1; c2 += 2) {
      B.boxB(hx + c2 * (HW / 2 - 1.2), hy, hz + HD / 2 - 1.2, 0.42, HH, 0.42, C.redD);
    }
    roof(hx, hy + HH, hz, HW, HD, 3.0, C.tile, C.tileD);

    /* 墙碰撞：分段留门洞 */
    J.Col.add(hx - HW / 2, hy, hz - HD / 2, hx + HW / 2, hy + HH, hz - HD / 2 + 0.5, 'wall');
    J.Col.add(hx - HW / 2, hy, hz - HD / 2, hx - HW / 2 + 0.5, hy + HH, hz + HD / 2, 'wall');
    J.Col.add(hx + HW / 2 - 0.5, hy, hz - HD / 2, hx + HW / 2, hy + HH, hz + HD / 2, 'wall');
    J.Col.add(hx - HW / 2, hy, hz + HD / 2 - 0.5, hx - 1.7, hy + HH, hz + HD / 2, 'wall');
    J.Col.add(hx + 1.7, hy, hz + HD / 2 - 0.5, hx + HW / 2, hy + HH, hz + HD / 2, 'wall');
    /* 室内地板 */
    J.Col.add(hx - HW / 2, hy - 0.3, hz - HD / 2, hx + HW / 2, hy + 0.15, hz + HD / 2, 'ground');

    /* 殿内：佛像基座与供桌 */
    B.box(hx, hy + 0.9, hz - 3.5, 5.0, 1.8, 3.0, C.stoneL);
    B.box(hx, hy + 2.6, hz - 3.5, 2.2, 2.4, 1.6, 0x9a8e76);
    B.box(hx, hy + 4.1, hz - 3.5, 2.6, 0.4, 1.9, C.gold);
    J.Col.add(hx - 2.5, hy, hz - 5, hx + 2.5, hy + 3.8, hz - 2, 'wall');
    B.box(hx, hy + 1.0, hz + 2.5, 3.2, 0.16, 1.2, C.woodD);

    /* 石灯、断柱 */
    lamp(cx - 8, cz + 20);
    lamp(cx + 8, cz + 20);
    for (var k = 0; k < 5; k++) {
      var px2 = cx + rnd(-14, 14), pz2 = cz + rnd(8, 22);
      var py2 = hAt(px2, pz2);
      B.cyl(px2, py2, pz2, 0.32, rnd(0.8, 2.4), 8, C.stone, { r2: 0.28 });
      J.Col.add(px2 - 0.35, py2, pz2 - 0.35, px2 + 0.35, py2 + 2.4, pz2 + 0.35, 'thin');
    }
    /* 枯树 */
    [[-12, 14], [13, 10], [-10, -2]].forEach(function (p) {
      var tx = cx + p[0], tz = cz + p[1], ty = hAt(tx, tz);
      B.cyl(tx, ty, tz, 0.3, 4.5, 6, 0x4a4034);
      for (var br = 0; br < 4; br++) {
        var ba = rnd(0, 6.28);
        B.box(tx + Math.cos(ba) * 1.3, ty + 3.2 + br * 0.4, tz + Math.sin(ba) * 1.3,
          1.8, 0.14, 0.14, 0x4a4034, { ry: ba, rz: rnd(-0.4, 0.4) });
      }
      J.Col.add(tx - 0.32, ty, tz - 0.32, tx + 0.32, ty + 4.5, tz + 0.32, 'thin');
    });

    W.templeCenter = { x: hx, z: hz, y: hy };
    W.regions.push({ id: 5, name: '废弃古寺', x: cx, z: cz, r: 38 });
  }

  /* ═══════════════════════════════════════════════
     区域六：断剑谷
     ═══════════════════════════════════════════════ */
  function buildValley() {
    var cz = -186, cx = J.Terrain.pathX(cz);
    var y = hAt(cx, cz);

    /* 环形石台 */
    for (var i = 0; i < 36; i++) {
      var a = i / 36 * Math.PI * 2;
      var rr = 17;
      var px = cx + Math.cos(a) * rr, pz = cz + Math.sin(a) * rr;
      var py = hAt(px, pz);
      B.box(px, py + 0.10, pz, 3.8, 0.24, 2.2, C.stoneL, { ry: -a });
    }

    /* 巨大断剑（插在中央） */
    B.box(cx, y + 0.1, cz, 3.2, 0.35, 3.2, C.stoneD);
    B.box(cx, y + 2.2, cz, 1.5, 4.4, 0.42, 0x8a8f96, { rz: 0.05 });
    B.box(cx, y + 4.6, cz, 2.6, 0.5, 0.55, 0x8a8f96);
    B.box(cx, y + 6.2, cz, 0.9, 2.6, 0.36, 0x9aa0a8, { rz: 0.06 });
    B.box(cx, y + 7.6, cz, 0.5, 0.9, 0.3, 0xb0b6be);
    J.Col.add(cx - 1.6, y, cz - 1.6, cx + 1.6, y + 5, cz + 1.6, 'wall');

    /* 环绕石柱 */
    for (var k = 0; k < 8; k++) {
      var ka = k / 8 * Math.PI * 2 + 0.2;
      var kx = cx + Math.cos(ka) * 21, kz = cz + Math.sin(ka) * 21;
      var ky = hAt(kx, kz);
      B.cyl(kx, ky - 1, kz, 0.75, rnd(5, 8.5), 8, C.stoneD, { r2: 0.62 });
      J.Col.add(kx - 0.8, ky, kz - 0.8, kx + 0.8, ky + 8, kz + 0.8, 'wall');
    }

    /* 落石与枯树 */
    for (var r2 = 0; r2 < 12; r2++) {
      var ra = rnd(0, 6.28), rd = rnd(24, 40);
      rock(cx + Math.cos(ra) * rd, cz + Math.sin(ra) * rd, rnd(0.8, 2.0));
    }

    /* 远处瀑布（视觉） */
    var wfx = cx + 55, wfz = cz - 30;
    var wy = hAt(wfx, wfz);
    var wf = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 42, 1, 8),
      new THREE.MeshBasicMaterial({ color: 0xd8e6ee, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide })
    );
    wf.position.set(wfx, wy + 14, wfz);
    wf.rotation.y = -0.5;
    J.S.add(wf);
    W.waterfall = wf;

    W.regions.push({ id: 6, name: '断剑谷', x: cx, z: cz, r: 40 });
    W.bossArena = { x: cx, z: cz, r: 26, y: y };
  }

  /* ═══════════════════════════════════════════════
     主构建
     ═══════════════════════════════════════════════ */
  W.build = function () {
    J.Col.reset();
    B = new J.MB();

    /* 地形 */
    J.Terrain.build();

    /* 远山 */
    [[900, 540, 250, '#9fb8c8', '#c3d2d8', 1.2, 0.55],
    [720, 440, 200, '#87a3b4', '#aec2ca', 2.7, 0.70],
    [540, 340, 152, '#6d8a9c', '#96aeb8', 4.1, 0.85],
    [380, 250, 110, '#546f80', '#7c95a2', 5.6, 1.0]].forEach(function (r) {
      var m = mountainRing(r[0], r[1], r[2], r[3], r[4], r[5]);
      m.material.opacity = r[6];
      m.material.transparent = true;
      J.S.add(m);
    });

    /* 云 */
    W.clouds = [];
    var ctex = [cloudTex(0.2), cloudTex(0.55), cloudTex(0.9)];
    for (var ci = 0; ci < 24; ci++) {
      var ang = Math.random() * 6.283, dist = 120 + Math.random() * 260;
      var yy = 90 + Math.random() * 110;
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: ctex[ci % 3], transparent: true, opacity: 0.08 + Math.random() * 0.15,
        depthWrite: false, fog: false,
        color: new THREE.Color().setHSL(0.09, 0.05, 0.88)
      }));
      sp.position.set(Math.cos(ang) * dist, yy, Math.sin(ang) * dist);
      var sc = 60 + Math.random() * 90;
      sp.scale.set(sc, sc * 0.5, 1);
      sp.userData = { ang: ang, dist: dist, drift: (Math.random() - 0.5) * 0.0014 };
      J.S.add(sp);
      W.clouds.push(sp);
    }

    /* 太阳光晕 */
    (function () {
      var cv = document.createElement('canvas'); cv.width = cv.height = 256;
      var g = cv.getContext('2d');
      var grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grd.addColorStop(0, 'rgba(255,244,214,1)');
      grd.addColorStop(0.14, 'rgba(255,224,160,0.85)');
      grd.addColorStop(0.42, 'rgba(255,196,120,0.26)');
      grd.addColorStop(1, 'rgba(255,180,100,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(cv), transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false
      }));
      sp.scale.set(420, 420, 1);
      sp.position.set(640, 330, -690);
      sp.renderOrder = -700;
      J.S.add(sp);
    })();

    /* 六区域 */
    buildEntrance();
    buildBamboo();
    buildBridge();
    W.regions.push({ id: 3, name: '断崖吊桥', x: J.Terrain.bridgeCenterX(0), z: 4, r: 34 });
    buildVillage();
    buildTemple();
    buildValley();

    /* 地表细节 */
    scatterGround();

    /* 散落植被与岩石 */
    for (var i = 0; i < 70; i++) {
      var px = rnd(-190, 190), pz = rnd(-210, 200);
      var d = Math.abs(px - J.Terrain.pathX(pz));
      if (d < 12) continue;
      var hh = hAt(px, pz);
      if (hh < -10) continue;
      if (J.Terrain.slopeAt(px, pz) > 0.85) continue;
      if (Math.random() > 0.5) pine(px, pz, rnd(0.7, 1.3));
      else rock(px, pz, rnd(0.6, 1.4));
    }

    /* 合并静态几何 */
    /* 建筑表面噪声：避免大色块 */
    var bc = document.createElement('canvas'); bc.width = bc.height = 256;
    var bg = bc.getContext('2d');
    bg.fillStyle = '#ffffff'; bg.fillRect(0, 0, 256, 256);
    var bi2 = bg.getImageData(0, 0, 256, 256), bd = bi2.data;
    for (var q = 0; q < bd.length; q += 4) {
      var nz2 = (Math.random() - 0.5) * 26;
      bd[q] += nz2; bd[q + 1] += nz2; bd[q + 2] += nz2;
    }
    bg.putImageData(bi2, 0, 0);
    var btex = new THREE.CanvasTexture(bc);
    btex.wrapS = btex.wrapT = THREE.RepeatWrapping;
    btex.repeat.set(0.35, 0.35);

    var mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.92, metalness: 0.02, map: btex
    });
    var mesh = B.build(mat);
    mesh.name = 'mapMesh';
    J.S.add(mesh);
    W.mesh = mesh;
    W.triCount = B.i.length / 3;
    W.colliderCount = J.Col.list.length;

    /* 尘粒 */
    var pc = 260, pg = new THREE.BufferGeometry();
    var pp = new Float32Array(pc * 3);
    for (var pi = 0; pi < pc; pi++) {
      pp[pi * 3] = rnd(-160, 160);
      pp[pi * 3 + 1] = rnd(0, 70);
      pp[pi * 3 + 2] = rnd(-200, 200);
    }
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    W.dust = new THREE.Points(pg, new THREE.PointsMaterial({
      color: 0xfff0d8, size: 0.13, transparent: true, opacity: 0.5,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    J.S.add(W.dust);

    return W;
  };

  /* ══ 区域判定 ══ */
  W.regionAt = function (x, z) {
    var best = null, bd = 1e9;
    for (var i = 0; i < W.regions.length; i++) {
      var r = W.regions[i];
      var d = Math.hypot(x - r.x, z - r.z);
      if (d < r.r && d < bd) { bd = d; best = r; }
    }
    return best;
  };

  W.update = function (dt, t, playerPos) {
    for (var i = 0; i < W.lanterns.length; i++) {
      var L = W.lanterns[i];
      L.g.rotation.z = Math.sin(t * 1.3 + L.ph) * 0.07;
    }
    for (var f = 0; f < W.fires.length; f++) {
      var F = W.fires[f];
      F.l.intensity = 1.7 + Math.sin(t * 9 + F.ph) * 0.4 + Math.sin(t * 23 + F.ph * 2) * 0.2;
    }
    for (var c = 0; c < W.clouds.length; c++) {
      var cm = W.clouds[c], u = cm.userData;
      u.ang += u.drift * dt;
      cm.position.x = Math.cos(u.ang) * u.dist;
      cm.position.z = Math.sin(u.ang) * u.dist;
    }
    if (W.dust) {
      var arr = W.dust.geometry.attributes.position.array;
      for (var d = 0; d < arr.length; d += 3) {
        arr[d + 1] -= dt * 0.4;
        arr[d] += Math.sin(t * 0.4 + arr[d + 2] * 0.1) * dt * 0.25;
        if (arr[d + 1] < 0) arr[d + 1] = 68;
      }
      W.dust.geometry.attributes.position.needsUpdate = true;
    }
  };

  return W;
})();
