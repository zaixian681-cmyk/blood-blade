/* ═══════════════════════════════════════════════
   ambience.js — 画面氛围
   远山剪影 / 谷底流雾 / 落叶 / 归鸟 / 瀑布天光
   ═══════════════════════════════════════════════ */
J.Amb = (function () {

  var A = { layers: [], mists: [], leaves: null, birds: [], rays: [], time: 0 };
  var ridgeGroup, mistGroup, leafPoint, birdGroup, rayGroup;

  /* ── 柔光贴图 ── */
  function softTex(size, inner, outer) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    var gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, inner || 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.45, 'rgba(255,255,255,0.28)');
    gr.addColorStop(1, outer || 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* ── 远山：三层环形山脊 ── */
  function buildRidge(radius, height, color, phase, segs, jag) {
    var N = segs || 160;
    var pos = [], col = [], idx = [];
    var c1 = new THREE.Color(color);
    var c2 = new THREE.Color(color).multiplyScalar(0.72);
    var cTop = new THREE.Color(color).lerp(new THREE.Color(0xcfe0e8), 0.42);

    function hAt(a) {
      var n = Math.sin(a * 3.0 + phase) * 0.42 + Math.sin(a * 7.3 + phase * 2.1) * 0.22 +
        Math.sin(a * 13.7 + phase * 0.7) * 0.12 + Math.sin(a * 27.1 + phase) * 0.05;
      return height * (0.62 + n * jag);
    }

    for (var i = 0; i <= N; i++) {
      var a = i / N * Math.PI * 2;
      var x = Math.cos(a) * radius, z = Math.sin(a) * radius;
      var yTop = hAt(a);
      /* 底边 */
      pos.push(x, -70, z); col.push(c2.r, c2.g, c2.b);
      /* 顶边 */
      pos.push(x, yTop, z);
      var cr = c1.clone().lerp(cTop, 0.35);
      col.push(cr.r, cr.g, cr.b);
      /* 中腰（让山体有一点层次） */
      pos.push(x * 0.995, yTop * 0.45, z * 0.995);
      var cm = c1.clone().lerp(c2, 0.4);
      col.push(cm.r, cm.g, cm.b);
    }
    for (var k = 0; k < N; k++) {
      var b = k * 3, n2 = (k + 1) * 3;
      /* 底-中-中 */
      idx.push(b, n2, b + 1); idx.push(b + 1, n2, n2 + 1);
      idx.push(b + 1, n2 + 1, b + 2); idx.push(b + 2, n2 + 1, n2 + 2);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    var m = new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false
    });
    var mesh = new THREE.Mesh(g, m);
    mesh.renderOrder = -900;
    mesh.frustumCulled = false;
    return mesh;
  }

  function buildRidges() {
    ridgeGroup = new THREE.Group();
    ridgeGroup.renderOrder = -900;
    J.S.add(ridgeGroup);
    var cfg = [
      { r: 430, h: 92, c: 0x9fb3c2, ph: 0.0, jag: 0.55 },
      { r: 340, h: 74, c: 0x8aa0b2, ph: 2.3, jag: 0.62 },
      { r: 265, h: 56, c: 0x7a92a6, ph: 4.1, jag: 0.68 }
    ];
    for (var i = 0; i < cfg.length; i++) {
      var m = buildRidge(cfg[i].r, cfg[i].h, cfg[i].c, cfg[i].ph, 150, cfg[i].jag);
      m.position.y = 8;
      ridgeGroup.add(m);
      A.layers.push(m);
    }
  }

  /* ── 谷底流雾 ── */
  function buildMist() {
    mistGroup = new THREE.Group();
    J.S.add(mistGroup);
    var tex = softTex(128, 'rgba(240,248,252,0.55)');
    var mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0.10, depthWrite: false, color: 0xdfeaf0
    });
    var spots = [
      [-4, 86], [6, 60], [-10, 34], [4, 8], [-6, -20], [8, -50],
      [-8, -80], [2, -110], [10, -140], [-4, -168],
      [J.Terrain.FALL.x, 118], [J.Terrain.FALL.x + 12, 112]
    ];
    for (var i = 0; i < spots.length; i++) {
      var s = new THREE.Sprite(mat.clone());
      var x = spots[i][0] + (J.Terrain.riverX ? J.Terrain.riverX(spots[i][1]) * 0.85 : 0);
      var z = spots[i][1];
      var y = J.Terrain.heightAt(x, z) + 2.2;
      s.position.set(x, y, z);
      var sc = 26 + Math.random() * 26;
      s.scale.set(sc, sc * 0.42, 1);
      s.material.opacity = 0.055 + Math.random() * 0.05;
      s.userData = {
        base: s.material.opacity,
        ph: Math.random() * 6.28,
        sp: 0.10 + Math.random() * 0.12,
        x0: x, z0: z
      };
      mistGroup.add(s);
      A.mists.push(s);
    }
  }

  /* ── 落叶 ── */
  function buildLeaves() {
    var n = 150;
    var g = new THREE.BufferGeometry();
    var pos = new Float32Array(n * 3);
    var col = new Float32Array(n * 3);
    var vel = new Float32Array(n * 3);
    var ph = new Float32Array(n);
    var palette = [[0.72, 0.62, 0.30], [0.62, 0.52, 0.26], [0.55, 0.60, 0.32], [0.78, 0.58, 0.32]];
    for (var i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 46;
      pos[i * 3 + 1] = Math.random() * 14;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 46;
      vel[i * 3] = (Math.random() - 0.5) * 0.7;
      vel[i * 3 + 1] = -0.5 - Math.random() * 0.9;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.7;
      ph[i] = Math.random() * 6.28;
      var c = palette[i % palette.length];
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var m = new THREE.PointsMaterial({
      size: 0.14, vertexColors: true, transparent: true, opacity: 0.85,
      map: softTex(32, 'rgba(255,255,255,0.95)'),
      depthWrite: false, alphaTest: 0.02, sizeAttenuation: true
    });
    leafPoint = new THREE.Points(g, m);
    leafPoint.frustumCulled = false;
    leafPoint.renderOrder = 8;
    J.S.add(leafPoint);
    A.leaves = { mesh: leafPoint, n: n, vel: vel, ph: ph, pos: pos };
  }

  /* ── 归鸟 ── */
  function birdTex() {
    var c = document.createElement('canvas'); c.width = 64; c.height = 32;
    var g = c.getContext('2d');
    g.strokeStyle = 'rgba(28,30,34,0.95)';
    g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(6, 22); g.quadraticCurveTo(20, 6, 32, 18);
    g.quadraticCurveTo(44, 6, 58, 22);
    g.stroke();
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function buildBirds() {
    birdGroup = new THREE.Group();
    J.S.add(birdGroup);
    var tex = birdTex();
    for (var g = 0; g < 3; g++) {
      var flock = new THREE.Group();
      var cnt = 2 + (g % 2);
      for (var i = 0; i < cnt; i++) {
        var sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: tex, transparent: true, depthWrite: false, opacity: 0.55, color: 0x2a2e34
        }));
        sp.scale.set(3.2, 1.6, 1);
        sp.position.set(i * 3.4 - cnt * 1.7, Math.random() * 2, Math.random() * 3);
        flock.add(sp);
      }
      A.birds.push({
        g: flock, r: 90 + g * 46, h: 58 + g * 14,
        a: Math.random() * 6.28, sp: 0.045 + g * 0.012, cx: 0, cz: 0
      });
      birdGroup.add(flock);
    }
  }

  /* ── 瀑布天光 ── */
  function buildRays() {
    rayGroup = new THREE.Group();
    J.S.add(rayGroup);
    var F = J.Terrain.FALL;
    var tex = softTex(64, 'rgba(255,246,220,0.55)');
    for (var i = 0; i < 4; i++) {
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(6 + i * 2.5, 26 + i * 5),
        new THREE.MeshBasicMaterial({
          map: tex, transparent: true, opacity: 0.10 + i * 0.02,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
          color: 0xffeccc
        })
      );
      m.position.set(F.x - 9 + i * 5.6, F.bottom + 13, F.z + 3);
      m.rotation.z = 0.22;
      m.rotation.y = 0.15;
      rayGroup.add(m);
      A.rays.push({ m: m, ph: i * 1.4 });
    }
  }

  /* ── 初始化 ── */
  A.init = function () {
    if (!J.S) return;
    buildRidges();
    buildMist();
    buildLeaves();
    buildBirds();
    buildRays();
  };

  /* 低配模式：关掉流雾与落叶，保留远山 */
  A.setLight = function (on) {
    if (mistGroup) mistGroup.visible = !on;
    if (leafPoint) leafPoint.visible = !on;
    if (rayGroup) rayGroup.visible = !on;
  };

  /* ── 每帧 ── */
  A.update = function (dt, t, P) {
    if (!P) return;
    if (P.pos) P = P.pos;   // 兼容传 player 或 player.pos
    A.time += dt;

    /* 远山跟着相机走，永不抵达 */
    if (ridgeGroup && J.C) {
      ridgeGroup.position.x = J.C.position.x;
      ridgeGroup.position.z = J.C.position.z;
      /* 轻微视差呼吸 */
      ridgeGroup.rotation.y = Math.sin(t * 0.01) * 0.004;
    }

    /* 雾 */
    for (var i = 0; i < A.mists.length; i++) {
      var s = A.mists[i], u = s.userData;
      s.position.x = u.x0 + Math.sin(t * u.sp + u.ph) * 6.5;
      s.position.z = u.z0 + Math.cos(t * u.sp * 0.7 + u.ph) * 3.2;
      s.material.opacity = u.base * (0.75 + Math.sin(t * u.sp * 2 + u.ph) * 0.25);
    }

    /* 落叶：只围绕玩家 */
    if (A.leaves) {
      var L = A.leaves, pos = L.pos;
      for (var k = 0; k < L.n; k++) {
        var ix = k * 3;
        pos[ix] += (L.vel[ix] + Math.sin(t * 1.6 + L.ph[k]) * 0.5) * dt;
        pos[ix + 1] += L.vel[ix + 1] * dt;
        pos[ix + 2] += (L.vel[ix + 2] + Math.cos(t * 1.3 + L.ph[k]) * 0.5) * dt;
        /* 越界回到玩家头顶 */
        if (pos[ix + 1] < -2 || Math.abs(pos[ix]) > 30 || Math.abs(pos[ix + 2]) > 30) {
          pos[ix] = (Math.random() - 0.5) * 40;
          pos[ix + 1] = 10 + Math.random() * 8;
          pos[ix + 2] = (Math.random() - 0.5) * 40;
        }
      }
      L.mesh.position.set(P.x, P.y, P.z);
      L.mesh.geometry.attributes.position.needsUpdate = true;
    }

    /* 鸟群绕山 */
    for (var b = 0; b < A.birds.length; b++) {
      var B2 = A.birds[b];
      B2.a += B2.sp * dt;
      var x = Math.cos(B2.a) * B2.r + (J.C ? J.C.position.x * 0.15 : 0);
      var z = Math.sin(B2.a) * B2.r + (J.C ? J.C.position.z * 0.15 : 0);
      B2.g.position.set(x, B2.h + Math.sin(t * 0.4 + b) * 3, z);
      B2.g.rotation.y = -B2.a + Math.PI / 2;
      /* 扇翅 */
      for (var c = 0; c < B2.g.children.length; c++) {
        var sp2 = B2.g.children[c];
        sp2.scale.y = 1.4 + Math.sin(t * 6 + c * 1.7) * 0.5;
      }
    }

    /* 天光脉动 */
    for (var r = 0; r < A.rays.length; r++) {
      var R = A.rays[r];
      R.m.material.opacity = (0.07 + Math.sin(t * 0.7 + R.ph) * 0.03) + r * 0.014;
    }

    /* 雾随区域变化：谷底浓，崖顶淡 */
    if (J.S && J.S.fog) {
      var wantD = 0.0026;
      var z = P.z;
      if (z > 20 && z < 140) wantD = 0.0038;      // 谷底云雾
      if (z < -140) wantD = 0.0031;                // 山顶
      if (P.y > 40) wantD *= 0.65;             // 高处通透
      J.S.fog.density = J.U.damp(J.S.fog.density, wantD, 0.8, dt);
    }
  };

  return A;
})();
