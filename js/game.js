/* ═══════════════════════════════════════════════
   game.js — 玩家 / 战斗 / 相机 / 主循环
   ═══════════════════════════════════════════════ */

/* ── 复用向量，避免每帧 new 造成 GC 卡顿 ── */
var _V1 = new THREE.Vector3(), _V2 = new THREE.Vector3();
var _V3 = new THREE.Vector3(), _V4 = new THREE.Vector3();
var _V5 = new THREE.Vector3(), _V6 = new THREE.Vector3();

J.boot = function () {
  var bootEl = document.getElementById('boot');
  try {
    J.Stage.init();
    J.initRenderer();
    J.buildSky(0x3f6278, 0x9db6c0, 0xd8c8a8);
    J.initLights();
    J.Col.reset();
    J.World.build();
    J.initInput();
    J.initPlayer();
    J.FX.init();
    J.spawnFoes();
    J.UI.init();
    J.startLoop();
    setTimeout(function () { bootEl.classList.add('gone'); }, 260);
  } catch (e) {
    if (bootEl) bootEl.querySelector('#bootS').textContent = '出错：' + e.message;
    var errEl = document.getElementById('err');
    errEl.style.display = 'block';
    errEl.textContent = 'BUILD ' + J.ver + ' 启动失败\n' + e.message + '\n' + (e.stack || '');
    console.error(e);
  }
};

/* ═══════════ 玩家 ═══════════ */
J.initPlayer = function () {
  var H = J.buildHero();
  J.S.add(H.root);
  /* 合并静态部件，降低 draw call */
  var meshBefore = 0;
  H.root.traverse(function (o) { if (o.isMesh) meshBefore++; });
  var meshAfter = J.optimizeHeroModel ? J.optimizeHeroModel(H.root) : meshBefore;
  H._meshBefore = meshBefore;
  H._meshAfter = meshAfter;

  var wp = J.Weapon.create();
  H.weaponHolder.add(wp.root);

  var W = J.World;
  var P = {
    model: H, weapon: wp,
    pos: new THREE.Vector3(W.spawn.x, J.Terrain.heightAt(W.spawn.x, W.spawn.z), W.spawn.z),
    yaw: W.spawn.yaw, vy: 0, onGround: true,
    hp: 240, maxHp: 240, stamina: 150, maxStamina: 150,
    qi: 70, maxQi: J.WINFO.maxQi, chargeT: 0, airJumps: 1, jumpCd: 0, jumpLatch: false,
    moveDmgMul: 1, heavyHeld: false,
    state: 'idle', tim: 0, move: null, moveId: '', hitSet: [],
    camYaw: W.spawn.yaw + Math.PI, camPitch: 0.07, camDist: 4.05,
    target: null, targetIdx: 0,
    blockT: 0, parryWindow: 0, blocking: false,
    invuln: 0, dashDir: new THREE.Vector3(),
    comboOpen: false, buffered: null, bufferT: 0,
    walkPhase: 0, speedMul: 1,
    hurtT: 0, dead: false, respawnT: 0,
    lastAtkEnd: 0
  };
  J.P = P;

  H.root.position.copy(P.pos);
  H.spin.rotation.y = P.yaw;

  /* 玩家受击接口 */
  P.takeHit = function (dmg, fromPos, isBoss) {
    if (P.invuln > 0 || P.dead) return;
    // 招架判定
    if (P.parryWindow > 0 && P.blocking) {
      P.parryWindow = 0;
      P.stamina = Math.min(P.maxStamina, P.stamina + 22);
      J.FX.spark(P.pos.x, 1.35, P.pos.z, 22, 0xfff0b0, 1.7);
      J.FX.ring(P.pos.x, 1.0, P.pos.z, 0xffe9a0, 2.6);
      J.FX.hitstop(0.13);
      J.FX.shake(0.16, 0.2);
      J.UI.toast('招 架', 0.9);
      // 反震敌人
      for (var i = 0; i < J.foes.length; i++) {
        var f = J.foes[i];
        if (f.dead || f.gone) continue;
        if (Math.hypot(f.pos.x - P.pos.x, f.pos.z - P.pos.z) < 4.2) {
          f.hurt(6, P.pos, 0.4, false);
          f.enter('stagger', 1.05);
        }
      }
      P.stamina = Math.max(0, P.stamina - 6);
      /* 弹反成功：自动接下反击（长刀·回身斩） */
      if (P.state !== 'air') J.Combat.start('p1', { force: true });
      return;
    }
    /* 霸体：出招判定期间不被打断（仍掉血），避免"挥刀一半被推开" */
    var inHyper = false;
    if (P.state === 'atk' && P.move && P.moveDur) {
      var prog = P.tim / P.moveDur;
      if (prog <= P.move.hit[1] + 0.08) inHyper = true;
    }
    if (inHyper) {
      P.hp -= dmg * 0.8;
      J.FX.dmgText(new THREE.Vector3(P.pos.x, 1.8, P.pos.z), '-' + Math.round(dmg * 0.8), '');
      J.FX.spark(P.pos.x, 1.3, P.pos.z, 8, 0xff7a5a, 0.9);
      J.FX.shake(0.07, 0.1);
      if (P.hp <= 0) J.playerDie();
      return;
    }

    if (P.blocking) {
      dmg *= 0.18;
      P.stamina -= dmg * 2.2 + 8;
      J.FX.spark(P.pos.x, 1.3, P.pos.z, 8, 0xbfd8ff, 1.0);
      J.FX.dmgText(new THREE.Vector3(P.pos.x, 1.7, P.pos.z), '挡', 'block');
      if (P.stamina <= 0) { P.stamina = 0; P.enterHurt(0.6); P.blocking = false; }
      else { J.FX.shake(0.05, 0.1); }
      P.hp -= dmg;
    } else {
      P.hp -= dmg;
      P.enterHurt(isBoss ? 0.55 : 0.32);
      J.FX.spark(P.pos.x, 1.3, P.pos.z, 16, 0xff6a4a, 1.3);
      J.FX.dmgText(new THREE.Vector3(P.pos.x, 1.75, P.pos.z), '-' + Math.round(dmg), '');
      J.FX.shake(0.18, 0.24);
      J.FX.hitstop(0.05);
    }
    if (P.hp <= 0) J.playerDie();
  };

  P.enterHurt = function (d) {
    if (P.dead) return;
    P.state = 'hurt'; P.tim = 0; P.hurtT = d;
    P.move = null; P.blocking = false;
  };

  return P;
};

J.playerDie = function () {
  var P = J.P;
  if (P.dead) return;
  P.dead = true; P.hp = 0; P.state = 'dead'; P.tim = 0;
  P.respawnT = 2.6;
  J.FX.shake(0.3, 0.5);
  J.UI.toast('倒 下 了', 2.2);
};

