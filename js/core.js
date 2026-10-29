/* ═══════════════════════════════════════════════
   core.js — 引擎层
   渲染 / 天空 / 光照 / 几何合并 / 碰撞 / 输入
   ═══════════════════════════════════════════════ */
var J = window.J = {
  ver: 1,
  clock: 0, dt: 0, timeScale: 1,
  world: null, hero: null, foes: [], fx: null, ui: null,
  paused: false,
  errs: []
};

/* ── 错误可视化 ── */
window.addEventListener('error', function (e) {
  J.errs.push(e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno);
  var el = document.getElementById('err');
  if (el) { el.style.display = 'block'; el.textContent = 'BUILD ' + J.ver + '\n' + J.errs.slice(-4).join('\n'); }
});
window.addEventListener('unhandledrejection', function (e) {
  J.errs.push('promise: ' + (e.reason && e.reason.message || e.reason));
  var el = document.getElementById('err');
  if (el) { el.style.display = 'block'; el.textContent = 'BUILD ' + J.ver + '\n' + J.errs.slice(-4).join('\n'); }
});

/* ── 数学工具 ── */
J.U = {
  clamp: function (v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp: function (a, b, t) { return a + (b - a) * t; },
  damp: function (a, b, l, dt) { return J.U.lerp(a, b, 1 - Math.exp(-l * dt)); },
  rand: function (a, b) { return a + Math.random() * (b - a); },
  randi: function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  ang: function (a, b) { var d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; },
  dist2: function (ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
};

/* ═══ 横屏舞台：整体旋转 90°，游戏始终按横屏尺寸渲染 ═══ */
J.Stage = {
  el: null, rotated: false, W: 0, H: 0,
  init: function () {
    J.Stage.el = document.getElementById('stage');
    J.Stage.resize();
    window.addEventListener('resize', J.Stage.resize);
    window.addEventListener('orientationchange', function () { setTimeout(J.Stage.resize, 150); });
  },
  resize: function () {
    var el = J.Stage.el; if (!el) return;
    var vw = window.innerWidth, vh = window.innerHeight;
    var land = vw > vh;
    J.Stage.rotated = !land;
    if (land) {
      el.style.width = vw + 'px';
      el.style.height = vh + 'px';
      el.style.transform = 'none';
    } else {
      el.style.width = vh + 'px';        // 横屏的宽 = 竖屏的高
      el.style.height = vw + 'px';
      el.style.transform = 'rotate(90deg) translateY(-100%)';
    }
    J.Stage.W = el.clientWidth;
    J.Stage.H = el.clientHeight;
    if (J.R) {
      J.R.setSize(J.Stage.W, J.Stage.H, false);
      if (J.C) { J.C.aspect = J.Stage.W / J.Stage.H; J.C.updateProjectionMatrix(); }
    }
    if (J.UI && J.UI.layout) J.UI.layout();
  },
  /* 屏幕坐标 → stage 局部坐标 */
  toLocal: function (cx, cy) {
    if (!J.Stage.rotated) return { x: cx, y: cy };
    return { x: cy, y: J.Stage.H - cx };
  }
};

/* ── 渲染器 ── */
J.initRenderer = function () {
  var cv = document.getElementById('gl');
  var r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  J.dprCap = 1.5;
r.setPixelRatio(Math.min(window.devicePixelRatio || 1, J.dprCap));
  r.setSize(J.Stage.W || window.innerWidth, J.Stage.H || window.innerHeight, false);
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.02;
  J.R = r;

  var sc = new THREE.Scene();
  sc.fog = new THREE.FogExp2(0xbcccd6, 0.0021);
  J.S = sc;

  var cam = new THREE.PerspectiveCamera(62, (J.Stage.W || window.innerWidth) / (J.Stage.H || window.innerHeight), 0.1, 900);
  cam.position.set(0, 4, 10);
  J.C = cam;

  window.addEventListener('resize', J.onResize);
  return r;
};

J.onResize = function () { J.Stage.resize(); };

/* ── 天空：渐变穹顶 ── */
J.buildSky = function (topCol, midCol, botCol) {
  var geo = new THREE.SphereGeometry(600, 24, 16);
  var mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: {
      cTop: { value: new THREE.Color(topCol) },
      cMid: { value: new THREE.Color(midCol) },
      cBot: { value: new THREE.Color(botCol) },
      cSun: { value: new THREE.Color(0xffd9a0) },
      sunDir: { value: new THREE.Vector3(0.66, 0.26, -0.70).normalize() }
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'uniform vec3 cTop,cMid,cBot,cSun,sunDir; varying vec3 vP;',
      'void main(){',
      '  vec3 dir = normalize(vP);',
      '  float h = dir.y;',
      '  vec3 c = mix(cBot, cMid, smoothstep(-0.10, 0.20, h));',
      '  c = mix(c, cTop, smoothstep(0.16, 0.72, h));',
      '  float d = max(0.0, dot(dir, normalize(sunDir)));',
      '  c += cSun * pow(d, 7.0) * 0.95;',
      '  c += cSun * pow(d, 60.0) * 1.6;',
      '  gl_FragColor = vec4(c, 1.0);',
      '}'
    ].join('\n')
  });
  var m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = -1000;
  J.sky = m;
  J.S.add(m);
  return m;
};

