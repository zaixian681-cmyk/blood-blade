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
    shen: { name: '山与晨', title: '山与晨公主', color: 0xd8c8f0 },
    lu: { name: '现与在', title: '主角', color: 0x9aa4b8 },
    xiao: { name: '萧无极', title: '血衣门主', color: 0x8a2020 },
    villager: { name: '渡口乡民', title: '', color: 0xa89880 },
    monk: { name: '空寂和尚', title: '守寺人', color: 0xb8a888 },
    gu: { name: '顾长风', title: '断岳刀客', color: 0x6a7a8a }
  };

  /* ══ 对话库 ══ */
  var DIALOG = {
    /* ══ 第一章 · 血夜惊变 ══ */
    gu_first: {
      who: 'gu',
      lines: [
        '（崖边石上坐着个披发老者，酒葫芦倒在脚边，腰间断刀满是豁口。）',
        '顾长风：你身上那股味儿…… 血衣门的。',
        '顾长风：还有太玄之刃的腥气。',
        '现与在：你认识这把刀。',
        '顾长风：二十年前，持刀那人站在我身边。后来他死了。',
        '顾长风：你现在拿着它，是想报仇，还是想送死？',
        '现与在：我要救人。',
        '顾长风：救人？（他笑了一声，很刺耳）刀客救不了人，只能杀更多的人。',
        '顾长风：去吧。等你明白刀是为什么而拔，再回来找我。'
      ],
      onEnd: function () { S.setFlag('metGu'); }
    },
    shen_meet: {
      who: 'shen',
      lines: [
        '（崖顶风急。白衣女子立在崖边，手中攥着一卷染血的密信。）',
        '山与晨：你终于来了。',
        '现与在：山与晨？',
        '山与晨：长公主这个身份，现在只会招来杀身之祸。',
        '山与晨：血衣门突袭皇城那夜，我逃出来时带走了他们的密信。',
        '山与晨：信上写着他们要在青崖山搜一块玉佩 —— 一块和你的刀有关的玉佩。',
        '现与在：……我的刀？',
        '山与晨：看来你还什么都不知道。',
        '山与晨：先活下来。血衣门的追兵就在崖下。'
      ],
      onEnd: function () { S.advance('c1_1'); }
    },
    shen_c1_end: {
      who: 'shen',
      lines: [
        '（追兵尸体横在崖下，最后一个死在瀑布水雾里。）',
        '山与晨：你出手的样子，不像山野猎户。',
        '现与在：我师父教过。',
        '山与晨：他叫什么？',
        '现与在：他没说。临终只留一句 ——',
        '现与在：「刀能杀人，也能护人。你若只为仇恨挥刀，终有一天会死在自己的刀下。」',
        '山与晨：（沉默片刻）这句话，我在皇室旧档里见过。',
        '山与晨：走吧。谷底渡口有船，我们去查那座古寺。'
      ],
      onEnd: function () { S.advance('c2_1'); }
    },

    /* ══ 第二章 · 断魂吊桥 ══ */
    shen_c2_1: {
      who: 'shen',
      lines: [
        '（桥头血迹未干，血衣门的旗插在木栏上。）',
        '山与晨：他们封了桥。',
        '山与晨：这些人不只是杀手 —— 他们在挑起各派互相残杀。',
        '山与晨：我见过一次，他们把两派的信物调换，让两派以为对方先动的手。',
        '现与在：为什么？',
        '山与晨：江湖越乱，就越没人顾得上查他们的底细。'
      ]
    },
    shen_c2_end: {
      who: 'shen',
      lines: [
        '（最后一名守卫倒下。桥那头雾里，隐约有更多火把。）',
        '山与晨：过了桥就是北坡，血衣门总坛在那里。',
        '山与晨：但我不能就这么冲进去 —— 我得先弄清他们到底想要什么。',
        '山与晨：谷底那座废弃古寺，是他们运东西的落脚点。',
        '山与晨：我们先去那儿。'
      ],
      onEnd: function () { S.advance('c3_1'); }
    },

    /* ══ 第三章 · 古寺藏锋 ══ */
    monk_talk: {
      who: 'monk',
      lines: [
        '空寂和尚：施主，这寺空了十年。',
        '空寂和尚：十年前血衣门来过一次，抬走了十几只箱子。',
        '空寂和尚：从那以后，佛像后面那扇门，再没人敢开。',
        '现与在：门后是什么？',
        '空寂和尚：是旧事。',
        '空寂和尚：（他看了一眼你腰间的刀）施主这把刀…… 老衲见过。',
        '空寂和尚：二十年前，一个年轻人背着它跪在这殿里，说要为父报仇。',
        '空寂和尚：后来他成了这寺里最后一任守刀人。',
        '现与在：他在哪？',
        '空寂和尚：死了。死在血衣门手里。'
      ],
      onEnd: function () { S.setFlag('knowsFather'); S.advance('c3_2'); }
    },
    shen_c3: {
      who: 'shen',
      lines: [
        '山与晨：账册、密令、买通北境三镇的凭据。',
        '山与晨：他们要的不是钱 —— 是让整个武林都听命于一个不在朝廷册封里的「门」。',
        '山与晨：萧无极想做的，是皇帝。'
      ]
    },
    shen_c3_end: {
      who: 'shen',
      lines: [
        '（密道尽头的箱子已被打开，账册摊在地上，旁边压着一封信。）',
        '山与晨：账册有了。还有这封…… 是写给「守刀人」的。',
        '现与在：（接过信，手在抖）',
        '「持刀者若见此信，说明我已不在。」',
        '「太玄秘藏不是兵器，是一份名单 —— 所有能被收买的人。」',
        '「把它烧了，或者用它守住该守的人。别让它落进任何一个人手里。」',
        '山与晨：……这是你父亲写的。',
        '现与在：我知道。',
        '山与晨：外面来人了。走！'
      ],
      onEnd: function () { S.setFlag('knowsFatherFull'); S.advance('c4_1'); }
    },

    /* ══ 第四章 · 皇城风云 ══ */
    villager_talk: {
      who: 'villager',
      lines: [
        '乡民：客官，别往北走啦！',
        '乡民：血衣门昨夜封了渡口，说要抓个刺客。',
        '乡民：可我们都知道，那「刺客」是替朝廷挡刀的。',
        '乡民：（压低声音）他们在城门贴了告示，说现与在杀了皇室、勾结魔教。',
        '乡民：这年头，说真话的人反倒成了反贼。'
      ],
      onEnd: function () { S.setFlag('wanted'); S.advance('c4_2'); }
    },
    shen_c4: {
      who: 'shen',
      lines: [
        '山与晨：他们把你写成了凶手。',
        '山与晨：我父王不会信 —— 但他被围在宫里，听不见外面的声音。',
        '现与在：那就先把你送回去。',
        '山与晨：回去做什么？',
        '山与晨：你以为我只是等着被救的人？',
        '山与晨：我在总坛待了七天，看清了他们所有布防。',
        '山与晨：路线、换岗、牢门钥匙在谁身上 —— 我全记下来了。',
        '山与晨：这一趟，不是你救我。是我们一起把这件事了结。'
      ],
      onEnd: function () { S.advance('c5_1'); }
    },

    /* ══ 第五章 · 血衣围城 ══ */
    shen_captured: {
      who: 'shen',
      lines: [
        '（总坛石牢，火把把影子拉得很长。山与晨被缚在柱上，脸上有伤。）',
        '山与晨：你来得比我算的快了半刻。',
        '现与在：你受伤了。',
        '山与晨：皮肉而已。',
        '山与晨：他们没找到账册 —— 我早抄了一份，缝在衣角里。',
        '山与晨：四大护法在东面和北面，中间空出来，是因为萧无极想让你走那条路。',
        '山与晨：他等的是你，不是救我。'
      ],
      onEnd: function () { S.advance('c5_2'); }
    },
    shen_freed: {
      who: 'shen',
      lines: [
        '（绳索落地。山与晨站起身，从靴中抽出一把短刃。）',
        '山与晨：我在宫里学的第一件事，是怎么在没人看见的时候活下去。',
        '山与晨：萧无极在断剑宫等你。',
        '现与在：你不必去。',
        '山与晨：（她笑了）这一路你说过多少次「你不必」。',
        '山与晨：现与在，我也有刀。',
        '山与晨：走吧。这一次，一起。'
      ],
      onEnd: function () { S.setFlag('shenFreed'); S.advance('c6_1'); }
    },


    /* ══ 顾长风 · 授刀意（支线）══ */
    gu_teach: {
      who: 'gu',
      lines: [
        '（顾长风把断刀横放在膝上，豁口密得像水纹。）',
        '顾长风：坐。',
        '顾长风：你的刀比上回快了，也狠了。',
        '现与在：我杀了不少人。',
        '顾长风：刀本来就会杀。问题不在杀多少，在你落刀之前，心里那口气是什么。',
        '顾长风：恨能让你第一刀很猛，第二刀就散了。你方才那几刀，是恨。',
        '现与在：那我该凭什么出刀？',
        '顾长风：凭你要护住的东西。',
        '顾长风：（他抬手，断刀在风里走了一道极轻的弧）',
        '顾长风：刀到尽头，还有一口气。气不散，刀就不散 —— 这一口气，叫刀魂。',
        '顾长风：连着一口气砍下去，魂就积得住；停下来喘半口气，它就散了。',
        '（你照着他的样子挥出一刀。刀锋过处，风被劈开一线。）'
      ],
      onEnd: function () {
        S.setFlag('guTeachDaoyi');
        S.doneSide('s1');
        S.setBladeStage(2);
        if (J.Soul) J.Soul.fill(46);
        J.UI.flashText('习 得 · 刀 意「断 岳」');
        J.UI.toast('重击将带出刀气余波 · 连续命中积累刀魂', 3.4);
        J.FX.ring(J.P.pos.x, J.P.pos.y + 0.8, J.P.pos.z, 0xa8c8ff, 6.0);
        J.FX.spark(J.P.pos.x, J.P.pos.y + 1.2, J.P.pos.z, 40, 0xcfe0ff, 2.4);
        J.FX.shake(0.16, 0.4);
      }
    },

    /* ══ 顾长风 · 天绝峰前（支线）══ */
    gu_teach2: {
      who: 'gu',
      lines: [
        '（断剑宫外，顾长风背对着你，望着远处的云。）',
        '顾长风：我等这一天等了二十年。',
        '现与在：等我？',
        '顾长风：等你走到这里。',
        '顾长风：他死的那天，握刀的手是松的。我一直想不明白。',
        '现与在：现在明白了？',
        '顾长风：明白了。因为他已经把该护的人，都推到身后了。',
        '顾长风：刀客一辈子只学一件事 —— 什么时候收刀。',
        '现与在：收刀？',
        '顾长风：杀完了人，还能把刀收回去的，才叫刀客。收不回去的，那叫凶器。',
        '顾长风：去吧。这一战我不替你打。',
        '顾长风：（他解下酒葫芦，把最后一口酒泼在地上）',
        '顾长风：但我在。'
      ],
      onEnd: function () {
        S.setFlag('guTeachDaodao');
        S.doneSide('s2');
        J.UI.flashText('刀 道 · 收 刀');
        J.UI.toast('对萧无极伤害提升 · 他会在关键时刻替你挡下一刀', 3.6);
        J.FX.ring(J.P.pos.x, J.P.pos.y + 1.0, J.P.pos.z, 0xffd8a0, 5.0);
      }
    },

    /* ══ 顾长风 · 战后（尾声）══ */
    gu_epilogue: {
      who: 'gu',
      lines: [
        '（崖顶的风比来时轻。顾长风还坐在那块石头上，酒葫芦空了。）',
        '顾长风：回来了。',
        '现与在：回来了。',
        '顾长风：刀呢？',
        '现与在：（他把太玄之刃送回鞘里）收着。',
        '顾长风：（他笑了。很难看，但确实是笑）',
        '顾长风：那你算是学会了。',
        '现与在：我一直想问你 —— 二十年前，你为什么不跟他一起走？',
        '顾长风：因为他让我留下。',
        '顾长风：留下看着你长大。',
        '（他站起来，断刀往肩上一扛，往山下走。）',
        '顾长风：江湖还在。别急着回来喝酒。'
      ],
      onEnd: function () {
        S.doneSide('s3');
        S.setFlag('epilogueSeen');
        J.UI.flashText('刀 道 大 成');
        J.UI.toast('主线 · 支线全部完成 · 可自由探索江湖', 4.0);
      }
    },

    /* ══ 山与晨 · 同行（参战后）══ */
    shen_companion: {
      who: 'shen',
      lines: [
        '山与晨：刀别握太死。',
        '现与在：你也一样。',
        '山与晨：（她掂了掂手里的短刃）',
        '山与晨：放心，我这一刀，比你想的准。'
      ]
    },

    /* ══ 第六章 · 天绝峰之战 ══ */
    xiao_taunt: {
      who: 'xiao',
      lines: [
        '（断剑宫前，血衣如林。萧无极背对着你，手里抚着一柄无鞘的刀。）',
        '萧无极：你父亲也站在这里。',
        '萧无极：二十年前，我给他两个选择 —— 交出秘藏，或者交出性命。',
        '萧无极：他选了第三个。他把秘藏藏进了刀里，然后把刀留给了你。',
        '现与在：所以你要杀我。',
        '萧无极：不。我要你亲手把它交出来。',
        '萧无极：只有持刀者自愿献出，秘藏才会打开。',
        '萧无极：你以为你在救人？你在替我把钥匙送到手上。',
        '现与在：那你就试试能不能拿。',
        '萧无极：好。让我看看，你父亲教了你什么。'
      ],
      onEnd: function () { S.setFlag('bossFight'); J.spawnBossEncounter(); }
    },
    shen_final: {
      who: 'shen',
      lines: [
        '（萧无极倒下。断剑宫的火把一盏盏熄灭。）',
        '山与晨：结束了。',
        '现与在：没有。这上面还有名字 —— 朝里还有他的人。',
        '山与晨：所以我父王的江山，还没坐稳。',
        '现与在：你要回去吗？',
        '山与晨：（沉默很久）',
        '山与晨：回去做什么？做回那个坐在宫里的长公主，等着下一次被人掳走？',
        '山与晨：这一路上，我第一次觉得自己活着。',
        '现与在：（他把太玄之刃收回鞘中，刀身泛起淡紫的光）',
        '现与在：这一路，我杀过恶人，也差点成了恶人。',
        '现与在：现在我才明白 —— 刀的锋芒不在杀多少人，在于能守住什么。',
        '山与晨：那以后，你还会走吗？',
        '现与在：（望向远处群山）',
        '现与在：江湖未平，我的刀就不会停。',
        '现与在：但这一次，我不再是一个人。'
      ],
      onEnd: function () {
        S.ended = true;
        S.setBladeStage(3);
        S.advance('c6_3');
        S.save();
        J.UI.regionBanner('江 湖 未 平');
        setTimeout(function () { J.UI.toast('主线完成 · 已开放自由探索', 3.6); }, 1500);
      }
    }
  };

  /* ══ 任务链 ══ */
  var QUESTS = [
    /* 第一章：血夜惊变 */
    { id: 'c1_1', ch: 1, name: '崖顶会面', desc: '与山与晨交谈，问清密信来历', type: 'talk', npc: 'shen', x: 0, z: 178, r: 4 },
    { id: 'c1_2', ch: 1, name: '血夜惊变', desc: '击退崖下的血衣门追兵', type: 'kill', zone: 'fall', count: 3 },
    { id: 'c1_3', ch: 1, name: '沿栈道下谷', desc: '从崖壁栈道下到谷底渡口', type: 'reach', x: 0, z: 60, r: 30 },

    /* 第二章：断魂吊桥 */
    { id: 'c2_1', ch: 2, name: '孤刀战群雄', desc: '清掉守桥的血衣门刀客', type: 'kill', zone: 'bridge', count: 2 },
    { id: 'c2_2', ch: 2, name: '与公主会合', desc: '回到崖下与山与晨会合', type: 'talk', npc: 'shen', x: 0, z: 100, r: 5 },

    /* 第三章：古寺藏锋 */
    { id: 'c3_1', ch: 3, name: '寻访古寺', desc: '找到谷底的废弃古寺', type: 'reach', x: -52, z: 20, r: 14 },
    { id: 'c3_2', ch: 3, name: '守刀人旧事', desc: '向空寂和尚打听佛像后的门', type: 'talk', npc: 'monk', x: -52, z: 24, r: 4 },
    { id: 'c3_3', ch: 3, name: '开佛像暗门', desc: '在佛殿佛像后打开密道', type: 'use', id_: 'passage' },
    { id: 'c3_4', ch: 3, name: '取得账册', desc: '从密道宝箱取出账册', type: 'use', id_: 'ledger' },

    /* 第四章：皇城风云 */
    { id: 'c4_1', ch: 4, name: '天下皆敌', desc: '向乡民打探封渡原因', type: 'talk', npc: 'villager', x: -30, z: 78, r: 4 },
    { id: 'c4_2', ch: 4, name: '过桥北上', desc: '穿过谷底木桥', type: 'reach', x: 0, z: 40, r: 12 },
    { id: 'c4_3', ch: 4, name: '与公主商议', desc: '听山与晨的打算', type: 'talk', npc: 'shen', x: 0, z: 30, r: 5 },

    /* 第五章：血衣围城 */
    { id: 'c5_1', ch: 5, name: '潜入总坛', desc: '抵达北坡血衣门总坛', type: 'reach', x: 0, z: -100, r: 26 },
    { id: 'c5_2', ch: 5, name: '千军之中', desc: '击溃总坛守卫', type: 'kill', zone: 'lair', count: 5 },
    { id: 'c5_3', ch: 5, name: '救出公主', desc: '解开山与晨的绳索', type: 'use', id_: 'rescueShen' },

    /* 第六章：天绝峰之战 */
    { id: 'c6_1', ch: 6, name: '登顶', desc: '与公主同上断剑宫', type: 'reach', x: 0, z: -186, r: 30 },
    { id: 'c6_2', ch: 6, name: '一刀定乾坤', desc: '击败血衣魔尊萧无极', type: 'boss' },
    { id: 'c6_3', ch: 6, name: '尘埃落定', desc: '与公主说完最后一句话', type: 'talk', npc: 'shen', x: 0, z: -178, r: 6 }
  ];

  var CHAPTER_NAME = ['', '第一章 · 血夜惊变', '第二章 · 断魂吊桥', '第三章 · 古寺藏锋',
    '第四章 · 皇城风云', '第五章 · 血衣围城', '第六章 · 天绝峰之战'];

  /* ══ 支线：顾长风线 ══ */
  var SIDE = [
    { id: 's1', name: '再访断岳刀客', hint: '崖顶的刀客在等你' },
    { id: 's2', name: '天绝峰前', hint: '断剑宫外有人在等你' },
    { id: 's3', name: '江湖再见', hint: '战后再回崖顶' }
  ];
  S.side = {};
  S.SIDE = SIDE;

  S.initSide = function () {
    for (var i = 0; i < SIDE.length; i++) if (!S.side[SIDE[i].id]) S.side[SIDE[i].id] = 'locked';
  };
  S.sideInfo = function (id) {
    for (var i = 0; i < SIDE.length; i++) if (SIDE[i].id === id) return SIDE[i];
    return null;
  };
  S.setSide = function (id) {
    if (S.side[id] === 'active' || S.side[id] === 'done') return;
    S.side[id] = 'active';
    var info = S.sideInfo(id);
    if (J.UI && J.UI.setSide) J.UI.setSide(info ? info.name : '');
    if (J.UI && info) J.UI.toast('支线 · ' + info.name, 2.4);
  };
  S.doneSide = function (id) {
    S.side[id] = 'done';
    if (J.UI && J.UI.setSide) J.UI.setSide('');
    S.save();
  };
  S.activeSide = function () {
    for (var i = 0; i < SIDE.length; i++) if (S.side[SIDE[i].id] === 'active') return SIDE[i];
    return null;
  };
  S.refreshSide = function () {
    var a = S.activeSide();
    if (J.UI && J.UI.setSide) J.UI.setSide(a ? a.name : '');
  };

  /* ══ 逻辑 ══ */
  S.init = function () {
    for (var i = 0; i < QUESTS.length; i++) {
      if (!S.quest[QUESTS[i].id]) S.quest[QUESTS[i].id] = 'locked';
    }
    S.quest.c1_1 = 'active';
    S.chapter = 1;
    S.initSide();
    S.load();
    if (S.chapter === 0) { S.chapter = 1; }
    J.UI.setChapter(CHAPTER_NAME[S.chapter] || '');
    J.UI.refreshQuests();

    /* ── 存档恢复 ── */
    if (S.hasFlag('shenFreed')) {
      if (J.NPC) J.NPC.hide('shen');
      if (J.Ally && !J.Ally.active) {
        J.Ally.spawn(J.P.pos.x + 1.2, J.P.pos.z + 1.2, J.P.yaw);
      }
    }
    /* 支线节点恢复 */
    if (S.quest.c2_2 === 'done' && !S.hasFlag('guTeachDaoyi')) S.setSide('s1');
    if (S.quest.c5_3 === 'done' && S.hasFlag('guTeachDaoyi') && !S.hasFlag('guTeachDaodao')) S.setSide('s2');
    if (S.ended && !S.hasFlag('epilogueSeen')) S.setSide('s3');
    S.refreshSide();

    /* 战斗中重载：把 Boss 补回来 */
    if (S.quest.c6_2 === 'active' && !S.flags.bossDone) {
      /* 上次没打完：重新摆好战场 */
      S.flags.bossActive = false;
      setTimeout(function () { J.spawnBossEncounter(true); }, 500);
    }
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
          /* 章节过场：镜头推向角色，字幕打出章名 */
          if (J.Cine && J.Cine.chapterIntro) {
            J.Cine.chapterIntro(CHAPTER_NAME[S.chapter], '');
          } else {
            J.UI.regionBanner(CHAPTER_NAME[S.chapter]);
          }
        }
        break;
      }
    }
    /* 山与晨随剧情移动 */
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

    /* ── 剧情驱动的世界变化 ── */
    if (id === 'c1_3' && J.NPC) {
      /* 下到谷底后，山与晨先行一步在渡口等 */
      var sx = J.Terrain.riverX(100);
      J.NPC.moveTo('shen', sx, 100);
    }
    if (id === 'c1_2' && J.NPC && J.NPC.get('shen')) {
      /* 打完追兵，她走到崖下 */
      J.NPC.moveTo('shen', J.Terrain.riverX(140), 140);
    }
    if (S.quest.c5_3 === 'done' && !S.hasFlag('shenFreed')) S.activateAlly();
    if (S.quest.c2_2 === 'done' && !S.hasFlag('guTeachDaoyi')) S.setSide('s1');
    if (S.quest.c5_3 === 'done' && S.hasFlag('guTeachDaoyi') && !S.hasFlag('guTeachDaodao')) {
      S.setSide('s2');
      if (J.NPC) J.NPC.moveTo('gu', 13, -166);
    }
    if (S.ended && !S.hasFlag('epilogueSeen')) {
      S.setSide('s3');
      if (J.NPC) J.NPC.moveTo('gu', -19, 190);
    }

    /* 章节内的刀觉醒 */
    if (S.quest.c2_2 === 'done' && S.bladeStage < 2) S.setBladeStage(2);
    if (S.quest.c5_3 === 'done' && S.bladeStage < 3) S.setBladeStage(3);

    J.UI.refreshQuests();
    S.save();
    return true;
  };

  /* ── 山与晨正式同行 ── */
  S.activateAlly = function () {
    if (!J.Ally || J.Ally.active) return;
    S.setFlag('shenFreed');
    if (J.NPC) J.NPC.hide('shen');
    var px = J.P ? J.P.pos.x + 1.4 : 0;
    var pz = J.P ? J.P.pos.z + 0.6 : -176;
    J.Ally.spawn(px, pz, J.P ? J.P.yaw : 0);
    J.UI.toast('山与晨 · 加入同行', 2.8);
    J.UI.flashText('我 也 有 刀');
    if (J.Cine) J.Cine.flash(0xe0d0ff, 0.7, 0.3);
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
    if (foe && foe.cfg && foe.cfg.phases) { S.onBossDown(foe); return; }
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

  /* ══ 最终 Boss 战：萧无极 · 三阶段 ══ */
  J.spawnBossEncounter = function (silent) {
    if (S.flags.bossActive || S.flags.bossDone) return null;
    S.setFlag('bossActive');

    var npc = J.NPC.get('xiao');
    var bx = 0, bz = -179, byaw = Math.PI;
    if (npc) {
      bx = npc.pos.x; bz = npc.pos.z; byaw = npc.model.spin.rotation.y;
      npc.model.root.visible = false;
      npc.tag.visible = false;
    }

    var f = new J.Foe('xiaowuji', bx, bz, byaw);
    f.home.set(bx, bz);
    J.foes.push(f);

    /* 三阶段：1600 血，66% / 33% 换招式组 */
    J.Boss.setup(f, { hp: 1600 });

    if (!silent) {
      J.Cine.bossIntro(f, '血 衣 门 主 · 萧 无 极', '「让我看看，你父亲教了你什么。」');
      J.FX.shake(0.24, 0.6);
      J.FX.ring(bx, J.Terrain.heightAt(bx, bz) + 1.0, bz, 0x8a1a14, 6.0);
    }
    S.save();
    return f;
  };

  /* 顾长风在第三阶段出手——他答应过「但我在」 */
  if (J.Boss) {
    J.Boss.onPhase = function (foe, idx) {
      if (idx !== 2 || !S.hasFlag('guTeachDaodao') || S.flags.guAssistDone) return;
      S.flags.guAssistDone = true;
      setTimeout(function () {
        if (!foe || foe.dead || foe.gone) return;
        J.UI.flashText('顾长风 · 断岳');
        if (J.Cine) J.Cine.flash(0xfff0d0, 0.55, 0.5);
        J.FX.ring(foe.pos.x, foe.pos.y + 1.1, foe.pos.z, 0xffd8a0, 7.0);
        J.FX.ring(foe.pos.x, foe.pos.y + 1.6, foe.pos.z, 0xff8a4a, 4.4);
        J.FX.spark(foe.pos.x, foe.pos.y + 1.3, foe.pos.z, 44, 0xffe0b0, 3.2);
        foe.hurt(Math.round(foe.maxHp * 0.055), foe.pos, 5.0, true);
        foe.bossInvuln = false;
        foe.enter('stagger', 1.7);
        foe.cd = 1.4;
        J.FX.shake(0.30, 0.5);
        J.UI.toast('顾长风替你挡下一击', 2.6);
      }, 1500);
    };
  }

  /* ── 终局抉择：焚名单 / 收名单 ── */
  S.addFinalChoice = function (foe) {
    if (!J.Interact || !foe) return;
    var x = foe.pos.x, z = foe.pos.z + 2.2, y = J.Terrain.heightAt(x, z);
    J.Interact.add({
      id: 'burnList', x: x, y: y, z: z, r: 3.2, label: '焚烧名单', tag: 'choice',
      onUse: function () {
        S.setFlag('endingBurn');
        S.save();
        J.FX.spark(x, y + 1.1, z, 40, 0xffb060, 2.2);
        J.FX.ring(x, y + 0.6, z, 0xff8a3a, 4.0);
        J.UI.flashText('一 把 火');
        J.UI.toast('名单在火里卷成灰。江湖少了一份把柄，也少了一条路。', 3.6);
      }
    });
    J.Interact.add({
      id: 'keepList', x: x - 2.4, y: J.Terrain.heightAt(x - 2.4, z), z: z, r: 3.2, label: '收起名单', tag: 'choice',
      onUse: function () {
        S.setFlag('endingKeep');
        S.save();
        J.FX.ring(x - 2.4, J.Terrain.heightAt(x - 2.4, z) + 0.8, z, 0xa8c8ff, 3.2);
        J.UI.flashText('收 入 怀 中');
        J.UI.toast('名单贴着你心口。往后每一次落刀，都要先想起这上面的名字。', 3.6);
      }
    });
  };

  /* ── Boss 倒下：终局演出 ── */
  S.onBossDown = function (foe) {
    if (S.flags.bossDone) return;
    S.setFlag('bossDone');
    S.quest.c6_2 = 'done';
    S.quest.c6_3 = 'active';
    S.chapter = 6;
    J.UI.setChapter(CHAPTER_NAME[6]);
    J.UI.refreshQuests();
    S.save();

    J.slowMo = 0.62;
    setTimeout(function () {
      J.slowMo = 1;
      /* 终局镜头 → 山与晨走上来 → 最后一段对话 */
      J.Cine.finale(function () {
        if (J.Ally && J.Ally.active) {
          J.Ally.state = 'idle';
          J.Ally.target = null;
        }
        S.save();
        /* 终局抉择：名单烧掉，还是留下 */
        S.addFinalChoice(foe);
        setTimeout(function () {
          if (J.UI && J.UI.showDialog) S.talk('shen', 'shen_final');
        }, 600);
      });
    }, 1500);
  };

  /* ── 存档 ── */
  S.save = function () {
    try {
      localStorage.setItem('wuxia_story', JSON.stringify({
        chapter: S.chapter, quest: S.quest, flags: S.flags, side: S.side,
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
      if (d.side) for (var k2 in d.side) S.side[k2] = d.side[k2];
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