/* ═══════════ 刀光轨迹 ═══════════ */
J.updateSlash = function (dt) {
  var P = J.P;
  if (!J.Slash) return;
  var w = P.weapon && P.weapon.root;
  if (w) {
    var show = false, prog = 0;
    if (P.state === 'atk' && P.move && P.moveDur) {
      prog = P.tim / P.moveDur;
      show = prog > 0.06 && prog < 0.92;
    } else if (P.state === 'charge' || P.state === 'exec') {
      show = true;
    }
    if (show) {
      w.updateWorldMatrix(true, false);
      _V1.set(0.50, 1.28, 0).applyMatrix4(w.matrixWorld);     // tip
      _V2.set(0.22, 0.86, 0).applyMatrix4(w.matrixWorld);     // base
      _V3.copy(_V1).sub(_V2);                                  // 刀刃方向
      var dl = _V3.length() || 1;
      _V3.multiplyScalar(1 / dl);
      _V4.copy(_V2).addScaledVector(_V3, -0.22);               // 外晕 base
      _V5.copy(_V1).addScaledVector(_V3, 0.26);                // 外晕 tip
      J.Slash.push(_V2, _V1, _V4, _V5);
    }
  }
  J.Slash.update(dt, J.clock);
};

/* ═══════════ 攻击（交给 J.Combat） ═══════════ */
J.aimDir = function () {
  var P = J.P;

  /* 1. 手动锁定优先 */
  if (P.target && !P.target.dead && !P.target.gone) {
    var dx = P.target.pos.x - P.pos.x, dz = P.target.pos.z - P.pos.z;
    var d = Math.hypot(dx, dz) || 1;
    return new THREE.Vector3(dx / d, 0, dz / d);
  }

  /* 2. 有移动输入：先看输入方向附近有没有敌人，有就微调过去 */
  if (J.IN.mag > 0.25) {
    var mx = J.IN.mx, mz = J.IN.mz;
    var wy = Math.atan2(mx, mz) + P.camYaw;
    var inDir = new THREE.Vector3(Math.sin(wy), 0, Math.cos(wy));
    var near = J.nearestFoeInArc(P, 7.0, inDir, 1.05);
    if (near) {
      var ndx = near.pos.x - P.pos.x, ndz = near.pos.z - P.pos.z;
      var nl = Math.hypot(ndx, ndz) || 1;
      return new THREE.Vector3(ndx / nl, 0, ndz / nl);
    }
    return inDir;
  }

  /* 3. 静止：直接朝最近的敌人（不限角度，这是手机上的攻击辅助） */
  var t = J.nearestFoe(8.0);
  if (t) {
    var tx = t.pos.x - P.pos.x, tz = t.pos.z - P.pos.z;
    var tl = Math.hypot(tx, tz) || 1;
    return new THREE.Vector3(tx / tl, 0, tz / tl);
  }

  /* 4. 周围没人：沿当前朝向 */
  return new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
};

/* 最近的敌人（可限定距离） */
J.nearestFoe = function (maxD) {
  var P = J.P, best = null, bd = maxD === undefined ? 1e9 : maxD;
  for (var i = 0; i < J.foes.length; i++) {
    var f = J.foes[i];
    if (f.dead || f.gone || f.state === 'dead') continue;
    var d = Math.hypot(f.pos.x - P.pos.x, f.pos.z - P.pos.z);
    if (d < bd) { bd = d; best = f; }
  }
  return best;
};

/* 指定方向扇形内的最近敌人 */
J.nearestFoeInArc = function (P, maxD, dir, arcCos) {
  var best = null, bd = maxD;
  for (var i = 0; i < J.foes.length; i++) {
    var f = J.foes[i];
    if (f.dead || f.gone) continue;
    var dx = f.pos.x - P.pos.x, dz = f.pos.z - P.pos.z;
    var d = Math.hypot(dx, dz);
    if (d > bd || d < 0.01) continue;
    var dot = (dx * dir.x + dz * dir.z) / d;
    if (dot < arcCos) continue;
    bd = d; best = f;
  }
  return best;
};

