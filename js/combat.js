/* ═══════════════════════════════════════════════
   combat.js — 长刀战斗状态机
   连招衔接 / 蓄力 / 多段判定 / 破防 / 弹反 / 终结技
   ═══════════════════════════════════════════════ */
J.Combat = (function () {

  var C = {
    /* 起手：进入攻击 */
    start: function (id, opt) {
      var P = J.P, m = J.MOVES[id];
      if (!m) return false;
      opt = opt || {};
      var W = J.WINFO;

      if (P.qi < (m.qi || 0)) return false;
      if (P.stamina < (m.stamina || 0) && !opt.force) return false;

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

      /* 起手冲刺 */
      var dir = J.aimDir();
      P.dashDir.copy(dir).multiplyScalar(m.lunge || 0);
      P.dashT = m.air ? 0.06 : 0.12;

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
      var reach = (m.reach || W.reach) * W.rangeMul;
      var arc = (m.arc || W.arc) * W.arcMul;

      for (var i = 0; i < J.foes.length; i++) {
        var f = J.foes[i];
        if (f.dead || f.gone || P.hitSet.indexOf(f) >= 0) continue;
        var dx = f.pos.x - P.pos.x, dz = f.pos.z - P.pos.z;
        var d = Math.hypot(dx, dz);
        if (d > reach + 0.35) continue;
        if (Math.abs(f.pos.y - P.pos.y) > 2.6) continue;
        var dot = (dx * fx + dz * fz) / (d || 1);
        if (dot < Math.cos(arc)) continue;

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
      dmg *= (1 + Math.min(0.55, combo * 0.028));
      if (crit) dmg *= 1.7;
      dmg = Math.round(dmg);

      var isHeavy = (m.type === 'heavy' || m.type === 'charge' || m.type === 'skill' || m.type === 'finisher');
      var kb = (m.kb || 1) * (isHeavy ? 1.0 : 0.7);

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
      var hs = isHeavy ? 0.095 : 0.05;
      if (m.type === 'finisher') hs = 0.16;
      J.FX.hitstop(hs);
      J.FX.shake(isHeavy ? 0.22 : 0.09, isHeavy ? 0.26 : 0.14);

      J.comboCount = (J.comboCount || 0) + 1;
      J.comboTimer = 2.6;

      /* 命中回内力 */
      P.qi = Math.min(J.WINFO.maxQi, P.qi + (isHeavy ? 4 : 2));
    },

    /* ── 终结技是否可用 ── */
    canFinisher: function () {
      var P = J.P;
      if (P.qi < J.MOVES.fin.qi) return false;
      if ((J.comboCount || 0) >= 6) return true;
      for (var i = 0; i < J.foes.length; i++) {
        var f = J.foes[i];
        if (!f.dead && !f.gone && f.state === 'break') return true;
      }
      return false;
    },

    canSkill: function () {
      return J.P.qi >= J.MOVES.skill.qi;
    }
  };

  return C;
})();
