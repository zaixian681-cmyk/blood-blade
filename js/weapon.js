/* ═══════════════════════════════════════════════
   weapon.js — 太玄之刃
   半透明玉质曲刃 / 内部流纹 / 白光飘带 / 镂空金护手
   ═══════════════════════════════════════════════ */
J.Weapon = (function () {

  var BLADE_LEN = 1.52, HILT_LEN = 0.31;
  var SEG = 26;

  /* 中心线：从护手(y=0)向刀尖弯曲；返回 [x, y] */
  function spine(t) {
    var y = t * BLADE_LEN;
    var x = Math.pow(t, 1.85) * 0.40;          // 越到尖端弯得越厉害
    return [x, y];
  }
  /* 半宽与半厚随 t 变化：根部宽，中段饱满，尖端骤收 */
  function widthAt(t) { return 0.052 * (0.72 + 0.55 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.92)) * (1 - t * 0.55) + 0.004; }
  function thickAt(t) { return 0.0125 * (1 - t * 0.62) + 0.0022; }

  /* 六边形截面（刀身剖面：刃口薄、刀背厚） */
  function section(w, th) {
    return [
      [0, -w], [th * 0.55, -w * 0.62], [th, w * 0.22],
      [th * 0.35, w], [-th * 0.35, w], [-th, w * 0.22], [-th * 0.55, -w * 0.62]
    ];
  }

  function buildBladeGeo() {
    var pos = [], nor = [], uv = [], idx = [];
    var rings = [];
    for (var i = 0; i <= SEG; i++) {
      var t = i / SEG;
      var p = spine(t), w = widthAt(t), th = thickAt(t);
      var sec = section(w, th);
      var ring = [];
      var k = 0;
      for (var j = 0; j < sec.length; j++) {
        // 截面在 (x=法向偏移, z=厚度) 平面，然后沿刀身横向排布
        var nx = sec[j][0], nz = sec[j][1];
        ring.push([p[0] + nx, p[1], nz]);
        pos.push(p[0] + nx, p[1], nz);
        nor.push(0, 0, 0);
        uv.push(k / 6, t);
        k++;
      }
      rings.push(ring);
    }
    var N = 7;
    for (var i2 = 0; i2 < SEG; i2++) {
      for (var j2 = 0; j2 < N; j2++) {
        var a = i2 * N + j2, b = i2 * N + (j2 + 1) % N;
        var c = (i2 + 1) * N + (j2 + 1) % N, d = (i2 + 1) * N + j2;
        idx.push(a, b, c, a, c, d);
      }
    }
    // 根部封口
    for (var j3 = 1; j3 < N - 1; j3++) idx.push(0, j3, j3 + 1);
    // 尖端封口
    var base = SEG * N;
    for (var j4 = 1; j4 < N - 1; j4++) idx.push(base, base + j4 + 1, base + j4);

    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /* ── 玉刃材质 ── */
  var bladeMat = new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uGlow: { value: 1 } },
    vertexShader: [
      'varying vec3 vN; varying vec3 vV; varying vec2 vUv;',
      'void main(){',
      '  vUv = uv;',
      '  vec4 wp = modelMatrix * vec4(position,1.0);',
      '  vN = normalize(mat3(modelMatrix) * normal);',
      '  vV = normalize(cameraPosition - wp.xyz);',
      '  gl_Position = projectionMatrix * viewMatrix * wp;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform float uTime, uGlow;',
      'varying vec3 vN; varying vec3 vV; varying vec2 vUv;',
      'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
      '  float a=hash(i),b=hash(i+vec2(1.0,0.0)),c=hash(i+vec2(0.0,1.0)),d=hash(i+vec2(1.0,1.0));',
      '  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}',
      'float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.03;a*=0.5;}return v;}',
      'void main(){',
      '  float f1 = fbm(vec2(vUv.y*3.4 - uTime*0.42, vUv.x*5.5));',
      '  float f2 = fbm(vec2(vUv.y*8.5 - uTime*0.85, vUv.x*2.2 + 11.0));',
      '  vec3 jade = mix(vec3(0.66,0.70,0.90), vec3(1.0,0.995,0.97), clamp(f1*1.25-0.1,0.0,1.0));',
      '  jade = mix(jade, vec3(0.90,0.84,1.0), f2*0.40);',
      '  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);',
      '  vec3 col = jade + vec3(0.50,0.60,0.98)*fres*0.85*uGlow;',
      /* 刃口（uv.x 贴近 0 的一侧）发冷白高光 */
      '  float edge = 1.0 - smoothstep(0.0, 0.10, vUv.x);',
      '  col += vec3(0.92,0.97,1.0) * pow(edge, 2.2) * 1.7 * uGlow;',
      '  float a = 0.58 + fres*0.42 + f1*0.10;',
      '  gl_FragColor = vec4(col, clamp(a,0.0,1.0));',
      '}'
    ].join('\n')
  });

  /* ── 飘带 ── */
  function buildRibbons(count) {
    var grp = new THREE.Group();
    var SEGR = 26;
    var ribbons = [];
    var mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uGlow: { value: 1 } },
      vertexShader: [
        'varying vec2 vUv;',
        'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime, uGlow; varying vec2 vUv;',
        'void main(){',
        '  float e = smoothstep(0.0,0.22,vUv.x) * (1.0 - smoothstep(0.55,1.0,vUv.x));',
        '  float tip = 1.0 - clamp(pow(vUv.y,1.6),0.0,1.0);',
        '  float a = e * (0.30 + tip*0.55) * uGlow;',
        '  vec3 c = mix(vec3(0.62,0.72,1.0), vec3(1.0,1.0,1.0), vUv.x);',
        '  gl_FragColor = vec4(c, a);',
        '}'
      ].join('\n')
    });
    for (var r = 0; r < count; r++) {
      var g = new THREE.BufferGeometry();
      var pos = new Float32Array((SEGR + 1) * 2 * 3);
      var uv = new Float32Array((SEGR + 1) * 2 * 2);
      var idx = [];
      for (var i = 0; i <= SEGR; i++) {
        var t = i / SEGR;
        uv[i * 4] = 0; uv[i * 4 + 1] = t;
        uv[i * 4 + 2] = 1; uv[i * 4 + 3] = t;
        if (i < SEGR) { var a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
      }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx);
      var m = new THREE.Mesh(g, mat);
      m.frustumCulled = false;
      m.renderOrder = 6;
      grp.add(m);
      ribbons.push({ mesh: m, off: r / count * Math.PI * 2, phase: Math.random() * 6.28, len: 0.50 + Math.random() * 0.20 });
    }
    return { grp: grp, ribbons: ribbons, mat: mat, SEGR: SEGR };
  }

  function updateRibbons(R, t, glow) {
    var SEGR = R.SEGR;
    for (var ri = 0; ri < R.ribbons.length; ri++) {
      var rib = R.ribbons[ri];
      var arr = rib.mesh.geometry.attributes.position.array;
      var len = rib.len;
      for (var i = 0; i <= SEGR; i++) {
        var u = i / SEGR;
        // 沿刀身的位置 t：从护手附近开始，向刀尖方向铺开再向后飘
        var t2 = 0.10 + u * 0.92;
        var p = spine(Math.min(1, t2));
        var wob = Math.sin(u * 6.5 + t * 2.4 + rib.phase) * 0.055 * (0.25 + u);
        var wob2 = Math.cos(u * 4.2 + t * 1.7 + rib.phase * 1.7) * 0.045 * (0.25 + u);
        // 飘带向外扩，越靠近末端越向后（-z）展开
        var spread = 0.045 + u * u * 0.085 * len;
        var back = -u * u * 0.13 * len + Math.sin(u * 5.0 + t * 1.9 + rib.phase) * 0.028 * u;
        var cx = p[0] + Math.cos(rib.off) * spread + wob;
        var cy = p[1] + Math.sin(rib.off) * spread * 0.55 + wob2;
        var cz = back + Math.sin(rib.off) * spread * 0.7;
        // 带子宽度方向
        var wv = 0.016 + u * 0.020;
        var px = Math.cos(rib.off + 1.57) * wv;
        var py = Math.sin(rib.off + 1.57) * wv * 0.6;
        var o = i * 6;
        arr[o] = cx - px; arr[o + 1] = cy - py; arr[o + 2] = cz;
        arr[o + 3] = cx + px; arr[o + 4] = cy + py; arr[o + 5] = cz;
      }
      rib.mesh.geometry.attributes.position.needsUpdate = true;
    }
    R.mat.uniforms.uTime.value = t;
    R.mat.uniforms.uGlow.value = glow;
  }

  /* ── 金饰材质 ── */
  var goldMat = new THREE.MeshStandardMaterial({ color: 0xf0cf8c, metalness: 1.0, roughness: 0.28, emissive: 0x4a3410, emissiveIntensity: 0.55 });
  var goldDark = new THREE.MeshStandardMaterial({ color: 0xb08a45, metalness: 1.0, roughness: 0.42, emissive: 0x2a1c06, emissiveIntensity: 0.4 });
  var gemMat = new THREE.MeshStandardMaterial({ color: 0x8f7cff, emissive: 0x6a52ff, emissiveIntensity: 2.2, metalness: 0.2, roughness: 0.15 });

  function goldRing(r, tube, seg) {
    var g = new THREE.TorusGeometry(r, tube, 8, seg || 16);
    var m = new THREE.Mesh(g, goldMat);
    m.castShadow = true;
    return m;
  }

  /* ── 组装 ── */
  var API = {};

  API.create = function () {
    var root = new THREE.Group();          // 原点在握把中心，刀身沿 +Y
    var parts = new THREE.Group();
    root.add(parts);

    /* 刀柄：y 从 -HILT_LEN 到 0 */
    var hiltG = new THREE.CylinderGeometry(0.0195, 0.0235, HILT_LEN, 10);
    var hilt = new THREE.Mesh(hiltG, new THREE.MeshStandardMaterial({ color: 0xe9e3d6, metalness: 0.35, roughness: 0.45, emissive: 0x2a2634, emissiveIntensity: 0.3 }));
    hilt.position.y = -HILT_LEN / 2;
    hilt.castShadow = true;
    parts.add(hilt);

    /* 柄上金环 */
    for (var i = 0; i < 3; i++) {
      var ring = goldRing(0.0215, 0.0042, 14);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.055 - i * 0.085;
      parts.add(ring);
    }

    /* 剑首：金环 + 眼状火焰饰 */
    var p1 = new THREE.Group();
    p1.position.y = -HILT_LEN - 0.012;
    var capRing = goldRing(0.052, 0.0085, 18);
    capRing.rotation.x = Math.PI / 2;
    p1.add(capRing);
    var inner = goldRing(0.032, 0.005, 14);
    inner.rotation.x = Math.PI / 2;
    p1.add(inner);
    // 火焰状挑饰（向侧上方翘）
    var flameShape = new THREE.Shape();
    flameShape.moveTo(0, 0);
    flameShape.bezierCurveTo(0.02, 0.05, 0.055, 0.075, 0.03, 0.115);
    flameShape.bezierCurveTo(0.05, 0.09, 0.075, 0.045, 0.045, 0.0);
    flameShape.lineTo(0, 0);
    var flameG = new THREE.ShapeGeometry(flameShape, 8);
    var flame = new THREE.Mesh(flameG, goldMat);
    flame.position.set(-0.035, 0.0, 0);
    flame.rotation.z = 0.35;
    p1.add(flame);
    var f2 = flame.clone(); f2.rotation.z = Math.PI - 0.35; f2.position.x = 0.035;
    p1.add(f2);
    // 剑首宝石
    var gem1 = new THREE.Mesh(new THREE.SphereGeometry(0.021, 10, 8), gemMat);
    p1.add(gem1);
    parts.add(p1);

    /* 护手（镡）：镂空金盘 + 花瓣 */
    var guard = new THREE.Group();
    guard.position.y = 0.012;
    var disk = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.078, 0.016, 14), goldMat);
    guard.add(disk);
    // 外圈
    var dRing = goldRing(0.086, 0.009, 20);
    dRing.rotation.x = Math.PI / 2;
    guard.add(dRing);
    var dRing2 = goldRing(0.062, 0.005, 18);
    dRing2.rotation.x = Math.PI / 2;
    guard.add(dRing2);
    // 四片花瓣镂空（两侧延伸）
    for (var k = 0; k < 2; k++) {
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        var petal = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), goldMat);
        petal.scale.set(0.042, 0.013, 0.026);
        petal.position.set(sgn * 0.098, k ? 0.014 : -0.014, 0);
        petal.rotation.z = sgn * (k ? 0.25 : -0.25);
        guard.add(petal);
      }
    }
    // 护手中央宝石（蓝紫）
    var gem2 = new THREE.Mesh(new THREE.SphereGeometry(0.020, 12, 10), gemMat);
    gem2.position.y = 0.004;
    gem2.scale.z = 1.35;
    guard.add(gem2);
    var gemHalo = new THREE.Mesh(new THREE.SphereGeometry(0.034, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x8f7cff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
    gemHalo.position.y = 0.004;
    guard.add(gemHalo);
    parts.add(guard);

    /* 刃身 */
    var bladeGeo = buildBladeGeo();
    var blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = 0.02;
    blade.renderOrder = 5;
    parts.add(blade);

    /* 刃身内嵌亮筋（细长发光片，让刀看起来有"芯"） */
    var ribG = new THREE.BufferGeometry();
    var rp = [], ri2 = [];
    var RS = 20;
    for (var j = 0; j <= RS; j++) {
      var t = j / RS, p = spine(t), w = widthAt(t);
      rp.push(p[0] + w * 0.18, p[1] + 0.02, 0);
      rp.push(p[0] + w * 0.18, p[1] + 0.02, 0);
      if (j < RS) { var a = j * 2; ri2.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    }
    ribG.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
    ribG.setIndex(ri2);
    ribG.computeVertexNormals();
    // 用一条极细的发光丝带代替
    var glowLine = new THREE.Mesh(
      new THREE.PlaneGeometry(0.012, BLADE_LEN, 1, 8),
      new THREE.MeshBasicMaterial({ color: 0xdfe9ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    glowLine.geometry.translate(0, BLADE_LEN / 2, 0);
    glowLine.position.set(0.03, 0.02, 0);
    glowLine.rotation.z = -0.13;
    glowLine.renderOrder = 7;
    parts.add(glowLine);

    /* 飘带 */
    var R = buildRibbons(4);
    R.grp.position.y = 0.02;
    parts.add(R.grp);

    /* 刀身冷光 */
    var light = new THREE.PointLight(0xa9c4ff, 0.9, 5.2, 2);
    light.position.set(0.15, 1.0, 0);
    root.add(light);

    var obj = {
      root: root, parts: parts, blade: blade, bladeMat: bladeMat,
      ribbons: R, gemMat: gemMat, gemHalo: gemHalo, light: light,
      glowLine: glowLine,
      /* 基础握持姿态 */
      baseRot: new THREE.Euler(0, 0, 0),
      glow: 1,
      update: function (dt, t, glowTarget) {
        this.glow = J.U.damp(this.glow, glowTarget === undefined ? 1 : glowTarget, 6, dt);
        bladeMat.uniforms.uTime.value = t;
        bladeMat.uniforms.uGlow.value = this.glow;
        updateRibbons(R, t, this.glow);
        light.intensity = 0.45 * this.glow + 0.35 * Math.sin(t * 2.2) * 0.12;
        gemMat.emissiveIntensity = 1.6 + this.glow * 0.9;
        gemHalo.scale.setScalar(1 + Math.sin(t * 2.0) * 0.08);
        glowLine.material.opacity = (0.36 + 0.22 * Math.sin(t * 3.1)) * this.glow;
      }
    };
    return obj;
  };

  return API;
})();