/* ═══════════ 每帧更新玩家 ═══════════ */
J.updatePlayer = function (dt, t) {
  var P = J.P, H = P.model, IN = J.IN;

  /* 死亡与复活 */
  if (P.dead) {
    P.tim += dt;
    H.root.rotation.x = J.U.damp(H.root.rotation.x, -1.35, 5, dt);
    P.hp = 0;
    if (P.tim > 2.4) {
      P.respawnT -= dt;
      if (P.respawnT <= 0) {
        P.dead = false; P.hp = P.maxHp; P.stamina = P.maxStamina;
        P.pos.set(J.World.spawn.x, J.Terrain.heightAt(J.World.spawn.x, J.World.spawn.z), J.World.spawn.z);
        P.yaw = J.World.spawn.yaw; P.camYaw = P.yaw + Math.PI;
        P.state = 'idle'; P.tim = 0; P.target = null;
        H.root.rotation.x = 0;
        J.comboCount = 0;
        J.UI.toast('重 整 旗 鼓', 1.4);
      }
    }
  }

  if (!P.dead) {
    /* ── 输入读取 ── */
    var wantAtk = J.pressed('atk'); if (wantAtk) J.consume('atk');
    var wantHeavy = J.pressed('heavy'); if (wantHeavy) J.consume('heavy');
    var wantDash = J.pressed('dash'); if (wantDash) J.consume('dash');
    var wantLock = false;
    var guardHeld = !!IN.keys.KeyL || IN.guardHeld;

    /* 锁定切换 */
    if (wantLock) {
      P.target = J.pickTarget(P.target);
      if (!P.target) J.UI.toast('无 人 可 锁', 0.8);
    }
    /* 目标失效 */
    if (P.target && (P.target.dead || P.target.gone)) P.target = null;
    if (P.hitTarget && (P.hitTarget.dead || P.hitTarget.gone)) P.hitTarget = null;
    if (P.target && Math.hypot(P.target.pos.x - P.pos.x, P.target.pos.z - P.pos.z) > 30) P.target = null;

    /* ── 状态机 ── */
    P.tim += dt;
    if (P.state === 'hurt' && P.tim >= P.hurtT) { P.state = 'idle'; }

    /* ══ 状态机（长刀体系） ══ */
    var wantJump = J.pressed('jump'); if (wantJump) J.consume('jump');
    var wantSkill = false;
    var wantUlt = J.pressed('ult'); if (wantUlt) J.consume('ult');
    var heavyHeld = !!IN.heavyHeld;

    if (P.state === 'exec') {
      J.Combat.updateExecution(J.rawDt || dt);
      P.invuln = Math.max(P.invuln, 0.02);
    }
    else if (P.state === 'atk') {
      J.Combat.update(dt);

      /* 攻击中仍可闪避取消后摇（长刀后摇长，必须有这个出口） */
      var m0 = P.move;
      if (wantDash && m0 && P.tim / P.moveDur > 0.45 && P.stamina >= 12) {
        J.startDash();
      }
      /* 输入缓冲 */
      if (P.state === 'atk' && (wantAtk || wantHeavy || wantJump)) {
        P.buffered = wantAtk ? 'atk' : (wantHeavy ? 'heavy' : 'jump');
        P.bufferT = 0.30;
      }
    }
    else if (P.state === 'dash') {
      if (wantAtk && P.tim > 0.10) { J.Combat.start('d1', { force: true }); }
      else if (P.tim >= P.dashDur) { P.state = 'idle'; }
    }
    else if (P.state === 'charge') {
      J.updateCharge(dt, wantHeavy, dt);
    }
    else if (P.state === 'hurt') {
      /* 受击不可操作 */
    }
    else if (P.state === 'air') {
      /* 空中：只允许空中攻击 */
      if (wantAtk && P.stamina >= 8) J.Combat.start('ja1');
      else if (wantJump && P.airJumps > 0) { P.airJumps--; P.vy = 6.4; J.FX.spark(P.pos.x, P.pos.y + 0.4, P.pos.z, 8, 0xcfe0ff, 0.8); }
    }
    else {
      /* idle / run */
      /* 终结技 > 技能 > 蓄力 > 轻击 > 重击 */
      if (wantUlt) {
        /* 一个键，按优先级自动选：处决 > 终结 > 技能 */
        var victim = J.findBreakFoe();
        if (victim) { J.Combat.execution(victim); }
        else if (J.Combat.canFinisher()) { J.Combat.start('fin'); }
        else if (J.Combat.canSkill()) { J.Combat.start('skill'); }
        else if (P.stamina >= 9) { J.Combat.start('l1'); }
      } else if (wantHeavy) {
        J.startCharge();
      } else if (wantAtk) {
        J.Combat.start(J.hasBreakTarget() ? 'b1' : 'l1');
      } else if (wantDash && P.stamina >= 12) {
        J.startDash();
      } else if (wantJump && P.onGround && P.jumpCd <= 0 && !P.jumpLatch) {
        J.startJump();
      } else {
        if (IN.parryPress) { IN.parryPress = 0; P.parryWindow = 0.22; }
        P.blocking = guardHeld && P.stamina > 5;
        P.state = 'idle';
      }
    }

    /* 缓冲输入在 idle 时立即执行 */
    if (P.bufferT > 0 && P.state !== 'atk') {
      P.bufferT -= dt;
      if (P.bufferT <= 0) P.buffered = null;
    }

    /* 跳跃冷却与松手解锁 */
    if (P.jumpCd > 0) P.jumpCd -= dt;
    if (P.jumpLatch && !IN.held.jump) P.jumpLatch = false;

    /* 招架窗口衰减 */
    if (P.parryWindow > 0) P.parryWindow -= dt;
    if (P.invuln > 0) P.invuln -= dt;

    /* ── 移动 ── */
    var canMove = (P.state === 'idle' || P.state === 'run');
    var mspd = 0;
    if (canMove && IN.mag > 0.05) {
      var isRun = IN.mag > 0.86 && P.stamina > 8;
      mspd = isRun ? 7.4 : 4.3;
      var slp = J.Terrain.slopeAt(P.pos.x, P.pos.z);
      mspd *= (1 - Math.min(0.62, slp * 0.78));
      if (P.blocking) mspd *= 0.42;
      var wx = IN.mx, wz = IN.mz;
      var len = Math.hypot(wx, wz) || 1;
      wx /= len; wz /= len;
      var moveAng = Math.atan2(wx, wz) + P.camYaw;
      P.pos.x += Math.sin(moveAng) * mspd * dt * IN.mag;
      P.pos.z += Math.cos(moveAng) * mspd * dt * IN.mag;
      // 朝向
      if (!P.blocking) {
        P.yaw = P.yaw + J.U.ang(P.yaw, moveAng) * Math.min(1, dt * 12);
      }
      P.state = 'run';
      P.animSpeed = mspd;
    } else if (canMove) {
      P.state = 'idle';
      P.animSpeed = 0;
      // 待机时若锁定向目标转
      if (P.target && !P.target.dead) {
        var ta = Math.atan2(P.target.pos.x - P.pos.x, P.target.pos.z - P.pos.z);
        P.yaw = P.yaw + J.U.ang(P.yaw, ta) * Math.min(1, dt * 6);
      }
    }

    /* 攻击起手冲刺 */
    if (P.dashT > 0) {
      P.dashT -= dt;
      P.pos.x += P.dashDir.x * dt;
      P.pos.z += P.dashDir.z * dt;
    }

    /* 闪避位移 */
    if (P.state === 'dash') {
      var dp = 1 - P.tim / P.dashDur;
      var ds = P.dashSpeed * (0.4 + dp * 0.6);
      P.pos.x += P.dashDir.x * ds * dt;
      P.pos.z += P.dashDir.z * ds * dt;
      if (P.tim > 0.06 && P.tim < 0.30) P.invuln = Math.max(P.invuln, 0.02);
    }

    /* 再贴地一次（移动后） */
    var gy2 = J.Terrain.heightAt(P.pos.x, P.pos.z);
    if (P.pos.y < gy2) P.pos.y = gy2;

    /* 体力恢复 */
    if (P.state !== 'atk' && P.state !== 'dash' && P.state !== 'charge') {
      P.stamina = Math.min(P.maxStamina, P.stamina + (P.blocking ? 14 : 36) * dt);
    }
    /* 内力回复 */
    P.qi = Math.min(P.maxQi, P.qi + J.WINFO.qiRegen * dt);

    /* 地形贴地 / 跳跃重力（处决演出中由演出接管位置） */
    var gy = J.Terrain.heightAt(P.pos.x, P.pos.z);
    if (P.state === 'exec') { /* 跳过物理 */ }
    else if (P.pos.y > gy + 0.03 || P.vy > 0.01) {
      P.vy -= 27 * dt;
      P.pos.y += P.vy * dt;
      if (P.pos.y <= gy) {
        var impact = -P.vy;
        P.pos.y = gy; P.vy = 0;
        if (!P.onGround) {
          if (impact > 5) {
            J.FX.spark(P.pos.x, gy + 0.15, P.pos.z, 10, 0xd8d0c0, 0.9);
            J.FX.shake(0.05, 0.1);
          }
          if (P.state === 'air') { P.state = 'idle'; P.tim = 0; }
          P.airJumps = 1;
        }
        P.onGround = true;
      } else P.onGround = false;
    } else {
      P.pos.y = gy; P.vy = 0; P.onGround = true;
      if (P.state === 'air') { P.state = 'idle'; P.tim = 0; }
      P.airJumps = 1;
    }

    /* 碰撞 */
    J.Col.resolve(P.pos, 0.38, 1.7, P.pos.y);
    P.pos.x = J.U.clamp(P.pos.x, -W_LIM, W_LIM);
    P.pos.z = J.U.clamp(P.pos.z, -W_LIM, W_LIM);
  }

  /* ── 动画 ── */
  J.animatePlayer(dt, t);

  /* ── 同步模型 ── */
  H.root.position.copy(P.pos);
  H.spin.rotation.y = P.yaw;
  P.weapon.update(dt, t, P.state === 'atk' ? 1.5 : 1.0);
};
var W_LIM = 140;

