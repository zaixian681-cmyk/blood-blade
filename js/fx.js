/* ═══════════════════════════════════════════════
   fx.js — 打击感
   刀光拖尾 / 顿帧 / 震屏 / 火花 / 冲击环 / 飘字
   ═══════════════════════════════════════════════ */
J.FX = {
  init: function () {
    var F = this;
    F.trails = [];
    F._buildSparkPool();
    F._buildRings();
    F.shakeAmt = 0;
    F.shakeT = 0;
    F.hitstopT = 0;
    F.dmgEls = [];

    window.addEventListener('shake', function (e) { F.shake(e.detail.amt, e.detail.dur); });
  },

  /* ── 刀光拖尾 ── */
  makeTrail: function (color, width) {
    var N = 12;
    var g = new THREE.BufferGeometry();
    var pos = new Float32Array(N * 2 * 3);
    var uv = new Float32Array(N * 2 * 2);
    var idx = [];
    for (var i = 0; i < N; i++) {
      uv[i * 4] = 0; uv[i * 4 + 1] = i / (N - 1);
      uv[i * 4 + 2] = 1; uv[i * 4 + 3] = i / (N - 1);
      if (i < N - 1) { var a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    var mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(color || 0xbfd8ff) }, uFade: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: [
        'uniform vec3 uColor; uniform float uFade; varying vec2 vUv;',
        'void main(){',
        '  float a = pow(vUv.y, 2.2) * uFade;',
        '  float core = smoothstep(0.0,0.55,vUv.y);',
        '  vec3 c = mix(uColor, vec3(1.0), core*0.75);',
        '  gl_FragColor = vec4(c, a*0.95);',
        '}'
      ].join('\n')
    });
    var m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    m.renderOrder = 20;
    J.S.add(m);
    var T = { mesh: m, mat: mat, N: N, pts: [], fade: 0, alive: false, color: color };
    for (var k = 0; k < N; k++) T.pts.push([0, 0, 0, 0, 0, 0]);
    F.trails.push(T);
    return T;
  },

  /* 推入武器两端的当前世界坐标 */
  pushTrail: function (T, a, b) {
    if (!T) return;
    T.alive = true;
    T.fade = 1;
    T.pts.pop();
    T.pts.unshift([a.x, a.y, a.z, b.x, b.y, b.z]);
    var arr = T.mesh.geometry.attributes.position.array;
    for (var i = 0; i < T.N; i++) {
      var p = T.pts[i];
      arr[i * 6] = p[0]; arr[i * 6 + 1] = p[1]; arr[i * 6 + 2] = p[2];
      arr[i * 6 + 3] = p[3]; arr[i * 6 + 4] = p[4]; arr[i * 6 + 5] = p[5];
    }
    T.mesh.geometry.attributes.position.needsUpdate = true;
    T.mat.uniforms.uFade.value = 1;
  },

  /* ── 火花粒子池 ── */
  _buildSparkPool: function () {
    var F = this, n = 220;
    var g = new THREE.BufferGeometry();
    var pos = new Float32Array(n * 3);
    var col = new Float32Array(n * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var mat = new THREE.PointsMaterial({
      size: 0.10, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, blending: THREE.AdditiveBlending
    });
    var p = new THREE.Points(g, mat);
    p.frustumCulled = false;
    p.renderOrder = 22;
    J.S.add(p);
    F.sparks = { mesh: p, n: n, pos: pos, col: col, v: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n), idx: 0 };
  },

  spark: function (x, y, z, count, color, power) {
    var S = this.sparks;
    color = color || 0xffd9a0;
    power = power || 1;
    var r = ((color >> 16) & 255) / 255, g = ((color >> 8) & 255) / 255, b = (color & 255) / 255;
    for (var i = 0; i < count; i++) {
      var k = S.idx; S.idx = (S.idx + 1) % S.n;
      S.pos[k * 3] = x; S.pos[k * 3 + 1] = y; S.pos[k * 3 + 2] = z;
      var a = Math.random() * 6.283, e = Math.random() * 1.2 - 0.2;
      var sp = (1.6 + Math.random() * 4.2) * power;
      S.v[k * 3] = Math.cos(a) * Math.cos(e) * sp;
      S.v[k * 3 + 1] = Math.sin(e) * sp + 1.2;
      S.v[k * 3 + 2] = Math.sin(a) * Math.cos(e) * sp;
      S.life[k] = S.max[k] = 0.22 + Math.random() * 0.35;
      S.col[k * 3] = r; S.col[k * 3 + 1] = g; S.col[k * 3 + 2] = b;
    }
    S.mesh.geometry.attributes.color.needsUpdate = true;
  },

  /* ── 冲击环 ── */
  _buildRings: function () {
    var F = this;
    F.rings = [];
    for (var i = 0; i < 6; i++) {
      var m = new THREE.Mesh(
        new THREE.RingGeometry(0.5, 0.62, 20),
        new THREE.MeshBasicMaterial({ color: 0xdfe9ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      J.S.add(m);
      F.rings.push({ m: m, life: 0, max: 1, scale: 1 });
    }
    F._ri = 0;
  },

  ring: function (x, y, z, color, size) {
    var R = this.rings[this._ri]; this._ri = (this._ri + 1) % this.rings.length;
    R.m.position.set(x, y, z);
    R.m.material.color.setHex(color || 0xdfe9ff);
    R.m.visible = true;
    R.life = R.max = 0.42;
    R.scale = size || 3.2;
  },

  /* ── 顿帧 / 震屏 ── */
  hitstop: function (sec) {
    this.hitstopT = Math.max(this.hitstopT, sec);
  },
  shake: function (amt, dur) {
    this.shakeAmt = Math.max(this.shakeAmt, amt);
    this.shakeT = Math.max(this.shakeT, dur || 0.18);
    this.shakeDur = dur || 0.18;
  },

  /* ── 飘字 ── */
  dmgText: function (worldPos, text, cls) {
    var v = worldPos.clone().project(J.C);
    if (v.z > 1) return;
    var el = document.createElement('div');
    el.textContent = text;
    el.className = 'dmg ' + (cls || '');
    el.style.left = ((v.x * 0.5 + 0.5) * 100) + '%';
    el.style.top = ((-v.y * 0.5 + 0.5) * 100) + '%';
    document.getElementById('hud').appendChild(el);
    var self = this;
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 720);
  },

  /* ── 每帧 ── */
  update: function (dt, t) {
    var F = this;

    /* 顿帧 */
    if (F.hitstopT > 0) {
      F.hitstopT -= dt;
      J.timeScale = 0.045;
      if (F.hitstopT <= 0) J.timeScale = 1;
    }

    /* 拖尾淡出 */
    for (var i = 0; i < F.trails.length; i++) {
      var T = F.trails[i];
      if (!T.alive) continue;
      T.mat.uniforms.uFade.value = T.fade;
      T.fade -= dt * 4.2;
      if (T.fade <= 0) { T.fade = 0; T.alive = false; T.mat.uniforms.uFade.value = 0; }
    }

    /* 火花 */
    var S = F.sparks;
    var need = false;
    for (var k = 0; k < S.n; k++) {
      if (S.life[k] <= 0) continue;
      need = true;
      S.life[k] -= dt;
      var d = S.life[k] / S.max[k];
      S.pos[k * 3] += S.v[k * 3] * dt;
      S.pos[k * 3 + 1] += S.v[k * 3 + 1] * dt;
      S.pos[k * 3 + 2] += S.v[k * 3 + 2] * dt;
      S.v[k * 3 + 1] -= 12 * dt;
      S.v[k * 3] *= (1 - 2.4 * dt);
      S.v[k * 3 + 2] *= (1 - 2.4 * dt);
      if (S.life[k] <= 0) { S.pos[k * 3 + 1] = -999; }
      var f = Math.max(0, d);
      S.col[k * 3] *= 1; // 颜色保持
      if (d < 0.35) { S.col[k * 3] *= 0.985; S.col[k * 3 + 1] *= 0.985; S.col[k * 3 + 2] *= 0.985; }
    }
    if (need) {
      S.mesh.geometry.attributes.position.needsUpdate = true;
      S.mesh.geometry.attributes.color.needsUpdate = true;
    }

    /* 冲击环 */
    for (var r = 0; r < F.rings.length; r++) {
      var R = F.rings[r];
      if (R.life <= 0) continue;
      R.life -= dt;
      var p = 1 - R.life / R.max;
      R.m.scale.setScalar(0.3 + p * R.scale);
      R.m.material.opacity = Math.max(0, (1 - p) * 0.85);
      if (R.life <= 0) R.m.visible = false;
    }

    /* 震屏 */
    if (F.shakeT > 0) {
      F.shakeT -= dt;
      F.shakeAmt *= Math.exp(-9 * dt);
      if (F.shakeT <= 0) { F.shakeAmt = 0; }
    }
  },

  /* 供相机使用的抖动量 */
  shakeOffset: function () {
    if (this.shakeAmt < 0.001) return null;
    return {
      x: (Math.random() - 0.5) * this.shakeAmt,
      y: (Math.random() - 0.5) * this.shakeAmt,
      z: (Math.random() - 0.5) * this.shakeAmt * 0.5
    };
  }
};
