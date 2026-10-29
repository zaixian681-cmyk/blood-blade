/* ═══════════════════════════════════════════════
   game.js — 玩家 / 战斗 / 相机 / 主循环
   ═══════════════════════════════════════════════ */

/* ── 招式表 ── */
var MOVES = {
  l1: { dur: 0.44, h: [0.13, 0.25], dmg: 15, range: 3.0, arc: 1.25, kb: 1.1, lunge: 3.2, next: { atk: 'l2', heavy: 'h1' }, sw: 1 },
  l2: { dur: 0.40, h: [0.10, 0.21], dmg: 13, range: 3.0, arc: 1.25, kb: 0.9, lunge: 3.0, next: { atk: 'l3', heavy: 'lift' }, sw: -1 },
  l3: { dur: 0.50, h: [0.15, 0.28], dmg: 19, range: 3.2, arc: 1.35, kb: 1.4, lunge: 3.4, next: { atk: 'l4', heavy: 'h1' }, sw: 1 },
  l4: { dur: 0.66, h: [0.17, 0.31], dmg: 30, range: 3.4, arc: 1.5, kb: 2.6, lunge: 4.0, next: {}, sw: -1, finisher: true },
  h1: { dur: 0.72, h: [0.25, 0.39], dmg: 38, range: 3.3, arc: 1.1, kb: 2.8, lunge: 3.0, next: { atk: 'l3' }, sw: 1, heavy: true, guardBreak: true },
  lift: { dur: 0.58, h: [0.19, 0.31], dmg: 24, range: 3.1, arc: 0.95, kb: 1.0, lunge: 2.4, next: { atk: 'air' }, sw: 1, launch: true }
};