/* ═══════════ 缓动曲线 ═══════════ */
var E = {
  lin: function (t) { return t; },
  inQ: function (t) { return t * t; },
  inQ3: function (t) { return t * t * t; },
  outQ: function (t) { return 1 - (1 - t) * (1 - t); },
  outExpo: function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -11 * t); },
  inOut: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
  inExpo: function (t) { return t <= 0 ? 0 : Math.pow(t, 3.4); }
};

/* ═══════════ 基础站姿 ═══════════ */
var POSE_IDLE = {
  arX: -0.18, arZ: -0.12, arEl: -0.28,
  alX: -0.18, alZ: 0.12, alEl: -0.28,
  torsoX: 0.02, torsoY: 0, torsoZ: 0,
  headX: 0, headY: 0,
  legL: 0, legR: 0, kneeL: 0, kneeR: 0,
  hipsY: 0.86, hipsRotY: 0, squat: 0,
  wpnRotX: 0.57, wpnRotZ: 0, wpnRotY: 0
};

/* ═══════════ 招式关键姿态：预备(wind) / 挥出(strike) ═══════════ */
var POSE = {
  bigSlash: {
    wind: { arX: -0.62, arZ: -2.05, arEl: -1.05, alX: -1.25, alZ: 0.85,
      torsoY: -1.30, torsoX: -0.12, hipsRotY: -0.55, wpnRotX: 1.05,
      legL: 0.22, legR: -0.26, kneeL: 0.18, kneeR: 0.34, hipsY: 0.80 },
    strike: { arX: 0.42, arZ: 1.32, arEl: 0.28, alX: 0.55, alZ: 0.30,
      torsoY: 2.05, torsoX: 0.36, hipsRotY: 0.90, wpnRotX: 0.62,
      legL: -0.18, legR: 0.22, kneeL: 0.10, kneeR: 0.16, hipsY: 0.86 }
  },
  bigSlashR: {
    wind: { arX: -0.55, arZ: 1.15, arEl: -1.15, alX: -1.05, alZ: 0.55,
      torsoY: 1.25, torsoX: -0.10, hipsRotY: 0.52, wpnRotX: 0.95,
      legL: -0.22, legR: 0.24, kneeL: 0.30, kneeR: 0.16, hipsY: 0.80 },
    strike: { arX: 0.38, arZ: -2.15, arEl: 0.22, alX: 0.35, alZ: 0.45,
      torsoY: -2.10, torsoX: 0.32, hipsRotY: -0.92, wpnRotX: 0.55,
      legL: 0.24, legR: -0.20, kneeL: 0.14, kneeR: 0.12, hipsY: 0.86 }
  },
  spinWide: {
    wind: { arX: -0.42, arZ: -1.70, arEl: -0.62, alX: -0.85, alZ: 1.05,
      torsoY: -0.75, torsoX: 0.05, hipsRotY: -0.42, wpnRotX: 0.90,
      legL: 0.18, legR: -0.18, kneeL: 0.22, kneeR: 0.20, hipsY: 0.83 },
    strike: { arX: 0.10, arZ: 1.55, arEl: 0.05, alX: 0.30, alZ: 0.95,
      torsoY: 4.60, torsoX: 0.20, hipsRotY: 3.60, wpnRotX: 0.80,
      legL: -0.30, legR: 0.30, kneeL: 0.16, kneeR: 0.16, hipsY: 0.855 }
  },
  overhead: {
    wind: { arX: -2.85, arZ: -0.30, arEl: -1.10, alX: -2.55, alZ: 0.20,
      torsoX: -0.34, torsoY: 0.10, headX: -0.16, wpnRotX: 1.75,
      legL: 0.10, legR: -0.10, kneeL: 0.24, kneeR: 0.28, hipsY: 0.80 },
    strike: { arX: 1.05, arZ: 0.05, arEl: 0.10, alX: 0.75, alZ: 0.12,
      torsoX: 0.68, torsoY: 0, headX: 0.26, wpnRotX: -0.20,
      legL: 0.16, legR: -0.14, kneeL: 0.30, kneeR: 0.34, hipsY: 0.78 }
  },
  chargeSlash: {
    wind: { arX: -1.05, arZ: -2.35, arEl: -1.35, alX: -1.95, alZ: 1.05,
      torsoY: -1.55, torsoX: -0.24, hipsRotY: -0.62, wpnRotX: 1.45,
      legL: 0.24, legR: -0.28, kneeL: 0.34, kneeR: 0.38, hipsY: 0.74 },
    strike: { arX: 0.52, arZ: 1.55, arEl: 0.30, alX: 0.70, alZ: 0.35,
      torsoY: 2.40, torsoX: 0.44, hipsRotY: 1.10, wpnRotX: 0.50,
      legL: -0.26, legR: 0.30, kneeL: 0.12, kneeR: 0.18, hipsY: 0.84 }
  },
  launch: {
    wind: { arX: 0.85, arZ: -0.35, arEl: -0.42, alX: 0.55, alZ: 0.35,
      torsoX: 0.42, torsoY: -0.15, wpnRotX: -0.35,
      legL: 0.20, legR: -0.20, kneeL: 0.55, kneeR: 0.50, hipsY: 0.72 },
    strike: { arX: -3.10, arZ: -0.30, arEl: 0.10, alX: -1.55, alZ: 0.35,
      torsoX: -0.62, torsoY: 0.10, wpnRotX: 0.10,
      legL: 0.05, legR: -0.05, kneeL: 0.16, kneeR: 0.16, hipsY: 0.90 }
  },
  airSlash: {
    wind: { arX: -1.25, arZ: -1.45, arEl: -1.05, alX: -0.95, alZ: 0.65,
      torsoY: -0.95, torsoX: 0.08, wpnRotX: 1.05,
      legL: 0.70, legR: -0.35, kneeL: 1.00, kneeR: 0.25, hipsY: 0.86 },
    strike: { arX: 0.35, arZ: 1.15, arEl: 0.20, alX: 0.20, alZ: 0.55,
      torsoY: 1.55, torsoX: 0.22, wpnRotX: 0.55,
      legL: 0.35, legR: -0.30, kneeL: 0.75, kneeR: 0.30, hipsY: 0.86 }
  },
  plunge: {
    wind: { arX: -2.85, arZ: -0.10, arEl: -1.10, alX: -2.35, alZ: 0.18,
      torsoX: -0.36, torsoY: 0, headX: -0.18, wpnRotX: 1.65,
      legL: 0.45, legR: -0.55, kneeL: 0.85, kneeR: 0.30, hipsY: 0.86 },
    strike: { arX: 1.15, arZ: 0.02, arEl: 0.15, alX: 0.90, alZ: 0.10,
      torsoX: 0.78, torsoY: 0, headX: 0.30, wpnRotX: -0.30,
      legL: 0.30, legR: -0.20, kneeL: 0.55, kneeR: 0.45, hipsY: 0.80 }
  },
  finisherBlade: {
    wind: { arX: -1.15, arZ: -2.55, arEl: -1.45, alX: -2.15, alZ: 1.15,
      torsoY: -1.75, torsoX: -0.30, hipsRotY: -0.78, wpnRotX: 1.60,
      legL: 0.28, legR: -0.32, kneeL: 0.38, kneeR: 0.42, hipsY: 0.70 },
    strike: { arX: 0.62, arZ: 1.75, arEl: 0.35, alX: 0.85, alZ: 0.40,
      torsoY: 2.75, torsoX: 0.50, hipsRotY: 1.30, wpnRotX: 0.45,
      legL: -0.32, legR: 0.36, kneeL: 0.14, kneeR: 0.20, hipsY: 0.82 }
  }
};

