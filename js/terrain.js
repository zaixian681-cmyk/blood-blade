/* ═══════════════════════════════════════════════
   terrain.js — 峡谷地形
   高度图 / 顶点着色 / 河流 / 碰撞采样
   世界：600×600m，中央河谷，两侧抬升为山崖
   ═══════════════════════════════════════════════ */
J.Terrain = (function () {

  var SIZE = 620;          // 世界边长
  var SEG = 118;           // 网格分段（每格约 5m）
  var HALF = SIZE / 2;

  /* ── 伪随机与噪声 ── */
  function hash2(x, y) {
    var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }
  function vnoise(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y);
    var fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
  function fbm(x, y, oct) {
    var v = 0, amp = 0.5, f = 1;
    for (var i = 0; i < (oct || 4); i++) { v += amp * vnoise(x * f, y * f); f *= 2.03; amp *= 0.5; }
    return v;
  }
  function smoothstep(a, b, x) {
    var t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  /* ── 河谷横剖面：d = 距河心距离 ── */
  function profile(d) {
    if (d < 16) return 0.15 + d * 0.045;                        // 河滩
    if (d < 58) return 0.87 + (d - 16) * 0.115;                  // 缓坡（城镇带）
    if (d < 118) return 5.7 + Math.pow((d - 58) / 60, 1.55) * 24; // 山坡
    if (d < 190) return 29.7 + Math.pow((d - 118) / 72, 1.30) * 38; // 高崖
    return 67.7 + Math.min(22, (d - 190) * 0.25);               // 崖顶台地（封顶）
  }

  /* ── 高度函数 ── */
  function heightAt(x, z) {
    // 河道左右摆动，让峡谷不呆板
    var riverCx = Math.sin(z * 0.0055) * 26 + Math.sin(z * 0.017) * 7;
    var d = Math.abs(x - riverCx);
    var h = profile(d);

    // 大地形噪声：越高越崎岖
    var rough = smoothstep(6, 40, h);
    var n1 = (fbm(x * 0.0085, z * 0.0085, 4) - 0.5) * 2;
    var n2 = (fbm(x * 0.026, z * 0.026, 3) - 0.5) * 2;
    h += n1 * (2 + rough * 16) + n2 * (0.5 + rough * 5);

    // 河道压平（水面附近不能有噪点）
    if (d < 17) h = Math.min(h, 1.15 + Math.max(0, d - 6) * 0.05);
    if (d < 8) h = 0.05 + d * 0.02;

    return h;
  }

  /* ── 坡度（0..1，用于着色与可走性） ── */
  function slopeAt(x, z) {
    var e = 1.6;
    var hx = heightAt(x + e, z) - heightAt(x - e, z);
    var hz = heightAt(x, z + e) - heightAt(x, z - e);
    return Math.min(1, Math.hypot(hx, hz) / (2 * e) / 1.4);
  }

  /* ── 构建地形网格 ── */
  function buildMesh() {
    var geo = new THREE.BufferGeometry();
    var n = SEG + 1;
    var pos = new Float32Array(n * n * 3);
    var col = new Float32Array(n * n * 3);
    var step = SIZE / SEG;

    var cSand = new THREE.Color(0x8e8168);
    var cGrass = new THREE.Color(0x536b3c);
    var cGrass2 = new THREE.Color(0x445c30);
    var cRock = new THREE.Color(0x6b6a62);
    var cRockH = new THREE.Color(0x7d848c);
    var cDirt = new THREE.Color(0x6e5c44);
    var tmp = new THREE.Color();

    var hs = new Float32Array(n * n);
    for (var iz = 0; iz < n; iz++) {
      for (var ix = 0; ix < n; ix++) {
        var x = -HALF + ix * step;
        var z = -HALF + iz * step;
        var h = heightAt(x, z);
        hs[iz * n + ix] = h;
        var k = (iz * n + ix) * 3;
        pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
      }
    }
    // 着色（依赖邻点算坡度）
    for (var iz2 = 0; iz2 < n; iz2++) {
      for (var ix2 = 0; ix2 < n; ix2++) {
        var i0 = iz2 * n + ix2;
        var h0 = hs[i0];
        var hx = hs[iz2 * n + Math.min(n - 1, ix2 + 1)] - hs[iz2 * n + Math.max(0, ix2 - 1)];
        var hz = hs[Math.min(n - 1, iz2 + 1) * n + ix2] - hs[Math.max(0, iz2 - 1) * n + ix2];
        var sl = Math.min(1, Math.hypot(hx, hz) / (2 * step) / 1.3);

        if (h0 < 1.5) tmp.copy(cSand);
        else if (h0 < 6) tmp.copy(cGrass).lerp(cDirt, smoothstep(5, 1.6, h0) * 0.6);
        else if (h0 < 26) tmp.copy(cGrass).lerp(cGrass2, smoothstep(8, 24, h0));
        else if (h0 < 55) tmp.copy(cGrass2).lerp(cRock, smoothstep(26, 52, h0));
        else tmp.copy(cRock).lerp(cRockH, smoothstep(55, 110, h0));
        if (h0 > 40) tmp.lerp(new THREE.Color(0x76898f), smoothstep(40, 95, h0) * 0.55);

        // 陡坡露岩
        tmp.lerp(cRock, sl * 0.72);
        // 轻微色噪声，避免大片死色
        var nz = (vnoise(ix2 * 0.7, iz2 * 0.7) - 0.5) * 0.10;
        var k2 = i0 * 3;
        col[k2] = Math.max(0, tmp.r + nz);
        col[k2 + 1] = Math.max(0, tmp.g + nz);
        col[k2 + 2] = Math.max(0, tmp.b + nz);
      }
    }
    // 索引
    var idx = new Uint32Array(SEG * SEG * 6);
    var p = 0;
    for (var iz3 = 0; iz3 < SEG; iz3++) {
      for (var ix3 = 0; ix3 < SEG; ix3++) {
        var a = iz3 * n + ix3, b = a + 1, c = a + n, d = c + 1;
        idx[p++] = a; idx[p++] = c; idx[p++] = b;
        idx[p++] = b; idx[p++] = c; idx[p++] = d;
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();

    var mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.0 });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.name = 'terrain';
    return mesh;
  }

  /* ── 河水 ── */
  function buildWater() {
    var g = new THREE.PlaneGeometry(SIZE, SIZE, 1, 1);
    var m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color(0x1e3a3e) },
        uShallow: { value: new THREE.Color(0x4a7a76) },
        uSun: { value: new THREE.Color(0xffd8a0) }
      },
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: [
        'uniform float uTime; uniform vec3 uDeep,uShallow,uSun;',
        'varying vec2 vUv; varying vec3 vW;',
        'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
        'float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
        '  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
        'void main(){',
        '  vec2 p = vW.xz*0.11;',
        '  float w = n2(p + vec2(uTime*0.06, uTime*0.11))*0.6 + n2(p*2.3 - vec2(uTime*0.15,0.0))*0.4;',
        '  vec3 c = mix(uDeep, uShallow, w*0.85);',
        '  float spark = smoothstep(0.72,0.98,w) * 0.55;',
        '  c += uSun * spark * 0.6;',
        '  float edge = smoothstep(0.0,0.25, abs(vUv.x-0.5)*2.0);',
        '  gl_FragColor = vec4(c, 0.86);',
        '}'
      ].join('\n')
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.55;
    m.renderOrder = 2;
    return m;
  }

  var T = {
    SIZE: SIZE, HALF: HALF, heightAt: heightAt, slopeAt: slopeAt,
    waterLevel: 0.55,
    build: function () {
      var mesh = buildMesh();
      J.S.add(mesh);
      T.mesh = mesh;
      var water = buildWater();
      J.S.add(water);
      T.water = water;
      T.triCount = SEG * SEG * 2;
      return T;
    },
    update: function (dt, t) {
      if (T.water) T.water.material.uniforms.uTime.value = t;
    }
  };
  return T;
})();
