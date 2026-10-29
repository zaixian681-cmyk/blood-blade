/* ═══════════════════════════════════════════════
   soul.js — 刀魂
   连续命中积累刀魂；三段境界；不命中会流失
   一重·刀意 / 二重·刀魄 / 三重·太玄
   ═══════════════════════════════════════════════ */
J.Soul = (function () {

  var S = {
    v: 0, max: 100,
    chain: 0,        // 连击内的连续命中数
    chainT: 0,       // 连击计时
    idleT: 0,        // 距上次命中的时间
    level: 0,        // 0~3
    gained: 0,       // 本局累计（数据面板用）
    _lvFx: 0
  };

  var LV_NAME = ['', '一重 · 刀意', '二重 · 刀魄', '三重 · 太玄'];
  var LV_ADD = [1, 1, 1, 1];
  var LV_DMG = [1.0, 1.03, 1.07, 1.12];

  S.name = function () { return LV_NAME[S.level] || '未凝'; };
  S.dmgMul = function () { return LV_DMG[S.level] || 1; };
  S.ratio = function () { return S.v / S.max; };
  S.isFull = function () { return S.v >= S.max - 0.001; };

  /* 刀魂境界对应的刀身色（供刀与光效使用） */
  S.color = function () {
    return [0xcfe0ff, 0xa8c8ff, 0x9a8cff, 0xffc8e0][S.level] || 0xcfe0ff;
  };

  S.reset = function () {
    S.v = 0; S.chain = 0; S.chainT = 0; S.idleT = 9; S.level = 0;
  };

  /* ── 命中积累 ──
     base：基础刀魂。连续命中越多，单次获得越高（最高 +80%）。
     只有玩家的攻击才会调用这里。 */
  S.add = function (base, opt) {
    if (!base) return 0;
    opt = opt || {};
    S.chainT = 2.2;
    S.idleT = 0;
    S.chain++;

    var bonus = Math.min(0.8, S.chain * 0.045);
    var gain = base * (1 + bonus);
    if (opt.heavy) gain *= 1.15;
    if (J.Story && J.Story.hasFlag && J.Story.hasFlag('guTeachDaoyi')) gain *= 1.25;

    var before = S.level;
    S.v = Math.min(S.max, S.v + gain);
    S.gained += gain;
    S._lvFx = 0.4;

    /* 境界突破演出 */
    if (S.level !== before) S._onLevel();

    /* HUD 飘一点 */
    if (J.UI && J.UI.soulPulse) J.UI.soulPulse(gain);
    return gain;
  };

  /* 一次性补满（处决演出、剧情奖励） */
  S.fill = function (v) {
    var before = S.level;
    S.v = J.U.clamp(S.v + (v === undefined ? S.max : v), 0, S.max);
    if (S.level !== before) S._onLevel();
  };

  S.spend = function (n) {
    if (S.v < n) return false;
    S.v = Math.max(0, S.v - n);
    if (S.level !== S._calcLevel()) S._onLevel();
    return true;
  };

  S._calcLevel = function () {
    if (S.v >= S.max) return 3;
    if (S.v >= 67) return 2;
    if (S.v >= 34) return 1;
    return 0;
  };

  S._onLevel = function () {
    var n = S._calcLevel();
    if (n === S.level) return;
    var up = n > S.level;
    S.level = n;
    if (!J.UI) return;
    if (up) {
      if (J.UI.flashText) J.UI.flashText(LV_NAME[n]);
      if (J.FX && J.P) {
        J.FX.ring(J.P.pos.x, J.P.pos.y + 0.9, J.P.pos.z, S.color(), n === 3 ? 6.2 : 4.2);
        J.FX.spark(J.P.pos.x, J.P.pos.y + 1.2, J.P.pos.z, 20 + n * 8, S.color(), 1.6);
      }
      if (J.FX && n === 3) J.FX.shake(0.10, 0.25);
    }
  };

  /* ── 每帧 ── */
  S.update = function (dt) {
    if (J.paused) return;
    S.idleT += dt;
    if (S.chainT > 0) {
      S.chainT -= dt;
      if (S.chainT <= 0) { S.chain = 0; }
    }
    /* 脱战流失：越高的境界流失越快，逼玩家持续压制 */
    if (S.idleT > 2.5 && S.v > 0) {
      var rate = 5.5 + S.level * 1.6;
      S.v = Math.max(0, S.v - rate * dt);
      if (S.v <= 0) { S.chain = 0; }
    }
    if (S._lvFx > 0) S._lvFx -= dt;
    var n = S._calcLevel();
    if (n !== S.level) S._onLevel();
  };

  /* ── 刀身刀魂光：供 weapon.update 使用 ── */
  S.auraMul = function () {
    var t = S.v / S.max;
    return 1 + t * 1.35 + (S._lvFx > 0 ? 0.5 : 0);
  };

  return S;
})();
