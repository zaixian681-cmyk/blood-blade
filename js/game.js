/* ═══════════════════════════════════════════════
   game.js — 玩家 / 战斗 / 相机 / 主循环
   ═══════════════════════════════════════════════ */

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
      var tip = new THREE.Vector3(0.55, 1.42, 0).applyMatrix4(w.matrixWorld);
      var base = new THREE.Vector3(0.24, 0.96, 0).applyMatrix4(w.matrixWorld);
      /* 外晕：沿刀刃方向两端各外扩，形成更宽更淡的第二层 */
      var dirv = tip.clone().sub(base);
      var dl = dirv.length() || 1;
      dirv.multiplyScalar(1 / dl);
      var baseO = base.clone().addScaledVector(dirv, -0.22);
      var tipO = tip.clone().addScaledVector(dirv, 0.26);
      J.Slash.push(base, tip, baseO, tipO);
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

/* ═══════════ 玩家动画 ═══════════ */
J.animatePlayer = function (dt, t) {
  var P = J.P, H = P.model;
  var A = H.armR, B2 = H.armL, L = H.legR, R = H.legL;

  var st = P.state;
  var runSpd = P.animSpeed || 0;
  var moving = runSpd > 0.2;
  P.walkPhase += dt * (moving ? runSpd * 1.55 : 1.5);

  /* 默认姿态目标值 */
  var tgt = {
    arX: -0.15, arZ: -0.10, arEl: -0.25,
    alX: -0.15, alZ: 0.10, alEl: -0.25,
    torsoX: 0.02, torsoY: 0, torsoZ: 0,
    headX: 0, headY: 0,
    legL: 0, legR: 0, kneeL: 0, kneeR: 0,
    hipsY: 0.86, hipsRotY: 0, squat: 0,
    wpnRotX: 1.72, wpnRotZ: 0.15, wpnRotY: 0
  };

  var swing = Math.sin(P.walkPhase);
  var swing2 = Math.sin(P.walkPhase + Math.PI);

  if (st === 'run') {
    var amp = Math.min(1.0, runSpd / 7.0);
    tgt.legL = swing * 0.72 * amp;
    tgt.legR = swing2 * 0.72 * amp;
    tgt.kneeL = Math.max(0, -swing) * 0.85 * amp;
    tgt.kneeR = Math.max(0, -swing2) * 0.85 * amp;
    tgt.arX = -0.15 - swing * 0.55 * amp;
    tgt.alX = -0.15 - swing2 * 0.55 * amp;
    tgt.torsoX = 0.10 + amp * 0.12;
    tgt.torsoZ = swing * 0.05 * amp;
    tgt.hipsY = 0.86 + Math.abs(Math.sin(P.walkPhase)) * 0.045 * amp;
  } else if (st === 'idle') {
    var br = Math.sin(t * 1.7);
    tgt.hipsY = 0.86 + br * 0.008;
    tgt.torsoX = 0.02 + br * 0.01;
    tgt.arX = -0.18 + br * 0.02;
    tgt.alX = -0.18 - br * 0.02;
    tgt.headY = Math.sin(t * 0.7) * 0.06;
    if (P.blocking) {
      tgt.arX = -1.15; tgt.arZ = -0.35; tgt.arEl = -1.25;
      tgt.alX = -1.05; tgt.alZ = 0.55; tgt.alEl = -1.15;
      tgt.torsoX = -0.10; tgt.headX = 0.06;
      tgt.wpnRotX = 1.25; tgt.wpnRotZ = 0.0;
    }
  } else if (st === 'atk') {
    var M = P.move;
    var pr = M ? Math.min(1, P.tim / P.moveDur) : 0;
    var ph = M ? Math.min(1, (P.tim / P.moveDur) / Math.max(0.001, M.hit[1])) : 0;
    /* 蓄势 0~0.58，发力 0.58~1 */
    var windP = Math.min(1, ph / 0.58);
    var strikeP = Math.max(0, Math.min(1, (ph - 0.58) / 0.42));
    var anim = M ? M.anim : 'bigSlash';

    function lerpP(a0, b0) { return a0 + (b0 - a0) * strikeP; }

    if (anim === 'bigSlash') {
      /* 大刀横斩：自右后向左前 */
      tgt.arX = -0.45 - 0.55 * windP + 0.75 * strikeP;
      tgt.arZ = -0.30 - 1.55 * windP + 2.75 * strikeP;
      tgt.arEl = -0.55 - 0.45 * windP + 0.75 * strikeP;
      tgt.alX = -1.15 * windP + 0.85 * strikeP;
      tgt.alZ = 0.55 + 0.30 * windP;
      tgt.torsoY = -1.05 * windP + 1.95 * strikeP;
      tgt.torsoX = -0.10 * windP + 0.34 * strikeP;
      tgt.hipsRotY = -0.45 * windP + 0.80 * strikeP;
      tgt.wpnRotX = 1.35 + 0.45 * windP - 0.30 * strikeP;
      tgt.squat = 0.05 * windP;
      tgt.legL = 0.20 * windP; tgt.legR = -0.24 * windP;
      tgt.kneeL = 0.15; tgt.kneeR = 0.28 * windP;
    } else if (anim === 'bigSlashR') {
      /* 反手回斩：自左前向右后 */
      tgt.arX = -0.45 - 0.35 * windP + 0.65 * strikeP;
      tgt.arZ = 0.85 * windP - 2.55 * strikeP;
      tgt.arEl = -0.45 - 0.55 * windP + 0.70 * strikeP;
      tgt.alX = -0.55 - 0.75 * windP + 0.65 * strikeP;
      tgt.alZ = 0.30;
      tgt.torsoY = 0.95 * windP - 1.95 * strikeP;
      tgt.torsoX = -0.06 * windP + 0.28 * strikeP;
      tgt.hipsRotY = 0.42 * windP - 0.78 * strikeP;
      tgt.wpnRotX = 1.20 - 0.25 * windP;
      tgt.legL = -0.18 * windP; tgt.legR = 0.22 * windP;
    } else if (anim === 'spinWide') {
      /* 回旋斩：躯干抡一整圈 */
      var spin = strikeP < 0.05 ? 0 : Math.min(1, strikeP / 0.75);
      tgt.torsoY = -0.55 * windP + spin * 4.2;
      tgt.hipsRotY = -0.30 * windP + spin * 3.4;
      tgt.arX = -0.30 - 0.30 * windP;
      tgt.arZ = -1.30 * (1 - spin) + 1.10 * spin;
      tgt.arEl = -0.30;
      tgt.alX = -0.55 * windP;
      tgt.alZ = 0.85;
      tgt.torsoX = 0.10 + 0.10 * strikeP;
      tgt.wpnRotX = 1.45 - 0.10 * strikeP;
      tgt.squat = 0.06 * windP;
    } else if (anim === 'overhead') {
      /* 竖劈：举过头顶再劈下 */
      tgt.arX = -0.6 - 2.35 * windP + 3.55 * strikeP;
      tgt.arZ = -0.10 - 0.25 * windP;
      tgt.arEl = -0.60 - 0.55 * windP + 0.95 * strikeP;
      tgt.alX = -0.4 - 2.05 * windP + 3.10 * strikeP;
      tgt.alZ = 0.18;
      tgt.torsoX = -0.32 * windP + 0.62 * strikeP;
      tgt.torsoY = 0.08 * windP - 0.10 * strikeP;
      tgt.headX = -0.12 * windP + 0.20 * strikeP;
      tgt.wpnRotX = 1.05 + 1.15 * windP - 1.55 * strikeP;
      tgt.squat = 0.10 * windP - 0.04 * strikeP;
      tgt.kneeL = 0.22 * windP; tgt.kneeR = 0.26 * windP;
    } else if (anim === 'chargeSlash') {
      /* 蓄力斩：长时间蓄势，然后一记全范围横扫 */
      var cw2 = Math.min(1, ph / 0.62);
      tgt.arX = -0.5 - 0.7 * cw2 + 0.9 * strikeP;
      tgt.arZ = -0.4 - 2.0 * cw2 + 3.2 * strikeP;
      tgt.arEl = -0.5 - 0.9 * cw2 + 1.0 * strikeP;
      tgt.alX = -1.5 * cw2 + 1.0 * strikeP;
      tgt.alZ = 0.75 + 0.4 * cw2;
      tgt.torsoY = -1.35 * cw2 + 2.6 * strikeP;
      tgt.torsoX = -0.22 * cw2 + 0.45 * strikeP;
      tgt.hipsRotY = -0.55 * cw2 + 1.05 * strikeP;
      tgt.wpnRotX = 1.55 + 0.55 * cw2 - 0.35 * strikeP;
      tgt.squat = 0.16 * cw2 - 0.05 * strikeP;
      tgt.kneeL = 0.30 * cw2; tgt.kneeR = 0.34 * cw2;
      tgt.legL = 0.18 * cw2; tgt.legR = -0.20 * cw2;
    } else if (anim === 'launch') {
      /* 挑斩：自下而上 */
      tgt.arX = 0.85 * windP - 3.10 * strikeP;
      tgt.arZ = -0.35 - 0.35 * windP;
      tgt.arEl = -0.25 - 0.35 * windP + 0.35 * strikeP;
      tgt.alX = 0.55 * windP - 1.55 * strikeP;
      tgt.alZ = 0.35;
      tgt.torsoX = 0.42 * windP - 0.68 * strikeP;
      tgt.wpnRotX = -0.35 + 0.35 * windP;
      tgt.hipsY = 0.86 - 0.14 * windP + 0.14 * strikeP;
      tgt.kneeL = 0.55 * windP; tgt.kneeR = 0.50 * windP;
    } else if (anim === 'airSlash') {
      /* 空中斩 */
      tgt.arX = -0.35 - 1.05 * windP + 1.55 * strikeP;
      tgt.arZ = -1.25 * windP + 2.25 * strikeP;
      tgt.arEl = -0.35 - 0.55 * windP + 0.65 * strikeP;
      tgt.alX = -0.9 - 0.6 * windP;
      tgt.alZ = 0.62;
      tgt.torsoY = -0.85 * windP + 1.55 * strikeP;
      tgt.torsoX = 0.10 + 0.15 * strikeP;
      tgt.legL = 0.75; tgt.legR = -0.35; tgt.kneeL = 1.05;
      tgt.wpnRotX = 1.55;
      tgt.hipsY = 0.86;
    } else if (anim === 'plunge') {
      /* 下劈：空中收刀再砸下 */
      tgt.arX = -0.6 - 2.3 * windP + 3.6 * strikeP;
      tgt.arZ = -0.05;
      tgt.arEl = -0.5 - 0.6 * windP + 1.0 * strikeP;
      tgt.alX = -0.5 - 1.9 * windP + 2.9 * strikeP;
      tgt.torsoX = -0.35 * windP + 0.75 * strikeP;
      tgt.legL = 0.45; tgt.legR = -0.55; tgt.kneeL = 0.85;
      tgt.wpnRotX = 1.0 + 1.3 * windP - 1.7 * strikeP;
      tgt.hipsY = 0.86;
    } else if (anim === 'finisherBlade') {
      /* 终结：超大幅蓄势 + 一记贯穿 */
      var fw = Math.min(1, ph / 0.66);
      tgt.arX = -0.5 - 1.0 * fw + 1.4 * strikeP;
      tgt.arZ = -0.3 - 2.35 * fw + 3.9 * strikeP;
      tgt.arEl = -0.45 - 1.0 * fw + 1.15 * strikeP;
      tgt.alX = -1.7 * fw + 1.3 * strikeP;
      tgt.alZ = 0.85 + 0.45 * fw;
      tgt.torsoY = -1.6 * fw + 3.1 * strikeP;
      tgt.torsoX = -0.28 * fw + 0.52 * strikeP;
      tgt.hipsRotY = -0.7 * fw + 1.3 * strikeP;
      tgt.wpnRotX = 1.6 + 0.7 * fw - 0.5 * strikeP;
      tgt.squat = 0.20 * fw - 0.08 * strikeP;
      tgt.kneeL = 0.36 * fw; tgt.kneeR = 0.40 * fw;
      tgt.legL = 0.26 * fw; tgt.legR = -0.30 * fw;
      tgt.headX = -0.15 * fw;
    } else {
      tgt.arX = -0.3 - 1.0 * windP + 1.5 * strikeP;
      tgt.arZ = -0.9 * windP + 1.5 * strikeP;
      tgt.torsoY = -0.7 * windP + 1.2 * strikeP;
    }

    /* 收招回正 */
    if (pr > 0.86) {
      var back2 = (pr - 0.86) / 0.14;
      tgt.arX = J.U.lerp(tgt.arX, -0.2, back2);
      tgt.arZ = J.U.lerp(tgt.arZ, -0.12, back2);
      tgt.torsoY = J.U.lerp(tgt.torsoY, 0, back2);
      tgt.hipsRotY = J.U.lerp(tgt.hipsRotY, 0, back2);
    }
  } else if (st === 'exec') {
    var et2 = P.execT || 0;
    if (et2 < 0.16) {
      /* 举刀过顶蓄势 */
      var k1 = Math.min(1, et2 / 0.16);
      tgt.arX = -0.45 - 2.35 * k1;
      tgt.arZ = -0.15 - 0.22 * k1;
      tgt.arEl = -0.5 - 0.55 * k1;
      tgt.alX = -0.40 - 1.95 * k1;
      tgt.alZ = 0.20 + 0.1 * k1;
      tgt.torsoX = -0.32 * k1;
      tgt.torsoY = -0.28 * k1;
      tgt.headX = -0.14 * k1;
      tgt.squat = 0.14 * k1;
      tgt.kneeL = 0.34 * k1; tgt.kneeR = 0.38 * k1;
      tgt.wpnRotX = 1.1 + 1.3 * k1;
      tgt.hipsY = 0.86 - 0.10 * k1;
    } else if (et2 < 0.29) {
      /* 一刀劈下 */
      var k2 = Math.min(1, (et2 - 0.16) / 0.13);
      var ease2 = k2 * k2 * (3 - 2 * k2);
      tgt.arX = -2.80 + 3.75 * ease2;
      tgt.arZ = -0.37 + 0.55 * ease2;
      tgt.arEl = -1.05 + 1.30 * ease2;
      tgt.alX = -2.35 + 2.95 * ease2;
      tgt.alZ = 0.30;
      tgt.torsoX = -0.32 + 0.86 * ease2;
      tgt.torsoY = -0.28 + 0.62 * ease2;
      tgt.headX = -0.14 + 0.30 * ease2;
      tgt.squat = 0.14 + 0.10 * ease2;
      tgt.kneeL = 0.34 + 0.30 * ease2;
      tgt.kneeR = 0.38 + 0.26 * ease2;
      tgt.wpnRotX = 2.40 - 2.10 * ease2;
      tgt.hipsY = 0.86 - 0.10 - 0.06 * ease2;
    } else {
      /* 收刀站定 */
      var k3 = Math.min(1, (et2 - 0.29) / 0.34);
      tgt.arX = J.U.lerp(0.95, -0.18, k3);
      tgt.arZ = J.U.lerp(0.18, -0.12, k3);
      tgt.arEl = J.U.lerp(0.25, -0.25, k3);
      tgt.alX = J.U.lerp(0.60, -0.18, k3);
      tgt.alZ = 0.12;
      tgt.torsoX = J.U.lerp(0.54, 0.02, k3);
      tgt.torsoY = J.U.lerp(0.34, 0.0, k3);
      tgt.squat = J.U.lerp(0.24, 0.0, k3);
      tgt.kneeL = J.U.lerp(0.64, 0.0, k3);
      tgt.kneeR = J.U.lerp(0.64, 0.0, k3);
      tgt.wpnRotX = J.U.lerp(0.30, 1.72, k3);
      tgt.hipsY = 0.86 - 0.16 + 0.16 * k3;
    }
  } else if (st === 'charge') {
    /* 蓄力：双手举刀过顶，身体下沉后仰 */
    var cq = Math.min(1, (P.chargeT || 0) / 0.85);
    var shake2 = Math.sin(t * 34) * 0.012 * cq;
    tgt.arX = -0.7 - 2.1 * cq + shake2;
    tgt.arZ = -0.25 - 0.35 * cq;
    tgt.arEl = -0.55 - 0.5 * cq;
    tgt.alX = -0.5 - 1.75 * cq;
    tgt.alZ = 0.30 + 0.2 * cq;
    tgt.torsoX = -0.36 * cq;
    tgt.headX = -0.18 * cq;
    tgt.squat = 0.20 * cq;
    tgt.kneeL = 0.42 * cq; tgt.kneeR = 0.46 * cq;
    tgt.legL = 0.20 * cq; tgt.legR = -0.24 * cq;
    tgt.wpnRotX = 1.05 + 1.35 * cq;
    tgt.hipsY = 0.86 - 0.14 * cq;
  } else if (st === 'air') {
    var rising = P.vy > 0;
    tgt.arX = -0.5; tgt.arZ = -0.3;
    tgt.alX = -0.5; tgt.alZ = 0.35;
    tgt.legL = rising ? 0.55 : 0.2;
    tgt.legR = rising ? -0.45 : -0.1;
    tgt.kneeL = rising ? 1.0 : 0.45;
    tgt.kneeR = rising ? 0.55 : 0.25;
    tgt.torsoX = rising ? -0.12 : 0.14;
    tgt.wpnRotX = 1.45;
    } else if (st === 'dash') {
    var dp = P.tim / P.dashDur;
    tgt.squat = Math.sin(dp * Math.PI) * 0.22;
    tgt.torsoX = 0.55 * Math.sin(dp * Math.PI);
    tgt.hipsY = 0.86 - tgt.squat;
    tgt.arX = -0.6; tgt.alX = -0.8; tgt.arEl = -1.0; tgt.alEl = -1.0;
    tgt.legL = 0.9 * Math.sin(dp * Math.PI); tgt.legR = -0.5 * Math.sin(dp * Math.PI);
    tgt.kneeL = 1.1 * Math.sin(dp * Math.PI);
    tgt.torsoZ = 0.25 * Math.sin(dp * Math.PI);
  } else if (st === 'hurt') {
    var hp2 = 1 - P.tim / P.hurtT;
    tgt.torsoX = -0.35 * hp2;
    tgt.arX = 0.35 * hp2; tgt.alX = 0.35 * hp2;
    tgt.headX = -0.2 * hp2;
  } else if (st === 'dead') {
    tgt.hipsY = 0.4;
    tgt.torsoX = 0.5;
  }

  /* 阻尼混合 */
  var k = 16;
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

  /* 武器握姿 */
  var wh = H.weaponHolder;
  wh.rotation.x = D(wh.rotation.x, tgt.wpnRotX + 0.35);
  wh.rotation.z = D(wh.rotation.z, tgt.wpnRotZ + 0.20);
  wh.rotation.y = D(wh.rotation.y, tgt.wpnRotY);

  /* 裙摆飘动：每片独立摆动 */
  if (H.skirtPanels) {
    var windAmp = Math.min(0.22, runSpd * 0.026) + (st === 'dash' ? 0.26 : 0);
    for (var sp2 = 0; sp2 < H.skirtPanels.length; sp2++) {
      var pn = H.skirtPanels[sp2];
      var wave = Math.sin(t * 2.4 + pn.ph + pn.a * 1.6);
      pn.m.rotation.x = wave * 0.030 + windAmp * 0.42;
      pn.m.rotation.z = wave * 0.018;
    }
  }
  /* 白尾摆动 */
  for (var i = 0; i < H.tailSegs.length; i++) {
    var seg = H.tailSegs[i];
    seg.rotation.y = Math.sin(t * 1.9 - i * 0.55) * (0.10 + i * 0.02);
    seg.rotation.x = Math.sin(t * 1.5 - i * 0.5) * 0.05 + (i >= 4 ? 0.14 : 0);
  }
  /* 长发飘动 */
  if (H.longHair) {
    for (var lh = 0; lh < H.longHair.length; lh++) {
      var st2 = H.longHair[lh];
      st2.rotation.x = 0.05 + Math.sin(t * 1.8 + lh * 0.6) * 0.03 + Math.min(0.32, runSpd * 0.045);
      st2.rotation.z = (lh - 3) * 0.035 + Math.sin(t * 1.3 + lh * 0.9) * 0.02;
    }
  }

  /* 流苏 & 眼纱飘 */
  for (var j = 0; j < H.tassels.length; j++) {
    H.tassels[j].rotation.x = Math.sin(t * 2.4 + j) * 0.10 + Math.min(0.35, runSpd * 0.05);
    H.tassels[j].rotation.z = Math.sin(t * 1.8 + j * 2) * 0.06;
  }
  if (H.veilTails) {
    H.veilTails[0].rotation.x = Math.sin(t * 2.1) * 0.12 + Math.min(0.4, runSpd * 0.05);
    H.veilTails[1].rotation.x = Math.sin(t * 2.1 + 1.5) * 0.12 + Math.min(0.4, runSpd * 0.05);
  }
  /* 披帛 */
  for (var s = 0; s < H.sashes.length; s++) {
    H.sashes[s].rotation.x = Math.sin(t * 1.6 + s * 1.2) * 0.10 - Math.min(0.5, runSpd * 0.06);
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
    var push = Math.min(1, et / 0.13);
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
  var focus = new THREE.Vector3(P.pos.x, P.pos.y + 1.10, P.pos.z);
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

  var camPos = new THREE.Vector3(
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
