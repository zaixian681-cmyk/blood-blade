/* ═══ ui.js — 抬头显示 ═══ */
J.UI = {
  init: function () {
    this.$hpF = document.getElementById('hpF');
    this.$hpT = document.getElementById('hpT');
    this.$spF = document.getElementById('spF');
    this.$tgt = document.getElementById('target');
    this.$tgtName = document.getElementById('tgtName');
    this.$tgtFill = document.getElementById('tgtFill');
    this.$combo = document.getElementById('combo');
    this.$comboBox = document.getElementById('comboBox');
    this.$toast = document.getElementById('toast');
    this.$qiF = document.getElementById('qiF');
    this.$moveName = document.getElementById('moveName');
    this.$flash = document.getElementById('flash');
    this.$chargeWrap = document.getElementById('chargeWrap');
    this.$chargeBar = document.getElementById('chargeBar');
    this.$bUlt = document.getElementById('bUlt');
    this.$bUse = document.getElementById('bUse');
    this.$hint = document.getElementById('interactHint');
    this.$banner = document.getElementById('regionBanner');
    this.$objList = document.getElementById('objList');
    this._objEls = {};
    this._moveT = 0; this._chargeOn = false;
    this._lastHp = -1; this._lastSp = -1; this._lastCombo = -1;
    this._toastT = 0;
    this._tgtE = null;
    this.$soulWrap = document.getElementById('soulWrap');
    this.$soulFill = document.getElementById('soulFill');
    this.$soulPips = document.getElementById('soulPips');
    this.$soulTag = document.getElementById('soulTag');
    this.$soulGlow = document.getElementById('soulGlow');
    this.$chain = document.getElementById('chainBox');
    this.$chainNum = document.getElementById('chainNum');
    this.$bossBar = document.getElementById('bossBar');
    this.$bossName = document.getElementById('bossName');
    this.$bossPhaseName = document.getElementById('bossPhaseName');
    this.$bossFill = document.getElementById('bossFill');
    this.$allyBar = document.getElementById('allyBar');
    this.$allyFill = document.getElementById('allyFill');
    this._lastSoul = -1; this._lastChain = -1; this._lastLv = -1;
    this._lastBossHp = -1; this._bossShown = false;
    this._lastAllyHp = -1; this._allyOn = false;
    this.layout();
  },

  update: function (dt) {
    var P = J.P;
    if (!P) return;
    var hp = Math.max(0, P.hp) / P.maxHp;
    if (Math.abs(hp - this._lastHp) > 0.001) {
      this.$hpF.style.width = (hp * 100) + '%';
      this.$hpT.textContent = Math.ceil(Math.max(0, P.hp)) + ' / ' + P.maxHp;
      this._lastHp = hp;
    }
    var sp = Math.max(0, P.stamina) / P.maxStamina;
    if (Math.abs(sp - this._lastSp) > 0.001) {
      this.$spF.style.width = (sp * 100) + '%';
      this._lastSp = sp;
    }

    /* 内力 */
    var qi = Math.max(0, P.qi) / P.maxQi;
    if (this.$qiF && Math.abs(qi - (this._lastQi === undefined ? -1 : this._lastQi)) > 0.002) {
      this.$qiF.style.width = (qi * 100) + '%';
      this.$qiF.classList.toggle('full', qi >= 0.98);
      this._lastQi = qi;
    }

    /* 绝技按钮可用状态 */
    if (this.$bUlt) {
      var victim = J.findBreakFoe ? J.findBreakFoe() : null;
      var fin = J.Combat.canFinisher();
      var sk = J.Combat.canSkill();
      var usable = !!victim || fin || sk;
      this.$bUlt.classList.toggle('off', !usable);
      this.$bUlt.classList.toggle('ready', usable && !victim);
      this.$bUlt.classList.toggle('exec', !!victim);
      var soulReady = J.Combat.canSoul ? J.Combat.canSoul() : false;
      if (soulReady) {
        this.$bUlt.classList.remove('off');
        this.$bUlt.classList.add('ready');
        this.$bUlt.classList.remove('exec');
        this.$bUlt.classList.add('soul');
        if (this.$bUlt.textContent !== '魂') this.$bUlt.textContent = '魂';
      } else {
        this.$bUlt.classList.remove('soul');
        var label = victim ? '决' : '绝';
        if (this.$bUlt.textContent !== label) this.$bUlt.textContent = label;
      }
    }

    /* 招式名淡出 */
    if (this._moveT > 0) {
      this._moveT -= dt;
      if (this._moveT <= 0) this.$moveName.classList.remove('on');
    }

    /* 目标 */
    var e = P.target;
    if (e && !e.dead && !e.gone) {
      this.$tgt.classList.add('on');
      if (this._tgtE !== e) {
        this.$tgtName.textContent = (e.cfg.boss ? '◆ ' : '') + e.cfg.name;
        this._tgtE = e;
      }
      this.$tgtFill.style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
    } else {
      this.$tgt.classList.remove('on');
      this._tgtE = null;
    }

    /* 连击 */
    var c = J.comboCount || 0;
    if (c !== this._lastCombo) {
      this.$comboBox.textContent = c;
      this._lastCombo = c;
      if (c >= 2) this.$combo.classList.add('on');
      else this.$combo.classList.remove('on');
    }
    if (J.comboTimer > 0) {
      J.comboTimer -= dt;
      if (J.comboTimer <= 0) { J.comboCount = 0; J.comboTimer = 0; this.$combo.classList.remove('on'); }
    }

    /* ── 刀魂 ── */
    if (J.Soul && this.$soulFill) {
      var sr = J.Soul.ratio();
      if (Math.abs(sr - this._lastSoul) > 0.002) {
        this.$soulFill.style.width = (sr * 100) + '%';
        this._lastSoul = sr;
      }
      if (J.Soul.level !== this._lastLv) {
        this._lastLv = J.Soul.level;
        this.$soulWrap.classList.toggle('lv2', J.Soul.level === 2);
        this.$soulWrap.classList.toggle('lv3', J.Soul.level === 3);
        this.$soulGlow.classList.toggle('on', J.Soul.level === 3);
        this.$soulTag.textContent = J.Soul.name();
        this.$soulTag.classList.toggle('on', J.Soul.level > 0);
        if (this.$soulPips) {
          var pips = this.$soulPips.children;
          for (var pi = 0; pi < pips.length; pi++) {
            pips[pi].classList.toggle('on', pi < Math.min(4, J.Soul.level * 4 / 3));
          }
        }
      }

      /* 连段（刀魂连锁） */
      var ch = J.Soul.chain;
      if (ch !== this._lastChain) {
        this._lastChain = ch;
        if (this.$chainNum) this.$chainNum.textContent = ch;
        this.$chain.classList.toggle('on', ch >= 2);
      }
    }

    /* ── Boss 血条 ── */
    if (this.$bossBar) {
      var b = J.boss;
      var bShow = !!(b && !b.dead && !b.gone && b.cfg.phases &&
        Math.hypot(b.pos.x - P.pos.x, b.pos.z - P.pos.z) < 46);
      if (bShow !== this._bossShown) {
        this._bossShown = bShow;
        this.$bossBar.classList.toggle('on', bShow);
        if (bShow && b) {
          this.$bossName.textContent = '『 ' + b.cfg.name + ' 』';
          this.bossPhase(b);
        }
      }
      if (bShow && b) {
        var br = Math.max(0, b.hp / b.maxHp);
        if (Math.abs(br - this._lastBossHp) > 0.001) {
          this.$bossFill.style.width = (br * 100) + '%';
          this._lastBossHp = br;
        }
      }
    }

    /* ── 同伴血条 ── */
    if (this.$allyBar) {
      var al = J.Ally;
      var alOn = !!(al && al.active);
      if (alOn !== this._allyOn) {
        this._allyOn = alOn;
        this.$allyBar.classList.toggle('on', alOn);
      }
      if (alOn) {
        var ar = Math.max(0, al.hp / al.maxHp);
        if (Math.abs(ar - this._lastAllyHp) > 0.002) {
          this.$allyFill.style.width = (ar * 100) + '%';
          this._lastAllyHp = ar;
        }
        this.$allyBar.classList.toggle('down', !!al.down);
      }
    }

    /* 交互按钮：靠近 NPC 显示「谈」，靠近物件显示「拾」 */
    if (this.$bUse) {
      var npcNear = J.NPC && J.NPC.near;
      var itNear = J.Interact && J.Interact.near;
      var want = !!(npcNear || itNear);
      if (want !== this._useOn) {
        this._useOn = want;
        this.$bUse.classList.toggle('on', want);
      }
      var lbl = npcNear ? '谈' : (itNear ? '拾' : '拾');
      if (this.$bUse.textContent !== lbl) this.$bUse.textContent = lbl;
    }

    /* 提示 */
    if (this._toastT > 0) {
      this._toastT -= dt;
      if (this._toastT <= 0) this.$toast.classList.remove('on');
    }
  },

  /* 刀魂获得的一次脉冲反馈 */
  soulPulse: function (gain) {
    if (!this.$soulFill) return;
    this.$soulFill.style.filter = 'brightness(1.7)';
    var self = this;
    clearTimeout(this._soulPulseT);
    this._soulPulseT = setTimeout(function () { self.$soulFill.style.filter = ''; }, 90);
  },

  /* Boss 阶段名与血条配色 */
  bossPhase: function (b) {
    if (!this.$bossFill || !b) return;
    var n = (b.phase === undefined ? 0 : b.phase) + 1;
    this.$bossPhaseName.textContent = (b.phaseName ? '第' + ['一', '二', '三'][b.phase] + '阶段 · ' + b.phaseName : '');
    this.$bossFill.className = n >= 3 ? 'p3' : (n === 2 ? 'p2' : '');
  },

  /* 支线目标 */
  setSide: function (name) {
    var el = document.getElementById('sideQuest');
    if (!el) return;
    if (!name) { el.classList.remove('on'); return; }
    el.textContent = name;
    el.classList.add('on');
  },

  /* 扶起同伴提示 */
  showAllyRevive: function (on) {
    if (!this.$allyBar) return;
    this.$allyBar.classList.toggle('down', !!on);
  },

  /* ── 交互提示 ── */
  interactHint: function (txt) {
    if (!this.$hint) return;
    if (txt) {
      this.$hint.textContent = txt;
      this.$hint.classList.add('on');
      if (this.$bUse) this.$bUse.classList.add('on');
    } else {
      this.$hint.classList.remove('on');
      if (this.$bUse) this.$bUse.classList.remove('on');
    }
  },

  /* ── 区域名横幅 ── */
  regionBanner: function (name) {
    if (!this.$banner) return;
    this.$banner.textContent = name;
    this.$banner.classList.remove('on');
    void this.$banner.offsetWidth;
    this.$banner.classList.add('on');
  },

  /* ── 任务列表 ── */
  buildObjectives: function (list) {
    if (!this.$objList) return;
    this.$objList.innerHTML = '';
    this._objEls = {};
    for (var i = 0; i < list.length; i++) {
      var d = document.createElement('div');
      d.className = 'oi';
      d.textContent = list[i].name;
      d.style.display = 'none';
      this.$objList.appendChild(d);
      this._objEls[list[i].id] = d;
    }
    this.refreshObjectives(list);
  },

  refreshObjectives: function (list) {
    var firstOpen = -1;
    for (var i = 0; i < list.length; i++) {
      if (!list[i].done) { firstOpen = i; break; }
    }
    for (var j = 0; j < list.length; j++) {
      var el = this._objEls[list[j].id];
      if (!el) continue;
      var o = list[j];
      /* 只显示已完成的和当前目标，其余隐藏，保持界面干净 */
      var show = o.done || j === firstOpen;
      el.style.display = show ? 'block' : 'none';
      el.classList.toggle('ok', !!o.done);
      el.classList.toggle('cur', j === firstOpen && !o.done);
    }
  },

  objectiveDone: function (name) {
    if (J.Obj) this.refreshObjectives(J.Obj.list);
    this.flashText('✓ ' + name);
  },

  /* ── 剧情对话 ── */
  showDialog: function (name, lines, onEnd) {
    var self = this;
    this._dlgLines = lines.slice();
    this._dlgIdx = 0;
    this._dlgEnd = onEnd;
    this.$dlg = this.$dlg || document.getElementById('dlg');
    this.$dlgName = this.$dlgName || document.getElementById('dlgName');
    this.$dlgText = this.$dlgText || document.getElementById('dlgText');
    this.$dlgName.textContent = name;
    this._dlgShowLine();
    this.$dlg.classList.add('on');
    if (!this._dlgBound) {
      this._dlgBound = true;
      this.$dlg.addEventListener('pointerdown', function (e) {
        e.preventDefault(); e.stopPropagation();
        self.dialogNext();
      });
    }
  },
  _dlgShowLine: function () {
    if (!this.$dlgText) return;
    this.$dlgText.textContent = this._dlgLines[this._dlgIdx] || '';
  },
  dialogNext: function () {
    if (!this.$dlg) return;
    this._dlgIdx++;
    if (this._dlgIdx >= this._dlgLines.length) {
      this.$dlg.classList.remove('on');
      var cb = this._dlgEnd;
      this._dlgEnd = null;
      if (cb) cb();
    } else {
      this._dlgShowLine();
    }
  },
  isDialogOpen: function () {
    return this.$dlg && this.$dlg.classList.contains('on');
  },

  /* ── 章节与任务 ── */
  setChapter: function (txt) {
    var el = document.getElementById('chapterName');
    if (el) el.textContent = txt || '';
  },
  refreshQuests: function () {
    var el = document.getElementById('objList');
    if (!el || !J.Story) return;
    var qs = J.Story.QUESTS, html = '';
    var shown = 0;
    for (var i = 0; i < qs.length; i++) {
      var st = J.Story.quest[qs[i].id];
      if (st === 'done') {
        html += '<div class="oi ok" style="display:block">' + qs[i].name + '</div>';
        shown++;
      } else if (st === 'active') {
        html += '<div class="oi cur" style="display:block">' + qs[i].name + '</div>';
        shown++;
        break;
      }
    }
    /* 只保留最近 5 条 */
    el.innerHTML = html;
  },
  updateQuestHint: function (P) {
    var el = document.getElementById('questHint');
    if (!el || !J.Story) return;
    var q = J.Story.currentQuest();
    if (!q) { el.textContent = ''; return; }
    var tx = q.x, tz = q.z;
    if (q.type === 'talk' && q.npc && J.NPC) {
      var np = J.NPC.get(q.npc);
      if (np) { tx = np.pos.x; tz = np.pos.z; }
    }
    if (q.type === 'boss' && J.boss) { tx = J.boss.pos.x; tz = J.boss.pos.z; }
    var d = (tx !== undefined) ? Math.round(Math.hypot(tx - P.pos.x, tz - P.pos.z)) : null;
    el.innerHTML = '◆ <b>' + q.name + '</b>' + (d !== null ? '<span class="dist">' + d + 'm</span>' : '');
  },

  showUseBtn: function (on) {
    var b = document.getElementById('bUse');
    if (b) b.classList.toggle('on', !!on);
  },

  moveName: function (txt) {
    if (!this.$moveName) return;
    this.$moveName.textContent = txt;
    this.$moveName.classList.add('on');
    this._moveT = 0.75;
  },

  flashText: function (txt) {
    if (!this.$flash) return;
    this.$flash.textContent = txt;
    this.$flash.classList.remove('on');
    void this.$flash.offsetWidth;
    this.$flash.classList.add('on');
  },

  chargeStart: function () {
    if (!this.$chargeWrap) return;
    this._chargeOn = true;
    this.$chargeWrap.classList.add('on');
    this.$chargeBar.style.width = '0%';
    this.$chargeBar.classList.remove('full');
  },

  chargeRatio: function (r) {
    if (!this._chargeOn) return;
    this.$chargeBar.style.width = Math.min(100, r * 100) + '%';
    this.$chargeBar.classList.toggle('full', r >= 0.99);
  },

  chargeEnd: function () {
    this._chargeOn = false;
    if (!this.$chargeWrap) return;
    this.$chargeWrap.classList.remove('on');
  },

  layout: function () {
    if (J.IN && J.IN._placeHome) J.IN._placeHome();
  },

  toast: function (txt, dur) {
    this.$toast.textContent = txt;
    this.$toast.classList.add('on');
    this._toastT = dur || 1.8;
  }
};
