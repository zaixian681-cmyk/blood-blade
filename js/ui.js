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
      var label = victim ? '决' : '绝';
      if (this.$bUlt.textContent !== label) this.$bUlt.textContent = label;
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

    /* 提示 */
    if (this._toastT > 0) {
      this._toastT -= dt;
      if (this._toastT <= 0) this.$toast.classList.remove('on');
    }
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