/* 采样式挥砍：预备 → 发力 → 收势 三段缓动 */
function sampleSwing(animName, prog, hit0, hit1) {
  var P0 = POSE_IDLE;
  var PA = POSE[animName] || POSE.bigSlash;
  var PW = PA.wind, PS = PA.strike;

  /* 预备：缓慢举刀（缓入） */
  var w = E.inOut(Math.min(1, prog / Math.max(0.02, hit0)));
  /* 发力：极快甩出（指数出） */
  var sStart = hit0;
  var sEnd = Math.min(1, hit1 + 0.05);
  var s = E.outExpo(Math.min(1, Math.max(0, (prog - sStart) / Math.max(0.02, sEnd - sStart))));
  /* 收势：回到站姿（缓入缓出） */
  var rStart = Math.min(1, hit1 + 0.12);
  var r = E.inOut(Math.min(1, Math.max(0, (prog - rStart) / Math.max(0.05, 1 - rStart))));

  var out = {};
  for (var k in PS) {
    var a = P0[k] !== undefined ? P0[k] : 0;
    var bv = PW[k] !== undefined ? PW[k] : a;
    var cv = PS[k];
    var v = a + (bv - a) * w;
    v = v + (cv - v) * s;
    v = v + (a - v) * r;
    out[k] = v;
  }
  return out;
}

