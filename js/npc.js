/* ═══════════════════════════════════════════════
   npc.js — 剧情 NPC
   山与晨 / 空寂和尚 / 渡口乡民 / 萧无极
   ═══════════════════════════════════════════════ */
J.NPC = (function () {

  var N = { list: [], near: null };

  function mat(c, r) {
    return new THREE.MeshStandardMaterial({ color: c, roughness: r === undefined ? 0.8 : r, metalness: 0.03 });
  }

  function box(w, h, d, m, x, y, z) {
    var e = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    e.position.set(x || 0, y || 0, z || 0);
    e.castShadow = true;
    return e;
  }
  function sph(r, m, x, y, z, sx, sy, sz) {
    var e = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m);
    e.position.set(x || 0, y || 0, z || 0);
    e.scale.set(sx || 1, sy || 1, sz || 1);
    e.castShadow = true;
    return e;
  }

  /* ── 人形模型 ── */
  function buildBody(cfg) {
    var root = new THREE.Group();
    var spin = new THREE.Group(); root.add(spin);
    var body = new THREE.Group(); body.position.y = 0.84; spin.add(body);

    var mCloth = mat(cfg.cloth || 0xb8a888);
    var mTrim = mat(cfg.trim || 0x8a7048);
    var mSkin = mat(cfg.skin || 0xe8cbb4, 0.85);
    var mHair = mat(cfg.hair || 0x2a2420, 0.7);

    var female = !!cfg.female;
    var scale = female ? 0.94 : 1.0;

    /* 腿 */
    for (var s = -1; s <= 1; s += 2) {
      root.add(box(0.13 * scale, 0.80 * scale, 0.14 * scale, mCloth, s * 0.10 * scale, 0.42 * scale, 0));
    }
    /* 裙/袍 */
    if (female) {
      var skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.34, 0.92, 12, 1, true), mCloth);
      skirt.position.y = 0.44; skirt.material.side = THREE.DoubleSide;
      root.add(skirt);
      var sash = box(0.30, 0.09, 0.24, mTrim, 0, 0.86, 0);
      root.add(sash);
    } else {
      root.add(box(0.30 * scale, 0.86 * scale, 0.22 * scale, mCloth, 0, 0.52 * scale, 0));
    }
    /* 上身 */
    var torso = box(0.34 * scale, 0.44 * scale, 0.22 * scale, mCloth, 0, 1.16 * scale, 0);
    root.add(torso);
    /* 肩 */
    root.add(box(0.44 * scale, 0.10 * scale, 0.24 * scale, mTrim, 0, 1.34 * scale, 0));
    /* 手臂 */
    for (var a = -1; a <= 1; a += 2) {
      root.add(box(0.10 * scale, 0.46 * scale, 0.11 * scale, mCloth, a * 0.22 * scale, 1.12 * scale, 0));
      root.add(sph(0.05 * scale, mSkin, a * 0.22 * scale, 0.86 * scale, 0));
    }
    /* 头 */
    var head = new THREE.Group(); head.position.y = 1.46 * scale; root.add(head);
    head.add(sph(0.11 * scale, mSkin, 0, 0.06, 0, 1, 1.05, 0.95));
    head.add(sph(0.115 * scale, mHair, 0, 0.09, -0.015, 1, 0.92, 0.98));
    if (female) {
      /* 长发 */
      head.add(box(0.20 * scale, 0.62 * scale, 0.12 * scale, mHair, 0, -0.26 * scale, -0.06 * scale));
      /* 发饰 */
      head.add(box(0.06 * scale, 0.05 * scale, 0.06 * scale, mTrim, 0.10 * scale, 0.16 * scale, 0));
    }
    /* 眼 */
    head.add(box(0.026, 0.014, 0.02, mat(0x201a16), -0.042 * scale, 0.075 * scale, 0.098 * scale));
    head.add(box(0.026, 0.014, 0.02, mat(0x201a16), 0.042 * scale, 0.075 * scale, 0.098 * scale));

    /* 脚下阴影 */
    var blob = new THREE.Mesh(new THREE.CircleGeometry(0.36, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02;
    root.add(blob);

    return { root: root, spin: spin, head: head, body: body };
  }

  /* ── 头顶名牌 ── */
  function nameTag(text) {
    var cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    var g = cv.getContext('2d');
    g.fillStyle = 'rgba(12,10,8,0.62)';
    g.beginPath();
    var r = 10, W = 256, H = 64;
    g.moveTo(r, 0); g.arcTo(W, 0, W, H, r); g.arcTo(W, H, 0, H, r);
    g.arcTo(0, H, 0, 0, r); g.arcTo(0, 0, W, 0, r); g.closePath(); g.fill();
    g.fillStyle = '#f0dfb8';
    g.font = 'bold 34px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, W / 2, H / 2 + 2);
    var tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, depthTest: false
    }));
    spr.scale.set(1.5, 0.38, 1);
    return spr;
  }

  /* ── 创建一个 NPC ── */
  function spawn(key, x, z, cfg) {
    var y = J.Terrain.heightAt(x, z);
    var b = buildBody(cfg);
    b.root.position.set(x, y, z);
    b.root.rotation.y = cfg.yaw || 0;
    J.S.add(b.root);

    var tag = nameTag(cfg.name);
    tag.position.set(0, 2.05, 0);
    b.root.add(tag);

    var npc = {
      key: key, name: cfg.name, pos: new THREE.Vector3(x, y, z),
      model: b, tag: tag, r: 3.2, cfg: cfg,
      dialog: cfg.dialog, questId: cfg.questId,
      ph: Math.random() * 6.28
    };
    N.list.push(npc);
    return npc;
  }

  /* ── 放置剧情 NPC ── */
  N.init = function () {
    N.list = [];

    /* 山与晨：会在剧情中移动，这里放在崖顶 */
    spawn('shen', 0 + J.Terrain.riverX(178), 178, {
      name: '山与晨', female: true,
      cloth: 0xe6e0f0, trim: 0xb8a8d8, hair: 0xe8e4f4,
      yaw: Math.PI * 1.05,
      dialog: 'shen_meet'
    });

    /* 顾长风：崖顶西侧石上 */
    spawn('gu', -19, 190, {
      name: '顾长风',
      cloth: 0x5a6470, trim: 0x3a4148, hair: 0x6a6258, skin: 0xd0b098,
      yaw: 1.4, dialog: 'gu_first'
    });

    /* 空寂和尚：古寺大殿前 */
    spawn('monk', -52, 22, {
      name: '空寂和尚',
      cloth: 0x9a8a70, trim: 0x6a5a44, hair: 0xd8d0c0,
      yaw: 0.4, dialog: 'monk_talk'
    });

    /* 渡口乡民 */
    spawn('villager', -30, 78, {
      name: '渡口乡民',
      cloth: 0x8a7458, trim: 0x5e4c36, hair: 0x2a2420,
      yaw: 2.2, dialog: 'villager_talk'
    });

    /* 萧无极：山顶断剑宫 */
    spawn('xiao', 0, -179, {
      name: '萧无极',
      cloth: 0x6a1a1a, trim: 0xc08a3a, hair: 0x1a1614,
      yaw: 0, dialog: 'xiao_taunt', boss: true
    });
  };

  /* ── 每帧 ── */
  N.update = function (dt, t, P) {
    var best = null, bd = 1e9;
    for (var i = 0; i < N.list.length; i++) {
      var npc = N.list[i];
      if (npc.hidden) continue;
      /* 呼吸 + 轻微转头看向玩家 */
      npc.tag.position.y = 2.05 + Math.sin(t * 1.4 + npc.ph) * 0.04;
      var toP = Math.atan2(P.pos.x - npc.pos.x, P.pos.z - npc.pos.z);
      var d = Math.hypot(P.pos.x - npc.pos.x, P.pos.z - npc.pos.z);
      if (d < 9) {
        npc.model.spin.rotation.y += J.U.ang(npc.model.spin.rotation.y, toP) * Math.min(1, dt * 3);
      }
      if (d < npc.r && d < bd) { bd = d; best = npc; }
    }
    /* 山与晨参战后：她本人就是对话对象 */
    if (J.Ally && J.Ally.active && !J.Ally.down) {
      var dA = Math.hypot(P.pos.x - J.Ally.pos.x, P.pos.z - J.Ally.pos.z);
      if (dA < 3.2 && dA < bd) {
        bd = dA;
        best = { key: 'shen', name: '山与晨', pos: J.Ally.pos, ally: true };
      }
    }
    N.near = best;

    /* 对话提示 */
    if (best) {
      var q = J.Story && J.Story.currentQuest ? J.Story.currentQuest() : null;
      var hasBusiness = q && q.type === 'talk' && q.npc === best.key;
      J.UI.interactHint(hasBusiness ? ('与' + best.name + '交谈') : ('与' + best.name + '交谈'));
      if (J.UI.showUseBtn) J.UI.showUseBtn(true);
    }
  };

  /* ── 触发对话 ── */
  N.talk = function () {
    var npc = N.near;
    if (!npc) return false;
    var q = J.Story.currentQuest();
    if (!q) { J.UI.toast(npc.name + '：江湖路远，各自珍重。', 1.8); return true; }

    /* 按任务决定对话 */
    if (q.type === 'talk' && q.npc === npc.key) {
      var dlgId = null;
      if (npc.key === 'shen') {
        if (q.id === 'c1_1') dlgId = 'shen_meet';
        else if (q.id === 'c2_2') dlgId = 'shen_c2_end';
        else if (q.id === 'c4_3') dlgId = 'shen_c4';
        else if (q.id === 'c6_3') dlgId = 'shen_final';
      } else if (npc.key === 'monk') {
        if (q.id === 'c3_2') dlgId = 'monk_talk';
      } else if (npc.key === 'villager') {
        if (q.id === 'c4_1') dlgId = 'villager_talk';
      }
      if (dlgId) {
        J.Story.talk(npc.key, dlgId);
        /* 纯打探型对话直接完成 */
        if (q.id === 'c4_1') J.Story.advance('c4_1');
        return true;
      }
    }

    /* ══ 顾长风：三段后续 ══ */
    if (npc.key === 'gu' && J.Story) {
      var St = J.Story;

      /* 首次相遇 */
      if (!St.hasFlag('metGu')) {
        St.talk('gu', 'gu_first');
        return true;
      }

      /* 支线 3：战后回崖顶 */
      if (St.ended && !St.hasFlag('epilogueSeen')) {
        J.Cine.mentor(npc, [{ t: 0.2, who: '顾长风', text: '回来了。', dur: 1.4 }],
          function () { St.talk('gu', 'gu_epilogue'); });
        return true;
      }

      /* 支线 2：天绝峰前授刀道 */
      if (!St.hasFlag('guTeachDaodao') && St.quest.c5_3 === 'done' && St.hasFlag('guTeachDaoyi')) {
        J.Cine.mentor(npc, [{ t: 0.2, who: '顾长风', text: '我等这一天，等了二十年。', dur: 2.0 }],
          function () { St.talk('gu', 'gu_teach2'); });
        return true;
      }

      /* 支线 1：授刀意 */
      if (!St.hasFlag('guTeachDaoyi') && (St.bladeStage >= 2 || St.quest.c2_2 === 'done')) {
        J.Cine.mentor(npc, [{ t: 0.2, who: '顾长风', text: '坐。', dur: 1.4 }],
          function () { St.talk('gu', 'gu_teach'); });
        return true;
      }

      /* 都教完了：闲聊 */
      var lines = St.hasFlag('guTeachDaodao')
        ? ['顾长风：刀收得回去，人就还在。', '顾长风：剩下的路，你自己走。']
        : ['顾长风：先去把该救的人救回来。', '顾长风：刀的事，不急。'];
      J.UI.showDialog('顾长风', lines, null);
      return true;
    }

    /* 无业务往来：说一句闲话 */
    var idle = {
      shen: (J.Ally && J.Ally.active) ? '山与晨：刀别握太死。' : '山与晨：当心脚下。',
      monk: '空寂和尚：阿弥陀佛。',
      villager: '乡民：这年景，能活着就好。',
      xiao: '萧无极：你还不配与我一战。',
      gu: '顾长风：……'
    };
    J.UI.toast(idle[npc.key] || (npc.name + '：……'), 2.0);
    return true;
  };

  N.hide = function (key) {
    var npc = N.get(key);
    if (!npc) return;
    npc.hidden = true;
    npc.model.root.visible = false;
    npc.tag.visible = false;
  };

  N.show = function (key) {
    var npc = N.get(key);
    if (!npc) return;
    npc.hidden = false;
    npc.model.root.visible = true;
    npc.tag.visible = true;
  };

  N.get = function (key) {
    for (var i = 0; i < N.list.length; i++) if (N.list[i].key === key) return N.list[i];
    return null;
  };

  /* 让 NPC 移动到指定位置（剧情需要） */
  N.moveTo = function (key, x, z) {
    var npc = N.get(key);
    if (!npc) return;
    npc.pos.set(x, J.Terrain.heightAt(x, z), z);
    npc.model.root.position.copy(npc.pos);
  };

  return N;
})();
