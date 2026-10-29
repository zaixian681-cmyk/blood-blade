/* ═══════════════════════════════════════════════
   foe.js — 江湖人
   山贼刀客 / 盾卫 / 飞镖手 / 教头(Boss)
   ═══════════════════════════════════════════════ */
(function () {

  var TYPE = {
    bandit: {
      name: '山贼', hp: 60, speed: 3.0, dmg: 9, range: 2.3, reach: 2.6,
      wind: 0.42, strike: 0.14, rec: 0.55, cd: 1.15, poise: 30,
      color: { cloth: 0x3b3630, trim: 0x8a4a32, skin: 0xd8b090, blade: 0xa8b0b8 },
      scale: 1.0, prize: 1
    },
    guard: {
      name: '护院', hp: 110, speed: 2.2, dmg: 14, range: 2.5, reach: 2.7,
      wind: 0.62, strike: 0.16, rec: 0.8, cd: 1.6, poise: 62,
      color: { cloth: 0x4a4a52, trim: 0x9a8a6a, skin: 0xd0a888, blade: 0xc0c8d0 },
      scale: 1.12, prize: 2, shield: true
    },
    thrower: {
      name: '飞镖客', hp: 45, speed: 3.6, dmg: 7, range: 9.0, reach: 9.0,
      wind: 0.55, strike: 0.12, rec: 0.5, cd: 1.5, poise: 18,
      color: { cloth: 0x2e3a44, trim: 0x5a8a8a, skin: 0xd8b090, blade: 0xb0b8c0 },
      scale: 0.96, prize: 1, ranged: true
    },
    xiaowuji: {
      name: '萧无极', hp: 560, speed: 3.4, dmg: 24, range: 3.2, reach: 3.7,
      wind: 0.50, strike: 0.18, rec: 0.55, cd: 1.05, poise: 170,
      color: { cloth: 0x2a1414, trim: 0xd0a050, skin: 0xd8b090, blade: 0xe0d0b8 },
      scale: 1.28, prize: 20, boss: true
    },
    boss: {
      name: '断水教头', hp: 420, speed: 3.2, dmg: 20, range: 3.0, reach: 3.4,
      wind: 0.55, strike: 0.18, rec: 0.62, cd: 1.2, poise: 140,
      color: { cloth: 0x2a1a1a, trim: 0xc08a3a, skin: 0xd8b090, blade: 0xd8c8b0 },
      scale: 1.22, prize: 10, boss: true
    }
  };

  var MAT = {};
  function mat(c, rough, metal) {
    var k = c + '_' + (rough || 0) + '_' + (metal || 0);
    if (!MAT[k]) {
      var mm = new THREE.MeshStandardMaterial({ color: c, roughness: rough === undefined ? 0.75 : rough, metalness: metal || 0 });
      mm.onBeforeCompile = function (sh) {
        sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>',
          ['#include <dithering_fragment>',
           'vec3 _vd2 = normalize(vViewPosition);',
           'float _rim2 = pow(1.0 - abs(dot(normalize(normal), _vd2)), 2.4);',
           'gl_FragColor.rgb += vec3(0.42,0.55,0.72) * _rim2 * 0.9;'
          ].join('\n'));
      };
      MAT[k] = mm;
    }
    return MAT[k];
  }

  function bx(w, h, d, m, x, y, z) {
    var e = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    e.position.set(x || 0, y || 0, z || 0);
    e.castShadow = true;
    return e;
  }
  function sp(r, m, x, y, z, sx, sy, sz) {
    var e = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), m);
    e.position.set(x || 0, y || 0, z || 0);
    e.scale.set(sx || 1, sy || 1, sz || 1);
    e.castShadow = true;
    return e;
  }

  /* ── 建人 ── */
  function buildFoe(T, cfg) {
    var C = cfg.color, s = cfg.scale;
    var root = new THREE.Group();
    var spin = new THREE.Group(); root.add(spin);
    var body = new THREE.Group(); spin.add(body);
    body.position.y = 0.86 * s;

    var mCloth = mat(C.cloth), mTrim = mat(C.trim, 0.6, 0.3);
    var mSkin = mat(C.skin, 0.85), mBlade = mat(C.blade, 0.35, 0.9);
    var mDark = mat(0x22201e, 0.9);

    /* 腿 */
    function leg(sd) {
      var hip = new THREE.Group(); hip.position.set(sd * 0.075 * s, -0.02, 0); body.add(hip);
      var th = bx(0.10 * s, 0.34 * s, 0.11 * s, mDark, 0, -0.17 * s, 0); hip.add(th);
      var kn = new THREE.Group(); kn.position.y = -0.34 * s; hip.add(kn);
      var sh2 = bx(0.085 * s, 0.32 * s, 0.09 * s, mDark, 0, -0.16 * s, 0); kn.add(sh2);
      var ft = bx(0.10 * s, 0.07 * s, 0.19 * s, mat(0x2a2018), 0, -0.335 * s, 0.03 * s); kn.add(ft);
      return { hip: hip, knee: kn };
    }
    var legL = leg(-1), legR = leg(1);

    /* 躯干 */
    var torso = new THREE.Group(); body.add(torso);
    torso.add(bx(0.30 * s, 0.34 * s, 0.19 * s, mCloth, 0, 0.19 * s, 0));
    torso.add(bx(0.32 * s, 0.07 * s, 0.20 * s, mTrim, 0, 0.05 * s, 0));  // 腰封
    var chest = new THREE.Group(); chest.position.y = 0.36 * s; torso.add(chest);
    chest.add(bx(0.33 * s, 0.26 * s, 0.21 * s, mCloth, 0, 0.10 * s, 0));
    chest.add(bx(0.18 * s, 0.10 * s, 0.22 * s, mTrim, 0, 0.20 * s, 0));  // 胸甲片

    /* 头 */
    var head = new THREE.Group(); head.position.y = 0.24 * s; chest.add(head);
    head.add(sp(0.105 * s, mSkin, 0, 0.05 * s, 0, 1, 1.05, 0.95));
    // 头巾
    head.add(bx(0.20 * s, 0.09 * s, 0.20 * s, mTrim, 0, 0.135 * s, 0));
    head.add(bx(0.045 * s, 0.14 * s, 0.03 * s, mTrim, 0.09 * s, 0.05 * s, -0.02 * s));
    // 眼（暗色）
    head.add(bx(0.028 * s, 0.016 * s, 0.02 * s, mat(0x141210), -0.042 * s, 0.06 * s, 0.093 * s));
    head.add(bx(0.028 * s, 0.016 * s, 0.02 * s, mat(0x141210), 0.042 * s, 0.06 * s, 0.093 * s));
    // 胡子（Boss/护院）
    if (cfg.boss || cfg.shield) head.add(bx(0.11 * s, 0.09 * s, 0.05 * s, mDark, 0, -0.03 * s, 0.08 * s));

    /* 手臂 */
    function arm(sd) {
      var sh = new THREE.Group(); sh.position.set(sd * 0.18 * s, 0.22 * s, 0); chest.add(sh);
      sh.add(sp(0.062 * s, mCloth, 0, 0, 0, 1.1, 0.9, 1));
      var up = new THREE.Group(); sh.add(up);
      up.add(bx(0.085 * s, 0.24 * s, 0.095 * s, mCloth, 0, -0.12 * s, 0));
      var el = new THREE.Group(); el.position.y = -0.24 * s; up.add(el);
      el.add(bx(0.075 * s, 0.22 * s, 0.085 * s, mCloth, 0, -0.11 * s, 0));
      var hand = new THREE.Group(); hand.position.y = -0.24 * s; el.add(hand);
      hand.add(sp(0.05 * s, mSkin, 0, 0, 0));
      return { sh: sh, up: up, el: el, hand: hand };
    }
    var armR = arm(1), armL = arm(-1);

    /* 武器 */
    var weapon = new THREE.Group();
    if (cfg.ranged) {
      // 飞镖：手里几枚小刀
      for (var i = 0; i < 3; i++) {
        var d = bx(0.015, 0.16, 0.055, mBlade, -0.02 + i * 0.02, 0.0, 0);
        d.rotation.z = 0.2; weapon.add(d);
      }
      weapon.position.set(0, -0.05, 0.06);
    } else if (cfg.shield) {
      var blade = bx(0.035, 0.85, 0.08, mBlade, 0, 0.25, 0);
      weapon.add(blade);
      var hilt = bx(0.05, 0.16, 0.05, mDark, 0, -0.12, 0); weapon.add(hilt);
      weapon.rotation.x = 0.4;
      weapon.position.y = -0.05;
    } else if (cfg.boss) {
      var longB = bx(0.045, 1.35, 0.10, mBlade, 0, 0.42, 0);
      weapon.add(longB);
      var h2 = bx(0.06, 0.3, 0.06, mDark, 0, -0.2, 0); weapon.add(h2);
      var guard = bx(0.18, 0.03, 0.09, mTrim, 0, -0.05, 0); weapon.add(guard);
      weapon.rotation.x = 0.5;
      weapon.position.y = -0.08;
    } else {
      var b2 = bx(0.032, 0.72, 0.075, mBlade, 0, 0.22, 0);
      weapon.add(b2);
      weapon.add(bx(0.045, 0.14, 0.045, mDark, 0, -0.1, 0));
      weapon.rotation.x = 0.45;
    }
    armR.hand.add(weapon);

    /* 盾（护院） */
    var shield = null;
    if (cfg.shield) {
      shield = new THREE.Group();
      var pl = bx(0.52 * s, 0.72 * s, 0.07, mat(0x6a5a44, 0.8, 0.2), 0, 0, 0);
      shield.add(pl);
      shield.add(bx(0.56 * s, 0.08 * s, 0.09, mTrim, 0, 0.24 * s, 0));
      shield.add(bx(0.56 * s, 0.08 * s, 0.09, mTrim, 0, -0.24 * s, 0));
      shield.add(sp(0.09 * s, mTrim, 0, 0, 0.05, 1, 1, 0.6));
      shield.position.set(0, -0.1, 0.10);
      shield.rotation.y = 0.1;
      armL.hand.add(shield);
    }

    /* 地面影子 */
    var blob = new THREE.Mesh(new THREE.CircleGeometry(0.42 * s, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02;
    root.add(blob);

    return { root: root, spin: spin, body: body, torso: torso, chest: chest, head: head, armR: armR, armL: armL, legL: legL, legR: legR, weapon: weapon, shield: shield, blob: blob };
  }

  /* ═══ 敌人实体 ═══ */
  function Foe(type, x, z, yaw, override) {
    var cfg = TYPE[type] || TYPE.bandit;
    if (override) { cfg = Object.assign({}, cfg, override); }
    this.type = type; this.cfg = cfg;
    this.M = buildFoe(TYPE[type], cfg);
    J.S.add(this.M.root);

    this.pos = new THREE.Vector3(x, 0, z);
    this.vy = 0;
    this.yaw = yaw || 0;
    this.hp = this.maxHp = cfg.hp;
    this.poise = cfg.poise; this.maxPoise = cfg.poise;
    this.state = 'idle';
    this.tim = 0;
    this.cd = 0.6 + Math.random() * 0.8;
    this.staggerT = 0;
    this.hitThisSwing = false;
    this.dead = false;
    this.gone = false;
    this.flashT = 0;
    this.knock = new THREE.Vector3();
    this.walkPhase = Math.random() * 6.28;
    this.aggro = 0;
    this.home = new THREE.Vector3(x, 0, z);
    this.wanderT = 0;
    this.wanderDir = Math.random() * 6.28;
    this.swingSide = 1;
    this.blocking = false;

    /* 受击闪白：给所有材质克隆一份 */
    this.flashMats = [];
    this.M.root.traverse(function (o) {
      if (o.isMesh && o.material && o.material.color) {
        var m = o.material.clone();
        m.userData.baseColor = m.color.clone();
        m.userData.baseEmissive = m.emissive ? m.emissive.clone() : null;
        o.material = m;
        this.flashMats.push(m);
      }
    }.bind(this));
  }

  Foe.prototype = {
    heal: function () {
      this.hp = this.maxHp;
      this.dead = false; this.gone = false;
      this.M.root.visible = true;
      this.M.root.rotation.x = 0;
      this.M.root.position.y = 0;
      this.M.root.scale.setScalar(1);
    },

    hurt: function (dmg, fromPos, power, isHeavy, launch) {
      if (this.dead) return false;
      /* 阶段切换 / 登场演出期间不可伤 */
      if (this.bossInvuln) {
        J.FX.spark(this.pos.x, this.pos.y + 1.3, this.pos.z, 6, 0xffe0c0, 0.8);
        return 'block';
      }
      // 盾卫正面格挡
      if (this.cfg.shield && this.state !== 'stagger') {
        var toP = Math.atan2(J.P.pos.x - this.pos.x, J.P.pos.z - this.pos.z);
        var facing = J.U.ang(this.yaw, toP);
        if (Math.abs(facing) < 0.9 && !isHeavy && Math.random() < 0.55) {
          J.FX.spark(this.pos.x, 1.2, this.pos.z, 10, 0xffe0a0, 1.2);
          J.FX.hitstop(0.05);
          this.poise -= 8;
          if (this.poise <= 0) { this.poise = this.maxPoise; this.enter('stagger', 0.9); }
          return 'block';
        }
      }

      this.hp -= dmg;
      this.poise -= dmg;
      this.flashT = 0.16;
      this.staggerT = Math.max(this.staggerT, 0.16);

      // 击退与浮空
      var dx = this.pos.x - fromPos.x, dz = this.pos.z - fromPos.z;
      var dl = Math.hypot(dx, dz) || 1;
      var kb = power * (1 - this.cfg.poise / 240) * 0.72;
      this.knock.x += dx / dl * kb * 3.2;
      this.knock.z += dz / dl * kb * 3.2;
      if (isHeavy) { this.vy = Math.max(this.vy, 3.6 * power); }
      if (launch) { this.vy = Math.max(this.vy, 5.4); this.pos.y = Math.max(this.pos.y, 0.12); }

      if (this.hp <= 0) { this.die(); return 'kill'; }

      if (this.poise <= 0) {
        this.poise = this.maxPoise;
        this.enter('stagger', this.cfg.boss ? 0.5 : 0.85);
      } else if (this.staggerT > 0) {
        this.state = this.state === 'strike' ? this.state : 'hurt';
        this.tim = 0;
      }
      return 'hit';
    },

    die: function () {
      if (J.Story && J.Story.onKill) J.Story.onKill(this);
      this.dead = true;
      this.state = 'dead';
      this.tim = 0;
      J.FX.ring(this.pos.x, 0.4, this.pos.z, 0xd8e4ff, 3.0);
      J.FX.spark(this.pos.x, 1.1, this.pos.z, 26, 0xffd0a0, 1.6);
    },

    enter: function (st, dur) {
      this.state = st;
      this.tim = 0;
      this.dur = dur || 0;
      this.hitThisSwing = false;
      if (st === 'break') this.dropWeapon();
      else if (this.weaponDropped && st !== 'dead') this.pickWeapon();
    },

    /* 武器脱手：从手部换挂到本体，带抛物线飞出 */
    dropWeapon: function () {
      var M = this.M, w = M.weapon;
      if (!w || this.weaponDropped) return;
      this.weaponDropped = true;
      // 保存原始本地变换
      this._wBase = { p: w.position.clone(), r: w.rotation.clone() };
      J.S.attach(w);                 // 挂到场景，直接用世界坐标
      this.dropVel = new THREE.Vector3(
        (Math.random() - 0.5) * 3.2, 3.4 + Math.random() * 1.6, (Math.random() - 0.5) * 3.2
      );
      this.dropSpin = new THREE.Vector3(
        (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 12
      );
      this.dropGrounded = false;
      J.FX.spark(this.pos.x, this.pos.y + 1.1, this.pos.z, 12, 0xdfe6f0, 1.3);
    },

    pickWeapon: function () {
      var M = this.M, w = M.weapon;
      if (!w || !this.weaponDropped) return;
      this.weaponDropped = false;
      M.armR.hand.add(w);              // 直接挂回手部
      if (this._wBase) {
        w.position.copy(this._wBase.p);
        w.rotation.copy(this._wBase.r);
      }
      w.scale.setScalar(1);
    },

    /* 脱手武器的物理（在 update 里调用） */
    updateDropped: function (dt) {
      if (!this.weaponDropped || this.dropGrounded) return;
      var w = this.M.weapon;
      this.dropVel.y -= 18 * dt;
      w.position.addScaledVector(this.dropVel, dt);   // 世界坐标
      w.rotation.x += this.dropSpin.x * dt;
      w.rotation.y += this.dropSpin.y * dt;
      w.rotation.z += this.dropSpin.z * dt;
      var gy = J.Terrain.heightAt(w.position.x, w.position.z) + 0.14;
      if (w.position.y <= gy) {
        w.position.y = gy;
        this.dropGrounded = true;
        this.dropVel.set(0, 0, 0);
        w.rotation.set(-Math.PI / 2, w.rotation.y, 0);
        J.FX.spark(w.position.x, gy, w.position.z, 7, 0xbfae90, 0.7);
      }
    },

    /* 攻击判定：对玩家 */
    checkHit: function () {
      var T = this.tgt || J.P;
      var dx = T.pos.x - this.pos.x, dz = T.pos.z - this.pos.z;
      var d = Math.hypot(dx, dz);
      var reach = this.cfg.reach;
      if (d > reach) return false;
      var toP = Math.atan2(dx, dz);
      var diff = J.U.ang(this.yaw, toP);
      if (Math.abs(diff) > 1.0) return false;
      T.takeHit(this.cfg.dmg, this.pos, this.cfg.boss);
      return true;
    },

    update: function (dt, t) {
      if (this.gone) return;
      var M = this.M, P = J.P;

      /* 脱手武器 */
      this.updateDropped(dt);

      /* 死亡：倒下然后消失 */
      if (this.dead) {
        this.tim += dt;
        M.root.rotation.x = J.U.damp(M.root.rotation.x, -Math.PI / 2 * 0.92, 6, dt);
        M.root.position.y = J.U.damp(M.root.position.y, -0.25, 4, dt);
        if (this.tim > 2.2) {
          M.root.scale.multiplyScalar(1 - dt * 2.2);
          if (M.root.scale.x < 0.06) { this.gone = true; M.root.visible = false; }
        }
        return;
      }

      /* 受击闪白 */
      if (this.flashT > 0) {
        this.flashT -= dt;
        var f = Math.max(0, this.flashT / 0.16);
        for (var i = 0; i < this.flashMats.length; i++) {
          var m = this.flashMats[i];
          m.emissive && m.emissive.setRGB(f * 0.9, f * 0.95, f * 1.0);
        }
      } else if (this._wasFlash) {
        for (var i2 = 0; i2 < this.flashMats.length; i2++) {
          var m2 = this.flashMats[i2];
          if (m2.userData.baseEmissive) m2.emissive.copy(m2.userData.baseEmissive);
          else if (m2.emissive) m2.emissive.setRGB(0, 0, 0);
        }
      }
      this._wasFlash = this.flashT > 0;

      /* 目标选择：玩家或同伴，打更近的那个 */
      var T = P;
      if (J.Ally && J.Ally.active && !J.Ally.down) {
        var dpP = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
        var dpA = Math.hypot(J.Ally.pos.x - this.pos.x, J.Ally.pos.z - this.pos.z);
        if (dpA < dpP * 1.25) T = J.Ally;
      }
      this.tgt = T;

      /* 物理 */
      var distToP = Math.hypot(T.pos.x - this.pos.x, T.pos.z - this.pos.z);

      // 击退惯性
      this.pos.x += this.knock.x * dt;
      this.pos.z += this.knock.z * dt;
      this.knock.multiplyScalar(Math.exp(-7 * dt));

      // 浮空 / 贴地
      var gy = J.Terrain.heightAt(this.pos.x, this.pos.z);
      if (this.pos.y > gy + 0.02 || this.vy > 0) {
        this.vy -= 22 * dt;
        this.pos.y += this.vy * dt;
        if (this.pos.y <= gy) { this.pos.y = gy; this.vy = 0; }
      } else {
        this.pos.y = gy;
        this.vy = 0;
      }

      /* 状态机 */
      this.tim += dt;
      var spd = 0;
      var faceTo = null;

      var bossHandled = false;
      if (this.cfg.phases && J.Boss) {
        var st8 = J.Boss.step(this, dt, distToP, t);
        if (st8) { spd = st8.spd; faceTo = st8.faceTo; bossHandled = true; }
      }
      if (!bossHandled) {
      switch (this.state) {
        case 'idle':
          this.wanderT -= dt;
          if (this.wanderT <= 0) { this.wanderT = 1.5 + Math.random() * 2.5; this.wanderDir = Math.random() * 6.283; this.wanderMove = Math.random() < 0.55; }
          if (this.wanderMove) {
            var wx = this.home.x + Math.cos(this.wanderDir) * 2.6;
            var wz = this.home.z + Math.sin(this.wanderDir) * 2.6;
            var wdx = wx - this.pos.x, wdz = wz - this.pos.z;
            if (Math.hypot(wdx, wdz) > 0.6) { spd = 1.0; faceTo = Math.atan2(wdx, wdz); }
          }
          if (distToP < 16) this.enter('alert', 0.35);
          break;

        case 'alert':
          faceTo = Math.atan2(T.pos.x - this.pos.x, T.pos.z - this.pos.z);
          if (this.tim > 0.35) this.enter('chase');
          break;

        case 'chase':
          faceTo = Math.atan2(T.pos.x - this.pos.x, T.pos.z - this.pos.z);
          if (distToP < (this.cfg.ranged ? 7.5 : this.cfg.range)) {
            if (this.cd <= 0) { this.enter('wind', this.cfg.wind); this.swingSide = Math.random() > 0.5 ? 1 : -1; }
            else { spd = 0.6; if (this.cfg.ranged) spd = 0; }
          } else {
            spd = this.cfg.speed;
          }
          if (this.tgt !== P) { /* 打同伴时不后撤 */ }
          if (this.tgt === P && this.cfg.ranged && distToP < 3.2) {
            spd = -this.cfg.speed * 0.85;   // 射手拉开距离
            faceTo = Math.atan2(T.pos.x - this.pos.x, T.pos.z - this.pos.z);
          }
          break;

        case 'wind':
          faceTo = Math.atan2(T.pos.x - this.pos.x, T.pos.z - this.pos.z);
          if (this.tim >= this.dur) { this.enter('strike', this.cfg.strike); }
          break;

        case 'strike':
          if (!this.hitThisSwing) {
            // 近战：判定帧
            if (this.checkHit()) {
              this.hitThisSwing = true;
              J.FX.spark(T.pos.x, 1.3, T.pos.z, 12, 0xff9a6a, 1.2);
            }
          }
          if (this.tim >= this.dur) { this.enter('recover', this.cfg.rec); this.cd = this.cfg.cd * (0.8 + Math.random() * 0.5); }
          break;

        case 'recover':
          if (this.tim >= this.dur) this.enter('chase');
          break;

        case 'break':
          if (this.tim >= this.dur) this.enter('chase');
          break;

        case 'stagger':
        case 'hurt':
          if (this.tim >= this.dur) { this.enter('chase'); }
          break;
      }
      }

      this.cd -= dt;
      if (this.cd < 0) this.cd = 0;

      /* 移动与朝向 */
      if (faceTo !== null) {
        this.yaw = this.yaw + J.U.ang(this.yaw, faceTo) * Math.min(1, dt * 7);
      }
      if (spd > 0) {
        var mvx = Math.sin(this.yaw) * spd * dt, mvz = Math.cos(this.yaw) * spd * dt;
        this.pos.x += mvx; this.pos.z += mvz;
      } else if (spd < 0) {
        this.pos.x += Math.sin(this.yaw) * spd * dt;
        this.pos.z += Math.cos(this.yaw) * spd * dt;
      }

      /* 碰撞 */
      var before = { x: this.pos.x, z: this.pos.z };
      J.Col.resolve(this.pos, 0.42, 1.7, this.pos.y);
      // 与其他敌人分离
      for (var f = 0; f < J.foes.length; f++) {
        var o = J.foes[f];
        if (o === this || o.dead || o.gone) continue;
        var ddx = this.pos.x - o.pos.x, ddz = this.pos.z - o.pos.z;
        var dd = Math.hypot(ddx, ddz);
        var minD = 0.85;
        if (dd < minD && dd > 0.001) {
          var push = (minD - dd) / dd * 0.5;
          this.pos.x += ddx * push; this.pos.z += ddz * push;
        }
      }

      /* 动画 */
      this.anim(dt, t, spd, distToP);

      /* 距离剔除：超过 46 米不渲染；34 米外不投阴影 */
      var distToCam = J.C ? Math.hypot(this.pos.x - J.C.position.x, this.pos.z - J.C.position.z) : 0;
      if (distToCam > 46) { if (M.root.visible) M.root.visible = false; return; }
      if (!M.root.visible) M.root.visible = true;
      var castOn = distToCam < 34;
      if (this._castOn !== castOn) {
        this._castOn = castOn;
        M.root.traverse(function (o) { if (o.isMesh) o.castShadow = castOn; });
      }

      M.root.position.set(this.pos.x, this.pos.y, this.pos.z);
      M.spin.rotation.y = this.yaw;
      /* 影子贴地：只按离地高度衰减，不能用世界高度 */
      var airH = Math.max(0, this.pos.y - J.Terrain.heightAt(this.pos.x, this.pos.z));
      M.blob.position.y = 0.02 - airH * 0.9;
      M.blob.material.opacity = 0.32 * Math.max(0, 1 - airH * 0.42);
    },

    anim: function (dt, t, spd, distToP) {
      if (this.cfg.phases && J.Boss && J.Boss.anim(this, dt, t, Math.abs(spd) > 0.1)) return;
      var M = this.M;
      var moving = Math.abs(spd) > 0.1;
      this.walkPhase += dt * (moving ? Math.abs(spd) * 2.6 + 3.2 : 1.6);

      var swing = Math.sin(this.walkPhase);
      var sw2 = Math.sin(this.walkPhase + Math.PI);

      // 腿
      var amp = moving ? 0.55 : 0.05;
      M.legL.hip.rotation.x = swing * amp;
      M.legR.hip.rotation.x = sw2 * amp;
      M.legL.knee.rotation.x = Math.max(0, -swing) * 0.7 * (moving ? 1 : 0.2);
      M.legR.knee.rotation.x = Math.max(0, -sw2) * 0.7 * (moving ? 1 : 0.2);

      // 身体起伏
      M.body.position.y = 0.86 * this.cfg.scale + (moving ? Math.abs(Math.sin(this.walkPhase)) * 0.035 : Math.sin(t * 1.6 + this.walkPhase) * 0.012);
      M.torso.rotation.z = moving ? swing * 0.05 : 0;

      // 手臂基础
      var armBase = -0.25;
      var rArm = armBase, lArm = armBase;
      M.chest.rotation.y = 0;
      M.torso.rotation.x = 0;

      if (this.state === 'wind') {
        var wp = Math.min(1, this.tim / this.dur);
        var e = wp * wp;
        // 举刀后仰
        M.armR.sh.rotation.x = -2.2 * e;
        M.armR.sh.rotation.z = -0.5 * e * this.swingSide;
        M.armR.el.rotation.x = -0.7 * e;
        M.torso.rotation.y = 0.5 * e * this.swingSide;
        M.torso.rotation.x = -0.12 * e;
        M.weapon.rotation.x = 0.9;
      } else if (this.state === 'strike') {
        var sp2 = Math.min(1, this.tim / this.dur);
        M.armR.sh.rotation.x = -2.2 + 3.2 * sp2;
        M.armR.sh.rotation.z = -0.5 + 0.6 * sp2 * this.swingSide;
        M.armR.el.rotation.x = -0.7 + 0.5 * sp2;
        M.torso.rotation.y = (0.5 - 0.9 * sp2) * this.swingSide;
        M.torso.rotation.x = -0.12 + 0.30 * sp2;
        M.weapon.rotation.x = 0.9 - 0.6 * sp2;
      } else if (this.state === 'break') {
        /* 破防：单膝跪地，刀脱手，垂头喘息 */
        var bk = Math.min(1, this.tim / 0.26);
        var breathe = Math.sin(this.tim * 5.5) * 0.015;
        /* 左腿单膝跪地：大腿竖直向下，小腿向后折 */
        M.legL.hip.rotation.x = 0.05 * bk;
        M.legL.knee.rotation.x = 1.62 * bk;
        /* 右腿屈膝支撑：大腿前抬，小腿竖直 */
        M.legR.hip.rotation.x = -1.28 * bk;
        M.legR.knee.rotation.x = 1.42 * bk;
        M.body.position.y = 0.86 * this.cfg.scale - 0.30 * bk + breathe;
        /* 上身：前倾但不趴下 */
        M.torso.rotation.x = 0.34 * bk;
        M.torso.rotation.y = 0;
        M.torso.rotation.z = 0.10 * bk;
        M.head.rotation.x = 0.42 * bk;
        M.head.rotation.y = 0.12 * bk;
        /* 双臂垂落 */
        M.armR.sh.rotation.x = 0.52 * bk;
        M.armR.sh.rotation.z = -0.42 * bk;
        M.armR.el.rotation.x = -0.30 * bk;
        M.armL.sh.rotation.x = 0.38 * bk;
        M.armL.sh.rotation.z = 0.36 * bk;
        M.armL.el.rotation.x = -0.35 * bk;
        if (M.shield) M.armL.sh.rotation.x = 0.72 * bk;
      } else if (this.state === 'stagger' || this.state === 'hurt') {
        M.torso.rotation.x = 0.28;
        M.armR.sh.rotation.x = 0.5;
        M.armL.sh.rotation.x = 0.4;
        M.head.rotation.x = -0.2;
      } else if (this.dead) {
        // handled outside
      } else {
        // 走动摆臂
        M.armR.sh.rotation.x = armBase + (moving ? -swing * 0.5 : Math.sin(t * 1.4 + this.walkPhase) * 0.04);
        M.armL.sh.rotation.x = armBase + (moving ? -sw2 * 0.5 : Math.sin(t * 1.4 + 1 + this.walkPhase) * 0.04);
        M.armR.sh.rotation.z = -0.14;
        M.armL.sh.rotation.z = 0.14;
        M.armR.el.rotation.x = -0.55;
        M.armL.el.rotation.x = -0.35;
        M.torso.rotation.x = moving ? 0.10 : 0.02;
        M.head.rotation.x = 0;
        M.weapon.rotation.x = 0.45;
      }

      // 盾卫举盾
      if (M.shield) {
        var guardUp = (this.state === 'chase' || this.state === 'idle' || this.state === 'wind');
        M.armL.sh.rotation.x = J.U.lerp(M.armL.sh.rotation.x, guardUp ? -1.15 : -0.3, 0.15);
        M.armL.el.rotation.x = -1.0;
        M.armL.sh.rotation.z = 0.5;
      }

      // 射手投掷
      if (this.cfg.ranged && this.state === 'strike') {
        M.armR.sh.rotation.x = -1.4 + (this.tim / this.dur) * 2.4;
      }
    }
  };

  J.Foe = Foe;
  J.FOE_TYPE = TYPE;

  /* ── 生成 ── */
  J.spawnFoes = function () {
    J.foes = [];
    function add(type, x, z, yaw) {
      var f = new Foe(type, x, z, yaw);
      J.foes.push(f);
      return f;
    }
    function rx(z) { return J.Terrain.riverX(z); }
    /* 谷底渡口：巡逻山贼 */
    add('bandit', rx(96) - 26, 96, 0.8);
    add('bandit', rx(70) + 24, 70, -0.4);
    add('bandit', rx(34) - 30, 34, 1.2);
    add('bandit', rx(8) + 26, 8, 2.2);
    add('thrower', rx(52) + 34, 52, 2.8);
    /* 木桥守卫 */
    add('guard', rx(50) - 8, 50, 3.0);
    add('bandit', rx(50) + 10, 50, 0.2);
    /* 瀑布崖下 */
    add('bandit', J.Terrain.FALL.x - 14, 122, 0.6);
    add('bandit', J.Terrain.FALL.x + 16, 118, -1.2);
    /* 北坡 */
    add('bandit', rx(-84) + 14, -84, 1.6);
    add('guard', rx(-96) - 10, -96, -0.6);
    add('thrower', rx(-110) + 18, -110, 2.0);
    add('guard', rx(-126) - 12, -126, 1.0);
    /* 山顶宫殿守卫 */
    add('guard', -18, -168, 0.5);
    add('guard', 18, -168, -0.5);
    add('thrower', 0, -158, 1.5);
    /* 总坛教头：第五章的关底，不是终局 Boss */
    var elite = add('boss', rx(-100) - 5, -106, Math.PI * 0.6);
    elite.home.set(rx(-100) - 5, -106);
    J.elite = elite;
  };

})();