/* ═══════════ 玩家动画 ═══════════ */
J.animatePlayer = function (dt, t) {
  var P = J.P, H = P.model;
  var A = H.armR, B2 = H.armL, L = H.legR, R = H.legL;
  var st = P.state;
  var runSpd = P.animSpeed || 0;
  var moving = runSpd > 0.2;
  P.walkPhase += dt * (moving ? runSpd * 1.75 : 1.35);
  var sw = Math.sin(P.walkPhase), sw2 = Math.sin(P.walkPhase + Math.PI);

  var tgt = {};
  for (var k in POSE_IDLE) tgt[k] = POSE_IDLE[k];

  if (st === 'run') {
    var amp = Math.min(1.0, runSpd / 7.0);
    tgt.legL = sw * 0.78 * amp;
    tgt.legR = sw2 * 0.78 * amp;
    tgt.kneeL = Math.max(0, -sw) * 0.95 * amp;
    tgt.kneeR = Math.max(0, -sw2) * 0.95 * amp;
    tgt.arX = -0.18 - sw * 0.62 * amp;
    tgt.alX = -0.18 - sw2 * 0.62 * amp;
    tgt.arEl = -0.34 - amp * 0.25;
    tgt.alEl = -0.34 - amp * 0.25;
    tgt.torsoX = 0.06 + amp * 0.16;
    tgt.torsoZ = sw * 0.06 * amp;          // 跑步时躯干左右摆
    tgt.torsoY = sw2 * 0.10 * amp;
    tgt.hipsY = 0.86 + Math.abs(Math.sin(P.walkPhase)) * 0.055 * amp;
    tgt.hipsRotY = -sw * 0.16 * amp;
    tgt.headY = sw2 * 0.08 * amp;

  } else if (st === 'idle') {
    /* 呼吸 + 重心微移，避免"木桩" */
    var br = Math.sin(t * 1.55);
    var sway = Math.sin(t * 0.62);
    tgt.hipsY = 0.86 + br * 0.010;
    tgt.torsoX = 0.02 + br * 0.014;
    tgt.torsoZ = sway * 0.018;
    tgt.arX = -0.18 + br * 0.025;
    tgt.alX = -0.18 - br * 0.025;
    tgt.arZ = -0.12 + sway * 0.02;
    tgt.alZ = 0.12 - sway * 0.02;
    tgt.headY = Math.sin(t * 0.45) * 0.10;
    tgt.headX = Math.sin(t * 0.33) * 0.03;
    tgt.kneeL = 0.04 + br * 0.012;
    tgt.kneeR = 0.04 - br * 0.012;
    if (P.blocking) {
      tgt.arX = -1.15; tgt.arZ = -0.35; tgt.arEl = -1.25;
      tgt.alX = -1.05; tgt.alZ = 0.55; tgt.alEl = -1.15;
      tgt.torsoX = -0.10; tgt.headX = 0.06;
      tgt.wpnRotX = 0.15;
    }

  } else if (st === 'atk') {
    var M = P.move;
    var prog = M ? Math.min(1, P.tim / P.moveDur) : 0;
    var hit0 = M ? M.hit[0] : 0.2, hit1 = M ? M.hit[1] : 0.35;
    var pose = sampleSwing(M ? M.anim : 'bigSlash', prog, hit0, hit1);
    for (var k2 in pose) tgt[k2] = pose[k2];

  } else if (st === 'charge') {
    var cq = Math.min(1, (P.chargeT || 0) / 0.85);
    var sh2 = Math.sin(t * 30) * 0.010 * cq;
    tgt.arX = -0.6 - 2.15 * cq + sh2;
    tgt.arZ = -0.25 - 0.40 * cq;
    tgt.arEl = -0.5 - 0.55 * cq;
    tgt.alX = -0.45 - 1.85 * cq;
    tgt.alZ = 0.30 + 0.22 * cq;
    tgt.torsoX = -0.40 * cq;
    tgt.headX = -0.18 * cq;
    tgt.hipsY = 0.86 - 0.16 * cq;
    tgt.kneeL = 0.46 * cq; tgt.kneeR = 0.50 * cq;
    tgt.legL = 0.22 * cq; tgt.legR = -0.26 * cq;
    tgt.wpnRotX = 0.55 + 1.15 * cq;

  } else if (st === 'air') {
    var rising = P.vy > 0;
    tgt.arX = -0.55; tgt.arZ = -0.30;
    tgt.alX = -0.50; tgt.alZ = 0.35;
    tgt.legL = rising ? 0.62 : 0.22;
    tgt.legR = rising ? -0.48 : -0.12;
    tgt.kneeL = rising ? 1.05 : 0.48;
    tgt.kneeR = rising ? 0.58 : 0.26;
    tgt.torsoX = rising ? -0.14 : 0.16;
    tgt.wpnRotX = 0.45;

  } else if (st === 'dash') {
    var dp = P.tim / P.dashDur;
    var sp2 = Math.sin(dp * Math.PI);
    tgt.hipsY = 0.86 - sp2 * 0.24;
    tgt.torsoX = 0.58 * sp2;
    tgt.torsoZ = 0.22 * sp2;
    tgt.arX = -0.55; tgt.alX = -0.85;
    tgt.arEl = -1.05; tgt.alEl = -1.05;
    tgt.legL = 0.95 * sp2; tgt.legR = -0.55 * sp2;
    tgt.kneeL = 1.15 * sp2;

  } else if (st === 'hurt') {
    var hp2 = 1 - P.tim / Math.max(0.01, P.hurtT);
    tgt.torsoX = -0.38 * hp2;
    tgt.arX = 0.38 * hp2; tgt.alX = 0.38 * hp2;
    tgt.headX = -0.22 * hp2;
    tgt.hipsY = 0.86 - 0.05 * hp2;

  } else if (st === 'exec') {
    var et2 = P.execT || 0;
    if (et2 < 0.12) {
      var k1 = et2 / 0.12;
      var e1 = E.outQ(k1);
      tgt.arX = -0.45 - 2.35 * e1;
      tgt.arZ = -0.15 - 0.22 * e1;
      tgt.arEl = -0.5 - 0.55 * e1;
      tgt.alX = -0.40 - 1.95 * e1;
      tgt.alZ = 0.20 + 0.1 * e1;
      tgt.torsoX = -0.32 * e1; tgt.torsoY = -0.28 * e1;
      tgt.headX = -0.14 * e1;
      tgt.hipsY = 0.86 - 0.10 * e1;
      tgt.kneeL = 0.34 * e1; tgt.kneeR = 0.38 * e1;
      tgt.wpnRotX = 0.55 + 1.25 * e1;
    } else if (et2 < 0.21) {
      var k2 = (et2 - 0.12) / 0.09;
      var e2 = E.outExpo(k2);
      tgt.arX = -2.80 + 3.90 * e2;
      tgt.arZ = -0.37 + 0.55 * e2;
      tgt.arEl = -1.05 + 1.30 * e2;
      tgt.alX = -2.35 + 3.05 * e2;
      tgt.alZ = 0.30;
      tgt.torsoX = -0.32 + 0.92 * e2;
      tgt.torsoY = -0.28 + 0.62 * e2;
      tgt.headX = -0.14 + 0.32 * e2;
      tgt.hipsY = 0.76 - 0.06 * e2;
      tgt.kneeL = 0.34 + 0.34 * e2; tgt.kneeR = 0.38 + 0.30 * e2;
      tgt.wpnRotX = 1.80 - 1.95 * e2;
    } else {
      var k3 = Math.min(1, (et2 - 0.21) / 0.28);
      var e3 = E.inOut(k3);
      tgt.arX = J.U.lerp(1.10, -0.18, e3);
      tgt.arZ = J.U.lerp(0.18, -0.12, e3);
      tgt.arEl = J.U.lerp(0.25, -0.28, e3);
      tgt.alX = J.U.lerp(0.70, -0.18, e3);
      tgt.torsoX = J.U.lerp(0.60, 0.02, e3);
      tgt.torsoY = J.U.lerp(0.34, 0, e3);
      tgt.hipsY = J.U.lerp(0.70, 0.86, e3);
      tgt.kneeL = J.U.lerp(0.68, 0.04, e3);
      tgt.kneeR = J.U.lerp(0.68, 0.04, e3);
      tgt.wpnRotX = J.U.lerp(-0.15, 0.57, e3);
    }

  } else if (st === 'dead') {
    tgt.hipsY = 0.42;
    tgt.torsoX = 0.5;
  }

  /* 应用：攻击/冲刺用更快的阻尼（几乎直接跟随曲线），待机柔和 */
  var k = (st === 'atk' || st === 'dash' || st === 'exec') ? 34 : 18;
  function D(a, b) { return J.U.damp(a, b, k, dt); }

  A.sh.rotation.x = D(A.sh.rotation.x, tgt.arX);
  A.sh.rotation.z = D(A.sh.rotation.z, tgt.arZ);
  A.el.rotation.x = D(A.el.rotation.x, tgt.arEl);
  B2.sh.rotation.x = D(B2.sh.rotation.x, tgt.alX);
  B2.sh.rotation.z = D(B2.sh.rotation.z, tgt.alZ);
  B2.el.rotation.x = D(B2.el.rotation.x, tgt.alEl);

  H.torso.rotation.x = D(H.torso.rotation.x, tgt.torsoX);
  H.torso.rotation.y = D(H.torso.rotation.y, tgt.torsoY);
  H.torso.rotation.z = D(H.torso.rotation.z, tgt.torsoZ);
  H.head.rotation.x = D(H.head.rotation.x, tgt.headX);
  H.head.rotation.y = D(H.head.rotation.y, tgt.headY);
  H.hips.position.y = D(H.hips.position.y, tgt.hipsY);
  H.hips.rotation.y = D(H.hips.rotation.y, tgt.hipsRotY);

  R.hip.rotation.x = D(R.hip.rotation.x, tgt.legR);
  L.hip.rotation.x = D(L.hip.rotation.x, tgt.legL);
  R.knee.rotation.x = D(R.knee.rotation.x, tgt.kneeR);
  L.knee.rotation.x = D(L.knee.rotation.x, tgt.kneeL);

  var wh = H.weaponHolder;
  wh.rotation.x = D(wh.rotation.x, tgt.wpnRotX + 0.35);
  wh.rotation.z = D(wh.rotation.z, (tgt.wpnRotZ || 0) + 0.20);
  wh.rotation.y = D(wh.rotation.y, tgt.wpnRotY || 0);

  /* 裙摆 */
  if (H.skirtPanels) {
    var windAmp = Math.min(0.22, runSpd * 0.026) + (st === 'dash' ? 0.26 : 0);
    for (var sp3 = 0; sp3 < H.skirtPanels.length; sp3++) {
      var pn = H.skirtPanels[sp3];
      var wave = Math.sin(t * 2.4 + pn.ph + pn.a * 1.6);
      pn.m.rotation.x = wave * 0.030 + windAmp * 0.42;
      pn.m.rotation.z = wave * 0.018;
    }
  }
  /* 长发 */
  if (H.longHair) {
    for (var lh = 0; lh < H.longHair.length; lh++) {
      var st2 = H.longHair[lh];
      var u2 = lh / (H.longHair.length - 1);
      st2.rotation.x = 0.06 + Math.abs(u2 - 0.5) * 0.10 + Math.sin(t * 1.9 + lh * 0.5) * 0.028 + Math.min(0.30, runSpd * 0.042);
      st2.rotation.z = (u2 - 0.5) * 0.24 + Math.sin(t * 1.3 + lh * 0.8) * 0.018;
    }
  }
  /* 流苏与眼纱 */
  for (var j = 0; j < H.tassels.length; j++) {
    H.tassels[j].rotation.x = Math.sin(t * 2.4 + j) * 0.10 + Math.min(0.35, runSpd * 0.05);
    H.tassels[j].rotation.z = Math.sin(t * 1.8 + j * 2) * 0.06;
  }
  if (H.veilTails) {
    H.veilTails[0].rotation.x = Math.sin(t * 2.1) * 0.12 + Math.min(0.4, runSpd * 0.05);
    H.veilTails[1].rotation.x = Math.sin(t * 2.1 + 1.5) * 0.12 + Math.min(0.4, runSpd * 0.05);
  }
  for (var s2 = 0; s2 < H.sashes.length; s2++) {
    H.sashes[s2].rotation.x = Math.sin(t * 1.6 + s2 * 1.2) * 0.10 - Math.min(0.5, runSpd * 0.06);
  }
};

