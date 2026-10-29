/* ═══════════════════════════════════════════════
   world.js — 小江湖
   青石主街 / 客栈 / 民居 / 竹林 / 破庙 / 远山
   ═══════════════════════════════════════════════ */
J.World = (function () {

  var W = {
    mats: {}, lanterns: [], fires: [],
    size: 150,          // 世界半径
    spawn: { x: 0, z: -18, yaw: Math.PI }
  };

  var C = {
    stone: 0x7c7970, stoneD: 0x5c594f, stoneL: 0x918d82,
    dirt: 0x7a6549, grass: 0x55693a, grassD: 0x44562e,
    wood: 0x6b4a32, woodD: 0x4a3222, woodL: 0x8d6544,
    wall: 0xc6b9a0, wallD: 0xa89880,
    tile: 0x3e4650, tileD: 0x2e343c,
    red: 0xa8342c, redD: 0x7a241e,
    gold: 0xd8b25e,
    bamboo: 0x6e8a3e, bambooL: 0x8aa651,
    leaf: 0x4d6b34, leafD: 0x3a5228,
    rock: 0x7a7568, rockD: 0x5e5a50,
    cloth: 0xc9b48a, clothB: 0x3f5a7a
  };

  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* ── 通用构件 ── */
  var B; // 当前 builder

  function post(x, z, h, r, col) { B.cyl(x, 0, z, r, h, 6, col || C.wood); }

  /* 双坡屋顶：两块真实斜板 + 瓦楞 */
  function roof(x, yb, z, w, d, h, col, ridgeCol) {
    var over = 0.6;
    var halfD = d / 2 + over;
    var slope = Math.sqrt(halfD * halfD + h * h);
    var ang = Math.atan2(h, halfD);
    var pw = w + over * 2;

    for (var s = -1; s <= 1; s += 2) {
      B.box(x, yb + h / 2, z + s * halfD / 2, pw, 0.22, slope, col, { rx: s * ang });
      /* 瓦楞：沿坡面走向的细条 */
      var ribs = Math.max(3, Math.round(pw / 1.1));
      for (var r = 0; r < ribs; r++) {
        var rx = x - pw / 2 + (r + 0.5) * (pw / ribs);
        B.box(rx, yb + h / 2 + 0.09, z + s * halfD / 2, 0.10, 0.10, slope * 0.97, ridgeCol, { rx: s * ang });
      }
    }
    /* 正脊 */
    B.box(x, yb + h + 0.10, z, pw + 0.12, 0.20, 0.36, ridgeCol || C.tileD);
    /* 两头翘角 */
    for (var e = -1; e <= 1; e += 2) {
      B.box(x + e * pw / 2, yb + h + 0.20, z, 0.22, 0.26, 0.44, ridgeCol || C.tileD);
    }
    /* 山墙（三角形封口，用两级台阶近似） */
    for (var g = 0; g < 3; g++) {
      var gh = h * (1 - g / 3);
      var gw = d * (gh / h) * 0.98;
      if (gw < 0.2) continue;
      for (var sg = -1; sg <= 1; sg += 2) {
        B.box(x + sg * (w / 2 - 0.06), yb + gh / 2 + 0.1, z, 0.14, gh, gw, C.wallD);
      }
    }
  }

  /* 房屋 */
  function house(cx, cz, w, d, h, opt) {
    opt = opt || {};
    var y0 = 0.1;
    // 台基
    B.box(cx, y0 / 2, cz, w + 0.5, y0, d + 0.5, C.stoneD);
    // 墙体
    var wallC = opt.wall || C.wall;
    B.boxB(cx, 0, cz, w, h, d, wallC);
    // 木构架立柱
    for (var sx = -1; sx <= 1; sx += 2) {
      for (var sz = -1; sz <= 1; sz += 2) {
        B.boxB(cx + sx * w / 2, 0, cz + sz * d / 2, 0.22, h, 0.22, C.woodD);
      }
    }
    // 横梁
    B.box(cx, h + 0.06, cz + d / 2, w + 0.3, 0.14, 0.16, C.woodD);
    B.box(cx, h + 0.06, cz - d / 2, w + 0.3, 0.14, 0.16, C.woodD);
    B.box(cx + w / 2, h + 0.06, cz, 0.16, 0.14, d + 0.3, C.woodD);
    B.box(cx - w / 2, h + 0.06, cz, 0.16, 0.14, d + 0.3, C.woodD);
    // 门窗（正面朝 +z 或 -z）
    var front = opt.front === undefined ? 1 : opt.front;
    var fz = cz + front * (d / 2 + 0.02);
    // 门
    B.box(cx, 1.05, fz, 1.0, 2.1, 0.10, C.wood);
    B.box(cx, 2.22, fz, 1.28, 0.18, 0.14, C.woodD);
    B.box(cx - 0.56, 2.22, fz, 0.20, 0.20, 0.16, C.gold);
    B.box(cx + 0.56, 2.22, fz, 0.20, 0.20, 0.16, C.gold);
    // 窗
    if (w > 4.5) {
      for (var s = -1; s <= 1; s += 2) {
        var wx = cx + s * (w / 2 - 1.2);
        B.box(wx, 1.55, fz, 1.1, 0.95, 0.10, C.woodD);
        B.box(wx, 1.55, fz + front * 0.03, 0.86, 0.72, 0.06, opt.winColor || 0x2a2620);
        // 窗格
        for (var g = -1; g <= 1; g++) B.box(wx + g * 0.28, 1.55, fz + front * 0.06, 0.05, 0.75, 0.04, C.wood);
        B.box(wx, 1.55, fz + front * 0.06, 0.9, 0.05, 0.04, C.wood);
      }
    }
    // 屋顶
    roof(cx, h + 0.12, cz, w, d, opt.roofH || Math.max(1.1, d * 0.30), C.tile, C.tileD);
    // 碰撞
    J.Col.add(cx - w / 2, 0, cz - d / 2, cx + w / 2, h + 1.4, cz + d / 2, 'wall');
    return { x: cx, z: cz, w: w, d: d, h: h };
  }

  /* 灯笼 */
  function lantern(x, y, z, col) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshStandardMaterial({ color: col || 0xd8422c, emissive: col || 0xd8422c, emissiveIntensity: 0.9, roughness: 0.6 }));
    body.scale.set(1, 1.18, 1);
    g.add(body);
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 8), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }));
    cap.position.y = 0.19; g.add(cap);
    var cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4), new THREE.MeshStandardMaterial({ color: 0x2a2018 }));
    cord.position.y = 0.34; g.add(cord);
    g.position.set(x, y, z);
    J.S.add(g);
    W.lanterns.push({ g: g, body: body, base: g.position.clone(), ph: Math.random() * 6.28 });
    return g;
  }

  /* 酒幡 */
  function banner(x, y, z, text) {
    var c = document.createElement('canvas'); c.width = 64; c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = '#f2e6cc'; g.fillRect(0, 0, 64, 128);
    g.fillStyle = '#8a2b22';
    g.font = 'bold 40px serif'; g.textAlign = 'center';
    var chars = (text || '酒').split('');
    for (var i = 0; i < chars.length; i++) g.fillText(chars[i], 32, 46 + i * 44);
    g.strokeStyle = '#8a2b22'; g.lineWidth = 3; g.strokeRect(2, 2, 60, 124);
    var tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    var m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.24),
      new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }));
    m.position.set(x, y, z);
    J.S.add(m);
    W.lanterns.push({ g: m, body: m, base: m.position.clone(), ph: 1.3, flag: true });
    return m;
  }

  /* 竹 */
  function bamboo(x, z, h, lean) {
    var seg = 5, cur = 0.1;
    var pts = [];
    for (var i = 0; i < seg; i++) {
      var r = 0.045 - i * 0.004;
      var lx = x + (lean || 0) * (i / seg) * 1.2;
      var lz = z;
      B.cyl(lx, i * (h / seg), lz, r, h / seg * 0.96, 6, i % 2 ? C.bamboo : C.bambooL);
      pts.push([lx, i * h / seg + h / seg]);
    }
    // 竹节
    for (var j = 0; j < seg; j++) B.cyl(x + (lean || 0) * (j / seg) * 1.2, j * h / seg - 0.02, z, 0.052, 0.045, 6, C.leafD);
    // 叶：折线面片
    var top = pts[pts.length - 1];
    for (var k = 0; k < 4; k++) {
      var a = Math.random() * 6.28;
      var lf = 0.55 + Math.random() * 0.5;
      var lx2 = top[0] + Math.cos(a) * lf * 0.55, lz2 = z + Math.sin(a) * lf * 0.55;
      B.box((top[0] + lx2) / 2, top[1] + 0.1 + Math.random() * 0.3, (z + lz2) / 2, lf, 0.02, 0.22, Math.random() > 0.5 ? C.leaf : C.leafD, { ry: a });
    }
    J.Col.add(x - 0.1, 0, z - 0.1, x + 0.1, h, z + 0.1, 'thin');
  }

  /* 树 */
  function tree(x, z, s, col) {
    s = s || 1;
    B.cyl(x, 0, z, 0.16 * s, 1.5 * s, 6, C.woodD);
    B.cyl(x, 0, z, 0.11 * s, 2.3 * s, 6, C.wood);
    // 树冠：错落方块
    var layers = 5, base = col || C.leaf;
    for (var i = 0; i < layers; i++) {
      var a = Math.random() * 6.28, r = (0.5 + Math.random() * 0.8) * s;
      var y = 2.0 * s + i * 0.5 * s;
      var sz2 = (1.7 - i * 0.22) * s * (0.8 + Math.random() * 0.4);
      B.box(x + Math.cos(a) * r * 0.55, y, z + Math.sin(a) * r * 0.55, sz2, sz2 * 0.75, sz2,
        i % 2 ? base : (col === undefined ? C.leafD : base), { ry: a });
    }
    J.Col.add(x - 0.2, 0, z - 0.2, x + 0.2, 2.2 * s, z + 0.2, 'thin');
  }

  /* 灯笼柱 / 石灯笼 */
  function lamp(x, z) {
    B.box(x, 0.06, z, 0.5, 0.12, 0.5, C.stoneD);
    B.cyl(x, 0.1, z, 0.07, 1.5, 6, C.stone);
    B.box(x, 1.66, z, 0.36, 0.28, 0.36, C.stoneL);
    B.box(x, 1.82, z, 0.46, 0.10, 0.46, C.stoneD);
    // 灯内芯
    B.box(x, 1.66, z, 0.24, 0.18, 0.24, 0xf0d090, { noShade: true });
    J.Col.add(x - 0.15, 0, z - 0.15, x + 0.15, 1.9, z + 0.15, 'thin');
  }

  /* ═══ 主构建 ═══ */
  W.build = function () {
    J.Col.reset();
    B = new J.MB();

    /* ── 地面 ── */
    var S = W.size;
    // 底层大地
    var gGeo = new THREE.PlaneGeometry(S * 2.4, S * 2.4, 1, 1);
    var gMat = new THREE.MeshStandardMaterial({ color: C.grass, roughness: 1.0, metalness: 0 });
    var ground = new THREE.Mesh(gGeo, gMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.position.y = -0.02;
    J.S.add(ground);

    /* ── 青石主街：z 轴，宽 9 ── */
    var zs = -70, ze = 70, sw = 9;
    // 街基
    B.box(0, -0.005, (zs + ze) / 2, sw + 2.2, 0.06, ze - zs, C.dirt);
    // 石板
    for (var zz = zs; zz < ze; zz += 2.0) {
      for (var row = -2; row <= 2; row++) {
        var px = row * 1.85 + rnd(-0.06, 0.06);
        var pz = zz + (row % 2 ? 1.0 : 0);
        var tintIdx = Math.random();
        var pc = tintIdx > 0.72 ? C.stoneL : (tintIdx > 0.3 ? C.stone : C.stoneD);
        B.box(px, 0.02, pz, 1.78, 0.07, 1.92, pc, { ry: rnd(-0.01, 0.01) });
      }
    }
    // 街沿石
    for (var sz2 = -1; sz2 <= 1; sz2 += 2) {
      B.box(sz2 * (sw / 2 + 0.55), 0.06, (zs + ze) / 2, 0.5, 0.12, ze - zs, C.stoneD);
    }

    /* ── 两侧小巷铺地 ── */
    for (var lane = -1; lane <= 1; lane += 2) {
      B.box(lane * 12, -0.01, 0, 14, 0.05, 120, C.dirt);
    }

    /* ── 客栈（街西，z=-42） ── */
    (function inn() {
      var cx = -15, cz = -42, w = 13, d = 10, h = 4.6;
      B.box(cx, 0.15, cz, w + 1.2, 0.3, d + 1.2, C.stoneD);
      B.boxB(cx, 0, cz, w, h, d, 0xcfc3ac);
      // 一层柱廊
      for (var i = -2; i <= 2; i++) {
        B.boxB(cx + i * 3.0, 0, cz + d / 2 + 0.9, 0.28, 4.0, 0.28, C.woodD);
      }
      // 二层挑出
      B.boxB(cx, h - 0.4, cz, w + 0.8, 2.9, d + 0.6, 0xc4b49a);
      // 二层栏杆
      for (var i2 = -3; i2 <= 3; i2++) {
        B.box(cx + i2 * 1.6, h + 0.6, cz + d / 2 + 1.2, 0.07, 0.7, 0.07, C.woodD);
      }
      B.box(cx, h + 0.95, cz + d / 2 + 1.2, w + 0.9, 0.12, 0.16, C.wood);
      // 二层窗
      for (var wI = -2; wI <= 2; wI++) {
        B.box(cx + wI * 2.2, h + 1.6, cz + d / 2 + 0.62, 1.5, 1.2, 0.1, C.woodD);
        B.box(cx + wI * 2.2, h + 1.6, cz + d / 2 + 0.68, 1.2, 0.95, 0.06, 0x2e2820);
      }
      // 大门
      B.box(cx, 1.3, cz + d / 2 + 0.06, 2.0, 2.6, 0.14, C.redD);
      B.box(cx, 2.72, cz + d / 2 + 0.10, 2.5, 0.28, 0.2, C.woodD);
      // 主屋顶
      roof(cx, h + 2.5, cz, w + 0.9, d + 0.6, 2.3, C.tile, C.tileD);
      // 檐下灯笼
      lantern(cx - 2.2, 3.5, cz + d / 2 + 1.5);
      lantern(cx + 2.2, 3.5, cz + d / 2 + 1.5);
      lantern(cx, 2.9, cz + d / 2 + 1.55);
      // 酒幡
      banner(cx + 5.6, 3.1, cz + d / 2 + 1.9, '酒家');
      banner(cx - 5.6, 3.1, cz + d / 2 + 1.9, '客');
      // 门口酒坛
      for (var j = 0; j < 4; j++) {
        var jx = cx + 3.4 + (j % 2) * 0.7, jz = cz + d / 2 + 1.4 + Math.floor(j / 2) * 0.7;
        B.cyl(jx, 0, jz, 0.22, 0.5, 8, 0x5a4a3a, { r2: 0.16 });
      }
      // 门外长凳
      B.box(cx - 4.2, 0.45, cz + d / 2 + 1.6, 2.4, 0.12, 0.45, C.wood);
      for (var bl = 0; bl < 2; bl++) B.box(cx - 5.2 + bl * 2.0, 0.2, cz + d / 2 + 1.6, 0.14, 0.42, 0.4, C.woodD);
      J.Col.add(cx - w / 2 - 0.6, 0, cz - d / 2 - 0.6, cx + w / 2 + 0.6, h + 4, cz + d / 2 + 0.6, 'wall');
    })();

    /* ── 街东：茶铺 ── */
    house(15, -40, 9, 8, 4.2, { front: -1, roofH: 2.0 });
    (function tea() {
      var cx = 15, cz = -34;
      // 茶棚
      for (var a = -1; a <= 1; a += 2) {
        for (var b = -1; b <= 1; b += 2) B.boxB(cx + a * 2.6, 0, cz + b * 2.2, 0.16, 2.6, 0.16, C.woodD);
      }
      B.taper(cx, 2.6, cz, 6.2, 5.2, 5.4, 4.6, 0.3, C.cloth);
      // 桌
      for (var t = -1; t <= 1; t++) {
        var tx = cx + t * 1.8, tz = cz + 0.4;
        B.cyl(tx, 0, tz, 0.5, 0.72, 8, C.wood);
        for (var st = 0; st < 4; st++) {
          var sa = st / 4 * 6.28;
          B.cyl(tx + Math.cos(sa) * 0.85, 0, tz + Math.sin(sa) * 0.85, 0.16, 0.42, 6, C.woodD);
        }
        J.Col.add(tx - 0.5, 0, tz - 0.5, tx + 0.5, 0.75, tz + 0.5, 'thin');
      }
      banner(cx + 3.2, 2.9, cz + 2.4, '茶');
    })();

    /* ── 街西民居群 ── */
    house(-14, -22, 8.5, 7.5, 3.8, { roofH: 1.9 });
    house(-14.5, -8, 9, 8, 4.0, { roofH: 2.0, front: 1 });
    house(-15, 8, 8, 7, 3.6, { roofH: 1.8 });
    /* 街东民居 */
    house(14.5, -18, 8, 7, 3.7, { roofH: 1.85, front: -1 });
    house(15, -2, 9.5, 8, 4.1, { roofH: 2.05 });
    house(14, 14, 8, 7.5, 3.9, { roofH: 1.95, front: -1 });

    /* ── 铁匠铺（街东 z=26） ── */
    (function smith() {
      var cx = 15, cz = 27;
      house(cx, cz, 9, 8, 4.0, { front: -1, roofH: 1.9, wall: 0xb8a894 });
      // 炉火
      B.box(cx - 2.6, 0.5, cz + 2.4, 1.1, 1.0, 1.1, 0x3a3028);
      B.box(cx - 2.6, 1.02, cz + 2.4, 0.8, 0.12, 0.8, 0xff7a2a, { noShade: true });
      var fire = new THREE.PointLight(0xff8a3a, 1.6, 8, 2);
      fire.position.set(cx - 2.6, 1.4, cz + 2.4);
      J.S.add(fire);
      W.fires.push({ l: fire, ph: Math.random() * 6.28 });
      // 铁砧
      B.box(cx - 0.6, 0.62, cz + 2.6, 0.9, 0.3, 0.45, 0x4a4a4a);
      B.box(cx - 0.6, 0.35, cz + 2.6, 0.5, 0.55, 0.4, 0x3a3a3a);
    })();

    /* ── 药铺（街西 z=26） ── */
    house(-15, 26, 8.5, 7.5, 3.9, { roofH: 1.9 });
    banner(-11.2, 2.9, 31.5, '药');

    /* ── 竹林（两侧，z 20~48） ── */
    for (var bz = 20; bz < 50; bz += 2.4) {
      for (var bside = -1; bside <= 1; bside += 2) {
        for (var bn = 0; bn < 3; bn++) {
          var bx = bside * rnd(11, 30);
          var bzz = bz + rnd(-1.4, 1.4);
          if (Math.abs(bx) < 10) continue;
          bamboo(bx, bzz, rnd(4.5, 7.5), rnd(-0.3, 0.3));
        }
      }
    }

    /* ── 破庙（街尽头 z=56） ── */
    (function temple() {
      var cx = 0, cz = 58;
      // 台基
      B.box(cx, 0.2, cz, 16, 0.4, 13, C.stoneD);
      // 残墙
      var wc = 0x9a9182;
      B.box(cx - 6, 1.9, cz - 4, 4, 3.8, 0.6, wc);
      B.box(cx + 6, 1.6, cz - 4, 4, 3.2, 0.6, wc);
      B.box(cx - 6.4, 3.9, cz - 4, 4.2, 0.5, 0.8, C.tileD);
      // 立柱（残）
      for (var pI = -1; pI <= 1; pI++) {
        B.boxB(cx + pI * 5.2, 0.4, cz + 2.5, 0.45, pI === 0 ? 5.2 : 3.4, 0.45, C.redD);
      }
      // 残破屋顶
      roof(cx, 4.2, cz - 1, 12, 9, 1.8, C.tile, C.tileD);
      // 佛像
      var bx2 = cx, bz2 = cz - 3;
      B.box(bx2, 0.7, bz2, 2.6, 1.0, 1.8, 0x8a7f6a);
      B.taper(bx2, 1.2, bz2, 2.0, 1.4, 1.2, 0.85, 1.5, 0x9a8e76);
      B.box(bx2, 3.0, bz2, 0.85, 0.9, 0.8, 0x9a8e76);   // 头
      B.box(bx2, 3.55, bz2, 0.95, 0.25, 0.9, C.gold);
      B.box(bx2, 2.65, bz2, 1.6, 0.25, 1.0, 0x7a6f5a);  // 肩
      J.Col.add(bx2 - 1.3, 0, bz2 - 0.9, bx2 + 1.3, 3.6, bz2 + 0.9, 'wall');
      // 香炉
      B.cyl(cx, 0.4, cz + 1.5, 0.55, 0.7, 10, 0x5a4a3a, { r2: 0.62 });
      var ember = new THREE.PointLight(0xff9a4a, 0.7, 5, 2);
      ember.position.set(cx, 1.0, cz + 1.5); J.S.add(ember);
      J.Col.add(cx - 0.55, 0, cz + 1.0, cx + 0.55, 1.1, cz + 2.0, 'thin');
      // 银杏（金黄）
      tree(cx - 7.5, cz + 4, 1.3, 0xc9a83a);
      tree(cx + 7.5, cz + 4, 1.2, 0xd4b444);
      // 庙前石阶
      B.box(cx, 0.08, cz + 6.8, 10, 0.16, 1.2, C.stoneD);
    })();

    /* ── 街灯 ── */
    for (var lz = -56; lz <= 50; lz += 13) {
      if (Math.abs(lz) < 6) continue;
      lamp(-7.2, lz); lamp(7.2, lz + 6.5);
    }

    /* ── 散树 ── */
    var treeSpots = [[-24, -30], [24, -28], [-26, -12], [26, -12], [-24, 2], [26, 4],
      [-28, 18], [28, 20], [-22, 38], [24, 40], [-34, -46], [34, -44], [-30, -8], [32, -2]];
    for (var tI = 0; tI < treeSpots.length; tI++) {
      tree(treeSpots[tI][0], treeSpots[tI][1], rnd(0.9, 1.35));
    }

    /* ── 水缸 / 石凳 / 木栅栏 点缀 ── */
    for (var dI = 0; dI < 12; dI++) {
      var dx = (Math.random() > 0.5 ? 1 : -1) * rnd(6.5, 9);
      var dz = rnd(-58, 52);
      if (Math.abs(dz + 42) < 8 || Math.abs(dz - 27) < 7) continue;
      if (Math.random() > 0.5) {
        B.cyl(dx, 0, dz, 0.34, 0.62, 10, 0x6a5a48, { r2: 0.30 });
        B.cyl(dx, 0.60, dz, 0.30, 0.03, 10, 0x2a3a3a);
        J.Col.add(dx - 0.3, 0, dz - 0.3, dx + 0.3, 0.65, dz + 0.3, 'thin');
      } else {
        B.box(dx, 0.22, dz, 1.0, 0.14, 1.0, C.stoneL);
        J.Col.add(dx - 0.5, 0, dz - 0.5, dx + 0.5, 0.3, dz + 0.5, 'thin');
      }
    }

    /* ── 远景山体（不参与碰撞） ── */
    (function mountains() {
      var mg = new THREE.Group();
      var mat = new THREE.MeshStandardMaterial({ color: 0x8a94a2, roughness: 1, metalness: 0, flatShading: true, fog: false });
      var mat2 = new THREE.MeshStandardMaterial({ color: 0x76808e, roughness: 1, metalness: 0, flatShading: true, fog: false });
      for (var i = 0; i < 22; i++) {
        var a = (i / 22) * Math.PI * 2 + rnd(-0.1, 0.1);
        var dist = rnd(380, 560);
        var hgt = rnd(70, 160);
        var r = rnd(55, 110);
        var geo = new THREE.ConeGeometry(r, hgt, rndi(5, 7));
        var m = new THREE.Mesh(geo, i % 3 ? mat : mat2);
        m.position.set(Math.cos(a) * dist, hgt / 2 - 6, Math.sin(a) * dist);
        m.rotation.y = Math.random() * 3;
        mg.add(m);
      }
      J.S.add(mg);
      W.mountains = mg;
    })();

    function rndi(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }

    /* ── 合并静态几何 ── */
    var mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.02 });
    var mesh = B.build(mat);
    mesh.name = 'cityMesh';
    J.S.add(mesh);
    W.mesh = mesh;
    W.triCount = B.i.length / 3;

    /* ── 空气尘埃 ── */
    var pcount = 260;
    var pg = new THREE.BufferGeometry();
    var pp = new Float32Array(pcount * 3);
    for (var pi = 0; pi < pcount; pi++) {
      pp[pi * 3] = rnd(-40, 40); pp[pi * 3 + 1] = rnd(0.5, 12); pp[pi * 3 + 2] = rnd(-60, 60);
    }
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    var pm = new THREE.PointsMaterial({ color: 0xfff0d0, size: 0.07, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
    W.dust = new THREE.Points(pg, pm);
    J.S.add(W.dust);

    return W;
  };

  W.update = function (dt, t, playerPos) {
    // 灯笼摇曳
    for (var i = 0; i < W.lanterns.length; i++) {
      var L = W.lanterns[i];
      var s = Math.sin(t * 1.3 + L.ph) * 0.06;
      if (L.flag) {
        L.g.rotation.y = Math.sin(t * 1.1 + L.ph) * 0.28;
      } else {
        L.g.rotation.z = s; L.g.rotation.x = Math.cos(t * 0.9 + L.ph) * 0.05;
      }
    }
    // 炉火
    for (var f = 0; f < W.fires.length; f++) {
      var F = W.fires[f];
      F.l.intensity = 1.25 + Math.sin(t * 9 + F.ph) * 0.28 + Math.sin(t * 23 + F.ph * 2) * 0.13;
    }
    // 尘埃
    if (W.dust) {
      var arr = W.dust.geometry.attributes.position.array;
      for (var d = 0; d < arr.length; d += 3) {
        arr[d + 1] += dt * 0.18;
        arr[d] += Math.sin(t * 0.5 + arr[d + 2]) * dt * 0.12;
        if (arr[d + 1] > 13) arr[d + 1] = 0.4;
      }
      W.dust.geometry.attributes.position.needsUpdate = true;
    }
  };

  return W;
})();
