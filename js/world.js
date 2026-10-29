/* ═══════════════════════════════════════════════
   world.js — 青崖山·断剑谷
   六区域：入口 / 竹海 / 吊桥 / 山寨 / 古寺 / 断剑谷
   ═══════════════════════════════════════════════ */
J.World = (function () {

  var W = {
    lanterns: [], fires: [], colliders: 0,
    spawn: { x: -14, z: 194, yaw: Math.PI },
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
  var B, BT;   // B=主体（墙/木/石）  BT=瓦顶
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

    /* 每一坡：底层薄板 + 逐片瓦 */
    for (var s = -1; s <= 1; s += 2) {
      var ox = Math.sin(ry) * s * halfD / 2, oz = Math.cos(ry) * s * halfD / 2;
      /* 底板（防止透光） */
      BT.box(x + ox, yb + h / 2 - 0.06, z + oz, pw, 0.12, slope, col, { rx: s * ang, ry: ry });

      /* 瓦片阵列：沿坡面分 5 排，每排横向分若干列 */
      var rows = 5;
      var cols = Math.max(3, Math.round(pw / 0.62));
      for (var r = 0; r < rows; r++) {
        var tr = (r + 0.5) / rows;                    // 0=檐口 1=屋脊
        var along = (tr - 0.5) * slope;                // 沿坡面位移
        /* 局部坐标 → 世界 */
        var lx = 0, ly = Math.cos(ang) * along, lz = -s * Math.sin(ang) * along;
        for (var c = 0; c < cols; c++) {
          var tx = -pw / 2 + (c + 0.5) * (pw / cols);
          /* 横向位置随 ry 旋转 */
          var wx = x + ox + Math.cos(ry) * tx;
          var wz = z + oz - Math.sin(ry) * tx;
          var wy = yb + h / 2 + ly;
          /* 每片瓦：微微起翘的薄片 */
          BT.box(wx + Math.sin(ry) * lz * 0, wy, wz + Math.cos(ry) * lz,
            pw / cols * 0.94, 0.10, slope / rows * 1.12,
            (r % 2 === 0) ? col : ridgeCol,
            { rx: s * ang, ry: ry, tint: 0.88 + ((r * 7 + c * 3) % 5) * 0.035 });
        }
      }
    }

    /* 屋脊压顶 */
    BT.box(x, yb + h + 0.12, z, pw + 0.24, 0.26, 0.46, ridgeCol, { ry: ry });
    /* 翘角 */
    for (var e = -1; e <= 1; e += 2) {
      BT.box(x + Math.cos(ry) * e * pw / 2, yb + h + 0.30, z - Math.sin(ry) * e * pw / 2,
        0.72, 0.18, 0.54, ridgeCol, { ry: ry, rz: e * 0.28 });
    }
  }

  function house(cx, cz, w, d, h, opt) {
    opt = opt || {};
    var y0 = hAt(cx, cz);
    /* 采样四角与中心，取最低点，基座一直落到最低点以下 */
    var minH = y0;
    var probes = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2],
    [0, 0], [-w / 2, 0], [w / 2, 0], [0, -d / 2], [0, d / 2]];
    for (var pi = 0; pi < probes.length; pi++) {
      var hh = hAt(cx + probes[pi][0], cz + probes[pi][1]);
      if (hh < minH) minH = hh;
    }
    var baseBottom = minH - 1.2;
    var baseTop = y0 + 0.35;
    B.box(cx, (baseBottom + baseTop) / 2, cz, w + 0.9, baseTop - baseBottom, d + 0.9, C.stoneD);
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
    /* 底部下沉，避免坡地悬空 */
    B.box(x, y0 - 0.9, z, 0.62, 1.9, 0.62, C.stoneD);
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
    for (var k = 0; k < 520; k++) {
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
    for (var g = 0; g < 150; g++) {
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
     崖顶：玩家出生点，俯瞰全谷
     ═══════════════════════════════════════════════ */
  function buildCliffTop() {
    var z = 186, cx = 0;
    var y = hAt(cx, z);

    /* 崖边观景台石栏 */
    for (var i = -9; i <= 9; i++) {
      var px = cx + i * 2.2;
      var py = hAt(px, 168);
      B.boxB(px, py, 168, 0.42, 1.15, 0.42, C.stoneD);
      if (i < 9) {
        B.box(px + 1.1, py + 1.05, 168, 2.2, 0.20, 0.34, C.stoneL);
      }
    }
    J.Col.add(cx - 21, hAt(cx, 168), 167.6, cx + 21, hAt(cx, 168) + 1.2, 168.4, 'thin');

    /* 观景台铺地 */
    B.box(cx, y + 0.05, 178, 22, 0.14, 22, C.stone, { tint: 0.92 });

    /* 「武」字旗杆 */
    var fx = -13, fz = 182, fy = hAt(fx, fz);
    B.boxB(fx, fy - 0.3, fz, 0.30, 11, 0.30, C.woodD);
    B.box(fx + 1.6, fy + 9.4, fz, 3.4, 0.22, 0.22, C.woodD);
    /* 旗面 */
    var bannerY = fy + 6.6;
    B.box(fx + 1.9, bannerY, fz, 2.4, 5.2, 0.06, 0x2a2420);
    B.box(fx + 1.9, bannerY + 1.2, fz + 0.04, 1.5, 2.0, 0.02, 0xd8c8a0);
    J.Col.add(fx - 0.3, fy, fz - 0.3, fx + 0.3, fy + 11, fz + 0.3, 'thin');

    /* 身后两棵松 */
    pine(cx - 9, 196, 1.3);
    pine(cx + 11, 194, 1.1);

    W.regions.push({ id: 1, name: '青崖山 · 崖顶', x: cx, z: z, r: 32 });
    W.cliffTop = { x: cx, z: 178, y: y };
  }

  /* ═══════════════════════════════════════════════
     下山栈道：崖顶 → 谷底（之字形木栈道）
     ═══════════════════════════════════════════════ */
  function buildStairs() {
    var pts = [
      { x: 18, z: 170 }, { x: 30, z: 158 }, { x: 34, z: 146 },
      { x: 26, z: 138 }, { x: 20, z: 128 }, { x: 26, z: 118 },
      { x: 36, z: 108 }, { x: 32, z: 96 }
    ];
    for (var i = 0; i < pts.length - 1; i++) {
      var A = pts[i], Bp = pts[i + 1];
      var ay = hAt(A.x, A.z), by = hAt(Bp.x, Bp.z);
      var segs = 8;
      for (var s = 0; s < segs; s++) {
        var t0 = s / segs, t1 = (s + 1) / segs;
        var mx = A.x + (Bp.x - A.x) * (t0 + t1) / 2;
        var mz = A.z + (Bp.z - A.z) * (t0 + t1) / 2;
        var my = ay + (by - ay) * (t0 + t1) / 2;
        var dx = Bp.x - A.x, dz = Bp.z - A.z;
        var len = Math.hypot(dx, dz) / segs;
        var ry = Math.atan2(dx, dz);
        /* 台阶板 */
        B.box(mx, my + 0.10, mz, 3.4, 0.20, len * 1.12, C.woodL, { ry: ry });
        /* 支柱 */
        if (s % 2 === 0) {
          B.boxB(mx - 1.5, my - 3.2, mz, 0.22, 3.4, 0.22, C.woodD);
          B.boxB(mx + 1.5, my - 3.2, mz, 0.22, 3.4, 0.22, C.woodD);
        }
        /* 扶手 */
        B.box(mx - 1.75, my + 1.0, mz, 0.12, 0.12, len * 1.12, C.woodD, { ry: ry });
        /* 碰撞：可站立 */
        J.Col.add(mx - 1.7, my - 1.2, mz - len * 0.6, mx + 1.7, my + 0.14, mz + len * 0.6, 'ground');
      }
    }
  }

  /* ═══════════════════════════════════════════════
     谷底城镇：沿河两岸的木构建筑群
     ═══════════════════════════════════════════════ */
  function buildTown() {
    var houses = [
      /* 西岸 */
      [-34, 92, 1], [-42, 74, 1], [-30, 58, 1], [-44, 40, 1],
      [-32, 22, 1], [-40, 4, 1], [-30, -14, 1], [-42, -32, 1],
      /* 东岸 */
      [30, 86, -1], [38, 68, -1], [28, 50, -1], [40, 30, -1],
      [30, 12, -1], [38, -8, -1]
    ];
    for (var i = 0; i < houses.length; i++) {
      var h = houses[i];
      var rx = J.Terrain.riverX(h[1]);
      var hx = rx + h[0];
      var hw = 6.5 + Math.random() * 2.5;
      var hd = 6 + Math.random() * 2;
      house(hx, h[1], hw, hd, 3.2 + Math.random() * 0.8, { front: h[2], roofH: 1.9 });
    }

    /* 河上木桥（跨河，连接两岸） */
    var bz = 50;
    var rxc = J.Terrain.riverX(bz);
    var span = 46;
    for (var k = 0; k < 22; k++) {
      var t = k / 21;
      var px = rxc - span / 2 + t * span;
      var pz = bz;
      var py = hAt(px, pz);
      var deckY = 10.2;
      B.box(px, deckY, pz, span / 21 * 1.15, 0.22, 4.2, C.woodL);
      J.Col.add(px - span / 42, deckY - 0.6, pz - 2.1, px + span / 42, deckY + 0.12, pz + 2.1, 'ground');
    }
    /* 桥栏 */
    for (var q = 0; q <= 10; q++) {
      var tq = q / 10;
      var qx = rxc - span / 2 + tq * span;
      for (var sg = -1; sg <= 1; sg += 2) {
        B.boxB(qx, 10.3, bz + sg * 2.0, 0.14, 1.1, 0.14, C.woodD);
      }
    }
    B.box(rxc, 11.4, bz - 2.0, span, 0.12, 0.14, C.woodD);
    B.box(rxc, 11.4, bz + 2.0, span, 0.12, 0.14, C.woodD);

    /* 码头 */
    var dz = 78, dx = J.Terrain.riverX(dz) - 16;
    for (var d = 0; d < 6; d++) {
      B.boxB(dx + d * 2.6, 7.4, dz, 0.22, 3.2, 0.22, C.woodD);
    }
    B.box(dx + 7, 10.6, dz, 17, 0.20, 4.0, C.woodL);
    J.Col.add(dx - 1, 10.2, dz - 2, dx + 16, 10.8, dz + 2, 'ground');

    /* 灯笼 */
    for (var L = 0; L < 6; L++) {
      var lz = 90 - L * 22;
      var lx = J.Terrain.riverX(lz) - 18;
      lantern(lx, hAt(lx, lz) + 3.4, lz, 0xc8382a);
    }

    W.regions.push({ id: 3, name: '断崖谷底 · 渡口', x: rxc, z: 60, r: 62 });
    W.townCenter = { x: rxc, z: 40 };
  }

  /* ═══════════════════════════════════════════════
     瀑布崖：崖壁岩石、水潭、观景栈桥
     ═══════════════════════════════════════════════ */
  function buildFallArea() {
    var F = J.Terrain.FALL;
    /* 崖壁两侧巨岩 */
    for (var i = 0; i < 14; i++) {
      var side = i % 2 ? 1 : -1;
      var rx = F.x + side * (10 + Math.random() * 24);
      var rz = 128 + Math.random() * 20;
      var ry = hAt(rx, rz);
      if (ry < 14) continue;
      rock(rx, rz, 1.4 + Math.random() * 1.8);
    }
    /* 水潭周围石块 */
    for (var k = 0; k < 10; k++) {
      var a = Math.random() * 6.283;
      var rr = 9 + Math.random() * 9;
      rock(F.x + Math.cos(a) * rr, F.z - 6 + Math.sin(a) * rr, 0.8 + Math.random() * 1.0);
    }
    /* 潭边栈桥（观瀑） */
    var dx = F.x - 18, dz = F.z - 14;
    B.box(dx, 12.4, dz, 11, 0.18, 3.0, C.woodL);
    for (var p = 0; p < 4; p++) {
      B.boxB(dx - 4 + p * 3, 9.6, dz, 0.20, 3.0, 0.20, C.woodD);
    }
    J.Col.add(dx - 5.5, 12.1, dz - 1.5, dx + 5.5, 12.6, dz + 1.5, 'ground');

    W.regions.push({ id: 2, name: '飞瀑崖壁', x: F.x, z: F.z - 12, r: 40 });
    W.fallArea = { x: F.x, z: F.z };
  }

  /* ═══════════════════════════════════════════════
     废弃古寺（谷底西侧）
     ═══════════════════════════════════════════════ */
  function buildTemple() {
    var cx = -52, cz = 20;
    var y = hAt(cx, cz);

    /* 石台基 */
    B.box(cx, y + 0.25, cz, 30, 0.6, 26, C.stoneD);
    J.Col.add(cx - 15, y - 0.5, cz - 13, cx + 15, y + 0.55, cz + 13, 'ground');

    /* 残破山门 */
    for (var s = -1; s <= 1; s += 2) {
      B.boxB(cx + s * 5.4, y + 0.5, cz + 13, 0.75, 5.2, 0.75, C.stoneD);
      B.box(cx + s * 5.4, y + 4.6, cz + 13, 0.95, 0.35, 0.95, C.stoneL);
      J.Col.add(cx + s * 5.4 - 0.5, y, cz + 12.6, cx + s * 5.4 + 0.5, y + 5.4, cz + 13.4, 'wall');
    }
    B.box(cx + 5.4, y + 5.4, cz + 13, 3.2, 0.4, 0.6, C.stoneD, { rz: 0.05 });
    B.box(cx, y + 5.6, cz + 13, 6, 0.35, 0.55, C.stoneD);

    /* 院墙（前后留口） */
    for (var w = -1; w <= 1; w += 2) {
      for (var wx = -6; wx <= 6; wx++) {
        B.boxB(cx + w * 13, y + 0.5, cz + wx * 2, 0.6, 2.4, 1.9, C.wallD);
      }
      J.Col.add(cx + w * 13 - 0.4, y, cz - 13, cx + w * 13 + 0.4, y + 3, cz + 13, 'wall');
    }

    /* 主殿（可进入） */
    var hx = cx, hz = cz - 2, HW = 11, HD = 9, HH = 4.8;
    B.box(hx, y + 0.45, hz, HW + 2.4, 0.9, HD + 2.4, C.stoneL);
    B.boxB(hx, y + 0.9, hz - HD / 2, HW, HH, 0.6, C.wall);
    B.boxB(hx - HW / 2, y + 0.9, hz, 0.6, HH, HD, C.wall);
    B.boxB(hx + HW / 2, y + 0.9, hz, 0.6, HH, HD, C.wall);
    /* 前墙留门洞 */
    B.boxB(hx - (HW / 4 + 0.9), y + 0.9, hz + HD / 2, HW / 2 - 1.8, HH, 0.6, C.wall);
    B.boxB(hx + (HW / 4 + 0.9), y + 0.9, hz + HD / 2, HW / 2 - 1.8, HH, 0.6, C.wall);
    B.boxB(hx - 1.9, y + 0.9, hz + HD / 2, 0.45, 4.2, 0.8, C.redD);
    B.boxB(hx + 1.9, y + 0.9, hz + HD / 2, 0.45, 4.2, 0.8, C.redD);
    B.box(hx, y + 5.2, hz + HD / 2, 4.4, 0.45, 0.8, C.woodD);

    /* 柱子 */
    for (var c2 = -1; c2 <= 1; c2 += 2) {
      B.boxB(hx + c2 * (HW / 2 - 1.0), y + 0.9, hz + HD / 2 - 1.0, 0.38, HH, 0.38, C.redD);
    }
    roof(hx, y + 0.9 + HH, hz, HW, HD, 2.4, C.tile, C.tileD);

    /* 碰撞（留门） */
    J.Col.add(hx - HW / 2, y + 0.9, hz - HD / 2, hx + HW / 2, y + 0.9 + HH, hz - HD / 2 + 0.5, 'wall');
    J.Col.add(hx - HW / 2, y + 0.9, hz - HD / 2, hx - HW / 2 + 0.5, y + 0.9 + HH, hz + HD / 2, 'wall');
    J.Col.add(hx + HW / 2 - 0.5, y + 0.9, hz - HD / 2, hx + HW / 2, y + 0.9 + HH, hz + HD / 2, 'wall');
    J.Col.add(hx - HW / 2, y + 0.9, hz + HD / 2 - 0.5, hx - 1.7, y + 0.9 + HH, hz + HD / 2, 'wall');
    J.Col.add(hx + 1.7, y + 0.9, hz + HD / 2 - 0.5, hx + HW / 2, y + 0.9 + HH, hz + HD / 2, 'wall');
    /* 殿内地板 */
    J.Col.add(hx - HW / 2, y + 0.4, hz - HD / 2, hx + HW / 2, y + 0.95, hz + HD / 2, 'ground');

    /* 佛像（密道在佛像背后） */
    B.box(hx, y + 1.8, hz - 2.6, 4.4, 1.8, 2.6, C.stoneL);
    B.box(hx, y + 3.6, hz - 2.8, 1.9, 2.0, 1.4, 0x9a8e76);
    B.box(hx, y + 4.8, hz - 2.8, 2.3, 0.35, 1.7, C.gold);
    J.Col.add(hx - 2.2, y + 0.9, hz - 4.1, hx + 2.2, y + 4.6, hz - 1.2, 'wall');

    /* 供桌 */
    B.box(hx, y + 1.35, hz + 1.6, 2.8, 0.16, 1.1, C.woodD);
    B.boxB(hx - 1.2, y + 0.9, hz + 1.6, 0.16, 0.5, 0.9, C.woodD);
    B.boxB(hx + 1.2, y + 0.9, hz + 1.6, 0.16, 0.5, 0.9, C.woodD);

    /* 石灯与枯树 */
    lamp(cx - 8, cz + 8);
    lamp(cx + 8, cz + 8);
    for (var k = 0; k < 4; k++) {
      var px2 = cx + rnd(-11, 11), pz2 = cz + rnd(6, 11);
      var py2 = hAt(px2, pz2);
      B.cyl(px2, py2, pz2, 0.28, rnd(0.9, 2.2), 8, C.stone, { r2: 0.24 });
    }
    [[-11, 4], [10, 2]].forEach(function (p) {
      var tx = cx + p[0], tz = cz + p[1], ty = hAt(tx, tz);
      B.cyl(tx, ty, tz, 0.26, 4.2, 6, 0x4a4034);
      for (var br = 0; br < 3; br++) {
        var ba = rnd(0, 6.28);
        B.box(tx + Math.cos(ba) * 1.2, ty + 3.0 + br * 0.4, tz + Math.sin(ba) * 1.2,
          1.6, 0.12, 0.12, 0x4a4034, { ry: ba, rz: rnd(-0.4, 0.4) });
      }
    });

    W.templeCenter = { x: hx, z: hz, y: y + 0.9 };
    W.passagePos = { x: hx, y: y + 0.9, z: hz - 4.6 };
    W.regions.push({ id: 3, name: '废弃古寺', x: cx, z: cz, r: 34 });
  }

  /* ═══════════════════════════════════════════════
     血衣门总坛（北坡）
     ═══════════════════════════════════════════════ */
  function buildLair() {
    var cx = J.Terrain.riverX(-100), cz = -100;
    var y = hAt(cx, cz);

    /* 木栅栏围场 */
    for (var a = 0; a < 32; a++) {
      var ang = a / 32 * Math.PI * 2;
      var px = cx + Math.cos(ang) * 24;
      var pz = cz + Math.sin(ang) * 24;
      /* 正门朝南留口 */
      if (Math.abs(J.U.ang(ang, Math.PI / 2)) < 0.34) continue;
      var py = hAt(px, pz);
      B.boxB(px, py - 0.4, pz, 0.3, 3.2, 0.3, 0x3a2418, { ry: ang });
      if (a % 2 === 0) B.box(px, py + 1.4, pz, 0.14, 0.14, 3.6, 0x3a2418, { ry: ang });
      J.Col.add(px - 0.22, py, pz - 0.22, px + 0.22, py + 3, pz + 0.22, 'thin');
    }

    /* 总坛大门 */
    var gx = cx, gz = cz + 24;
    var gy = hAt(gx, gz);
    for (var s = -1; s <= 1; s += 2) {
      B.boxB(gx + s * 3.4, gy - 0.4, gz, 0.46, 5.0, 0.46, 0x3a2418);
      J.Col.add(gx + s * 3.4 - 0.3, gy, gz - 0.3, gx + s * 3.4 + 0.3, gy + 4.8, gz + 0.3, 'wall');
    }
    B.box(gx, gy + 4.8, gz, 0.5, 0.5, 7.4, 0x3a2418);
    /* 血红旗 */
    for (var f = -1; f <= 1; f += 2) {
      B.box(gx + f * 0.9, gy + 3.2, gz + 0.3, 1.8, 3.0, 0.05, 0x8a1a14);
      B.box(gx + f * 0.9, gy + 2.6, gz + 0.32, 1.0, 0.9, 0.02, 0x1a1210);
    }

    /* 帐篷 */
    [[-13, -4], [12, -6], [-9, 12], [14, 10]].forEach(function (p) {
      var tx = cx + p[0], tz = cz + p[1], ty = hAt(tx, tz);
      B.taper(tx, ty, tz, 5.4, 5.0, 1.2, 1.0, 3.0, 0x5a4a3a);
      B.box(tx, ty + 0.05, tz, 5.8, 0.1, 5.4, 0x4a3a2c);
      B.box(tx, ty + 1.2, tz + 2.4, 1.4, 1.6, 0.2, 0x2a2018);
      J.Col.add(tx - 2.7, ty, tz - 2.5, tx + 2.7, ty + 2.8, tz + 2.5, 'wall');
    });

    /* 火盆 */
    for (var fp = 0; fp < 3; fp++) {
      var fx = cx + (fp - 1) * 10, fz = cz + 2;
      var fy = hAt(fx, fz);
      B.cyl(fx, fy, fz, 0.7, 0.9, 8, 0x2a2018, { r2: 0.55 });
      B.box(fx, fy + 0.95, fz, 1.2, 0.12, 1.2, 0xff7a2a, { noShade: true });
      var fl = new THREE.PointLight(0xff7a30, 2.4, 16, 2);
      fl.position.set(fx, fy + 1.4, fz);
      J.S.add(fl);
      W.fires.push({ l: fl, ph: Math.random() * 6.28 });
    }

    /* 石牢：囚禁公主 */
    var px2 = cx + 4, pz2 = cz - 12;
    var py2 = hAt(px2, pz2);
    B.box(px2, py2 + 0.1, pz2, 4.2, 0.3, 4.2, C.stoneD);
    for (var b2 = 0; b2 < 9; b2++) {
      var ba2 = b2 / 9 * Math.PI * 2;
      B.boxB(px2 + Math.cos(ba2) * 2.0, py2 + 0.2, pz2 + Math.sin(ba2) * 2.0, 0.16, 3.0, 0.16, 0x4a4a50);
    }
    B.box(px2, py2 + 3.2, pz2, 4.4, 0.2, 4.4, 0x3a3a40);
    J.Col.add(px2 - 2.2, py2, pz2 - 2.2, px2 + 2.2, py2 + 3.2, pz2 + 2.2, 'wall');
    /* 内部地板 */
    J.Col.add(px2 - 1.9, py2 + 0.1, pz2 - 1.9, px2 + 1.9, py2 + 0.35, pz2 + 1.9, 'ground');

    /* 兵器架 */
    var wx = cx - 12, wz = cz - 8, wy = hAt(wx, wz);
    B.box(wx, wy + 0.9, wz, 3.4, 0.16, 0.3, 0x3a2418);
    for (var wq = 0; wq < 5; wq++) {
      B.box(wx - 1.4 + wq * 0.7, wy + 1.5, wz, 0.07, 2.0, 0.07, 0x9aa0a8, { rz: rnd(-0.12, 0.12) });
    }
    J.Col.add(wx - 1.8, wy, wz - 0.4, wx + 1.8, wy + 2.6, wz + 0.4, 'thin');

    W.lairCenter = { x: cx, z: cz, y: y };
    W.cagePos = { x: px2, y: py2, z: pz2 };
    W.regions.push({ id: 5, name: '血衣门总坛', x: cx, z: cz, r: 40 });
  }

  /* ═══════════════════════════════════════════════
     北岸山坡 + 山顶宫殿
     ═══════════════════════════════════════════════ */
  function buildNorthSlope() {
    /* 山坡上的几处院落 */
    var spots = [[-30, -96], [34, -104], [-18, -126]];
    for (var i = 0; i < spots.length; i++) {
      house(spots[i][0] + J.Terrain.riverX(spots[i][1]), spots[i][1], 7, 6.5, 3.4, { front: 1, roofH: 1.9 });
    }
    /* 上山石阶 */
    for (var k = 0; k < 20; k++) {
      var sz = -80 - k * 4.2;
      var sx = J.Terrain.riverX(sz) + 4;
      var sy = hAt(sx, sz);
      B.box(sx, sy + 0.08, sz, 8, 0.18, 4.4, C.stone, { tint: 0.86 + (k % 3) * 0.06 });
    }
    W.regions.push({ id: 5, name: '北坡石阶', x: J.Terrain.riverX(-100), z: -100, r: 44 });
  }

  function buildPalace() {
    var cz = -190, cx = 0;
    var y = 73;

    /* 三层台基 */
    B.box(cx, y + 0.6, cz, 46, 1.2, 30, C.stoneD);
    B.box(cx, y + 1.8, cz - 3, 34, 1.2, 22, C.stoneL);
    B.box(cx, y + 3.0, cz - 5, 24, 1.2, 16, C.stoneD);

    /* 主殿（三层重檐） */
    var baseY = y + 3.6;
    for (var lv = 0; lv < 2; lv++) {
      var w = 18 - lv * 3, d = 12 - lv * 2, hgt = 4.2;
      var yy = baseY + lv * 5.2;
      B.boxB(cx, yy, cz - 4, w, hgt, d, C.wall);
      for (var s = -1; s <= 1; s += 2) {
        for (var t = -1; t <= 1; t += 2) {
          B.boxB(cx + s * (w / 2 - 0.5), yy, cz - 4 + t * (d / 2 - 0.5), 0.5, hgt, 0.5, C.redD);
        }
      }
      roof(cx, yy + hgt, cz - 4, w + 1.2, d + 1.2, 2.6, C.tile, C.tileD);
    }
    /* 顶阁 */
    B.boxB(cx, baseY + 10.4, cz - 4, 8, 3.2, 6, C.wall);
    roof(cx, baseY + 13.6, cz - 4, 9.6, 7.4, 2.2, C.tile, C.tileD);
    B.box(cx, baseY + 16.4, cz - 4, 0.5, 2.6, 0.5, C.gold);

    /* 两侧配殿 */
    for (var e = -1; e <= 1; e += 2) {
      B.boxB(cx + e * 20, y + 1.4, cz + 2, 10, 3.4, 10, C.wall);
      roof(cx + e * 20, y + 4.8, cz + 2, 11.4, 11.4, 2.0, C.tile, C.tileD);
      /* 红旗 */
      B.boxB(cx + e * 15, y + 1.4, cz + 8, 0.20, 7, 0.20, C.woodD);
      B.box(cx + e * 15 + e * 0.9, y + 7.2, cz + 8, 1.6, 2.4, 0.05, 0xa8342c);
    }

    /* 石阶登顶 */
    for (var k = 0; k < 14; k++) {
      var sz = cz + 22 - k * 1.8;
      var sy = 72 + k * 0.15;
      B.box(cx, sy, sz, 16 - k * 0.3, 0.20, 2.0, C.stoneL, { tint: 0.9 + (k % 3) * 0.05 });
    }

    J.Col.add(cx - 24, y, cz - 20, cx + 24, y + 20, cz + 16, 'wall');

    W.regions.push({ id: 6, name: '山顶 · 断剑宫', x: cx, z: cz, r: 56 });
    W.palace = { x: cx, z: cz, y: y };
    W.bossArena = { x: cx, z: cz + 18, r: 22, y: y + 6 };
  }

  /* ═══════════════════════════════════════════════
     主构建
     ═══════════════════════════════════════════════ */
  W.build = function () {
    J.Col.reset();
    B = new J.MB();
    BT = new J.MB();

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

    /* 六区域（按参考图垂直布局） */
    buildCliffTop();
    buildStairs();
    buildFallArea();
    buildTown();
    buildTemple();
    buildLair();
    buildNorthSlope();
    buildPalace();

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
    /* ── 瓦顶材质：程序化瓦楞贴图 ── */
    var tc = document.createElement('canvas'); tc.width = 192; tc.height = 192;
    var tg = tc.getContext('2d');
    tg.fillStyle = '#3a4048'; tg.fillRect(0, 0, 192, 192);
    for (var ty = 0; ty < 192; ty += 16) {
      var grd = tg.createLinearGradient(0, ty, 0, ty + 16);
      grd.addColorStop(0, 'rgba(255,255,255,0.16)');
      grd.addColorStop(0.45, 'rgba(255,255,255,0.03)');
      grd.addColorStop(1, 'rgba(0,0,0,0.28)');
      tg.fillStyle = grd; tg.fillRect(0, ty, 192, 16);
      tg.strokeStyle = 'rgba(0,0,0,0.22)'; tg.lineWidth = 1.4;
      tg.beginPath(); tg.moveTo(0, ty + 0.5); tg.lineTo(192, ty + 0.5); tg.stroke();
    }
    for (var tx = 0; tx < 192; tx += 24) {
      tg.strokeStyle = 'rgba(0,0,0,0.16)'; tg.lineWidth = 1;
      tg.beginPath(); tg.moveTo(tx + 0.5, 0); tg.lineTo(tx + 0.5, 192); tg.stroke();
    }
    var ttex = new THREE.CanvasTexture(tc);
    ttex.wrapS = ttex.wrapT = THREE.RepeatWrapping;
    ttex.repeat.set(0.55, 0.55);
    ttex.colorSpace = THREE.SRGBColorSpace;

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

    /* 建筑表面法线：模拟瓦楞 / 灰泥 / 木纹的微起伏 */
    var bnc = document.createElement('canvas'); bnc.width = bnc.height = 256;
    var bx2 = bnc.getContext('2d');
    var bimg = bx2.createImageData(256, 256);
    var bdd = bimg.data;
    for (var by = 0; by < 256; by++) {
      for (var bxx = 0; bxx < 256; bxx++) {
        /* 横向瓦楞 + 细噪 */
        var wave = Math.sin(bxx * 0.30) * 0.5 + Math.sin(by * 0.12) * 0.3 + Math.random() * 0.2;
        var dxn = Math.cos(bxx * 0.30) * 0.55;
        var dyn = Math.cos(by * 0.12) * 0.35 + Math.random() * 0.1;
        var nx3 = -dxn, ny3 = -dyn, nz3 = 1.0;
        var l3 = Math.sqrt(nx3 * nx3 + ny3 * ny3 + nz3 * nz3) || 1;
        var kk = (by * 256 + bxx) * 4;
        bdd[kk] = (nx3 / l3 * 0.5 + 0.5) * 255;
        bdd[kk + 1] = (ny3 / l3 * 0.5 + 0.5) * 255;
        bdd[kk + 2] = (nz3 / l3 * 0.5 + 0.5) * 255;
        bdd[kk + 3] = 255;
      }
    }
    bx2.putImageData(bimg, 0, 0);
    var bnorm = new THREE.CanvasTexture(bnc);
    bnorm.wrapS = bnorm.wrapT = THREE.RepeatWrapping;
    bnorm.repeat.set(0.28, 0.28);

    var mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.90, metalness: 0.02, map: btex,
      normalMap: bnorm, normalScale: new THREE.Vector2(0.75, 0.75)
    });
    var mesh = B.build(mat);
    mesh.name = 'mapMesh';
    J.S.add(mesh);
    W.mesh = mesh;

    /* 瓦顶单独成 mesh，用瓦楞材质 */
    var tileMat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.86, metalness: 0.04,
      map: ttex, normalMap: bnorm, normalScale: new THREE.Vector2(1.1, 1.1)
    });
    var tileMesh = BT.build(tileMat);
    tileMesh.name = 'roofMesh';
    J.S.add(tileMesh);
    W.roofMesh = tileMesh;

    W.triCount = B.i.length / 3 + BT.i.length / 3;
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

  /* ══ 放置可交互物 ══ */
  W.placeInteractables = function () {
    if (!J.Interact) return;

    /* 山寨物资箱 */
    if (W.cratePos) {
      for (var i = 0; i < W.cratePos.length; i++) {
        var c = W.cratePos[i];
        J.Interact.addChest(c.x, c.z, {
          id: 'villageCrate' + i,
          ry: rnd(0, 3.14),
          reward: i === 1 ? '获得 铜钱 ×80' : '获得 铜钱 ×45'
        });
      }
    }

    /* 隐藏山洞宝箱 */
    if (W.cavePos) {
      J.Interact.addChest(W.cavePos.x + 1.0, W.cavePos.z + 1.2, {
        id: 'caveChest',
        reward: '获得 武学残页 · 断岳式'
      });
      J.Interact.addStele(W.cavePos.x - 1.6, W.cavePos.z + 2.0, '石壁刻着模糊的字：「刀过之处，山亦可断。」', 0);
    }

    /* 古寺大雄宝殿内的秘籍 */
    if (W.templeCenter) {
      var t = W.templeCenter;
      J.Interact.addChest(t.x + 4.2, t.z + 3.4, {
        id: 'secretTemple',
        ry: 0.4,
        reward: '获得 武学秘籍 · 太玄刀诀'
      });
      J.Interact.addStele(t.x - 2.0, t.z + 5.0, '断碑曰：「太玄之刃，非持刀者不可御。」', 0.3);
    }

    /* 入口山门石碑 */
    var ez = 178, ex = J.Terrain.pathX(ez) + 7;
    J.Interact.addStele(ex, ez, '青崖山 · 断剑谷\n山道险绝，桥上慎行。', -0.4);

    /* 桥头石碑 */
    var bz = 34, bx = J.Terrain.pathX(bz) + 6;
    J.Interact.addStele(bx, bz, '断崖吊桥\n此行向北，黑风寨在此山中。', 0.2);

    /* 佛像暗门 */
    if (W.passagePos) {
      J.Interact.add({
        id: 'passage', x: W.passagePos.x, y: W.passagePos.y, z: W.passagePos.z,
        r: 3.4, label: '推开佛像', tag: 'passage',
        onUse: function () {
          J.UI.toast('佛像缓缓移开，露出向下的石阶', 2.6);
          J.FX.ring(W.passagePos.x, W.passagePos.y + 1.2, W.passagePos.z, 0xc0a0ff, 3.0);
          if (J.Story) J.Story.onInteract('passage');
        }
      });
    }
    /* 密道账册 */
    if (W.templeCenter) {
      var t2 = W.templeCenter;
      J.Interact.addChest(t2.x + 3.0, t2.z - 7.0, {
        id: 'ledger', ry: 0.2,
        reward: '取得 血衣门账册',
        onUse: function () {
          if (J.Story) J.Story.onInteract('ledger');
        }
      });
    }
    /* 囚笼解绳 */
    if (W.cagePos) {
      J.Interact.add({
        id: 'rescueShen', x: W.cagePos.x, y: W.cagePos.y, z: W.cagePos.z,
        r: 4.0, label: '解开绳索', tag: 'rescue', once: true,
        onUse: function () {
          J.UI.toast('绳索落地，山与晨站起身来', 2.6);
          J.FX.ring(W.cagePos.x, W.cagePos.y + 1.0, W.cagePos.z, 0xffd070, 3.2);
          if (J.Story) {
            J.Story.onInteract('rescueShen');
            J.Story.talk('shen', 'shen_freed');
          }
        }
      });
    }

    /* 断剑谷石碑 */
    var vz = -200, vx = J.Terrain.pathX(vz) + 9;
    J.Interact.addStele(vx, vz, '断剑谷\n昔年刀客尽折于此。', 0);
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