/* ═══════════ 蓄力重击 ═══════════ */
J.startCharge = function () {
  var P = J.P;
  if (P.stamina < J.MOVES.c1.stamina * 0.5) { return; }
  P.state = 'charge';
  P.tim = 0;
  P.chargeT = 0;
  P.blocking = false;
  P.move = null;
  P.moveId = '';
  J.UI.chargeStart();
};

J.updateCharge = function (dt, held) {
  var P = J.P;
  P.chargeT += dt;
  var ratio = Math.min(1, P.chargeT / 0.80);
  J.UI.chargeRatio(ratio);
  /* 蓄力时若被打断/移动则取消 */
  if (P.state !== 'charge') return;

  if (!held) {
    if (P.chargeT < 0.28) {
      J.Combat.start('h1');            // 短按 = 普通重劈
    } else {
      J.Combat.start('c1', { dmgMul: 0.78 + ratio * 0.55 });
      J.FX.shake(0.12 + ratio * 0.1, 0.24);
    }
    J.UI.chargeEnd();
    return;
  }
  if (P.chargeT > 1.6) {              // 蓄满自动放
    J.Combat.start('c1', { dmgMul: 1.33 });
    J.FX.shake(0.22, 0.28);
    J.UI.chargeEnd();
  }
};

/* ═══════════ 跳跃 ═══════════ */
J.startJump = function () {
  var P = J.P;
  P.state = 'air';
  P.tim = 0;
  P.jumpCd = 0.26;              // 冷却：防止按住/重复事件导致连跳
  P.jumpLatch = true;           // 锁：必须松手才能再次起跳
  P.vy = 7.6;
  P.onGround = false;
  P.airJumps = 1;
  P.blocking = false;
  J.FX.spark(P.pos.x, P.pos.y + 0.1, P.pos.z, 6, 0xd8e0f0, 0.6);
};

/* ═══════════ 闪避 ═══════════ */
J.startDash = function () {
  var P = J.P;
  if (P.stamina < 12) return;
  P.stamina -= 12;
  P.state = 'dash'; P.tim = 0; P.dashDur = 0.36;
  var d = J.aimDir();
  // 有输入朝向输入，否则向后退
  if (P.target && !P.target.dead && J.IN.mag < 0.15) {
    d.multiplyScalar(-1);
  } else if (J.IN.mag < 0.15) {
    d = new THREE.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
  }
  P.dashDir.copy(d);
  P.dashSpeed = 13;
  P.blocking = false;
  P.move = null;
  P.invuln = 0.30;
  var dirAng = Math.atan2(d.x, d.z);
  P.yaw = dirAng;
};

/* 取最近的破防敌人（用于处决） */
J.findBreakFoe = function () {
  var P = J.P, best = null, bd = 4.6;
  for (var i = 0; i < J.foes.length; i++) {
    var f = J.foes[i];
    if (f.dead || f.gone || f.state !== 'break') continue;
    var d = Math.hypot(f.pos.x - P.pos.x, f.pos.z - P.pos.z);
    if (d < bd) { bd = d; best = f; }
  }
  return best;
};

/* 附近是否有被破防的敌人（用于自动追击） */
J.hasBreakTarget = function () {
  var P = J.P;
  for (var i = 0; i < J.foes.length; i++) {
    var f = J.foes[i];
    if (f.dead || f.gone || f.state !== 'break') continue;
    if (Math.hypot(f.pos.x - P.pos.x, f.pos.z - P.pos.z) < 4.2) return true;
  }
  return false;
};

/* ═══════════ 锁定 ═══════════ */
J.pickTarget = function (cur) {
  var P = J.P, best = null, bestD = 1e9;
  for (var i = 0; i < J.foes.length; i++) {
    var f = J.foes[i];
    if (f.dead || f.gone) continue;
    var d = Math.hypot(f.pos.x - P.pos.x, f.pos.z - P.pos.z);
    if (d > 16) continue;
    // 相机视线方向偏好
    var ang = Math.atan2(f.pos.x - P.pos.x, f.pos.z - P.pos.z);
    var face = Math.abs(J.U.ang(P.camYaw + Math.PI, ang));
    var score = d * (1 + face * 0.6);
    if (cur && f !== cur && score > bestD) continue;
    if (score < bestD) { bestD = score; best = f; }
  }
  // 若当前已锁定且有其他目标，切换到下一个
  if (cur && best === cur) {
    var next = null, nd = 1e9;
    for (var j = 0; j < J.foes.length; j++) {
      var g = J.foes[j];
      if (g === cur || g.dead || g.gone) continue;
      var dd = Math.hypot(g.pos.x - P.pos.x, g.pos.z - P.pos.z);
      if (dd > 16 || dd >= nd) continue;
      nd = dd; next = g;
    }
    if (next) return next;
  }
  return best;
};

