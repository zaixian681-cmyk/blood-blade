/* ═══════════════════════════════════════════════
   world.js — 峡谷江湖
   国画式远山环 / 云海 / 谷底城镇 / 竹林山坡 / 崖顶楼阁
   ═══════════════════════════════════════════════ */
J.World = (function () {

  var W = { lanterns: [], fires: [], spawn: { x: -104, z: -46, yaw: Math.PI * 0.62 } };

  var C = {
    stone: 0x6e6b62, stoneD: 0x4e4b44, stoneL: 0x82806f,
    dirt: 0x5e4f3a, wood: 0x4a3626, woodD: 0x2e2118, woodL: 0x6a4c32,
    wall: 0xbfb6a4, wallD: 0x8a8172,
    tile: 0x2b3138, tileD: 0x1c2126,
    red: 0x8a2e26, redD: 0x5e1e18, gold: 0xc09850,
    bamboo: 0x4e6428, bambooL: 0x627c34, leaf: 0x3a5024,
    ink: 0x24262a, ink2: 0x33363c
  };
  var B;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function hAt(x, z) { return J.Terrain.heightAt(x, z); }

  /* ═══ 远山：环绕圆柱剪影（国画层叠） ═══ */
  function mountainRing(radius, height, yBase, colTop, colBot, seed, repeatY) {
    var W2 = 2048, H2 = 512;
    var cv = document.createElement('canvas'); cv.width = W2; cv.height = H2;
    var g = cv.getContext('2d');
    g.clearRect(0, 0, W2, H2);

    function noise1(x, s) {
      var n = Math.sin(x * 127.1 + s * 311.7) * 43758.5453;
      return n - Math.floor(n);
    }
    function smoothNoise(x, s) {
      var i = Math.floor(x), f = x - i;
      f = f * f * (3 - 2 * f);
      return noise1(i, s) * (1 - f) + noise1(i + 1, s) * f;
    }
    // 用多层噪声叠出山脊线（周期性：x 用 W2 归一）
    function ridge(u) {
      var v = 0, amp = 1, f = 3;
      for (var o = 0; o < 5; o++) {
        // 周期化：sin 保证首尾相接
        v += amp * (0.5 + 0.5 * Math.sin(u * Math.PI * 2 * f + seed * 6.28 + o * 2.1)) * Math.pow(noise1(f * 7.3 + o, seed), 0.4);
        f *= 2;
        amp *= 0.48;
      }
      return v;
    }
    var grad = g.createLinearGradient(0, 0, 0, H2);
    grad.addColorStop(0, colTop);
    grad.addColorStop(1, colBot);
    g.fillStyle = grad;

    g.beginPath();
    g.moveTo(0, H2);
    var pts = [];
    for (var px = 0; px <= W2; px += 4) {
      var u = px / W2;
      var rv = ridge(u);
      var y = H2 - (0.30 + rv * 0.62) * H2;
      pts.push([px, y]);
    }
    // 首尾对齐
    pts[pts.length - 1][1] = pts[0][1];
    g.lineTo(0, pts[0][1]);
    for (var i = 0; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.lineTo(W2, H2);
    g.closePath();
    g.fill();

    // 山体上的皴擦纹理（横向淡线）
    g.globalCompositeOperation = 'source-atop';
    for (var s2 = 0; s2 < 240; s2++) {
      var sx = Math.random() * W2, sy = Math.random() * H2;
      g.strokeStyle = 'rgba(255,255,255,' + (0.02 + Math.random() * 0.05) + ')';
      g.lineWidth = 1 + Math.random() * 2;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + (Math.random() - 0.5) * 60, sy + Math.random() * 40);
      g.stroke();
    }
    g.globalCompositeOperation = 'source-over';

    var tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);

    var geo = new THREE.CylinderGeometry(radius, radius, height, 96, 1, true);
    var mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, side: THREE.BackSide, fog: false,
      depthWrite: false, opacity: 1, toneMapped: false
    });
    var m = new THREE.Mesh(geo, mat);
    m.position.y = yBase;
    m.renderOrder = -900;
    return m;
  }

  /* ═══ 云 ═══ sprite 云朵，避免大平面边缘穿帮 */
  function cloudTexture(seed) {
    var S = 256;
    var cv = document.createElement('canvas'); cv.width = cv.height = S;
    var g = cv.getContext('2d');
    g.clearRect(0, 0, S, S);
    var n = 9 + Math.floor(seed * 5);
    for (var i = 0; i < n; i++) {
      var cx = S * 0.5 + (Math.random() - 0.5) * S * 0.66;
      var cy = S * 0.52 + (Math.random() - 0.5) * S * 0.34;
      var r = S * (0.11 + Math.random() * 0.20);
      var grd = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      grd.addColorStop(0, 'rgba(255,255,255,0.55)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0.28)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    }
    var tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function buildClouds() {
    var texs = [cloudTexture(0.2), cloudTexture(0.55), cloudTexture(0.9)];
    var out = [];
    for (var i = 0; i < 26; i++) {
      var ang = Math.random() * Math.PI * 2;
      var dist = 160 + Math.random() * 420;
      var y = 30 + Math.random() * 78;
      var mat = new THREE.SpriteMaterial({
        map: texs[i % 3], transparent: true,
        opacity: 0.10 + Math.random() * 0.22,
        depthWrite: false, fog: false,
        color: new THREE.Color().setHSL(0.09, 0.05, 0.86 + Math.random() * 0.14)
      });
      var sp = new THREE.Sprite(mat);
      sp.position.set(Math.cos(ang) * dist, y, Math.sin(ang) * dist);
      var sc = 45 + Math.random() * 75;
      sp.scale.set(sc, sc * (0.42 + Math.random() * 0.22), 1);
      sp.userData = { ang: ang, dist: dist, drift: (Math.random() - 0.5) * 0.0016 };
      J.S.add(sp);
      out.push(sp);
    }
    return out;
  }

  /* ═══ 建筑构件 ═══ */
  function roof(x, yb, z, w, d, h, col, ridgeCol, ry) {
    ry = ry || 0;
    var over = 0.7;
    var halfD = d / 2 + over;
    var slope = Math.sqrt(halfD * halfD + h * h);
    var ang = Math.atan2(h, halfD);
    var pw = w + over * 2;
    for (var s = -1; s <= 1; s += 2) {
      var ox = Math.sin(ry) * s * halfD / 2;
      var oz = Math.cos(ry) * s * halfD / 2;
      B.box(x + ox, yb + h / 2, z + oz, pw, 0.22, slope, col, { rx: s * ang, ry: ry });
      var ribs = Math.max(3, Math.round(pw / 1.0));
      for (var r = 0; r < ribs; r++) {
        var off = -pw / 2 + (r + 0.5) * (pw / ribs);
        B.box(x + ox + Math.cos(ry) * off, yb + h / 2 + 0.09, z + oz - Math.sin(ry) * off,
          0.09, 0.10, slope * 0.96, ridgeCol, { rx: s * ang, ry: ry });
      }
    }
    B.box(x, yb + h + 0.10, z, pw + 0.2, 0.22, 0.4, ridgeCol, { ry: ry });
    // 翘角（中式飞檐感）
    for (var e = -1; e <= 1; e += 2) {
      B.box(x + Math.cos(ry) * e * pw / 2, yb + h + 0.26, z - Math.sin(ry) * e * pw / 2,
        0.6, 0.16, 0.5, ridgeCol, { ry: ry, rz: e * 0.24 });
    }
  }

  function house(cx, cz, w, d, h, opt) {
    opt = opt || {};
    var y0 = hAt(cx, cz);
    B.box(cx, y0 - 0.3, cz, w + 0.7, 1.2, d + 0.7, C.stoneD);      // 台基（埋进坡里）
    var wallC = opt.wall || C.wall;
    B.boxB(cx, y0, cz, w, h, d, wallC);
    // 木柱
    for (var sx = -1; sx <= 1; sx += 2) {
      for (var sz = -1; sz <= 1; sz += 2) {
        B.boxB(cx + sx * w / 2, y0, cz + sz * d / 2, 0.24, h, 0.24, C.woodD);
      }
    }
    // 横梁
    B.box(cx, y0 + h + 0.06, cz + d / 2, w + 0.35, 0.16, 0.18, C.woodD);
    B.box(cx, y0 + h + 0.06, cz - d / 2, w + 0.35, 0.16, 0.18, C.woodD);
    // 门
    var fz = cz + (opt.front === undefined ? 1 : opt.front) * (d / 2 + 0.03);
    B.box(cx, y0 + 1.05, fz, 1.05, 2.1, 0.12, C.wood);
    B.box(cx, y0 + 2.2, fz, 1.35, 0.20, 0.16, C.woodD);
    // 窗
    if (w > 4.6) {
      for (var s2 = -1; s2 <= 1; s2 += 2) {
        var wx = cx + s2 * (w / 2 - 1.25);
        B.box(wx, y0 + 1.55, fz, 1.15, 1.0, 0.12, C.woodD);
        B.box(wx, y0 + 1.55, fz + (opt.front === undefined ? 1 : opt.front) * 0.04, 0.9, 0.76, 0.06, 0x1e1a16);
      }
    }
    roof(cx, y0 + h + 0.12, cz, w, d, opt.roofH || Math.max(1.2, d * 0.32), C.tile, C.tileD);
    J.Col.add(cx - w / 2, y0, cz - d / 2, cx + w / 2, y0 + h + 1.5, cz + d / 2, 'wall');
  }

  /* 崖顶楼阁（远景，简化） */
  function tower(cx, cz, scale, h) {
    var y0 = hAt(cx, cz);
    var w = 7 * scale, d = 7 * scale;
    // 石台
    B.box(cx, y0 + 1.2 * scale, cz, w * 1.5, 3.4 * scale, d * 1.5, C.stoneD);
    var yy = y0 + 3.0 * scale;
    for (var lvl = 0; lvl < 3; lvl++) {
      var sw = w * (1 - lvl * 0.14), sd = d * (1 - lvl * 0.14);
      B.boxB(cx, yy, cz, sw, h * 0.62, sd, lvl === 0 ? C.wallD : C.wall);
      // 柱子
      for (var i = -1; i <= 1; i += 2) {
        B.boxB(cx + i * sw / 2, yy, cz + sd / 2, 0.3 * scale, h * 0.62, 0.3 * scale, C.redD);
      }
      if (lvl === 0) B.box(cx, yy + h * 0.30, cz + sd / 2 + 0.03, sw * 0.5, 1.6 * scale, 0.12, 0x1a1614);
      roof(cx, yy + h * 0.62, cz, sw * 1.04, sd * 1.04, 1.5 * scale, C.tile, C.tileD);
      yy += h * 0.62 + 1.5 * scale * 0.75;
    }
    // 顶饰
    B.box(cx, yy + 1.1 * scale, cz, 0.3, 2.2 * scale, 0.3, C.gold);
    J.Col.add(cx - w, y0, cz - d, cx + w, yy + 3, cz + d, 'wall');
  }

  function lantern(x, y, z, col) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8),
      new THREE.MeshStandardMaterial({ color: col || 0xc8382a, emissive: col || 0xc8382a, emissiveIntensity: 1.5, roughness: 0.6 }));
    body.scale.set(1, 1.2, 1);
    g.add(body);
    g.position.set(x, y, z);
    J.S.add(g);
    W.lanterns.push({ g: g, ph: Math.random() * 6.28 });
  }

  function bamboo(x, z, h) {
    var y0 = hAt(x, z);
    var seg = 5;
    for (var i = 0; i < seg; i++) {
      var r = 0.048 - i * 0.004;
      B.cyl(x, y0 + i * (h / seg), z, r, h / seg * 0.96, 6, i % 2 ? C.bamboo : C.bambooL);
    }
    var topY = y0 + h;
    for (var k = 0; k < 9; k++) {
      var a = Math.random() * 6.28;
      var lf = 0.9 + Math.random() * 0.8;
      var ly = topY - Math.random() * 1.8;
      B.box(x + Math.cos(a) * lf * 0.55, ly, z + Math.sin(a) * lf * 0.55,
        lf, 0.025, 0.34, Math.random() > 0.4 ? C.leaf : C.bamboo, { ry: a, rz: (Math.random() - 0.5) * 0.5 });
    }
    J.Col.add(x - 0.1, y0, z - 0.1, x + 0.1, topY, z + 0.1, 'thin');
  }

  function pine(x, z, s) {
    var y0 = hAt(x, z);
    B.cyl(x, y0, z, 0.13 * s, 2.0 * s, 6, C.woodD);
    // 三层锥形树冠
    for (var i = 0; i < 3; i++) {
      var yy = y0 + 1.4 * s + i * 0.95 * s;
      var rr = (1.55 - i * 0.38) * s;
      B.cyl(x, yy, z, rr, 1.15 * s, 7, i % 2 ? C.leaf : 0x2f4020, { r2: rr * 0.16 });
    }
    J.Col.add(x - 0.16, y0, z - 0.16, x + 0.16, y0 + 4 * s, z + 0.16, 'thin');
  }

  /* ═══ 主构建 ═══ */
  W.build = function () {
    J.Col.reset();
    B = new J.MB();

    /* ── 地形 ── */
    J.Terrain.build();

    /* ── 远山环（四层，越远越淡） ── */
    var rings = [
      { r: 900, h: 540, y: 250, top: '#9fb8c8', bot: '#c3d2d8', seed: 1.2, op: 0.55 },
      { r: 720, h: 440, y: 200, top: '#87a3b4', bot: '#aec2ca', seed: 2.7, op: 0.70 },
      { r: 540, h: 340, y: 152, top: '#6d8a9c', bot: '#96aeb8', seed: 4.1, op: 0.85 },
      { r: 380, h: 250, y: 110, top: '#546f80', bot: '#7c95a2', seed: 5.6, op: 1.0 }
    ];
    W.rings = [];
    for (var i = 0; i < rings.length; i++) {
      var R = rings[i];
      var m = mountainRing(R.r, R.h, R.y, R.top, R.bot, R.seed);
      J.S.add(m);
      W.rings.push(m);
    }

    /* ── 云（sprite） ── */
    W.clouds = buildClouds();

    /* ── 谷底城镇：沿河道两侧 ── */
    (function town() {
      // 主街沿 Z 轴，在河的一侧
      for (var z = -140; z < 150; z += 26) {
        var cx = Math.sin(z * 0.0055) * 26 + Math.sin(z * 0.017) * 7;
        var side = (Math.floor(z / 26) % 2 === 0) ? 1 : -1;
        var bx = cx + side * 26;
        var by = hAt(bx, z);
        if (by > 16) continue;
        house(bx, z, 9, 8, 3.8, { front: -side, roofH: 2.0 });
        if (z % 52 === 0) {
          lantern(bx - side * 5.2, by + 3.4, z + 4, 0xc8382a);
          lantern(bx - side * 5.2, by + 3.4, z - 4, 0xd8a850);
        }
      }
      // 客栈（河湾处，最大）
      var innX = Math.sin(-62 * 0.0055) * 26 + 22;
      var innY = hAt(innX, -62);
      B.box(innX, innY - 0.4, -62, 16, 1.6, 13, C.stoneD);
      B.boxB(innX, innY, -62, 14, 4.6, 11, 0xa89c88);
      for (var i2 = -2; i2 <= 2; i2++) B.boxB(innX + i2 * 3.2, innY, -62 + 6.2, 0.3, 4.2, 0.3, C.woodD);
      B.boxB(innX, innY + 4.2, -62, 15, 3.2, 12, 0x9a8e7a);
      for (var wI = -2; wI <= 2; wI++) B.box(innX + wI * 2.6, innY + 5.4, -62 + 6.3, 1.6, 1.3, 0.1, C.woodD);
      roof(innX, innY + 7.4, -62, 15, 12, 2.8, C.tile, C.tileD);
      // 二层围栏
      B.box(innX, innY + 4.6, -62 + 6.4, 14.5, 0.14, 0.18, C.wood);
      lantern(innX - 3, innY + 4.0, -62 + 6.6, 0xc8382a);
      lantern(innX + 3, innY + 4.0, -62 + 6.6, 0xd8a850);
      J.Col.add(innX - 7.5, innY, -62 - 6, innX + 7.5, innY + 9, -62 + 6, 'wall');
    })();

    /* ── 河上木桥 ── */
    (function bridge() {
      var bz = 24;
      var cx = Math.sin(bz * 0.0055) * 26 + Math.sin(bz * 0.017) * 7;
      var span = 46;
      var y = 3.2;
      // 桥面
      for (var i = 0; i < 24; i++) {
        var t = i / 23;
        var px = cx - span / 2 + t * span;
        var sag = Math.sin(t * Math.PI) * -1.6;
        B.box(px, y + sag, bz, span / 23 * 1.15, 0.22, 3.4, C.wood);
      }
      // 桥栏
      for (var s = -1; s <= 1; s += 2) {
        for (var i2 = 0; i2 < 12; i2++) {
          var t2 = i2 / 11;
          var px2 = cx - span / 2 + t2 * span;
          var sag2 = Math.sin(t2 * Math.PI) * -1.6;
          B.box(px2, y + sag2 + 0.55, bz + s * 1.6, 0.14, 1.1, 0.14, C.woodD);
        }
        B.box(cx, y + Math.sin(0.5 * Math.PI) * -1.6 + 1.15, bz + s * 1.6, span, 0.12, 0.14, C.woodD);
      }
      J.Col.add(cx - span / 2, y - 2, bz - 1.8, cx + span / 2, y + 1, bz + 1.8, 'ground');
    })();

    /* ── 竹林：山坡带 ── */
    for (var bz2 = -160; bz2 < 160; bz2 += 6) {
      for (var side2 = -1; side2 <= 1; side2 += 2) {
        for (var n = 0; n < 4; n++) {
          var bx2 = side2 * rnd(56, 110);
          var bzz = bz2 + rnd(-3, 3);
          if (Math.hypot(bx2 - (-104), bzz - (-46)) < 26) continue;
          var hh = hAt(bx2, bzz);
          if (hh > 34) continue;
          if (J.Terrain.slopeAt(bx2, bzz) > 0.75) continue;
          bamboo(bx2, bzz, rnd(5, 9));
        }
      }
    }
    /* 松树点缀 */
    for (var p = 0; p < 60; p++) {
      var px3 = (Math.random() > 0.5 ? 1 : -1) * rnd(60, 150);
      var pz3 = rnd(-200, 200);
      var ph3 = hAt(px3, pz3);
      if (ph3 < 8 || ph3 > 60) continue;
      if (J.Terrain.slopeAt(px3, pz3) > 0.8) continue;
      pine(px3, pz3, rnd(0.9, 1.7));
    }

    /* ── 崖顶楼阁群（远景剪影） ── */
    var towers = [
      [-185, -120, 1.5, 7], [-210, 20, 1.2, 6], [-165, 140, 1.0, 5.5],
      [190, -140, 1.4, 6.5], [215, 30, 1.3, 6], [175, 150, 1.1, 5.5],
      [-140, -230, 1.1, 5], [150, 235, 1.2, 5.5], [0, -250, 1.3, 6]
    ];
    for (var t3 = 0; t3 < towers.length; t3++) {
      var T3 = towers[t3];
      tower(T3[0], T3[1], T3[2], T3[3]);
    }

    /* ── 合并静态几何 ── */
    var mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02 });
    var mesh = B.build(mat);
    mesh.name = 'village';
    J.S.add(mesh);
    W.mesh = mesh;
    W.triCount = B.i.length / 3;

    /* ── 空中尘絮 / 花瓣 ── */
    var pc = 300;
    var pg = new THREE.BufferGeometry();
    var pp = new Float32Array(pc * 3);
    for (var pi = 0; pi < pc; pi++) {
      pp[pi * 3] = rnd(-160, 160); pp[pi * 3 + 1] = rnd(2, 60); pp[pi * 3 + 2] = rnd(-160, 160);
    }
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    var pm = new THREE.PointsMaterial({ color: 0xfff0d8, size: 0.14, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
    W.dust = new THREE.Points(pg, pm);
    J.S.add(W.dust);

    return W;
  };

  W.update = function (dt, t, playerPos) {
    for (var i = 0; i < W.lanterns.length; i++) {
      var L = W.lanterns[i];
      L.g.rotation.z = Math.sin(t * 1.3 + L.ph) * 0.07;
    }
    // 云漂移
    for (var c = 0; c < W.clouds.length; c++) {
      var cm = W.clouds[c];
      var u = cm.userData;
      u.ang += u.drift * dt;
      cm.position.x = Math.cos(u.ang) * u.dist;
      cm.position.z = Math.sin(u.ang) * u.dist;
    }
    // 尘
    if (W.dust) {
      var arr = W.dust.geometry.attributes.position.array;
      for (var d = 0; d < arr.length; d += 3) {
        arr[d + 1] -= dt * 0.5;
        arr[d] += Math.sin(t * 0.4 + arr[d + 2] * 0.1) * dt * 0.3;
        if (arr[d + 1] < 1) arr[d + 1] = 58;
      }
      W.dust.geometry.attributes.position.needsUpdate = true;
    }
  };

  return W;
})();
