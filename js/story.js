/* ═══════════════════════════════════════════════
   story.js — 主线剧情：血刃救红颜，孤刀定江湖
   六章 / 任务链 / 剧情状态 / 存档
   ═══════════════════════════════════════════════ */
J.Story = (function () {

  var S = {
    chapter: 0,          // 当前章节（0=未开始）
    quest: {},           // 任务状态 {id: 'done'|'active'|'locked'}
    flags: {},           // 剧情标记
    bladeStage: 1,       // 太玄之刃觉醒阶段 1~3
    ended: false
  };

  /* ══ 角色 ══ */
  var CAST = {
    shen: { name: '沈昭宁', title: '昭宁公主', color: 0xd8c8f0 },
    lu: { name: '陆沉渊', title: '主角', color: 0x9aa4b8 },
    xiao: { name: '萧无极', title: '血衣门主', color: 0x8a2020 },
    villager: { name: '渡口乡民', title: '', color: 0xa89880 },
    monk: { name: '空寂和尚', title: '守寺人', color: 0xb8a888 }
  };

  /* ══ 对话库 ══ */
  var DIALOG = {
    /* ── 第一章 ── */
    shen_meet: {
      who: 'shen',
      lines: [
        '（崖顶风急，一名白衣女子背对着你，手中攥着一卷染血的密信。）',
        '沈昭宁：你终于来了，陆沉渊。',
        '沈昭宁：三日前血衣门夜袭皇城，我逃出时带走了他们与北境勾结的账目。',
        '沈昭宁：萧无极不会放过这东西 —— 他已在山下布了人手。',
        '陆沉渊：那你为何不直接回宫？',
        '沈昭宁：回不去了。守门的是他们的人。',
        '沈昭宁：我要查清这桩阴谋，需要一把刀。你就是那把刀。'
      ],
      onEnd: function () { S.advance('c1_2'); }
    },
    shen_c1_2: {
      who: 'shen',
      lines: [
        '沈昭宁：血衣门的追兵就在飞瀑崖下。',
        '沈昭宁：先去清掉他们，我们从崖壁的栈道下去。'
      ]
    },

    /* ── 第二章 ── */
    shen_c2_1: {
      who: 'shen',
      lines: [
        '（瀑布轰鸣，水雾中隐约有血衣人影。）',
        '沈昭宁：他们守在崖下，一共三人。',
        '沈昭宁：我不擅长杀人，但可以替你看着上头。'
      ]
    },
    shen_c2_end: {
      who: 'shen',
      lines: [
        '沈昭宁：都解决了。',
        '沈昭宁：这封信提到一个地方 —— 谷底那座废弃古寺。',
        '沈昭宁：血衣门在寺里藏了东西，我们得去看看。'
      ],
      onEnd: function () { S.advance('c3_1'); }
    },

    /* ── 第三章 ── */
    monk_talk: {
      who: 'monk',
      lines: [
        '空寂和尚：施主，这寺已经空了十年。',
        '空寂和尚：十年前血衣门来过一次，之后地下就再没人敢下去。',
        '空寂和尚：佛殿佛像身后有道暗门…… 老衲劝你莫开。',
        '陆沉渊：我非开不可。'
      ],
      onEnd: function () { S.setFlag('knowsPassage'); S.advance('c3_2'); }
    },
    shen_c3: {
      who: 'shen',
      lines: [
        '沈昭宁：殿里的佛像…… 底座是空的。',
        '沈昭宁：密道在下面，我听见风声了。'
      ]
    },
    shen_c3_end: {
      who: 'shen',
      lines: [
        '（密道尽头的箱子已被打开，一卷账册摊在地上。）',
        '沈昭宁：找到了。血衣门买通北境三镇的凭据。',
        '沈昭宁：但也暴露了我们 —— 外面来人了。',
        '沈昭宁：快去渡口，那里有船。'
      ],
      onEnd: function () { S.advance('c4_1'); }
    },

    /* ── 第四章 ── */
    villager_talk: {
      who: 'villager',
      lines: [
        '乡民：客官莫往北走！血衣门昨夜封了渡口。',
        '乡民：他们把守着桥，说是要抓个什么公主……',
        '乡民：唉，这世道。'
      ],
      onEnd: function () { S.setFlag('knowsBridge'); }
    },
    shen_c4: {
      who: 'shen',
      lines: [
        '沈昭宁：桥是他们唯一能封锁的地方。',
        '沈昭宁：过了桥就是北坡，血衣门总坛在那里。',
        '沈昭宁：我的身份已经藏不住了 —— 你先上，我在后面接应。'
      ],
      onEnd: function () { S.advance('c5_1'); }
    },

    /* ── 第五章 ── */
    shen_captured: {
      who: 'shen',
      lines: [
        '（总坛火把通明，沈昭宁被缚在石柱上。）',
        '沈昭宁：别看他们的眼 —— 那是淬了药的。',
        '沈昭宁：我没事。你先把这些杂碎清了。'
      ],
      onEnd: function () { S.advance('c5_2'); }
    },
    shen_freed: {
      who: 'shen',
      lines: [
        '（绳索落地，沈昭宁站起身，抽出藏在靴中的短刃。）',
        '沈昭宁：账册我早就抄了一份藏在身上。',
        '沈昭宁：萧无极在山顶等你 —— 他要把这桩事一刀了断。',
        '沈昭宁：一起去。'
      ],
      onEnd: function () { S.setFlag('shenFreed'); S.advance('c6_1'); }
    },

    /* ── 第六章 ── */
    xiao_taunt: {
      who: 'xiao',
      lines: [
        '萧无极：你毁了血衣门三十年。',
        '萧无极：为了一个不相干的女人。',
        '陆沉渊：她不是不相干的人。',
        '萧无极：那就用刀说话。'
      ],
      onEnd: function () { S.setFlag('bossFight'); J.spawnBossEncounter(); }
    },
    shen_final: {
      who: 'shen',
      lines: [
        '（萧无极倒在断剑旁，血衣门火把尽灭。）',
        '沈昭宁：结束了。',
        '沈昭宁：不 —— 还没结束。',
        '沈昭宁：这账册上还有名字。朝里还有他的人。',
        '沈昭宁：陆沉渊，你愿意再陪我走一程吗？',
        '陆沉渊：刀在，人在。',
        '（太玄之刃发出低鸣，紫白灵光大盛 —— 第三阶，太玄觉醒。）'
      ],
      onEnd: function () {
        S.ended = true;
        S.setBladeStage(3);
        S.advance('done');
        S.save();
      }
    }
  };

  /* ══ 任务链 ══ */
  var QUESTS = [
    /* 第一章：血夜惊变 */
    { id: 'c1_1', ch: 1, name: '崖顶会面', desc: '与沈昭宁交谈', type: 'talk', npc: 'shen', x: 0, z: 178, r: 4 },
    { id: 'c1_2', ch: 1, name: '清剿追兵', desc: '消灭飞瀑崖壁下的血衣门追兵', type: 'kill', zone: 'fall', count: 3 },
    { id: 'c1_3', ch: 1, name: '沿栈道下谷', desc: '从崖壁栈道下到谷底渡口', type: 'reach', x: 0, z: 60, r: 30 },

    /* 第二章：断魂吊桥 */
    { id: 'c2_1', ch: 2, name: '断魂吊桥', desc: '击败桥头守着血衣门', type: 'kill', zone: 'bridge', count: 2 },
    { id: 'c2_2', ch: 2, name: '与公主会合', desc: '回到崖下与沈昭宁会合', type: 'talk', npc: 'shen', x: 0, z: 100, r: 5 },

    /* 第三章：古寺藏锋 */
    { id: 'c3_1', ch: 3, name: '寻访古寺', desc: '找到谷底的废弃古寺', type: 'reach', x: -52, z: 20, r: 14 },
    { id: 'c3_2', ch: 3, name: '询问守寺人', desc: '与空寂和尚交谈', type: 'talk', npc: 'monk', x: -52, z: 24, r: 4 },
    { id: 'c3_3', ch: 3, name: '开佛像暗门', desc: '在佛殿佛像后打开密道', type: 'use', id_: 'passage' },
    { id: 'c3_4', ch: 3, name: '取得账册', desc: '从密道宝箱取出账册', type: 'use', id_: 'ledger' },

    /* 第四章：皇城风云 */
    { id: 'c4_1', ch: 4, name: '渡口问路', desc: '向乡民打探出路', type: 'talk', npc: 'villager', x: -30, z: 78, r: 4 },
    { id: 'c4_2', ch: 4, name: '过桥北上', desc: '穿过谷底木桥', type: 'reach', x: 0, z: 40, r: 12 },
    { id: 'c4_3', ch: 4, name: '与公主商议', desc: '听沈昭宁的打算', type: 'talk', npc: 'shen', x: 0, z: 30, r: 5 },

    /* 第五章：血衣围城 */
    { id: 'c5_1', ch: 5, name: '潜入总坛', desc: '抵达北坡血衣门总坛', type: 'reach', x: 0, z: -100, r: 26 },
    { id: 'c5_2', ch: 5, name: '血战总坛', desc: '击溃血衣门守卫', type: 'kill', zone: 'lair', count: 5 },
    { id: 'c5_3', ch: 5, name: '救出公主', desc: '解开沈昭宁的绳索', type: 'use', id_: 'rescueShen' },

    /* 第六章：天绝峰之战 */
    { id: 'c6_1', ch: 6, name: '登顶', desc: '与公主同上断剑宫', type: 'reach', x: 0, z: -186, r: 30 },
    { id: 'c6_2', ch: 6, name: '血衣门主', desc: '击败萧无极', type: 'boss' },
    { id: 'c6_3', ch: 6, name: '尘埃落定', desc: '与公主说完最后一句话', type: 'talk', npc: 'shen', x: 0, z: -178, r: 6 }
  ];

  var CHAPTER_NAME = ['', '第一章 · 血夜惊变', '第二章 · 断魂吊桥', '第三章 · 古寺藏锋',
    '第四章 · 皇城风云', '第五章 · 血衣围城', '第六章 · 天绝峰之战'];

  /* ══ 逻辑 ══ */
  S.init = function () {
    for (var i = 0; i < QUESTS.length; i++) {
      if (!S.quest[QUESTS[i].id]) S.quest[QUESTS[i].id] = 'locked';
    }
    S.quest.c1_1 = 'active';
    S.chapter = 1;
    S.load();
    if (S.chapter === 0) { S.chapter = 1; }
    J.UI.setChapter(CHAPTER_NAME[S.chapter] || '');
    J.UI.refreshQuests();
  };

  S.getQuest = function (id) {
    for (var i = 0; i < QUESTS.length; i++) if (QUESTS[i].id === id) return QUESTS[i];
    return null;
  };

  S.currentQuest = function () {
    for (var i = 0; i < QUESTS.length; i++) {
      if (S.quest[QUESTS[i].id] === 'active') return QUESTS[i];
    }
    return null;
  };

  S.isActive = function (id) { return S.quest[id] === 'active'; };

  /* 完成一个任务，并推进链 */
  S.advance = function (id) {
    if (S.quest[id] !== 'active') return false;
    S.quest[id] = 'done';
    J.UI.toast('任务完成 · ' + S.getQuest(id).name, 2.2);

    /* 激活下一条 */
    for (var i = 0; i < QUESTS.length; i++) {
      if (QUESTS[i].id === id && i + 1 < QUESTS.length) {
        var nx = QUESTS[i + 1];
        S.quest[nx.id] = 'active';
        if (nx.ch !== S.chapter) {
          S.chapter = nx.ch;
          J.UI.setChapter(CHAPTER_NAME[S.chapter]);
          J.UI.regionBanner(CHAPTER_NAME[S.chapter]);
        }
        break;
      }
    }
    /* 沈昭宁随剧情移动 */
    if (J.NPC) {
      if (S.quest.c2_2 === 'done' && J.World.townCenter) {
        J.NPC.moveTo('shen', J.World.townCenter.x - 10, J.World.townCenter.z + 24);
      }
      if (S.quest.c3_3 === 'done' && J.World.templeCenter) {
        J.NPC.moveTo('shen', J.World.templeCenter.x + 3, J.World.templeCenter.z + 6);
      }
      if (S.quest.c4_3 === 'done' && J.World.lairCenter) {
        /* 被俘：移到囚笼 */
        var cg = J.World.cagePos;
        J.NPC.moveTo('shen', cg.x, cg.z);
        if (J.Story) S.talk('shen', 'shen_captured');
      }
      if (S.quest.c5_3 === 'done') {
        J.NPC.moveTo('shen', 0, -176);
      }
    }

    /* 章节内的刀觉醒 */
    if (S.quest.c2_2 === 'done' && S.bladeStage < 2) S.setBladeStage(2);
    if (S.quest.c5_3 === 'done' && S.bladeStage < 3) S.setBladeStage(3);

    J.UI.refreshQuests();
    S.save();
    return true;
  };

  S.setFlag = function (k, v) { S.flags[k] = v === undefined ? true : v; };
  S.hasFlag = function (k) { return !!S.flags[k]; };

  /* 太玄之刃觉醒 */
  S.setBladeStage = function (n) {
    if (n <= S.bladeStage) return;
    S.bladeStage = n;
    if (J.P && J.P.weapon && J.P.weapon.setStage) J.P.weapon.setStage(n);
    var txt = ['', '封刃', '鸣刃', '太玄觉醒'][n] || '';
    J.UI.flashText('太玄之刃 · ' + txt);
    J.FX.ring(J.P.pos.x, J.P.pos.y + 1.0, J.P.pos.z, 0xb090ff, 5.0);
    J.FX.spark(J.P.pos.x, J.P.pos.y + 1.2, J.P.pos.z, 40, 0xc0a0ff, 2.2);
  };

  /* 每帧条件检查 */
  S.update = function (dt, P) {
    var q = S.currentQuest();
    if (!q) return;

    if (q.type === 'reach') {
      var d = Math.hypot(P.pos.x - q.x, P.pos.z - q.z);
      if (d < q.r) S.advance(q.id);
    } else if (q.type === 'kill') {
      /* 由击杀回调处理 */
    } else if (q.type === 'boss') {
      if (J.boss && J.boss.dead) S.advance(q.id);
    }
  };

  /* 击杀敌人时统计 */
  S.onKill = function (foe) {
    var q = S.currentQuest();
    if (!q || q.type !== 'kill') return;
    var inZone = false;
    if (q.zone === 'fall') inZone = Math.abs(foe.pos.z - 122) < 26;
    else if (q.zone === 'bridge') inZone = Math.abs(foe.pos.z - 50) < 16;
    else if (q.zone === 'lair') inZone = foe.pos.z < -70 && foe.pos.z > -140;
    if (!inZone) return;
    S._kills = (S._kills || 0) + 1;
    if (S._kills >= q.count) { S._kills = 0; S.advance(q.id); }
    else J.UI.toast('还剩 ' + (q.count - S._kills) + ' 人', 1.2);
  };

  /* 交互物触发 */
  S.onInteract = function (id) {
    var q = S.currentQuest();
    if (!q || q.type !== 'use') return;
    if (q.id_ === id) S.advance(q.id);
  };

  /* NPC 对话 */
  S.talk = function (npcKey, dialogId) {
    var d = DIALOG[dialogId];
    if (!d) return false;
    J.UI.showDialog(CAST[d.who].name, d.lines, function () {
      if (d.onEnd) d.onEnd();
    });
    return true;
  };

  /* ── 存档 ── */
  S.save = function () {
    try {
      localStorage.setItem('wuxia_story', JSON.stringify({
        chapter: S.chapter, quest: S.quest, flags: S.flags,
        bladeStage: S.bladeStage, ended: S.ended
      }));
    } catch (e) { }
  };
  S.load = function () {
    try {
      var raw = localStorage.getItem('wuxia_story');
      if (!raw) return;
      var d = JSON.parse(raw);
      if (d.chapter) S.chapter = d.chapter;
      if (d.quest) for (var k in d.quest) S.quest[k] = d.quest[k];
      if (d.flags) S.flags = d.flags;
      if (d.bladeStage) S.bladeStage = d.bladeStage;
      if (d.ended) S.ended = d.ended;
    } catch (e) { }
  };
  S.reset = function () {
    try { localStorage.removeItem('wuxia_story'); } catch (e) { }
    location.reload();
  };

  S.QUESTS = QUESTS;
  S.DIALOG = DIALOG;
  S.CAST = CAST;
  S.CHAPTER_NAME = CHAPTER_NAME;
  return S;
})();
