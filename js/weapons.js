/* ═══════════════════════════════════════════════
   weapons.js — 长刀体系配置（唯一真源）
   定位：凌厉 / 强势 / 爆发 / 压制
   单武器，但连招树、判定、消耗全部走数据表，
   战斗逻辑只读表，不写死数值。
   ═══════════════════════════════════════════════ */

J.WINFO = {
  id: 'blade', name: '长刀', short: '刀',
  desc: '大开大合，一刀断岳。以蓄力与破防压制敌人，单次爆发极高。',

  /* ── 全局倍率 ── */
  spd: 1.08,           // 动作速度
  dmgMul: 1.0,
  rangeMul: 1.0,
  arcMul: 1.0,
  staminaMul: 1.0,
  poiseMul: 1.6,       // 破防能力
  cancelBase: 0.10,    // 全局取消窗口偏置
  reach: 3.35,
  arc: 1.48,
  atk: 32,

  color: 0xffd9a0,
  trailCol: 0xffe2b8,

  /* 内力上限 */
  maxQi: 100,
  qiRegen: 3.4         // 每秒回内力
};

/* ── 招式表 ──
   dur   总时长(秒，会被 spd 缩放)
   hit   [判定开始, 判定结束] 占 dur 比例
   cw    取消窗口起点比例（到这里之后可以接下一招）
   dmg   基础伤害
   kb    击退力
   lunge 起手冲刺速度
   next  可衔接 { atk, heavy, charge, dash, jump }
   anim  动作类型
   type  light / heavy / charge / launch / air / parry / skill / finisher
   hits  多段判定次数
   poise 额外削韧倍率（破防用）
*/
J.MOVES = {

  /* ══════ 一、轻攻击连招树 ══════ */
  l1: {
    name: '横斩', dur: 0.50, hit: [0.17, 0.30], cw: 0.50,
    dmg: 22, kb: 1.5, lunge: 2.8, anim: 'bigSlash', type: 'light', stamina: 6,
    next: { atk: 'l2', heavy: 'h1', charge: 'c1', jump: 'ja1' }
  },
  l2: {
    name: '连斩', dur: 0.46, hit: [0.15, 0.28], cw: 0.48,
    dmg: 19, kb: 1.3, lunge: 2.6, anim: 'bigSlashR', type: 'light', stamina: 6,
    next: { atk: 'l3', heavy: 'h1', charge: 'c1' }
  },
  l3: {
    name: '回旋斩', dur: 0.60, hit: [0.21, 0.38], cw: 0.56,
    dmg: 28, kb: 2.2, lunge: 2.4, anim: 'spinWide', type: 'light', stamina: 8,
    next: { atk: 'l4', heavy: 'h1' }
  },
  l4: {
    name: '断岳劈', dur: 0.78, hit: [0.27, 0.44], cw: 0.70,
    dmg: 42, kb: 3.2, lunge: 3.0, anim: 'overhead', type: 'light', stamina: 11,
    next: {}
  },

  /* ══════ 二、重攻击与蓄力分支 ══════ */
  h1: {
    name: '重劈', dur: 0.82, hit: [0.31, 0.47], cw: 0.76,
    dmg: 44, kb: 3.4, lunge: 2.6, anim: 'overhead', type: 'heavy', stamina: 17,
    guardBreak: true, poise: 1.4, next: { atk: 'b1' }
  },
  c1: {
    name: '蓄力斩', dur: 0.96, hit: [0.33, 0.54], cw: 0.80,
    dmg: 58, kb: 4.2, lunge: 4.6, anim: 'chargeSlash', type: 'charge', stamina: 21,
    guardBreak: true, poise: 2.0, next: { atk: 'l3' }
  },

  /* ══════ 三、闪避攻击分支 ══════ */
  d1: {
    name: '突进斩', dur: 0.50, hit: [0.14, 0.31], cw: 0.54,
    dmg: 26, kb: 1.8, lunge: 7.2, anim: 'bigSlash', type: 'dash', stamina: 0,
    next: { atk: 'u1' }
  },

  /* ══════ 四、空中连招分支 ══════ */
  u1: {
    name: '挑斩', dur: 0.55, hit: [0.19, 0.32], cw: 0.54,
    dmg: 24, kb: 0.9, lunge: 2.2, anim: 'launch', type: 'launch', stamina: 8,
    launch: true, next: { atk: 'a1' }
  },
  a1: {
    name: '空中斩', dur: 0.43, hit: [0.10, 0.27], cw: 0.46,
    dmg: 20, kb: 0.8, lunge: 3.2, anim: 'airSlash', type: 'air', stamina: 5,
    air: true, next: { atk: 'a2' }
  },
  a2: {
    name: '坠击', dur: 0.54, hit: [0.12, 0.32], cw: 0.66,
    dmg: 34, kb: 3.0, lunge: 2.0, anim: 'plunge', type: 'air', stamina: 9,
    air: true, slam: true, poise: 1.3, next: {}
  },
  ja1: {
    name: '跳斩', dur: 0.50, hit: [0.10, 0.29], cw: 0.50,
    dmg: 24, kb: 1.6, lunge: 1.8, anim: 'airSlash', type: 'air', stamina: 6,
    air: true, next: { atk: 'a1' }
  },

  /* ══════ 五、弹反反击分支 ══════ */
  p1: {
    name: '回身斩', dur: 0.38, hit: [0.07, 0.21], cw: 0.40,
    dmg: 30, kb: 1.6, lunge: 4.6, anim: 'spinWide', type: 'parry', stamina: 0,
    poise: 1.5, next: { atk: 'h1' }
  },

  /* ══════ 六、破防追击分支 ══════ */
  b1: {
    name: '破防追击', dur: 0.42, hit: [0.10, 0.25], cw: 0.44,
    dmg: 28, kb: 1.2, lunge: 4.4, anim: 'bigSlash', type: 'light', stamina: 5,
    next: { atk: 'l2' }
  },

  /* ══════ 七、专属特殊技能（耗内力） ══════ */
  skill: {
    name: '开山', dur: 1.00, hit: [0.30, 0.60], cw: 0.94,
    dmg: 26, hits: 4, kb: 2.6, lunge: 4.4, anim: 'chargeSlash', type: 'skill',
    stamina: 0, qi: 45, guardBreak: true, poise: 2.2, next: {}
  },

  /* ══════ 八、专属终结技（连击数达标解锁） ══════ */
  fin: {
    name: '一刀两断', dur: 1.25, hit: [0.36, 0.62], cw: 0.98,
    dmg: 130, kb: 4.6, lunge: 6.0, anim: 'finisherBlade', type: 'finisher',
    stamina: 0, qi: 35, poise: 3.0, next: {}
  }
};

/* 连招提示（HUD 展示用） */
J.COMBO_HINT = [
  '横斩 → 连斩 → 回旋斩 → 断岳劈',
  '轻 → 轻 → 重劈（破防）→ 破防追击',
  '闪避 → 突进斩 → 挑斩 → 空中斩 → 坠击',
  '弹反 → 回身斩 → 重劈',
  '蓄力斩 →（破防）→ 回旋斩'
];