J.boot = function () {
  var bootEl = document.getElementById('boot');
  try {
    J.initRenderer();
    J.buildSky(0x6f8ba8, 0xb9b2a4, 0xc9b79c);
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
    pos: new THREE.Vector3(W.spawn.x, 0, W.spawn.z),
    yaw: W.spawn.yaw, vy: 0, onGround: true,
    hp: 240, maxHp: 240, stamina: 100, maxStamina: 100,
    state: 'idle', tim: 0, move: null, moveId: '', hitSet: [],
    camYaw: W.spawn.yaw + Math.PI, camPitch: 0.01, camDist: 3.9,
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

/* ═══════════ 攻击 ═══════════ */
J.startAttack = function (id) {
  var P = J.P, M = MOVES[id];
  if (!M) return;
  P.state = 'atk';
  P.tim = 0;
  P.move = M;
  P.moveId = id;
  P.hitSet = [];
  P.blocking = false;
  P.stamina = Math.max(0, P.stamina - (M.heavy ? 26 : 8));

  // 起手位移（向朝向/锁定方向冲刺）
  var dir = J.aimDir();
  P.dashDir.copy(dir).multiplyScalar(M.lunge);
  P.dashT = 0.11;
};

J.aimDir = function () {
  var P = J.P;
  // 锁定时朝目标
  if (P.target && !P.target.dead && !P.target.gone) {
    var dx = P.target.pos.x - P.pos.x, dz = P.target.pos.z - P.pos.z;
    var d = Math.hypot(dx, dz) || 1;
    return new THREE.Vector3(dx / d, 0, dz / d);
  }
  // 有移动输入时朝输入方向
  if (J.IN.mag > 0.15) {
    var mx = J.IN.mx, mz = J.IN.mz;
    var wy = Math.atan2(mx, mz) + P.camYaw;
    return new THREE.Vector3(Math.sin(wy), 0, Math.cos(wy));
  }
  return new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
};

J.doHitCheck = function () {
  var P = J.P, M = P.move;
  if (!M) return;
  var fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
  for (var i = 0; i < J.foes.length; i++) {
    var f = J.foes[i];
    if (f.dead || f.gone || P.hitSet.indexOf(f) >= 0) continue;
    var dx = f.pos.x - P.pos.x, dz = f.pos.z - P.pos.z;
    var d = Math.hypot(dx, dz);
    if (d > M.range + 0.35) continue;
    if (Math.abs(f.pos.y - P.pos.y) > 2.0) continue;
    var dot = (dx * fx + dz * fz) / (d || 1);
    if (dot < Math.cos(M.arc)) continue;

    /* 命中 */
    P.hitSet.push(f);
    var isHeavy = !!M.heavy;
    var crit = Math.random() < (M.finisher ? 0.30 : 0.14);
    var dmg = M.dmg * (crit ? 1.75 : 1) * (1 + Math.min(0.6, (J.comboCount || 0) * 0.035));
    dmg = Math.round(dmg);

    var res = f.hurt(dmg, P.pos, M.kb, isHeavy);
    var hp3 = new THREE.Vector3(f.pos.x, f.pos.y + 1.75, f.pos.z);
    if (res === 'block') {
      J.FX.dmgText(hp3, '格挡', 'block');
      J.FX.shake(0.07, 0.1);
      J.FX.hitstop(0.045);
    } else {
      J.FX.dmgText(hp3, (crit ? '暴击 ' : '') + dmg, crit ? 'crit' : (isHeavy ? 'heavy' : ''));
      J.FX.spark(f.pos.x, 1.25, f.pos.z, isHeavy ? 24 : 14, crit ? 0xffb060 : 0xffd9a0, isHeavy ? 1.8 : 1.1);
      J.FX.ring(f.pos.x, 1.15, f.pos.z, 0xffe0b0, isHeavy ? 3.0 : 1.8);
      J.FX.hitstop(isHeavy ? 0.085 : 0.045);
      J.FX.shake(isHeavy ? 0.20 : 0.085, isHeavy ? 0.26 : 0.14);
      J.comboCount = (J.comboCount || 0) + 1;
      J.comboTimer = 2.4;
      if (Math.random() < 0.35) J.FX.spark(f.pos.x, 0.35, f.pos.z, 8, 0xb0a080, 0.7);
    }
  }
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
        P.pos.set(J.World.spawn.x, 0, J.World.spawn.z);
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
    var wantAtk = J.pressed('atk');
    var wantHeavy = J.pressed('heavy');
    var wantDash = J.pressed('dash');
    var wantLock = J.pressed('lock');
    var guardHeld = !!IN.keys.KeyL || IN.guardHeld;

    /* 锁定切换 */
    if (wantLock) {
      P.target = J.pickTarget(P.target);
      if (!P.target) J.UI.toast('无 人 可 锁', 0.8);
    }
    /* 目标失效 */
    if (P.target && (P.target.dead || P.target.gone)) P.target = null;
    if (P.target && Math.hypot(P.target.pos.x - P.pos.x, P.target.pos.z - P.pos.z) > 30) P.target = null;

    /* ── 状态机 ── */
    P.tim += dt;
    if (P.state === 'hurt' && P.tim >= P.hurtT) { P.state = 'idle'; }

    if (P.state === 'atk') {
      var M = P.move;
      // 判定窗口
      if (M && P.tim >= M.h[0] && P.tim <= M.h[1]) J.doHitCheck();
      // 取消窗口接下一招
      var inCancel = M && P.tim >= M.h[1] * 0.85;
      if (wantAtk || wantHeavy) {
        if (inCancel) {
          var nxt = wantHeavy ? M.next.heavy : M.next.atk;
          if (nxt && MOVES[nxt]) J.startAttack(nxt);
          else if (P.tim >= M.dur) { P.state = 'idle'; }
        } else {
          P.buffered = wantHeavy ? 'heavy' : 'atk';
          P.bufferT = 0.28;
        }
      }
      // 闪避取消攻击后摇
      if (wantDash && P.tim > M.h[0] * 0.9 && P.stamina >= 18) { J.startDash(); }
      if (P.tim >= M.dur && P.state === 'atk') { P.state = 'idle'; P.move = null; }
    }
    else if (P.state === 'dash') {
      if (P.tim >= P.dashDur) { P.state = 'idle'; }
    }
    else if (P.state === 'hurt') {
      // 受击不可操作
    }
    else {
      /* idle / run */
      if (wantAtk && P.stamina >= 8) { J.startAttack('l1'); }
      else if (wantHeavy && P.stamina >= 26) { J.startAttack('h1'); }
      else if (wantDash && P.stamina >= 18) { J.startDash(); }
      else {
        // 格挡 / 招架
        if (IN.parryPress) { IN.parryPress = 0; P.parryWindow = 0.22; }
        P.blocking = guardHeld && P.stamina > 5;
        P.state = 'idle';
      }
    }

    /* 缓冲输入执行 */
    if (P.bufferT > 0) {
      P.bufferT -= dt;
      if (P.state === 'atk' && P.move) {
        var Mc = P.move;
        if (P.tim >= Mc.h[1] * 0.85) {
          var nx = P.buffered === 'heavy' ? Mc.next.heavy : Mc.next.atk;
          if (nx && MOVES[nx]) { J.startAttack(nx); P.buffered = null; P.bufferT = 0; }
        }
      } else if (P.state === 'idle') {
        if (P.buffered === 'atk') J.startAttack('l1');
        else if (P.buffered === 'heavy') J.startAttack('h1');
        P.buffered = null; P.bufferT = 0;
      }
    }

    /* 招架窗口衰减 */
    if (P.parryWindow > 0) P.parryWindow -= dt;
    if (P.invuln > 0) P.invuln -= dt;

    /* ── 移动 ── */
    var canMove = (P.state === 'idle' || P.state === 'run');
    var mspd = 0;
    if (canMove && IN.mag > 0.05) {
      var isRun = IN.mag > 0.86 && P.stamina > 8;
      mspd = isRun ? 7.4 : 4.3;
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

    /* 体力恢复 */
    if (P.state !== 'atk' && P.state !== 'dash') {
      P.stamina = Math.min(P.maxStamina, P.stamina + (P.blocking ? 9 : 26) * dt);
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
    var pr = M ? Math.min(1, P.tim / M.dur) : 0;
    var sw = M ? M.sw : 1;
    var ph = P.tim / (M ? M.h[1] : 0.3);   // 0..1 到判定结束
    var wind = Math.min(1, ph / 1.0);

    // 起手蓄力（0~0.55）→ 挥出（0.55~1）
    var windP = Math.min(1, ph / 0.55);
    var strikeP = Math.max(0, Math.min(1, (ph - 0.55) / 0.45));

    if (M && M.heavy) {
      tgt.arX = -0.2 - 2.3 * windP + 4.0 * strikeP;
      tgt.arZ = -0.3 * sw - 0.6 * windP * sw + 0.9 * strikeP * sw;
      tgt.arEl = -0.5 - 0.6 * windP + 1.1 * strikeP;
      tgt.alX = -1.0 * windP + 0.4 * strikeP;
      tgt.torsoY = (0.7 * windP - 1.5 * strikeP) * sw;
      tgt.torsoX = -0.18 * windP + 0.42 * strikeP;
      tgt.wpnRotX = 0.2 + 1.0 * windP - 0.7 * strikeP;
      tgt.squat = 0.06 * windP;
    } else if (M && M.launch) {
      tgt.arX = 0.6 * windP - 2.6 * strikeP;
      tgt.arZ = -0.5 * sw;
      tgt.arEl = -0.4;
      tgt.torsoX = 0.3 * windP - 0.55 * strikeP;
      tgt.torsoY = 0.5 * windP - 0.8 * strikeP;
      tgt.wpnRotX = 0.1 - 0.9 * strikeP;
      tgt.hipsY = 0.86 - 0.08 * windP + 0.10 * strikeP;
    } else {
      // 轻击：横斩
      tgt.arX = -0.3 - 1.15 * windP + 1.7 * strikeP;
      tgt.arZ = (-0.9 * windP + 1.5 * strikeP) * sw;
      tgt.arEl = -0.35 - 0.75 * windP + 0.85 * strikeP;
      tgt.alX = -0.25 - 0.7 * windP + 0.5 * strikeP;
      tgt.alZ = 0.25;
      tgt.torsoY = (-0.85 * windP + 1.35 * strikeP) * sw;
      tgt.torsoX = 0.05 + 0.12 * strikeP;
      tgt.wpnRotX = 0.35 - 0.25 * strikeP;
      tgt.wpnRotZ = 0.15 + 0.3 * windP;
      tgt.hipsRotY = (-0.3 * windP + 0.45 * strikeP) * sw;
      tgt.legL = sw * 0.15; tgt.legR = -sw * 0.15;
    }
    // 结束回正
    if (pr > 0.85) {
      var back = (pr - 0.85) / 0.15;
      tgt.arX = J.U.lerp(tgt.arX, -0.15, back);
      tgt.torsoY = J.U.lerp(tgt.torsoY, 0, back);
    }
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

/* ═══════════ 闪避 ═══════════ */
J.startDash = function () {
  var P = J.P;
  if (P.stamina < 18) return;
  P.stamina -= 18;
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

  P.camYaw -= IN.lx;
  P.camPitch = J.U.clamp(P.camPitch + IN.ly, -0.55, 0.95);
  IN.lx = 0; IN.ly = 0;

  // 锁定时相机跟向目标
  if (P.target && !P.target.dead && !P.target.gone) {
    var want = Math.atan2(P.target.pos.x - P.pos.x, P.target.pos.z - P.pos.z) + Math.PI;
    P.camYaw = P.camYaw + J.U.ang(P.camYaw, want) * Math.min(1, dt * 3.2);
  }

  var dist = P.camDist;
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
  P._camPos.x = J.U.damp(P._camPos.x, camPos.x, 18, dt);
  P._camPos.y = J.U.damp(P._camPos.y, camPos.y, 18, dt);
  P._camPos.z = J.U.damp(P._camPos.z, camPos.z, 18, dt);

  C.position.copy(P._camPos);
  var so = J.FX.shakeOffset();
  if (so) { C.position.x += so.x; C.position.y += so.y; C.position.z += so.z; }

  C.lookAt(focus.x, focus.y + 0.05, focus.z + 0.0);

  // FOV 随速度轻微变化
  var wantFov = 68 + Math.min(7, (P.animSpeed || 0) * 0.9);
  C.fov = J.U.damp(C.fov, wantFov, 4, dt);
  C.updateProjectionMatrix();
};

/* ═══════════ 主循环 ═══════════ */
J.startLoop = function () {
  var last = performance.now();
  var acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var raw = (now - last) / 1000;
    last = now;
    if (raw > 0.12) raw = 0.12;
    var dt = raw * (J.timeScale || 1);
    J.clock += dt;
    J.dt = dt;

    J.readKeys();
    try {
      J.updatePlayer(dt, J.clock);
      for (var i = 0; i < J.foes.length; i++) J.foes[i].update(dt, J.clock);
      J.FX.update(dt, J.clock);
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
