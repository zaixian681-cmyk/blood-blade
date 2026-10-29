/* ═══════════════════════════════════════════════
   combat.js — 长刀战斗状态机
   连招衔接 / 蓄力 / 多段判定 / 破防 / 弹反 / 终结技
   ═══════════════════════════════════════════════ */
J.Combat = (function () {
  var _dmgV = new THREE.Vector3();

  var C = {
    /* 起手：进入攻击 */
    start: function (id, opt) {
      var P = J.P, m = J.MOVES[id];
      if (!m) return false;
      opt = opt || {};
      var W = J.WINFO;

      if (P.qi < (m.qi || 0)) return false;
      if (P.stamina < (m.stamina || 0) && !opt.force) return false;
      /* 刀魂消耗（太玄·一刀） */
      if (m.soulCost && (!J.Soul || J.Soul.v < m.soulCost)) return false;

      P.state = 'atk';
      P.tim = 0;
      P.moveId = id;
      P.move = m;
      P.moveDur = m.dur / W.spd;
      P.moveDmgMul = opt.dmgMul || 1;
      P.hitSet = [];
      P.hitSeg = -1;
      P.blocking = false;
      P.charging = false;
      P.bufferT = 0;
      P.buffered = null;

      P.stamina = Math.max(0, P.stamina - (m.stamina || 0));
      if (m.qi) P.qi = Math.max(0, P.qi - m.qi);
      if (m.soulCost && J.Soul) J.Soul.spend(m.soulCost);

      /* 新一段刀光 */
      if (J.Slash) {
        J.Slash.begin();
        var heavyMove = (m.type === 'heavy' || m.type === 'charge' || m.type === 'skill' || m.type === 'finisher');
        J.Slash.setColor(heavyMove ? 0xfff0d0 : 0xf2f8ff, heavyMove ? 0xffc46a : 0x86c8ff);
      }

      /* 起手：先转向，再吸附冲脸 */
      var dir = J.aimDir();
      P.yaw = Math.atan2(dir.x, dir.z);          // ★ 关键修复：动作真的朝目标挥

      var tgt = P.target && !P.target.dead && !P.target.gone ? P.target : J.nearestFoe(8.5);
      P.hitTarget = tgt || null;   // 本次出招锁定的目标
      if (tgt && !m.air) {
        var tdx = tgt.pos.x - P.pos.x, tdz = tgt.pos.z - P.pos.z;
        var td = Math.hypot(tdx, tdz);
        var desired = 1.35;                       // 贴身，让刀真的砍到人身上
        var travel = Math.max(0, Math.min(td - desired, 6.5));
        var dur = 0.11;
        P.dashDir.copy(dir).multiplyScalar(travel / dur);
        P.dashT = dur;
      } else {
        P.dashDir.copy(dir).multiplyScalar(m.lunge || 0);
        P.dashT = m.air ? 0.06 : 0.12;
      }

      /* 招式名飘一下（重击以上） */
      if (m.type === 'heavy' || m.type === 'charge' || m.type === 'skill' || m.type === 'finisher') {
        J.UI.moveName(m.name);
      }
      if (m.type === 'finisher') {
        J.FX.shake(0.12, 0.35);
        J.FX.ring(P.pos.x, P.pos.y + 1.0, P.pos.z, 0xffd8a0, 4.5);
        P.invuln = Math.max(P.invuln, 0.30);
      }
      if (m.type === 'skill') {
        J.FX.ring(P.pos.x, P.pos.y + 0.9, P.pos.z, 0x9fd0ff, 3.6);
        J.FX.shake(0.08, 0.2);
      }
      if (id === 'soulMove') {
        /* 太玄 · 一刀：全身刀魂炸开 */
        J.slowMo = 0.42;
        setTimeout(function () { J.slowMo = 1; }, 900);
        J.Cine && J.Cine.flash(0xffe8f0, 0.5, 0.5);
        J.FX.shake(0.24, 0.5);
        J.FX.ring(P.pos.x, P.pos.y + 0.9, P.pos.z, 0xffb8d8, 7.5);
        J.FX.ring(P.pos.x, P.pos.y + 1.4, P.pos.z, 0xb090ff, 5.0);
        J.FX.spark(P.pos.x, P.pos.y + 1.2, P.pos.z, 48, 0xffc8e8, 3.0);
        J.UI.flashText('太 玄 · 一 刀');
        P.invuln = Math.max(P.invuln, 1.2);
      }
      return true;
    },

    /* 当前招式的历史记录（用于按段判定） */
    _segOf: function (P, prog, m) {
      var hits = m.hits || 1;
      if (hits <= 1) return 0;
      var a = m.hit[0], b = m.hit[1];
      var seg = Math.floor((prog - a) / ((b - a) / hits));
      return Math.max(0, Math.min(hits - 1, seg));
    },

    /* 每帧推进 */
    update: function (dt) {
      var P = J.P, m = P.move;
      if (!m || P.state !== 'atk') return;

      var prog = P.tim / P.moveDur;

      /* ── 判定窗口 ── */
      if (prog >= m.hit[0] && prog <= m.hit[1]) {
        var seg = this._segOf(P, prog, m);
        if (seg !== P.hitSeg) { P.hitSeg = seg; P.hitSet = []; }
        this.hitCheck(m);
      }

      /* ── 输入缓冲：取消窗口内可接下一招 ── */
      var cancelAt = Math.max(m.cw, J.WINFO.cancelBase);
      var canCancel = prog >= cancelAt;

      if (P.bufferT > 0) {
        P.bufferT -= dt;
        if (canCancel) this.resolveBuffer(P, m);
        else if (P.bufferT <= 0) P.buffered = null;
      }

      /* ── 空中攻击落地强制结束 ── */
      if (m.air && P.onGround && P.tim > 0.12) {
        P.state = 'idle'; P.move = null; P.moveId = '';
        return;
      }

      /* ── 动作结束 ── */
      if (P.tim >= P.moveDur) {
        P.state = 'idle';
        P.move = null; P.moveId = '';
        P.hitSet = []; P.hitSeg = -1;
      }
    },

    resolveBuffer: function (P, m) {
      var b = P.buffered;
      P.buffered = null; P.bufferT = 0;
      if (!b || !m.next) return;
      var nid = null;
      if (b === 'atk') nid = m.next.atk;
      else if (b === 'heavy') nid = m.next.heavy;
      else if (b === 'charge') nid = m.next.charge;
      else if (b === 'jump') nid = m.next.jump;
      if (nid && J.MOVES[nid]) {
        // 体力不足时降级为普通轻击
        var nm = J.MOVES[nid];
        if (P.stamina < (nm.stamina || 0)) {
          if (m.next.atk && P.stamina >= (J.MOVES[m.next.atk].stamina || 0)) nid = m.next.atk;
          else return;
        }
        J.Combat.start(nid);
      }
    },

    /* 命中判定 */
    hitCheck: function (m) {
      var P = J.P, W = J.WINFO;
      var fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
      var reach = (m.reach || W.reach) * W.rangeMul + 0.55;   // 容差
      var arc = (m.arc || W.arc) * W.arcMul + 0.22;

      for (var i = 0; i < J.foes.length; i++) {
        var f = J.foes[i];
        if (f.dead || f.gone || P.hitSet.indexOf(f) >= 0) continue;
        var dx = f.pos.x - P.pos.x, dz = f.pos.z - P.pos.z;
        var d = Math.hypot(dx, dz);
        var bodyR = 0.45;                                     // 敌人身体半径
        var isLocked = (P.hitTarget === f);
        /* 锁定的目标：只要在距离内就必定命中，不受角度影响（防止敌人绕背导致空刀） */
        if (isLocked) {
          if (d - bodyR > reach * 1.2) continue;
        } else {
          if (d - bodyR > reach) continue;
          var dot = (dx * fx + dz * fz) / (d || 1);
          if (dot < Math.cos(arc)) continue;
        }
        if (Math.abs(f.pos.y - P.pos.y) > 3.0) continue;

        P.hitSet.push(f);
        this.dealDamage(f, m, d);
      }
    },

    dealDamage: function (f, m, dist) {
      var P = J.P, W = J.WINFO;
      var combo = J.comboCount || 0;
      var critChance = 0.12 + Math.min(0.25, combo * 0.02);
      var crit = Math.random() < critChance;

      /* 距离越近伤害越高（刀锋中段） */
      var falloff = 1.0;
      var reach = (m.reach || W.reach) * W.rangeMul;
      if (dist > reach * 0.75) falloff = 0.86;

      var dmg = (m.dmg || 0) * W.dmgMul * falloff * (P.moveDmgMul || 1);
      dmg *= (J.Soul ? J.Soul.dmgMul() : 1);
      if (J.Story && J.Story.hasFlag && J.Story.hasFlag('guTeachDaodao') && f.cfg.phases) dmg *= 1.12;
      dmg *= (1 + Math.min(0.55, combo * 0.028));
      if (crit) dmg *= 1.7;
      dmg = Math.round(dmg);

      var isHeavy = (m.type === 'heavy' || m.type === 'charge' || m.type === 'skill' || m.type === 'finisher');
      var kb = (m.kb || 1) * (isHeavy ? 0.85 : 0.45);

      /* 削韧 */
      if (f.poise !== undefined) {
        f.poise -= dmg * W.poiseMul * (m.poise || 1) * 0.5;
        if (f.poise <= 0) {
          f.poise = f.maxPoise;
          f.enter('break', m.type === 'finisher' ? 2.2 : 1.6);
          J.FX.ring(f.pos.x, f.pos.y + 1.2, f.pos.z, 0xffc060, 3.4);
          J.FX.spark(f.pos.x, f.pos.y + 1.2, f.pos.z, 26, 0xffd070, 2.0);
          J.FX.hitstop(0.10);
          J.UI.flashText('破 防');
          P.breakTarget = f;
        }
      }

      var res = f.hurt(dmg, P.pos, kb, isHeavy, m.launch);
      var hp3 = new THREE.Vector3(f.pos.x, f.pos.y + 1.85, f.pos.z);

      if (res === 'block') {
        J.FX.dmgText(hp3, '格挡', 'block');
        J.FX.shake(0.06, 0.09);
        J.FX.hitstop(0.04);
        J.FX.spark(f.pos.x, f.pos.y + 1.2, f.pos.z, 9, 0xbfd8ff, 0.9);
        return;
      }

      /* 飘字与特效 */
      J.FX.dmgText(hp3, (crit ? '暴击 ' : '') + dmg, crit ? 'crit' : (isHeavy ? 'heavy' : ''));
      var sc = crit ? 0xffb060 : (isHeavy ? 0xffc880 : 0xffd9a0);
      J.FX.spark(f.pos.x, f.pos.y + 1.25, f.pos.z, isHeavy ? 26 : 14, sc, isHeavy ? 2.0 : 1.1);
      if (isHeavy) J.FX.ring(f.pos.x, f.pos.y + 1.1, f.pos.z, 0xffe0b0, 3.2);

      /* 打击感：顿帧与震屏按武器重量分级 */
      var hs = isHeavy ? 0.085 : 0.042;
      if (m.type === 'finisher') hs = 0.16;
      J.FX.hitstop(hs);
      J.FX.shake(isHeavy ? 0.22 : 0.09, isHeavy ? 0.26 : 0.14);
      if (isHeavy) J.FX.fovPunch(m.type === 'finisher' ? 6.5 : 3.2);

      J.comboCount = (J.comboCount || 0) + 1;
      J.comboTimer = 2.6;

      /* 命中回内力 */
      P.qi = Math.min(J.WINFO.maxQi, P.qi + (isHeavy ? 4 : 2));
      /* 连续命中积累刀魂 */
      if (J.Soul) J.Soul.add(m.type === 'finisher' ? 12 : (isHeavy ? 8.5 : 5.2), { heavy: isHeavy });

      /* 刀意 · 断岳（顾长风所授）：重击带出刀气余波 */
      if (isHeavy && J.Story && J.Story.hasFlag && J.Story.hasFlag('guTeachDaoyi')) {
        J.FX.ring(f.pos.x, f.pos.y + 0.75, f.pos.z, 0xa8c8ff, 3.4);
        J.FX.spark(f.pos.x, f.pos.y + 0.6, f.pos.z, 10, 0xcfe0ff, 1.2);
        for (var q = 0; q < J.foes.length; q++) {
          var g2 = J.foes[q];
          if (g2 === f || g2.dead || g2.gone) continue;
          if (Math.hypot(g2.pos.x - f.pos.x, g2.pos.z - f.pos.z) < 3.4) {
            g2.hurt(Math.round(dmg * 0.34), f.pos, 0.5, false);
            J.FX.dmgText(new THREE.Vector3(g2.pos.x, g2.pos.y + 1.7, g2.pos.z),
              Math.round(dmg * 0.34), '');
          }
        }
      }
    },

    /* ══ 处决：破防敌人的专属演出 ══ */
    execution: function (foe) {
      var P = J.P;
      if (!foe || foe.dead || foe.gone || foe.state !== 'break') return false;
      if (!J.Soul || J.Soul.v < 22) {
        if (J.UI) J.UI.toast('刀魂不足 · 需 22', 1.1);
        return false;
      }

      J.Soul.spend(22);
      P.state = 'exec';
      P.tim = 0;
      P.execT = 0;
      P.execHit = false;
      P.execTarget = foe;
      P.invuln = 2.4;
      P.blocking = false;
      P.move = null;
      P.moveId = '';
      P.vy = 0;

      /* 面向敌人并算出位置 */
      var dx = foe.pos.x - P.pos.x, dz = foe.pos.z - P.pos.z;
      var d = Math.hypot(dx, dz) || 1;
      var nx = dx / d, nz = dz / d;
      P.yaw = Math.atan2(dx, dz);
      P.execFrom = P.pos.clone();
      if (!P.execTo) P.execTo = new THREE.Vector3();
      P.execTo.set(
        foe.pos.x - nx * 1.75,
        J.Terrain.heightAt(foe.pos.x - nx * 1.75, foe.pos.z - nz * 1.75),
        foe.pos.z - nz * 1.75
      );
      P.execFace = Math.atan2(dx, dz);

      /* 敌人定格，转身面向玩家 */
      foe.yaw = Math.atan2(-dx, -dz);
      foe.enter('break', 2.0);

      /* 慢动作 + 镜头接管 */
      J.slowMo = 0.74;
      J.FX.shake(0.06, 0.2);
      J.FX.ring(P.pos.x, P.pos.y + 1.0, P.pos.z, 0x9fd0ff, 3.0);
      J.UI.flashText('处 决');
      return true;
    },

    /* 每帧推进处决 */
    updateExecution: function (dt) {
      var P = J.P, foe = P.execTarget;
      if (P.state !== 'exec') return;
      P.execT += dt;
      var t = P.execT;

      /* 阶段 1：瞬身贴近（0~0.11） */
      if (t < 0.085) {
        var k = t / 0.085;
        var e = k * k * (3 - 2 * k);
        P.pos.x = J.U.lerp(P.execFrom.x, P.execTo.x, e);
        P.pos.z = J.U.lerp(P.execFrom.z, P.execTo.z, e);
        P.pos.y = J.U.lerp(P.execFrom.y, P.execTo.y, e);
      }

      /* 阶段 2：斩下（0.23 命中） */
      if (t >= 0.17 && !P.execHit) {
        P.execHit = true;
        var isBoss = foe.cfg.boss;
        var dmg = isBoss ? Math.round(foe.maxHp * 0.34) : 9999;
        foe.hurt(dmg, P.pos, 3.4, true, false);
        if (isBoss) foe.enter('break', 2.0);

        J.FX.hitstop(0.10);
        J.FX.shake(0.34, 0.42);
        J.FX.ring(foe.pos.x, foe.pos.y + 1.15, foe.pos.z, 0xffc880, 5.2);
        J.FX.ring(foe.pos.x, foe.pos.y + 1.15, foe.pos.z, 0xff8a4a, 3.0);
        J.FX.spark(foe.pos.x, foe.pos.y + 1.2, foe.pos.z, 30, 0xff9a50, 2.8);
        J.FX.spark(foe.pos.x, foe.pos.y + 1.2, foe.pos.z, 16, 0xffe8c0, 1.8);
        J.FX.dmgText(_dmgV.set(foe.pos.x, foe.pos.y + 2.0, foe.pos.z),
          isBoss ? '重创 ' + dmg : '斩', 'crit');
        J.comboCount = (J.comboCount || 0) + 3;
        J.comboTimer = 3.0;
        P.qi = Math.min(J.MAXQI || J.WINFO.maxQi, P.qi + 12);
        if (J.Soul) J.Soul.add(10, { heavy: true });
      }

      /* 阶段 3：收刀（0.78 结束） */
      if (t > 0.55) {
        P.state = 'idle';
        P.tim = 0;
        P.execT = 0;
        P.execTarget = null;
        P.execHit = false;
        J.slowMo = 1;
        J.timeScale = 1;
      }
    },

    /* ── 终结技是否可用 ── */
    canFinisher: function () {
      var P = J.P;
      if (P.qi < J.MOVES.fin.qi) return false;
      if (J.Soul && J.Soul.v < 55) return false;
      if ((J.comboCount || 0) >= 6) return true;
      for (var i = 0; i < J.foes.length; i++) {
        var f = J.foes[i];
        if (!f.dead && !f.gone && f.state === 'break') return true;
      }
      return false;
    },

    canSkill: function () {
      return J.P.qi >= J.MOVES.skill.qi;
    },

    /* 刀魂满：太玄 · 一刀 */
    canSoul: function () {
      return !!(J.Soul && J.Soul.isFull() && J.MOVES.soulMove);
    }
  };

  return C;
})();
