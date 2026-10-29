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
    this._lastHp = -1; this._lastSp = -1; this._lastCombo = -1;
    this._toastT = 0;
    this._tgtE = null;
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

  toast: function (txt, dur) {
    this.$toast.textContent = txt;
    this.$toast.classList.add('on');
    this._toastT = dur || 1.8;
  }
};
