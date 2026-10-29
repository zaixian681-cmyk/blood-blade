/* ═══════════════════════════════════════════════
   terrain.js — 青崖山 · 断剑谷 地形
   南→北：入口 / 竹海 / 吊桥峡谷 / 山寨 / 古寺 / 断剑谷
   ═══════════════════════════════════════════════ */
J.Terrain = (function () {

  var SIZE = 440;
  var SEG = 110;                 // 每格约 4m
  var HALF = SIZE / 2;

  /* ── 噪声 ── */
  function h2(x, y) { var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }
  function vn(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    return (h2(ix, iy) * (1 - fx) + h2(ix + 1, iy) * fx) * (1 - fy) +
      (h2(ix, iy + 1) * (1 - fx) + h2(ix + 1, iy + 1) * fx) * fy;
  }
  function fbm(x, y, o) { var v = 0, a = 0.5, f = 1; for (var i = 0; i < (o || 4); i++) { v += a * vn(x * f, y * f); f *= 2.03; a *= 0.5; } return v; }
  function ss(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ── 主路径：随 z 蜿蜒 ── */
  function pathX(z) {
    return Math.sin(z * 0.0072) * 26 + Math.sin(z * 0.019) * 7;
  }

  /* ── 沿 z 的基础高度剖面 ── */
  var PROF = [
    [260, 0], [200, 0.6], [160, 2], [120, 4], [80, 7], [46, 9.5],
    [28, 9.8], [26.5, 9.8], [26, -20], [-16, -20], [-16.5, 10.6], [-18, 10.8],
    [-46, 15], [-90, 20], [-120, 26], [-150, 31], [-180, 38], [-215, 42], [-260, 45]
  ];
  function baseH(z) {
    z = Math.max(-400, Math.min(400, z));
    for (var i = 0; i < PROF.length - 1; i++) {
      var a = PROF[i], b = PROF[i + 1];
      if (z <= a[0] && z >= b[0]) {
        var t = (a[0] - z) / (a[0] - b[0]);
        return lerp(a[1], b[1], t);
      }
    }
    return 0;
  }

  /* ── 峡谷区域判定（只能走吊桥） ── */
  var GORGE_Z0 = -16, GORGE_Z1 = 26;
  var BRIDGE_HALF = 4.2;            // 桥宽的一半
  function bridgeCenterX(z) { return pathX(z); }

  function heightAt(x, z) {
    var px = pathX(z);
    var d = Math.abs(x - px);
    var base = baseH(z);

    /* 峡谷：一条横贯东西的深沟，桥位置除外 */
    if (z > GORGE_Z0 && z < GORGE_Z1) {
      var bd = Math.abs(x - bridgeCenterX(z));
      if (bd > BRIDGE_HALF + 0.6) {
        /* 沟底，越靠中间越深 */
        var deep = -20 + Math.sin(z * 0.2) * 1.2;
        var edgeFade = ss(GORGE_Z1 + 6, GORGE_Z1 - 4, z) * ss(GORGE_Z0 - 6, GORGE_Z0 + 4, z);
        return lerp(base, deep, edgeFade);
      }
      /* 桥面位置：地形沉下去，由桥板承担通行 */
      return -20;
    }

    /* 主路两侧抬升为山体 */
    var side = Math.pow(Math.min(1, d / 70), 1.55) * 40;

    /* 山门内侧略抬，形成"山口"感 */
    var n = (fbm(x * 0.0082, z * 0.0082, 4) - 0.5) * 2;
    var n2 = (fbm(x * 0.028, z * 0.028, 3) - 0.5) * 2;
    var rough = ss(6, 34, base);
    var h = base + side + n * (1.4 + rough * 9) + n2 * (0.4 + rough * 2.6);

    /* 主路压平，保证可走 */
    var roadW = 9;
    if (d < roadW) {
      var f = ss(roadW, roadW * 0.55, d);
      h = lerp(h, base + n * 0.7, f);
    }

    /* 断剑谷：山顶平台 */
    if (z < -175) {
      var plat = ss(-175, -205, z);
      h = lerp(h, 40 + n * 1.0, plat * 0.92);
    }
    return h;
  }

  function slopeAt(x, z) {
    var e = 2.0;
    var hx = heightAt(x + e, z) - heightAt(x - e, z);
    var hz = heightAt(x, z + e) - heightAt(x, z - e);
    return Math.min(1, Math.hypot(hx, hz) / (2 * e) / 1.4);
  }

  /* ── 地表噪声纹理：让地面有颗粒与斑驳，不再是纯色块 ── */
  function groundTexture() {
    var S = 512, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    var g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);

    /* 细颗粒 */
    var img = g.getImageData(0, 0, S, S), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var n = (Math.random() - 0.5) * 34;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    g.putImageData(img, 0, 0);

    /* 大块斑驳（土色/苔色深浅） */
    for (var k = 0; k < 90; k++) {
      var cx = Math.random() * S, cy = Math.random() * S;
      var r = 12 + Math.random() * 62;
      var grd = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      var dark = Math.random() > 0.5;
      grd.addColorStop(0, dark ? 'rgba(90,80,60,0.16)' : 'rgba(255,255,240,0.13)');
      grd.addColorStop(1, 'rgba(128,128,128,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    }
    /* 细碎裂纹 */
    g.strokeStyle = 'rgba(80,72,58,0.25)';
    for (var c = 0; c < 60; c++) {
      g.lineWidth = 0.6 + Math.random() * 1.2;
      var sx = Math.random() * S, sy = Math.random() * S;
      g.beginPath(); g.moveTo(sx, sy);
      var px = sx, py = sy;
      for (var seg = 0; seg < 4; seg++) {
        px += (Math.random() - 0.5) * 40; py += (Math.random() - 0.5) * 40;
        g.lineTo(px, py);
      }
      g.stroke();
    }

    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(46, 46);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 2;
    return t;
  }

  /* ── 地形网格 ── */
  function buildMesh() {
    var n = SEG + 1, step = SIZE / SEG;
    var pos = new Float32Array(n * n * 3);
    var col = new Float32Array(n * n * 3);
    var hs = new Float32Array(n * n);

    var cGrass = new THREE.Color(0x54683a);
    var cGrass2 = new THREE.Color(0x445830);
    var cDirt = new THREE.Color(0x6a5842);
    var cRock = new THREE.Color(0x6e6b62);
    var cRockH = new THREE.Color(0x828a92);
    var cPath = new THREE.Color(0x8a7a60);
    var tmp = new THREE.Color();

    for (var iz = 0; iz < n; iz++) {
      for (var ix = 0; ix < n; ix++) {
        var x = -HALF + ix * step, z = -HALF + iz * step;
        var h = heightAt(x, z);
        hs[iz * n + ix] = h;
        var k = (iz * n + ix) * 3;
        pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
      }
    }
    for (var iz2 = 0; iz2 < n; iz2++) {
      for (var ix2 = 0; ix2 < n; ix2++) {
        var i0 = iz2 * n + ix2;
        var h0 = hs[i0];
        var hx = hs[iz2 * n + Math.min(n - 1, ix2 + 1)] - hs[iz2 * n + Math.max(0, ix2 - 1)];
        var hz = hs[Math.min(n - 1, iz2 + 1) * n + ix2] - hs[Math.max(0, iz2 - 1) * n + ix2];
        var sl = Math.min(1, Math.hypot(hx, hz) / (2 * step) / 1.3);
        var x2 = -HALF + ix2 * step, z2 = -HALF + iz2 * step;
        var dRoad = Math.abs(x2 - pathX(z2));

        if (h0 < -6) tmp.copy(cRock).lerp(new THREE.Color(0x3a4048), 0.5);
        else if (h0 < 5) tmp.copy(cGrass);
        else if (h0 < 30) tmp.copy(cGrass).lerp(cGrass2, ss(8, 26, h0));
        else if (h0 < 58) tmp.copy(cGrass2).lerp(cRock, ss(30, 55, h0));
        else tmp.copy(cRock).lerp(cRockH, ss(58, 95, h0));

        /* 主路：踩出土色 */
        if (dRoad < 7 && h0 > -6) tmp.lerp(cPath, ss(7, 3, dRoad) * 0.85);
        /* 陡坡露岩 */
        tmp.lerp(cRock, sl * 0.66);
        /* 高处偏冷 */
        if (h0 > 40) tmp.lerp(new THREE.Color(0x77898f), ss(40, 95, h0) * 0.5);

        var nz = (vn(ix2 * 0.8, iz2 * 0.8) - 0.5) * 0.09;
        var k2 = i0 * 3;
        col[k2] = Math.max(0, tmp.r + nz);
        col[k2 + 1] = Math.max(0, tmp.g + nz);
        col[k2 + 2] = Math.max(0, tmp.b + nz);
      }
    }
    var idx = new Uint32Array(SEG * SEG * 6), p = 0;
    for (var iz3 = 0; iz3 < SEG; iz3++) {
      for (var ix3 = 0; ix3 < SEG; ix3++) {
        var a = iz3 * n + ix3, b = a + 1, c = a + n, dd = c + 1;
        idx[p++] = a; idx[p++] = c; idx[p++] = b;
        idx[p++] = b; idx[p++] = c; idx[p++] = dd;
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    var gmat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.95, metalness: 0,
      map: groundTexture()
    });
    var mesh = new THREE.Mesh(g, gmat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    return mesh;
  }

  /* ── 峡谷底部溪流 ── */
  function buildStream() {
    var g = new THREE.PlaneGeometry(SIZE, 60, 1, 1);
    var m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: [
        'uniform float uTime; varying vec2 vUv; varying vec3 vW;',
        'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
        'float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
        '  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
        'void main(){',
        '  vec2 p = vW.xz*0.13;',
        '  float w = n2(p + vec2(uTime*0.07, uTime*0.13))*0.6 + n2(p*2.4 - vec2(uTime*0.18,0.0))*0.4;',
        '  vec3 c = mix(vec3(0.10,0.20,0.22), vec3(0.34,0.52,0.52), w);',
        '  c += vec3(0.9,0.85,0.7) * smoothstep(0.75,0.99,w) * 0.4;',
        '  gl_FragColor = vec4(c, 0.90);',
        '}'
      ].join('\n')
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = -20.5;
    m.position.z = 2;
    m.renderOrder = 2;
    return m;
  }

  var T = {
    SIZE: SIZE, HALF: HALF, heightAt: heightAt, slopeAt: slopeAt, pathX: pathX,
    GORGE_Z0: GORGE_Z0, GORGE_Z1: GORGE_Z1, bridgeCenterX: bridgeCenterX, BRIDGE_HALF: BRIDGE_HALF,

    /* 区域高度查询（给放置建筑用） */
    baseAt: function (z) { return baseH(z); },

    build: function () {
      var mesh = buildMesh();
      J.S.add(mesh);
      T.mesh = mesh;
      var st = buildStream();
      J.S.add(st);
      T.stream = st;
      T.triCount = SEG * SEG * 2;
      return T;
    },

    update: function (dt, t) {
      if (T.stream) T.stream.material.uniforms.uTime.value = t;
    }
  };
  return T;
})();
