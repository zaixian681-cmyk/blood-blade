/* ═══════════════════════════════════════════════
   ally.js — 山与晨（同伴）
   「我也有刀。」
   跟随 / 觅敌 / 连击 / 格挡 / 负伤倒地 / 复起
   ═══════════════════════════════════════════════ */
J.Ally = (function () {

  var A = {
    active: false, down: false, hp: 0, maxHp: 340,
    pos: new THREE.Vector3(), yaw: 0, vy: 0,
    state: 'idle', tim: 0, cd: 0.6,
    target: null, hitCd: 0, hurt: 0, flashT: 0,
    reviveT: 0, hits: 0, yawDamp: 0,
    model: null, name: '山与晨'
  };

  var M = null;

  /* ── 材质 ── */
  function mat(c, r, m) {
    return new THREE.MeshStandardMaterial({
      color: c, roughness: r === undefined ? 0.78 : r, metalness: m || 0.04
    });
  }
  function bx(w, h, d, m, x, y, z) {
    var e = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    e.position.set(x || 0, y || 0, z || 0);
    e.castShadow = true;
    return e;
  }
  function sp(r, m, x, y, z, sx, sy, sz) {
    var e = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m);
    e.position.set(x || 0, y || 0, z || 0);
    e.scale.set(sx || 1, sy || 1, sz || 1);
    e.castShadow = true;
    return e;
  }

  var mRobe, mRobe2, mTrim, mSkin, mHair, mBlade, mDark;

  function build() {
    mRobe = mat(0xeae6f2, 0.82);
    mRobe2 = mat(0xd6cfe8, 0.86);
    mTrim = mat(0x9a86c0, 0.6, 0.22);
    mSkin = mat(0xf0d5bd, 0.85);
    mHair = mat(0x2a2430, 0.72);
    mBlade = mat(0xdfe6f2, 0.28, 0.92);
    mDark = mat(0x332c3c, 0.9);

    var root = new THREE.Group();
    var spin = new THREE.Group(); root.add(spin);
    var hips = new THREE.Group(); hips.position.y = 0.84; spin.add(hips);

    /* 腿 */
    function leg(sd) {
      var hip = new THREE.Group(); hip.position.set(sd * 0.085, 0, 0); hips.add(hip);
      hip.add(bx(0.115, 0.36, 0.12, mRobe2, 0, -0.18, 0));
      var knee = new THREE.Group(); knee.position.y = -0.36; hip.add(knee);
      knee.add(bx(0.10, 0.34, 0.105, mRobe2, 0, -0.17, 0));
      knee.add(bx(0.11, 0.06, 0.20, mDark, 0, -0.355, 0.035));
      return { hip: hip, knee: knee };
    }
    var legL = leg(-1), legR = leg(1);

    /* 裙 */
    var skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.34, 0.55, 14, 1, true), mRobe);
    skirt.position.y = -0.20; skirt.material.side = THREE.DoubleSide;
    hips.add(skirt);

    /* 躯干 */
    var torso = new THREE.Group(); hips.add(torso);
    torso.add(bx(0.30, 0.26, 0.19, mRobe, 0, 0.12, 0));
    torso.add(bx(0.32, 0.07, 0.205, mTrim, 0, 0.0, 0));       // 腰封
    var chest = new THREE.Group(); chest.position.y = 0.26; torso.add(chest);
    chest.add(bx(0.32, 0.28, 0.21, mRobe, 0, 0.13, 0));
    /* 交领 */
    var collar = bx(0.16, 0.30, 0.02, mTrim, 0, 0.14, 0.105);
    collar.rotation.z = 0.42; chest.add(collar);
    var collar2 = bx(0.16, 0.28, 0.02, mTrim, 0, 0.15, 0.106);
    collar2.rotation.z = -0.42; chest.add(collar2);
    /* 肩披 */
    chest.add(bx(0.40, 0.09, 0.24, mTrim, 0, 0.255, 0));

    /* 头 */
    var head = new THREE.Group(); head.position.y = 0.30; chest.add(head);
    head.add(sp(0.105, mSkin, 0, 0.05, 0, 1, 1.06, 0.96));
    head.add(sp(0.112, mHair, 0, 0.075, -0.012, 1.02, 0.95, 1.0));
    /* 长直发 */
    var hairBack = bx(0.20, 0.66, 0.10, mHair, 0, -0.28, -0.075);
    head.add(hairBack);
    head.add(bx(0.035, 0.52, 0.055, mHair, -0.115, -0.24, 0.01));
    head.add(bx(0.035, 0.52, 0.055, mHair, 0.115, -0.24, 0.01));
    /* 发带 */
    head.add(bx(0.04, 0.045, 0.04, mTrim, 0, 0.135, 0.055));
    /* 眼 */
    head.add(bx(0.026, 0.014, 0.02, mat(0x2a2024), -0.042, 0.062, 0.096));
    head.add(bx(0.026, 0.014, 0.02, mat(0x2a2024), 0.042, 0.062, 0.096));

    /* 手臂 */
    function arm(sd) {
      var sh = new THREE.Group(); sh.position.set(sd * 0.175, 0.235, 0); chest.add(sh);
      sh.add(sp(0.062, mRobe, 0, 0, 0, 1.05, 0.95, 1));
      sh.add(bx(0.09, 0.24, 0.095, mRobe, 0, -0.12, 0));
      var el = new THREE.Group(); el.position.y = -0.24; sh.add(el);
      el.add(bx(0.08, 0.23, 0.085, mRobe, 0, -0.115, 0));
      el.add(bx(0.085, 0.06, 0.09, mTrim, 0, -0.20, 0));
      var hand = new THREE.Group(); hand.position.y = -0.245; el.add(hand);
      hand.add(sp(0.048, mSkin, 0, 0, 0));
      return { sh: sh, el: el, hand: hand };
    }
    var armR = arm(1), armL = arm(-1);

    /* 短刀 */
    var wHold = new THREE.Group();
    var blade = bx(0.03, 0.62, 0.065, mBlade, 0, 0.24, 0);
    wHold.add(blade);
    wHold.add(bx(0.035, 0.13, 0.04, mDark, 0, -0.08, 0));
    wHold.add(bx(0.10, 0.022, 0.05, mTrim, 0, -0.005, 0));
    wHold.rotation.x = 0.5;
    wHold.position.y = -0.04;
    armR.hand.add(wHold);

    /* 腰间短刃鞘 */
    var scab = bx(0.05, 0.34, 0.06, mDark, -0.14, -0.05, 0.03);
    scab.rotation.z = 0.25;
    hips.add(scab);

    /* 影子 */
    var blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.38, 14),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })
    );
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02;
    root.add(blob);

    /* 名牌 */
    var cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    var g = cv.getContext('2d');
    g.font = 'bold 30px serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(10,8,8,.55)';
    g.fillRect(8, 8, 240, 48);
    g.fillStyle = '#e6d8f8';
    g.fillText('山与晨', 128, 34);
    var tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    var tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
    tag.scale.set(1.35, 0.34, 1);
    tag.position.y = 2.1;
    root.add(tag);

    return {
      root: root, spin: spin, hips: hips, torso: torso, chest: chest, head: head,
      armR: armR, armL: armL, legL: legL, legR: legR, weapon: wHold,
      blob: blob, tag: tag, hairBack: hairBack
    };
  }

  /* ── 出场 ── */
  A.spawn = function (x, z, yaw) {
    if (!M) M = build();
    if (!M.root.parent) J.S.add(M.root);
    M.root.visible = true;
    A.model = M;
    A.active = true;
    A.down = false;
    A.hp = A.maxHp;
    A.state = 'idle';
    A.tim = 0;
    A.cd = 0.4;
    A.target = null;
    A.yaw = yaw || 0;
    var p = J.P ? J.P.pos : new THREE.Vector3(x, 0, z);
    var sx = x === undefined ? p.x + 1.4 : x;
    var sz = z === undefined ? p.z + 1.4 : z;
    A.pos.set(sx, J.Terrain.heightAt(sx, sz), sz);
    M.root.position.copy(A.pos);
    M.spin.rotation.y = A.yaw;
    M.root.rotation.x = 0;
    M.hips.position.y = 0.84;
    if (J.UI && J.UI.allyBar) J.UI.allyBar(A);
    J.FX.ring(A.pos.x, A.pos.y + 0.5, A.pos.z, 0xc8b0ff, 2.6);
    J.FX.spark(A.pos.x, A.pos.y + 1.0, A.pos.z, 18, 0xd8c8ff, 1.2);
    return A;
  };

  A.despawn = function () {
    A.active = false;
    if (M) M.root.visible = false;
    if (J.UI && J.UI.allyBar) J.UI.allyBar(null);
  };

  /* ── 受击 ── */
  A.takeHit = function (dmg, fromPos, isBoss) {
    if (!A.active || A.down) return;
    if (A.state === 'parry') {
      /* 她的格挡：小幅减免并反击 */
      J.FX.spark(A.pos.x, A.pos.y + 1.3, A.pos.z, 12, 0xbfd8ff, 1.1);
      dmg *= 0.3;
      A.counter();
    }
    A.hp -= dmg;
    A.hurt = 0.35;
    A.flashT = 0.14;
    J.FX.spark(A.pos.x, A.pos.y + 1.25, A.pos.z, 10, 0xff9a7a, 1.0);
    if (A.hp <= 0) {
      A.hp = 0;
      A.down = true;
      A.state = 'down';
      A.tim = 0;
      A.reviveT = 16;
      J.UI && J.UI.toast('山与晨 负伤了', 2.2);
      J.UI && J.UI.flashText('沈 昭 宁 倒 下');
      J.FX.spark(A.pos.x, A.pos.y + 1.0, A.pos.z, 22, 0xe0d0ff, 1.6);
    }
  };

  A.counter = function () {
    var f = A.target;
    if (!f || f.dead || f.gone) return;
    var d = Math.hypot(f.pos.x - A.pos.x, f.pos.z - A.pos.z);
    if (d > 3.0) return;
    f.hurt(24, A.pos, 1.4, false);
    J.FX.spark(f.pos.x, f.pos.y + 1.2, f.pos.z, 14, 0xd8e0ff, 1.2);
  };

  /* ── 找目标 ── */
  function pickTarget() {
    var P = J.P, best = null, bd = 12.5;
    for (var i = 0; i < J.foes.length; i++) {
      var f = J.foes[i];
      if (f.dead || f.gone) continue;
      /* 不打远处的，只打玩家身边这一圈的 */
      var dp = Math.hypot(f.pos.x - P.pos.x, f.pos.z - P.pos.z);
      if (dp > 15) continue;
      var da = Math.hypot(f.pos.x - A.pos.x, f.pos.z - A.pos.z);
      if (da < bd) { bd = da; best = f; }
    }
    return best;
  }

  /* ── 挥刀 ── */
  function strike(power) {
    var f = A.target;
    if (!f || f.dead || f.gone) return;
    var dx = f.pos.x - A.pos.x, dz = f.pos.z - A.pos.z;
    var d = Math.hypot(dx, dz);
    var toT = Math.atan2(dx, dz);
    if (Math.abs(J.U.ang(A.yaw, toT)) > 1.5 || d > 2.9) return;

    var dmg = Math.round((18 + Math.random() * 8) * power);
    var crit = Math.random() < 0.22;
    if (crit) dmg = Math.round(dmg * 1.6);
    f.hurt(dmg, A.pos, 1.2, power > 1.2);
    J.FX.dmgText(new THREE.Vector3(f.pos.x, f.pos.y + 1.75, f.pos.z), dmg, crit ? 'crit' : '');
    J.FX.spark(f.pos.x, f.pos.y + 1.2, f.pos.z, crit ? 16 : 10, 0xd8e0ff, 1.1);

    A.hits++;
    /* 每 6 刀，替玩家回一点血 —— 她是来一起打的 */
    if (A.hits % 6 === 0) {
      var P = J.P;
      P.hp = Math.min(P.maxHp, P.hp + 10);
      J.FX.dmgText(new THREE.Vector3(P.pos.x, P.pos.y + 1.9, P.pos.z), '+10', 'block');
      J.FX.spark(P.pos.x, P.pos.y + 1.2, P.pos.z, 10, 0xa8ffc0, 0.9);
    }
  }

  /* ── 每帧 ── */
  A.update = function (dt, t) {
    if (!A.active || !M) return;
    var P = J.P;
    if (!P) return;

    /* 影子与名牌（离镜头太近就隐藏，避免大字糊屏） */
    M.tag.position.y = 2.1 + Math.sin(t * 1.5) * 0.035;
    if (J.C) {
      var dc = Math.hypot(A.pos.x - J.C.position.x, A.pos.z - J.C.position.z);
      var showTag = dc > 5.5;
      if (M.tag.visible !== showTag) M.tag.visible = showTag;
    }

    /* 闪白 */
    if (A.flashT > 0) A.flashT -= dt;
    if (A.hurt > 0) A.hurt -= dt;

    /* 倒地 */
    if (A.down) {
      A.reviveT -= dt;
      M.root.rotation.x = J.U.damp(M.root.rotation.x, -1.25, 4, dt);
      M.hips.position.y = J.U.damp(M.hips.position.y, 0.35, 4, dt);
      /* 玩家靠近按「拾」可扶起 */
      var near = Math.hypot(P.pos.x - A.pos.x, P.pos.z - A.pos.z) < 3.2;
      if (J.UI && J.UI.showAllyRevive) J.UI.showAllyRevive(near);
      if (near) A.reviveT -= dt * 6.5;   // 守在身边能把她拉起来
      if (A.reviveT <= 0) {
        A.down = false;
        A.hp = Math.round(A.maxHp * 0.45);
        A.state = 'idle';
        A.tim = 0;
        A.reviveT = 0;
        M.root.rotation.x = 0;
        M.hips.position.y = 0.84;
        J.FX.ring(A.pos.x, A.pos.y + 0.4, A.pos.z, 0xd8c8ff, 3.0);
        J.FX.spark(A.pos.x, A.pos.y + 1.1, A.pos.z, 20, 0xe0d0ff, 1.4);
        J.UI && J.UI.toast('山与晨：还能打。', 1.8);
      }
      M.blob.position.y = 0.02;
      M.root.position.copy(A.pos);
      if (J.UI && J.UI.allyBar) J.UI.allyBar(A);
      return;
    }

    /* 脱战缓慢回血 */
    var anyFoe = false;
    for (var q = 0; q < J.foes.length; q++) {
      if (!J.foes[q].dead && !J.foes[q].gone &&
        Math.hypot(J.foes[q].pos.x - P.pos.x, J.foes[q].pos.z - P.pos.z) < 14) { anyFoe = true; break; }
    }
    if (!anyFoe) A.hp = Math.min(A.maxHp, A.hp + 9 * dt);

    var dP = Math.hypot(P.pos.x - A.pos.x, P.pos.z - A.pos.z);

    /* 太远直接跟上（避免她被困在关卡外） */
    if (dP > 30) {
      var bx2 = P.pos.x - Math.sin(P.yaw) * 2.2 + Math.cos(P.yaw) * 1.4;
      var bz2 = P.pos.z - Math.cos(P.yaw) * 2.2 - Math.sin(P.yaw) * 1.4;
      A.pos.set(bx2, J.Terrain.heightAt(bx2, bz2), bz2);
      J.FX.spark(bx2, A.pos.y + 1.0, bz2, 14, 0xc8b0ff, 1.2);
    }

    A.tim += dt;
    A.cd -= dt;

    /* 目标 */
    if (!A.target || A.target.dead || A.target.gone) A.target = pickTarget();

    var faceTo = null, spd = 0;

    /* 剧情对话 / 过场时她安静站着 */
    var busy = (J.UI && J.UI.isDialogOpen && J.UI.isDialogOpen()) || (J.Cine && J.Cine.active);

    if (A.state === 'parry') {
      if (A.tim > 0.4) { A.state = 'idle'; A.tim = 0; }
    } else if (A.hurt > 0.01) {
      A.state = 'hurt';
    } else if (!busy && A.target) {
      var f = A.target;
      var df = Math.hypot(f.pos.x - A.pos.x, f.pos.z - A.pos.z);
      var toF = Math.atan2(f.pos.x - A.pos.x, f.pos.z - A.pos.z);

      if (A.state === 'wind') {
        faceTo = toF;
        if (A.tim >= A.dur) {
          A.state = 'strike';
          A.tim = 0;
          A.dur = 0.22;
          A._hit = false;
        }
      } else if (A.state === 'strike') {
        if (!A._hit && A.tim > 0.06) {
          A._hit = true;
          strike(A._heavy ? 1.5 : 1);
          if (A._heavy) {
            J.FX.ring(f.pos.x, f.pos.y + 0.8, f.pos.z, 0xd0c0ff, 2.2);
            J.FX.shake(0.06, 0.12);
          }
        }
        if (A.tim >= A.dur) { A.state = 'recover'; A.tim = 0; A.dur = 0.34; }
      } else if (A.state === 'recover') {
        if (A.tim >= A.dur) { A.state = 'idle'; A.tim = 0; }
      } else {
        /* 接近并起手 */
        if (df > 2.25) {
          spd = df > 6 ? 6.4 : 4.9;
          faceTo = toF;
        } else {
          faceTo = toF;
          if (A.cd <= 0) {
            A.state = 'wind';
            A.tim = 0;
            A.dur = 0.30 + Math.random() * 0.12;
            A._heavy = (A.hits > 0 && (A.hits % 4 === 3));
            A.yaw = toF;
          }
        }
      }
    } else {
      /* 跟随 */
      var fx = P.pos.x - Math.sin(P.camYaw) * 0 , fz = 0;
      /* 站在主角右前方（镜头在身后，这样永远不会糊在镜头上） */
      var sideX = Math.cos(P.yaw) * 1.9, sideZ = -Math.sin(P.yaw) * 1.9;
      var backX = Math.sin(P.yaw) * 1.1, backZ = Math.cos(P.yaw) * 1.1;
      var tx = P.pos.x + backX + sideX;
      var tz = P.pos.z + backZ + sideZ;
      var dT = Math.hypot(tx - A.pos.x, tz - A.pos.z);
      if (dT > 1.2) {
        spd = dT > 7 ? 7.2 : Math.min(5.0, 1.8 + dT * 0.8);
        faceTo = Math.atan2(tx - A.pos.x, tz - A.pos.z);
      } else {
        faceTo = P.yaw;
      }
      A.state = dT > 1.2 ? 'run' : 'idle';
    }

    /* 朝向 */
    if (faceTo !== null) {
      A.yaw += J.U.ang(A.yaw, faceTo) * Math.min(1, dt * 9);
    }

    /* 位移 */
    if (spd > 0) {
      A.pos.x += Math.sin(A.yaw) * spd * dt;
      A.pos.z += Math.cos(A.yaw) * spd * dt;
    }
    /* 贴地 + 碰撞 */
    var gy = J.Terrain.heightAt(A.pos.x, A.pos.z);
    A.pos.y = J.U.damp(A.pos.y, gy, 18, dt);
    J.Col.resolve(A.pos, 0.44, 1.72, A.pos.y);
    /* 与玩家分离 */
    var dpp = Math.hypot(P.pos.x - A.pos.x, P.pos.z - A.pos.z);
    if (dpp < 0.85 && dpp > 0.001) {
      A.pos.x += (A.pos.x - P.pos.x) / dpp * (0.85 - dpp) * 0.6;
      A.pos.z += (A.pos.z - P.pos.z) / dpp * (0.85 - dpp) * 0.6;
    }

    /* 动作 */
    animate(dt, t, spd);
    M.root.position.copy(A.pos);
    M.spin.rotation.y = A.yaw;
    M.blob.position.y = 0.02;
    if (df2(A) < 46) M.root.visible = true;

    if (J.UI && J.UI.allyBar) J.UI.allyBar(A);
  };

  function df2(a) { return J.C ? Math.hypot(a.pos.x - J.C.position.x, a.pos.z - J.C.position.z) : 0; }

  /* ── 动画 ── */
  function animate(dt, t, spd) {
    var moving = spd > 0.2;
    A.walkPhase = (A.walkPhase || 0) + dt * (moving ? spd * 1.9 + 3 : 1.6);
    var sw = Math.sin(A.walkPhase);
    var amp = moving ? Math.min(0.72, 0.34 + spd * 0.05) : 0.05;

    var tgt = {
      legL: sw * amp, legR: -sw * amp,
      kneeL: Math.max(0, -sw) * 0.85 * (moving ? 1 : 0.2),
      kneeR: Math.max(0, sw) * 0.85 * (moving ? 1 : 0.2),
      arX: -0.2, arZ: -0.12, arEl: -0.3,
      alX: -0.2, alZ: 0.12, alEl: -0.3,
      torsoX: 0.02, torsoY: 0, torsoZ: sw * 0.04 * (moving ? 1 : 0),
      hipsY: 0.84 + (moving ? Math.abs(Math.sin(A.walkPhase)) * 0.04 : Math.sin(t * 1.5) * 0.008),
      wpnX: 0.55
    };

    var st = A.state;
    if (st === 'wind') {
      var w = Math.min(1, A.tim / (A.dur || 0.3));
      tgt.arX = -1.35 * w;
      tgt.arZ = -1.25 * w;
      tgt.arEl = -0.85 * w;
      tgt.torsoY = 0.62 * w;
      tgt.torsoX = -0.08 * w;
      tgt.wpnX = 1.0;
      tgt.legL = 0.18 * w; tgt.legR = -0.16 * w;
    } else if (st === 'strike') {
      var s2 = Math.min(1, A.tim / (A.dur || 0.2));
      var e = 1 - Math.pow(1 - s2, 3);
      tgt.arX = -1.35 + 2.1 * e;
      tgt.arZ = -1.25 + 2.5 * e;
      tgt.arEl = -0.85 + 1.0 * e;
      tgt.torsoY = 0.62 - 1.55 * e;
      tgt.torsoX = 0.24 * e;
      tgt.wpnX = 1.0 - 0.85 * e;
      tgt.legL = 0.18 - 0.3 * e; tgt.legR = -0.16 + 0.28 * e;
    } else if (st === 'hurt') {
      tgt.torsoX = -0.32;
      tgt.arX = 0.3; tgt.alX = 0.28;
    } else if (st === 'parry') {
      tgt.arX = -1.15; tgt.arZ = -0.4; tgt.arEl = -1.2;
      tgt.alX = -0.9; tgt.alZ = 0.5;
      tgt.torsoX = -0.1;
    } else if (st === 'idle' && !A.target) {
      /* 待机：呼吸、偶尔看向玩家 */
      tgt.hipsY = 0.84 + Math.sin(t * 1.6) * 0.009;
      tgt.arX = -0.2 + Math.sin(t * 1.6) * 0.02;
      tgt.headY = Math.sin(t * 0.5) * 0.12;
    }

    var k = st === 'strike' ? 30 : 15;
    function D(a, b) { return J.U.damp(a, b, k, dt); }
    M.legL.hip.rotation.x = D(M.legL.hip.rotation.x, tgt.legL);
    M.legR.hip.rotation.x = D(M.legR.hip.rotation.x, tgt.legR);
    M.legL.knee.rotation.x = D(M.legL.knee.rotation.x, tgt.kneeL);
    M.legR.knee.rotation.x = D(M.legR.knee.rotation.x, tgt.kneeR);
    M.armR.sh.rotation.x = D(M.armR.sh.rotation.x, tgt.arX);
    M.armR.sh.rotation.z = D(M.armR.sh.rotation.z, tgt.arZ);
    M.armR.el.rotation.x = D(M.armR.el.rotation.x, tgt.arEl);
    M.armL.sh.rotation.x = D(M.armL.sh.rotation.x, tgt.alX);
    M.armL.sh.rotation.z = D(M.armL.sh.rotation.z, tgt.alZ);
    M.armL.el.rotation.x = D(M.armL.el.rotation.x, tgt.alEl);
    M.torso.rotation.x = D(M.torso.rotation.x, tgt.torsoX);
    M.torso.rotation.y = D(M.torso.rotation.y, tgt.torsoY);
    M.torso.rotation.z = D(M.torso.rotation.z, tgt.torsoZ || 0);
    M.hips.position.y = D(M.hips.position.y, tgt.hipsY);
    M.weapon.rotation.x = D(M.weapon.rotation.x, tgt.wpnX);
    M.head.rotation.y = D(M.head.rotation.y, tgt.headY || 0);
    /* 长发摆动 */
    if (M.hairBack) {
      M.hairBack.rotation.x = D(M.hairBack.rotation.x, -Math.min(0.30, spd * 0.05) + Math.sin(t * 1.7) * 0.02);
      M.hairBack.rotation.z = Math.sin(t * 1.2) * 0.02;
    }
  }

  A.getPos = function () { return A.pos; };

  /* 供剧情调用：让她「露一手」 */
  A.showcase = function () {
    if (!A.active || !M) return;
    A.state = 'wind';
    A.tim = 0;
    A.dur = 0.28;
    A._heavy = true;
    A.target = pickTarget();
    J.FX.spark(A.pos.x, A.pos.y + 1.1, A.pos.z, 14, 0xd8c8ff, 1.2);
  };

  return A;
})();