/* ── 光照：斜阳低角度，长影子，最有武侠味 ── */
J.initLights = function () {
  var hemi = new THREE.HemisphereLight(0xa8becd, 0x4a4234, 0.92);
  J.S.add(hemi);

  var sun = new THREE.DirectionalLight(0xffc48a, 2.15);
  sun.position.set(130, 52, -150);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  var s = 92;
  sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
  sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 20; sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0009;
  sun.shadow.normalBias = 0.035;
  J.S.add(sun);
  J.S.add(sun.target);
  J.sun = sun;

  var fill = new THREE.DirectionalLight(0x8fa8c8, 0.42);
  fill.position.set(40, 26, -50);
  J.S.add(fill);
  J.fill = fill;
};

J.updateSun = function (px, pz) {
  var sun = J.sun; if (!sun) return;
  sun.target.position.set(px, 0, pz);
  sun.position.set(px + 130, 52, pz - 150);
  sun.target.updateMatrixWorld();
};
/* ═══ 几何合并器 ═══ 把成百上千个方块压成一个网格 */
J.MB = function () {
  this.p = []; this.n = []; this.c = []; this.i = [];
  this.vc = 0;
};
J.MB.prototype = {
  /* 单面（4 顶点） */
  quad: function (a, b, c, d, nx, ny, nz, col, shade) {
    var s = shade === undefined ? 1 : shade;
    var r = ((col >> 16) & 255) / 255 * s, g = ((col >> 8) & 255) / 255 * s, bl = (col & 255) / 255 * s;
    var P = this.p, N = this.n, C = this.c, I = this.i, v = this.vc;
    P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    for (var k = 0; k < 4; k++) { N.push(nx, ny, nz); C.push(r, g, bl); }
    I.push(v, v + 1, v + 2, v, v + 2, v + 3);
    this.vc += 4;
  },
  /* 盒子，y 为中心；支持 rx/ry/rz 欧拉旋转（法线同步旋转） */
  box: function (x, y, z, sx, sy, sz, col, opt) {
    opt = opt || {};
    var hx = sx / 2, hy = sy / 2, hz = sz / 2;
    var rx = opt.rx || 0, ry = opt.ry || 0, rz = opt.rz || 0;
    var t = opt.tint === undefined ? 1 : opt.tint;
    var cx = Math.cos(rx), sxr = Math.sin(rx);
    var cz = Math.cos(rz), szr = Math.sin(rz);
    var cy = Math.cos(ry), syr = Math.sin(ry);
    var anyRot = !!(rx || ry || rz);

    function rot(dx, dy, dz) {
      var a = dx, b = dy, c = dz, tmp;
      if (rx) { tmp = b * cx - c * sxr; c = b * sxr + c * cx; b = tmp; }
      if (rz) { tmp = a * cz - b * szr; b = a * szr + b * cz; a = tmp; }
      if (ry) { tmp = a * cy + c * syr; c = -a * syr + c * cy; a = tmp; }
      return [a, b, c];
    }
    function P(dx, dy, dz) { var r = anyRot ? rot(dx, dy, dz) : [dx, dy, dz]; return [x + r[0], y + r[1], z + r[2]]; }
    function N(nx0, ny0, nz0) { return anyRot ? rot(nx0, ny0, nz0) : [nx0, ny0, nz0]; }

    var top = 1.0, side = 0.80, side2 = 0.68, bot = 0.45;
    if (opt.noShade) { top = side = side2 = bot = 1; }
    var n1 = N(0, 1, 0), n2 = N(0, -1, 0), n3 = N(0, 0, 1), n4 = N(0, 0, -1), n5 = N(1, 0, 0), n6 = N(-1, 0, 0);
    this.quad(P(-hx, hy, hz), P(hx, hy, hz), P(hx, hy, -hz), P(-hx, hy, -hz), n1[0], n1[1], n1[2], col, top * t);
    this.quad(P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, -hy, hz), P(-hx, -hy, hz), n2[0], n2[1], n2[2], col, bot * t);
    this.quad(P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz), n3[0], n3[1], n3[2], col, side * t);
    this.quad(P(hx, -hy, -hz), P(-hx, -hy, -hz), P(-hx, hy, -hz), P(hx, hy, -hz), n4[0], n4[1], n4[2], col, side * t);
    this.quad(P(hx, -hy, hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(hx, hy, hz), n5[0], n5[1], n5[2], col, side2 * t);
    this.quad(P(-hx, -hy, -hz), P(-hx, -hy, hz), P(-hx, hy, hz), P(-hx, hy, -hz), n6[0], n6[1], n6[2], col, side2 * t);
    return this;
  },
  /* 以 y 为底面的盒子 */
  boxB: function (x, yb, z, sx, sy, sz, col, opt) {
    return this.box(x, yb + sy / 2, z, sx, sy, sz, col, opt);
  },
  /* 圆柱（低边数） */
  cyl: function (x, yb, z, r, h, seg, col, opt) {
    opt = opt || {};
    seg = seg || 8;
    var r2 = opt.r2 === undefined ? r : opt.r2;
    for (var i = 0; i < seg; i++) {
      var a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      var x0 = x + Math.cos(a0) * r, z0 = z + Math.sin(a0) * r;
      var x1 = x + Math.cos(a1) * r, z1 = z + Math.sin(a1) * r;
      var x0b = x + Math.cos(a0) * r2, z0b = z + Math.sin(a0) * r2;
      var x1b = x + Math.cos(a1) * r2, z1b = z + Math.sin(a1) * r2;
      var nx = Math.cos((a0 + a1) / 2), nz = Math.sin((a0 + a1) / 2);
      this.quad([x0, yb, z0], [x1, yb, z1], [x1b, yb + h, z1b], [x0b, yb + h, z0b], nx, 0, nz, col, 0.82);
      this.quad([x, yb + h, z], [x0b, yb + h, z0b], [x1b, yb + h, z1b], [x, yb + h, z], 0, 1, 0, col, 1);
    }
    return this;
  },
  /* 棱台/斜面（顶面缩放） */
  taper: function (x, yb, z, w0, d0, w1, d1, h, col, opt) {
    var a = [[-w0 / 2, -d0 / 2], [w0 / 2, -d0 / 2], [w0 / 2, d0 / 2], [-w0 / 2, d0 / 2]];
    var b = [[-w1 / 2, -d1 / 2], [w1 / 2, -d1 / 2], [w1 / 2, d1 / 2], [-w1 / 2, d1 / 2]];
    for (var i = 0; i < 4; i++) {
      var j = (i + 1) % 4;
      var p0 = [x + a[i][0], yb, z + a[i][1]], p1 = [x + a[j][0], yb, z + a[j][1]];
      var p2 = [x + b[j][0], yb + h, z + b[j][1]], p3 = [x + b[i][0], yb + h, z + b[i][1]];
      var nx = (a[i][0] + a[j][0]) / 2, nz = (a[i][1] + a[j][1]) / 2;
      var ln = Math.hypot(nx, nz) || 1;
      this.quad(p0, p1, p2, p3, nx / ln, 0, nz / ln, col, 0.84);
    }
    this.quad([x + b[2][0], yb + h, z + b[2][1]], [x + b[1][0], yb + h, z + b[1][1]],
      [x + b[0][0], yb + h, z + b[0][1]], [x + b[3][0], yb + h, z + b[3][1]], 0, 1, 0, col, 1);
    return this;
  },
  build: function (mat) {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    var m = new THREE.Mesh(g, mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
};

/* ═══ 碰撞：AABB 空间哈希 ═══ */
J.Col = {
  cell: 8, map: {}, list: [], minY: -3, maxY: 40,
  reset: function () { this.map = {}; this.list = []; },
  _key: function (ix, iz) { return ix + ',' + iz; },
  add: function (x0, y0, z0, x1, y1, z1, tag) {
    var b = { x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1), tag: tag || '' };
    this.list.push(b);
    var c = this.cell;
    var ax = Math.floor(b.x0 / c), bx = Math.floor(b.x1 / c);
    var az = Math.floor(b.z0 / c), bz = Math.floor(b.z1 / c);
    for (var ix = ax; ix <= bx; ix++) for (var iz = az; iz <= bz; iz++) {
      var k = this._key(ix, iz);
      if (!this.map[k]) this.map[k] = [];
      this.map[k].push(b);
    }
    return b;
  },
  /* 由中心+尺寸添加 */
  addC: function (x, y, z, sx, sy, sz, tag) {
    return this.add(x - sx / 2, y - sy / 2, z - sz / 2, x + sx / 2, y + sy / 2, z + sz / 2, tag);
  },
  query: function (x, z, r) {
    var out = [], seen = {}, c = this.cell;
    var ax = Math.floor((x - r) / c), bx = Math.floor((x + r) / c);
    var az = Math.floor((z - r) / c), bz = Math.floor((z + r) / c);
    for (var ix = ax; ix <= bx; ix++) for (var iz = az; iz <= bz; iz++) {
      var arr = this.map[this._key(ix, iz)];
      if (!arr) continue;
      for (var i = 0; i < arr.length; i++) {
        var b = arr[i];
        if (b._id === undefined) b._id = (J.Col._n = (J.Col._n || 0) + 1);
        if (seen[b._id]) continue;
        seen[b._id] = 1; out.push(b);
      }
    }
    return out;
  },
  /* 圆柱体水平推出 */
  resolve: function (pos, radius, height, feetY) {
    var list = this.query(pos.x, pos.z, radius + 0.6);
    var hit = false;
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b.y1 <= feetY + 0.28) continue;          // 可跨过的矮物
      if (b.y0 >= feetY + height) continue;         // 头顶之上
      var cx = J.U.clamp(pos.x, b.x0, b.x1);
      var cz = J.U.clamp(pos.z, b.z0, b.z1);
      var dx = pos.x - cx, dz = pos.z - cz;
      var d2 = dx * dx + dz * dz;
      if (d2 > radius * radius) continue;
      var d = Math.sqrt(d2);
      if (d < 1e-4) {
        // 圆心在盒内：沿最小穿透轴推出
        var pl = pos.x - b.x0, pr = b.x1 - pos.x, pn = pos.z - b.z0, pf = b.z1 - pos.z;
        var mn = Math.min(pl, pr, pn, pf);
        if (mn === pl) pos.x = b.x0 - radius;
        else if (mn === pr) pos.x = b.x1 + radius;
        else if (mn === pn) pos.z = b.z0 - radius;
        else pos.z = b.z1 + radius;
      } else {
        var push = (radius - d) / d;
        pos.x += dx * push; pos.z += dz * push;
      }
      hit = true;
    }
    return hit;
  },
  /* 脚下地面高度 */
  groundAt: function (x, z, fromY) {
    var list = this.query(x, z, 0.05), best = -999;
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (x < b.x0 - 0.02 || x > b.x1 + 0.02 || z < b.z0 - 0.02 || z > b.z1 + 0.02) continue;
      if (b.tag === 'wall') continue;
      if (b.y1 <= fromY + 0.42 && b.y1 > best) best = b.y1;
    }
    return best > -900 ? best : 0;
  },
  /* 相机射线：返回最近命中距离 */
  rayDist: function (ox, oy, oz, dx, dy, dz, maxD) {
    var best = maxD;
    var list = this.query(ox + dx * maxD * 0.5, oz + dz * maxD * 0.5, maxD * 0.6);
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      var tmin = 0, tmax = best, ok = true;
      var o = [ox, oy, oz], d = [dx, dy, dz], mn = [b.x0, b.y0, b.z0], mx = [b.x1, b.y1, b.z1];
      for (var a = 0; a < 3; a++) {
        if (Math.abs(d[a]) < 1e-6) { if (o[a] < mn[a] || o[a] > mx[a]) { ok = false; break; } }
        else {
          var t1 = (mn[a] - o[a]) / d[a], t2 = (mx[a] - o[a]) / d[a];
          if (t1 > t2) { var tt = t1; t1 = t2; t2 = tt; }
          if (t1 > tmin) tmin = t1;
          if (t2 < tmax) tmax = t2;
          if (tmin > tmax) { ok = false; break; }
        }
      }
      if (ok && tmin < best && tmin > 0) best = tmin;
    }
    return best;
  }
};

