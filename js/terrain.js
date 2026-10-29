/* ═══════════════════════════════════════════════
   terrain.js — 青崖山 · 断剑谷
   空间结构按参考图：南崖顶 → 瀑布崖壁 → 谷底城镇 → 北岸山坡 → 山顶宫殿
   ═══════════════════════════════════════════════ */
J.Terrain = (function () {

  var SIZE = 480;
  var SEG = 150;
  var HALF = SIZE / 2;

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

  function riverX(z) {
    return Math.sin(z * 0.0085) * 22 + Math.sin(z * 0.021) * 6;
  }

  var CLIFF_TOP_Z = 148;
  var CLIFF_BOT_Z = 126;
  var VALLEY_Z0 = -70, VALLEY_Z1 = 126;

  var PROF = [
    [240, 70], [200, 69], [170, 68], [152, 67], [148, 66],
    [146, 40], [140, 16], [132, 12], [126, 11],
    [100, 10], [60, 9], [20, 8], [-20, 9], [-60, 11],
    [-76, 14], [-100, 24], [-120, 36], [-140, 50],
    [-160, 62], [-185, 70], [-210, 75], [-240, 78]
  ];
  function baseH(z) {
    z = Math.max(-245, Math.min(245, z));
    for (var i = 0; i < PROF.length - 1; i++) {
      var a = PROF[i], b = PROF[i + 1];
      if (z <= a[0] && z >= b[0]) {
        var t = (a[0] - z) / (a[0] - b[0]);
        return lerp(a[1], b[1], t);
      }
    }
    return 0;
  }

  var FALL = { x: 0, z: 133, top: 64, bottom: 12, width: 18 };
  FALL.x = riverX(FALL.z) - 4;

  function heightAt(x, z) {
    var rx = riverX(z);
    var d = Math.abs(x - rx);
    var base = baseH(z);

    var side;
    if (z > VALLEY_Z0 && z < VALLEY_Z1) {
      side = Math.pow(Math.min(1, d / 130), 1.5) * 34;
    } else {
      side = Math.pow(Math.min(1, d / 110), 1.45) * 46;
    }
    if (z > CLIFF_TOP_Z) side = Math.pow(Math.min(1, d / 120), 1.4) * 10;

    var n = (fbm(x * 0.0085, z * 0.0085, 4) - 0.5) * 2;
    var n2 = (fbm(x * 0.032, z * 0.032, 2) - 0.5) * 2;
    var rough = ss(14, 55, base);
    var h = base + side + n * (1.1 + rough * 7) + n2 * (0.12 + rough * 0.9);

    /* 崖壁（瀑布所在的陡峭立面） */
    if (z > CLIFF_BOT_Z && z < CLIFF_TOP_Z + 2) {
      var cw = Math.abs(x - (rx - 4));
      if (cw < 26) {
        h = lerp(h, lerp(FALL.bottom, FALL.top, (z - CLIFF_BOT_Z) / (CLIFF_TOP_Z - CLIFF_BOT_Z)), 0.92);
      }
    }

    /* 河道下切 */
    if (z > VALLEY_Z0 - 10 && z < VALLEY_Z1 + 6) {
      var chan = ss(20, 7, d);
      h = lerp(h, base - 2.6, chan * 0.9);
    }

    /* 西岸城镇台地 */
    if (z > -50 && z < 110 && x < rx - 6 && x > rx - 62) {
      var plat = ss(-50, -40, z) * ss(110, 96, z) * ss(-62, -50, x) * ss(-6, -12, x);
      h = lerp(h, base + 0.6, plat * 0.85);
    }
    /* 东岸台地 */
    if (z > 10 && z < 110 && x > rx + 8 && x < rx + 54) {
      var plat2 = ss(10, 22, z) * ss(110, 96, z) * ss(8, 18, x) * ss(54, 44, x);
      h = lerp(h, base + 0.8, plat2 * 0.8);
    }

    /* 山顶宫殿平台 */
    if (z < -168) {
      var top = ss(-168, -190, z);
      h = lerp(h, 73 + n * 0.8, top * 0.9);
    }
    /* 崖顶平台 */
    if (z > 158) {
      var tp = ss(158, 175, z);
      h = lerp(h, 68 + n * 0.6, tp * 0.88);
    }

    return h;
  }

  function slopeAt(x, z) {
    var e = 2.0;
    var hx = heightAt(x + e, z) - heightAt(x - e, z);
    var hz = heightAt(x, z + e) - heightAt(x, z - e);
    return Math.min(1, Math.hypot(hx, hz) / (2 * e) / 1.4);
  }

  function groundTexture() {
    var S = 512, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    var g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
    var img = g.getImageData(0, 0, S, S), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var n = (Math.random() - 0.5) * 32;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    for (var k = 0; k < 80; k++) {
      var cx = Math.random() * S, cy = Math.random() * S, r = 14 + Math.random() * 70;
      var grd = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      grd.addColorStop(0, Math.random() > 0.5 ? 'rgba(88,78,58,0.15)' : 'rgba(255,255,240,0.12)');
      grd.addColorStop(1, 'rgba(128,128,128,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    }
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(44, 44);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function normalMapFromHeight(size, hFn, strength) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = size;
    var g = cv.getContext('2d');
    var img = g.createImageData(size, size), d = img.data;
    var e = 1 / size;
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var u = x / size, v = y / size;
        var dx = (hFn(u + e, v) - hFn(u - e, v)) * strength;
        var dy = (hFn(u, v + e) - hFn(u, v - e)) * strength;
        var nx = -dx, ny = -dy, nz = 1.0;
        var len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        var k = (y * size + x) * 4;
        d[k] = (nx / len * 0.5 + 0.5) * 255;
        d[k + 1] = (ny / len * 0.5 + 0.5) * 255;
        d[k + 2] = (nz / len * 0.5 + 0.5) * 255;
        d[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  function soilHeight(u, v) {
    return fbm(u * 22, v * 22, 4) * 0.6 + fbm(u * 70, v * 70, 3) * 0.3 + fbm(u * 180, v * 180, 2) * 0.1;
  }

  function buildMesh() {
    var n = SEG + 1, step = SIZE / SEG;
    var pos = new Float32Array(n * n * 3);
    var col = new Float32Array(n * n * 3);
    var hs = new Float32Array(n * n);

    var cGrass = new THREE.Color(0x6f8a4e);      // 山野青草
    var cGrass2 = new THREE.Color(0x55703c);     // 深一层的草坡
    var cRock = new THREE.Color(0x8d8a80);       // 青灰岩
    var cRockH = new THREE.Color(0xa2adb4);      // 高处冷灰
    var cSand = new THREE.Color(0x9c9179);       // 河滩卵石
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
        var dRiver = Math.abs(x2 - riverX(z2));

        if (h0 < 6) tmp.copy(cSand);
        else if (h0 < 14) tmp.copy(cGrass).lerp(cSand, ss(14, 7, h0) * 0.4);
        else if (h0 < 38) tmp.copy(cGrass).lerp(cGrass2, ss(16, 34, h0));
        else if (h0 < 60) tmp.copy(cGrass2).lerp(cRock, ss(38, 58, h0));
        else tmp.copy(cRock).lerp(cRockH, ss(60, 90, h0));

        if (dRiver < 12 && h0 < 12) tmp.lerp(cSand, ss(12, 4, dRiver) * 0.7);
        tmp.lerp(cRock, sl * 0.7);
        if (h0 > 45) tmp.lerp(new THREE.Color(0x8fa0a8), ss(45, 95, h0) * 0.42);

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

    var gN = normalMapFromHeight(256, soilHeight, 7.0);
    gN.repeat.set(36, 36);
    var mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.94, metalness: 0,
      map: groundTexture(), normalMap: gN,
      normalScale: new THREE.Vector2(0.85, 0.85)
    }));
    mesh.receiveShadow = true;
    return mesh;
  }

  function buildRiver() {
    /* 沿河道生成的带状水面：贴着河走，不会像大平板一样切穿地形 */
    var RN = 90, RZ0 = -110, RZ1 = 190, RW = 10.5;
    var rp = [], ruv = [], ridx = [];
    for (var ri = 0; ri <= RN; ri++) {
      var rz = RZ0 + (RZ1 - RZ0) * ri / RN;
      var rx0 = riverX(rz);
      rp.push(rx0 - RW, 7.2, rz, rx0 + RW, 7.2, rz);
      ruv.push(0, ri / RN, 1, ri / RN);
    }
    for (var rk = 0; rk < RN; rk++) {
      var ra = rk * 2;
      ridx.push(ra, ra + 1, ra + 3, ra, ra + 3, ra + 2);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(ruv, 2));
    g.setIndex(ridx);
    var m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } },
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: [
        'uniform float uTime; uniform vec3 uCam; varying vec2 vUv; varying vec3 vW;',
        'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
        'float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
        '  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
        'void main(){',
        '  vec3 V = normalize(uCam - vW);',
        '  float fres = pow(1.0 - clamp(V.y,0.0,1.0), 3.2);',
        '  vec2 p = vW.xz*0.10;',
        '  float w = n2(p + vec2(uTime*0.05, uTime*0.16))*0.6 + n2(p*2.6 - vec2(uTime*0.2,0.0))*0.4;',
        '  float w2 = n2(p*7.0 + vec2(uTime*0.42, -uTime*0.30));',
        '  vec3 deepC = vec3(0.055,0.135,0.155);',
        '  vec3 shalC = vec3(0.215,0.415,0.415);',
        '  vec3 c = mix(deepC, shalC, w);',
        '  c = mix(c, vec3(0.60,0.70,0.76), fres*0.55);',
        '  c += vec3(1.0,0.95,0.80) * smoothstep(0.80,0.995,w) * 0.38;',
        '  float spec = pow(max(0.0, w2 - 0.55), 3.0) * (0.25 + fres*0.9);',
        '  c += vec3(1.0,0.92,0.74) * spec * 1.25;',
        '  c *= 0.94 + 0.12 * n2(p*1.6 + uTime*0.03);',
        '  gl_FragColor = vec4(c, 0.94);',
        '}'
      ].join('\n')
    }));
    m.position.set(0, 0, 0);
    m.renderOrder = 2;
    return m;
  }

  function buildWaterfall() {
    var grp = new THREE.Group();
    var H = FALL.top - FALL.bottom;
    var W = FALL.width;

    var geo = new THREE.PlaneGeometry(W, H, 1, 14);
    var mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(0xdfeef4) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: [
        'uniform float uTime; uniform vec3 uCol; varying vec2 vUv;',
        'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
        'float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
        '  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
        'void main(){',
        '  float flow = n2(vec2(vUv.x*7.0, vUv.y*3.0 + uTime*1.6));',
        '  float flow2 = n2(vec2(vUv.x*18.0 + uTime*0.4, vUv.y*8.0 + uTime*3.2));',
        '  float streak = smoothstep(0.35, 0.95, flow*0.65 + flow2*0.45);',
        '  float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);',
        '  float bottomGlow = 1.0 - smoothstep(0.0, 0.35, vUv.y);',
        '  vec3 c = mix(uCol, vec3(1.0), streak*0.8 + bottomGlow*0.3);',
        '  float a = (0.28 + streak*0.55 + bottomGlow*0.35) * edge;',
        '  gl_FragColor = vec4(c, clamp(a*0.85,0.0,0.9));',
        '}'
      ].join('\n')
    });
    var main = new THREE.Mesh(geo, mat);
    main.position.set(FALL.x, FALL.bottom + H / 2, FALL.z + 1.5);
    main.renderOrder = 6;
    grp.add(main);

    var mat2 = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(0xcfe4ec) } },
      vertexShader: mat.vertexShader, fragmentShader: mat.fragmentShader
    });
    var main2 = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.12, H * 0.94, 1, 10), mat2);
    main2.position.set(FALL.x, FALL.bottom + H * 0.48, FALL.z + 2.2);
    main2.material.uniforms.uCol.value = new THREE.Color(0x98b8c8);
    main2.renderOrder = 5;
    grp.add(main2);

    var pool = new THREE.Mesh(
      new THREE.CircleGeometry(13, 24),
      new THREE.MeshStandardMaterial({ color: 0x8fb8c0, roughness: 0.18, metalness: 0.15, transparent: true, opacity: 0.78 })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(FALL.x, FALL.bottom + 0.3, FALL.z - 6);
    grp.add(pool);

    var N = 26;
    var pg = new THREE.BufferGeometry();
    var pp = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      pp[i * 3] = FALL.x + (Math.random() - 0.5) * W * 2.4;
      pp[i * 3 + 1] = FALL.bottom + Math.random() * 8;
      pp[i * 3 + 2] = FALL.z - 2 + (Math.random() - 0.5) * 12;
    }
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    var mist = new THREE.Points(pg, new THREE.PointsMaterial({
      color: 0xe8f4f8, size: 2.2, transparent: true, opacity: 0.12,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    grp.add(mist);

    J.S.add(grp);
    return { group: grp, mat: mat, mat2: mat2, mist: mist, N: N };
  }

  var T = {
    SIZE: SIZE, HALF: HALF,
    heightAt: heightAt, slopeAt: slopeAt, riverX: riverX, baseAt: baseH,
    /* 兼容旧接口 */
    pathX: riverX, bridgeCenterX: riverX,
    GORGE_Z0: VALLEY_Z0, GORGE_Z1: VALLEY_Z1,
    FALL: FALL, CLIFF_TOP_Z: CLIFF_TOP_Z, CLIFF_BOT_Z: CLIFF_BOT_Z,
    VALLEY_Z0: VALLEY_Z0, VALLEY_Z1: VALLEY_Z1,
    riverLevel: 7.2,

    build: function () {
      var mesh = buildMesh();
      J.S.add(mesh);
      T.mesh = mesh;
      var r = buildRiver();
      J.S.add(r);
      T.river = r;
      T.waterfall = buildWaterfall();
      T.triCount = SEG * SEG * 2;
      return T;
    },

    update: function (dt, t) {
      if (T.river) {
        T.river.material.uniforms.uTime.value = t;
        if (J.C) T.river.material.uniforms.uCam.value.copy(J.C.position);
      }
      if (T.waterfall) {
        T.waterfall.mat.uniforms.uTime.value = t;
        T.waterfall.mat2.uniforms.uTime.value = t * 1.3;
        var arr = T.waterfall.mist.geometry.attributes.position.array;
        for (var i = 0; i < T.waterfall.N; i++) {
          arr[i * 3 + 1] += dt * (1.6 + (i % 5) * 0.3);
          arr[i * 3] += Math.sin(t * 0.7 + i) * dt * 0.8;
          if (arr[i * 3 + 1] > FALL.bottom + 16) arr[i * 3 + 1] = FALL.bottom + 0.5;
        }
        T.waterfall.mist.geometry.attributes.position.needsUpdate = true;
      }
    }
  };
  return T;
})();