/* ═══════════ 相机 ═══════════ */
J.updateCamera = function (dt) {
  var P = J.P, C = J.C, IN = J.IN;

  /* ── 处决特写镜头 ── */
  if (P.state === 'exec' && P.execTarget) {
    var f = P.execTarget, et = P.execT;
    var push = Math.min(1, et / 0.10);
    var ang = P.execFace + 1.52;                 // 侧后方 87°
    var dist = 3.0 - push * 0.75;
    var tx = f.pos.x + Math.sin(ang) * dist;
    var tz = f.pos.z + Math.cos(ang) * dist;
    var ty = f.pos.y + 1.25 + push * 0.12;

    if (!P._execCam) P._execCam = new THREE.Vector3(tx, ty, tz);
    var sm = 1 - Math.exp(-7 * Math.max(0.016, J.rawDt || 0.016));
    P._execCam.x += (tx - P._execCam.x) * sm;
    P._execCam.y += (ty - P._execCam.y) * sm;
    P._execCam.z += (tz - P._execCam.z) * sm;

    C.position.copy(P._execCam);
    C.lookAt(f.pos.x, f.pos.y + 1.05, f.pos.z);
    C.fov = J.U.damp(C.fov, 52, 6, dt || 0.016);
    C.updateProjectionMatrix();
    IN.lx = 0; IN.ly = 0;
    return;
  }
  if (P._execCam) P._execCam = null;

  P.camYaw -= IN.lx;
  P.camPitch = J.U.clamp(P.camPitch + IN.ly, -0.55, 0.95);
  IN.lx = 0; IN.ly = 0;

  // 锁定时相机跟向目标
  if (P.target && !P.target.dead && !P.target.gone) {
    var want = Math.atan2(P.target.pos.x - P.pos.x, P.target.pos.z - P.pos.z) + Math.PI;
    P.camYaw = P.camYaw + J.U.ang(P.camYaw, want) * Math.min(1, dt * 5.5);
  }

  var dist = P.camDist;
  if (P.state === 'atk') dist -= 0.22;      // 出刀时镜头微推，增强冲击
  if (P.state === 'charge') dist += 0.35;   // 蓄力时拉开一点看全身
  var focus = _V6.set(P.pos.x, P.pos.y + 1.10, P.pos.z);
  // 越肩：视角焦点向右偏，人物落在画面左三分之一
  var rx = Math.cos(P.camYaw), rz = -Math.sin(P.camYaw);
  focus.x += rx * 0.40; focus.z += rz * 0.40;

  var cp = Math.cos(P.camPitch), sp = Math.sin(P.camPitch);
  var dirx = Math.sin(P.camYaw) * cp;
  var diry = sp + 0.055;
  var dirz = Math.cos(P.camYaw) * cp;
  var dl = Math.hypot(dirx, diry, dirz) || 1;
  dirx /= dl; diry /= dl; dirz /= dl;

  // 防穿墙
  var hitD = J.Col.rayDist(focus.x, focus.y, focus.z, dirx, diry, dirz, dist + 0.4);
  if (hitD < dist) dist = Math.max(0.9, hitD - 0.25);

  var camPos = _V1.set(
    focus.x + dirx * dist,
    focus.y + diry * dist,
    focus.z + dirz * dist
  );
  if (camPos.y < 0.45) camPos.y = 0.45;

  // 平滑
  if (!P._camPos) P._camPos = camPos.clone();
  P._camPos.x = J.U.damp(P._camPos.x, camPos.x, 26, dt);
  P._camPos.y = J.U.damp(P._camPos.y, camPos.y, 26, dt);
  P._camPos.z = J.U.damp(P._camPos.z, camPos.z, 26, dt);

  C.position.copy(P._camPos);
  var so = J.FX.shakeOffset();
  if (so) { C.position.x += so.x; C.position.y += so.y; C.position.z += so.z; }

  C.lookAt(focus.x, focus.y + 0.05, focus.z + 0.0);

  // FOV 随速度轻微变化
  var wantFov = 60 + Math.min(6, (P.animSpeed || 0) * 0.8);
  C.fov = J.U.damp(C.fov, wantFov, 4, dt);
  C.updateProjectionMatrix();
};

/* ═══════════ 主循环 ═══════════ */
J.startLoop = function () {
  var last = performance.now();
  /* 帧率自适应：连续掉帧就降像素比 */
  var slowFrames = 0, quality = 2;
  var acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var raw = (now - last) / 1000;
    last = now;
    if (raw > 0.12) raw = 0.12;
    var dt = raw * (J.timeScale || 1);
    J.rawDt = raw;
    J.clock += dt;
    J.dt = dt;

    J.readKeys();
    try {
      J.updatePlayer(dt, J.clock);
      for (var i = 0; i < J.foes.length; i++) J.foes[i].update(dt, J.clock);
      J.FX.update(dt, J.clock);
      J.updateSlash(dt);
      J.World.update(dt, J.clock, J.P.pos);
      J.updateCamera(raw);
      J.UI.update(raw);
      J.updateSun(J.P.pos.x, J.P.pos.z);
      J.sky.position.copy(J.C.position);
    } catch (e) {
      if (!J._loopErr) {
        J._loopErr = true;
        var el = document.getElementById('err');
        el.style.display = 'block';
        el.textContent = 'BUILD ' + J.ver + ' 运行错误\n' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n');
        console.error(e);
      }
    }
    J.R.render(J.S, J.C);

    /* 性能自适应 */
    if (raw > 0.028) slowFrames++; else if (slowFrames > 0) slowFrames -= 0.5;
    if (slowFrames > 50 && quality > 0) {
      quality--;
      slowFrames = 0;
      var cap = quality === 0 ? 1.0 : 1.25;
      J.R.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
      if (quality === 0 && J.R.shadowMap.enabled) {
        J.R.shadowMap.enabled = false;
        J.S.traverse(function (o) { if (o.isMesh) o.material && (o.material.needsUpdate = true); });
      }
    }

    // 清空按键脉冲
    var pr = J.IN._press;
    pr.atk = 0; pr.heavy = 0; pr.dash = 0; pr.lock = 0;
  }
  requestAnimationFrame(frame);
};

/* 启动 */
window.addEventListener('load', function () {
  setTimeout(J.boot, 30);
});