/* ═══ 输入 ═══ */
J.IN = {
  mx: 0, mz: 0, mag: 0,            // 移动向量（-1..1）
  lx: 0, ly: 0,                     // 视角增量
  keys: {},
  btn: { atk: 0, heavy: 0, dash: 0, lock: 0 },
  _press: { atk: 0, heavy: 0, dash: 0, jump: 0, ult: 0 },
  _pressT: { atk: 0, heavy: 0, dash: 0, jump: 0, ult: 0 },
  held: { atk: 0, heavy: 0, dash: 0, jump: 0, ult: 0 },
  PRESS_TTL: 260,          // 未消费的按下超过这个时间就作废
  joyActive: false, joyId: -1, lookId: -1, guardHeld: false, parryPress: 0,
  _ox: 0, _oy: 0, _cx: 0, _cy: 0
};

J.pressed = function (b) {
  var IN = J.IN;
  if (!IN._press[b]) return false;
  var now = (window.performance && performance.now) ? performance.now() : Date.now();
  if (now - IN._pressT[b] > IN.PRESS_TTL) { IN._press[b] = 0; return false; }
  return true;
};
/* 消费掉这个脉冲，防止重复触发 */
J.consume = function (b) { J.IN._press[b] = 0; };

J.initInput = function () {
  var IN = J.IN;

  /* 键盘 */
  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    IN.keys[e.code] = 1;
    if (e.code === 'KeyJ' && !IN.held.atk) { IN.held.atk = 1; IN._press.atk = 1; IN._pressT.atk = performance.now(); }
    if (e.code === 'KeyK' && !IN.held.heavy) { IN.held.heavy = 1; IN._press.heavy = 1; IN._pressT.heavy = performance.now(); IN.hold_heavy = true; }
    if (e.code === 'Space') { e.preventDefault(); if (!IN.held.dash) { IN.held.dash = 1; IN._press.dash = 1; IN._pressT.dash = performance.now(); } }
    if (e.code === 'ShiftLeft' && !IN.held.jump) { IN.held.jump = 1; IN._press.jump = 1; IN._pressT.jump = performance.now(); }
    if ((e.code === 'KeyE' || e.code === 'KeyR' || e.code === 'KeyQ') && !IN.held.ult) { IN.held.ult = 1; IN._press.ult = 1; IN._pressT.ult = performance.now(); }
  });
  window.addEventListener('keyup', function (e) {
    IN.keys[e.code] = 0;
    if (e.code === 'KeyJ') IN.held.atk = 0;
    if (e.code === 'KeyK') { IN.held.heavy = 0; IN.hold_heavy = false; }
    if (e.code === 'Space') IN.held.dash = 0;
    if (e.code === 'ShiftLeft') IN.held.jump = 0;
    if (e.code === 'KeyE' || e.code === 'KeyR' || e.code === 'KeyQ') IN.held.ult = 0;
  });

  /* 鼠标视角（桌面调试） */
  var cv = J.R.domElement, mdown = false;
  cv.addEventListener('mousedown', function (e) {
    mdown = true;
    var p = J.Stage.toLocal(e.clientX, e.clientY);
    IN._ox = p.x; IN._oy = p.y;
  });
  window.addEventListener('mouseup', function () { mdown = false; });
  window.addEventListener('mousemove', function (e) {
    if (!mdown) return;
    var p = J.Stage.toLocal(e.clientX, e.clientY);
    IN.lx += (p.x - IN._ox) * 0.005;
    IN.ly += (p.y - IN._oy) * 0.004;
    IN._ox = p.x; IN._oy = p.y;
  });

  /* 摇杆 */
  var joy = document.getElementById('joy');
  var base = document.getElementById('joyBase');
  var knob = document.getElementById('joyKnob');
  var R = 54;
  var HOME = { x: 96, y: 0 };

  function homeY() { return Math.max(80, J.Stage.H - 110); }
  function placeHome() {
    HOME.y = homeY();
    base.style.left = HOME.x + 'px'; base.style.top = HOME.y + 'px';
    knob.style.left = HOME.x + 'px'; knob.style.top = HOME.y + 'px';
  }
  placeHome();
  J.IN._placeHome = placeHome;
  J.IN._home = HOME;

  function joyMove(lp) {
    var dx = lp.x - IN._cx, dy = lp.y - IN._cy;
    var d = Math.hypot(dx, dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; d = R; }
    knob.style.left = (IN._cx + dx) + 'px';
    knob.style.top = (IN._cy + dy) + 'px';
    IN.mag = Math.min(1, d / (R * 0.82));
    IN.mx = dx / R; IN.mz = dy / R;
    var l = Math.hypot(IN.mx, IN.mz);
    if (l > 1) { IN.mx /= l; IN.mz /= l; }
  }
  /* ── 摇杆：document 级跟踪，手指移出区域也不断 ── */
  function joyMove(lp) {
    var dx = lp.x - IN._cx, dy = lp.y - IN._cy;
    var d = Math.hypot(dx, dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; d = R; }
    knob.style.left = (IN._cx + dx) + 'px';
    knob.style.top = (IN._cy + dy) + 'px';
    IN.mag = Math.min(1, d / (R * 0.82));
    IN.mx = dx / R; IN.mz = dy / R;
    var l = Math.hypot(IN.mx, IN.mz);
    if (l > 1) { IN.mx /= l; IN.mz /= l; }
  }

  function onJoyMove(e) {
    if (e.pointerId !== IN.joyId) return;
    if (e.cancelable) e.preventDefault();
    joyMove(J.Stage.toLocal(e.clientX, e.clientY));
  }
  function onJoyUp(e) {
    if (e.pointerId !== IN.joyId) return;
    IN.joyId = -1; IN.joyActive = false;
    IN.mx = 0; IN.mz = 0; IN.mag = 0;
    placeHome();
    document.removeEventListener('pointermove', onJoyMove);
    document.removeEventListener('pointerup', onJoyUp);
    document.removeEventListener('pointercancel', onJoyUp);
  }
  joy.addEventListener('pointerdown', function (e) {
    if (IN.joyId !== -1) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    var lp = J.Stage.toLocal(e.clientX, e.clientY);
    IN.joyId = e.pointerId;
    IN.joyActive = true;
    IN._cx = lp.x; IN._cy = lp.y;
    base.style.left = lp.x + 'px';
    base.style.top = lp.y + 'px';
    knob.style.left = lp.x + 'px';
    knob.style.top = lp.y + 'px';
    joyMove(lp);
    document.addEventListener('pointermove', onJoyMove, { passive: false });
    document.addEventListener('pointerup', onJoyUp);
    document.addEventListener('pointercancel', onJoyUp);
  });

  /* ── 视角拖动：document 级跟踪 ── */
  var lookId = -1;

  function onLookMove(e) {
    if (e.pointerId !== lookId) return;
    if (e.cancelable) e.preventDefault();
    var p = J.Stage.toLocal(e.clientX, e.clientY);
    IN.lx += (p.x - IN._ox) * 0.0072;
    IN.ly += (p.y - IN._oy) * 0.0058;
    IN._ox = p.x; IN._oy = p.y;
  }
  function onLookUp(e) {
    if (e.pointerId !== lookId) return;
    lookId = -1; IN.lookId = -1;
    document.removeEventListener('pointermove', onLookMove);
    document.removeEventListener('pointerup', onLookUp);
    document.removeEventListener('pointercancel', onLookUp);
  }
  cv.addEventListener('pointerdown', function (e) {
    if (lookId !== -1) return;
    if (IN.joyId === e.pointerId) return;
    lookId = e.pointerId;
    IN.lookId = lookId;
    var p0 = J.Stage.toLocal(e.clientX, e.clientY);
    IN._ox = p0.x; IN._oy = p0.y;
    document.addEventListener('pointermove', onLookMove, { passive: false });
    document.addEventListener('pointerup', onLookUp);
    document.addEventListener('pointercancel', onLookUp);
  });

  /* 按钮 */
  function bindBtn(id, name) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation();
      /* 边沿触发：只有「从未按下 → 按下」才产生一次脉冲。
         重复的 pointerdown（同一根手指的抖动/WebView 重发）一律忽略。 */
      if (IN.held[name]) return;
      var now = (window.performance && performance.now) ? performance.now() : Date.now();
      IN.held[name] = 1;
      IN._press[name] = 1;
      IN._pressT[name] = now;
      IN['hold_' + name] = true;
      if (navigator.vibrate) { try { navigator.vibrate(8); } catch (err) { } }
    });
    var up = function (e) {
      if (e) e.stopPropagation();
      IN['hold_' + name] = false;
      IN.held[name] = 0;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }
  bindBtn('bAtk', 'atk');
  bindBtn('bHeavy', 'heavy');
  bindBtn('bDash', 'dash');
  bindBtn('bJump', 'jump');
  bindBtn('bUlt', 'ult');

  /* 格挡：按住生效 */
  var gEl = document.getElementById('bGuard');
  if (gEl) {
    gEl.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation();
      IN.guardHeld = true;
      IN._press.guard = 1;
      IN.parryPress = 0.01;
    });
    var guardUp = function (e) { if (e) e.stopPropagation(); IN.guardHeld = false; };
    gEl.addEventListener('pointerup', guardUp);
    gEl.addEventListener('pointercancel', guardUp);
    gEl.addEventListener('pointerleave', guardUp);
  }
  /* 键盘格挡 */
  window.addEventListener('keydown', function (e) { if (e.code === 'KeyL') { IN.guardHeld = true; IN.parryPress = 0.01; } });
  window.addEventListener('keyup', function (e) { if (e.code === 'KeyL') IN.guardHeld = false; });
};

/* 每帧读取键盘移动 */
J.readKeys = function () {
  var k = J.IN.keys, IN = J.IN;
  if (IN.joyActive) return;
  var x = 0, z = 0;
  if (k.KeyW || k.ArrowUp) z -= 1;
  if (k.KeyS || k.ArrowDown) z += 1;
  if (k.KeyA || k.ArrowLeft) x -= 1;
  if (k.KeyD || k.ArrowRight) x += 1;
  var l = Math.hypot(x, z);
  if (l > 0) { x /= l; z /= l; IN.mag = (k.ShiftLeft || k.ShiftRight) ? 1 : 0.62; }
  else IN.mag = 0;
  IN.mx = x; IN.mz = z;
};
