/* ═══════════════════════════════════════════════
   boss.js — 终局 Boss：萧无极
   三阶段：血衣魔尊 → 秘藏觉醒 → 太玄决战
   每阶段换招式组 / 换演出 / 换刀气颜色
   ═══════════════════════════════════════════════ */
J.Boss = (function () {

  /* ══ 血影（召唤物）══ */
  J.FOE_TYPE.shade = {
    name: '血影', hp: 70, speed: 4.4, dmg: 11, range: 2.4, reach: 2.6,
    wind: 0.38, strike: 0.12, rec: 0.45, cd: 1.2, poise: 14,
    color: { cloth: 0x3a0a0c, trim: 0x8a1a18, skin: 0x8a5a58, blade: 0xc04030 },
    scale: 0.96, prize: 0, shade: true
  };

  /* ══ 阶段配置 ══
     moves: 招式权重表
     speed/dmg/cd: 随阶段递增 */
  var PHASES = [
    {
      name: '血衣魔尊', ch: '一',
      hpGate: 1.0, speed: 3.5, dmg: 24, cdMul: 1.0, poise: 170,
      aura: 0x7a1210, auraSize: 2.4, lightI: 2.0,
      moves: [['slash3', 3], ['heavy', 3], ['dashSlash', 2]]
    },
    {
      name: '秘藏觉醒', ch: '二',
      hpGate: 0.66, speed: 4.0, dmg: 30, cdMul: 0.82, poise: 230,
      aura: 0xc41c10, auraSize: 3.0, lightI: 2.8,
      moves: [['slash3', 2], ['wave', 3], ['dashSlash', 3], ['heavy', 2]]
    },
    {
      name: '太玄决战', ch: '三',
      hpGate: 0.33, speed: 4.5, dmg: 37, cdMul: 0.66, poise: 300,
      aura: 0xff3a18, auraSize: 3.6, lightI: 3.6,
      moves: [['storm', 3], ['wave', 2], ['summon', 1], ['slash3', 3], ['dashSlash', 2]]
    }
  ];

  var B = {
    projectiles: [],
    phases: PHASES,
    active: null
  };

  /* ── 刀气波网格 ── */
  var waveGeo = null;
  function makeWaveMesh(color) {
    if (!waveGeo) {
      waveGeo = new THREE.RingGeometry(0.55, 1.0, 18, 1, Math.PI * 0.15, Math.PI * 0.7);
    }
    var mat = new THREE.MeshBasicMaterial({
      color: color, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    var m = new THREE.Mesh(waveGeo, mat);
    m.renderOrder = 18;
    return m;
  }

  function spawnWave(foe, ph, dmg) {
    var p = foe.pos;
    var dx = J.P.pos.x - p.x, dz = J.P.pos.z - p.z;
    var d = Math.hypot(dx, dz) || 1;
    var m = makeWaveMesh(ph.aura);
    m.scale.setScalar(1.9);
    m.position.set(p.x, p.y + 1.15, p.z);
    m.lookAt(p.x + dx, p.y + 1.15, p.z + dz);
    J.S.add(m);
    B.projectiles.push({
      m: m, x: p.x, z: p.z, y: p.y,
      vx: dx / d * 15.5, vz: dz / d * 15.5,
      life: 2.0, dmg: dmg * 0.85, hit: false, color: ph.aura
    });
    J.FX.ring(p.x, p.y + 1.0, p.z, ph.aura, 3.4);
    J.FX.spark(p.x, p.y + 1.2, p.z, 18, ph.aura, 2.0);
    J.FX.shake(0.14, 0.22);
  }

  /* ── 阶段光环 ── */
  function buildAura(foe) {
    var g = new THREE.Group();
    var mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0x8a1210, transparent: true, opacity: 0.24,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide
      })
    );
    mesh.scale.set(1.15, 1.9, 1.15);
    mesh.position.y = 1.0;
    g.add(mesh);

    var ring = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.28, 26),
      new THREE.MeshBasicMaterial({
        color: 0xff4030, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    g.add(ring);

    var light = new THREE.PointLight(0x8a1210, 0, 9, 2);
    light.position.y = 1.3;
    g.add(light);

    foe.M.root.add(g);
    foe._aura = { g: g, mesh: mesh, ring: ring, light: light };
  }

  function applyPhase(foe, idx, silent) {
    var ph = PHASES[idx];
    foe.phase = idx;
    foe.phaseName = ph.name;
    foe.cfg.dmg = ph.dmg;
    foe.cfg.speed = ph.speed;
    foe._cdMul = ph.cdMul;
    foe.maxPoise = ph.poise;
    foe.poise = ph.poise;
    if (foe._aura) {
      foe._aura.mesh.material.color.setHex(ph.aura);
      foe._aura.ring.material.color.setHex(ph.aura);
      foe._aura.light.color.setHex(ph.aura);
      foe._aura.light.intensity = ph.lightI;
      foe._aura.mesh.scale.set(1.15, 1.9, 1.15).multiplyScalar(ph.auraSize / 2.4);
    }
    /* 招式的攻速也随阶段变快 */
    foe._atkSpd = 1 + idx * 0.12;
    if (!silent && J.UI) J.UI.bossPhase(foe);
  }

  /* ══ 初始化 Boss ══ */
  B.setup = function (foe, opt) {
    opt = opt || {};
    foe.cfg.phases = true;
    foe.isBoss3 = true;
    foe.phase = -1;
    foe._cdMul = 1;
    foe._atkSpd = 1;
    foe.bossInvuln = false;
    foe.maxHp = foe.hp = opt.hp || 1600;
    foe.summonT = 0;
    foe._lastMove = '';
    buildAura(foe);
    applyPhase(foe, 0, true);
    B.active = foe;
    J.boss = foe;
    return foe;
  };

  /* ══ 玩家/同伴 受击判定 ══ */
  function targets() {
    var out = [];
    if (J.P && !J.P.dead) out.push(J.P);
    if (J.Ally && J.Ally.active && !J.Ally.down) out.push(J.Ally);
    return out;
  }

  function strikeHit(foe, mul, opt) {
    opt = opt || {};
    var reach = (foe.cfg.reach + 0.6) * (opt.reachMul || 1);
    var arc = Math.cos(opt.arc || 1.05);
    var list = targets();
    var hitAny = false;
    for (var i = 0; i < list.length; i++) {
      var T = list[i];
      var dx = T.pos.x - foe.pos.x, dz = T.pos.z - foe.pos.z;
      var d = Math.hypot(dx, dz);
      if (d > reach) continue;
      var dot = (dx * Math.sin(foe.yaw) + dz * Math.cos(foe.yaw)) / (d || 1);
      if (d > 1.0 && dot < arc) continue;
      T.takeHit(foe.cfg.dmg * mul, foe.pos, true);
      hitAny = true;
    }
    if (hitAny) {
      J.FX.spark(
        foe.pos.x + Math.sin(foe.yaw) * 1.6,
        foe.pos.y + 1.2,
        foe.pos.z + Math.cos(foe.yaw) * 1.6,
        14, 0xff8050, 1.6);
      J.FX.shake(0.16, 0.2);
    }
    return hitAny;
  }

  /* ══ 状态机（返回 {spd, faceTo}）══ */
  B.step = function (foe, dt, distToP, t) {
    /* 过场动画期间站定 */
    if (J.Cine && J.Cine.active && J.Cine._lock) return { spd: 0, faceTo: null };
    var ph = PHASES[foe.phase] || PHASES[0];
    var spd = 0, faceTo = null;
    var P = J.P;

    /* 阶段切换检测（在受击后由 hurt 触发的 gate 检查） */
    if (!foe.bossInvuln) {
      var r = foe.hp / foe.maxHp;
      if (foe.phase === 0 && r <= 0.66) { B.enterPhase(foe, 1); return { spd: 0, faceTo: null }; }
      if (foe.phase === 1 && r <= 0.33) { B.enterPhase(foe, 2); return { spd: 0, faceTo: null }; }
    }

    foe.tim += dt;
    var st = foe.state;

    /* 由父类处理的状态 */
    if (st === 'stagger' || st === 'hurt') {
      if (foe.tim >= (foe.dur || 0.4)) foe.enter('chase'); else return { spd: 0, faceTo: null };
    }
    if (st === 'break') {
      /* Boss 破防时间更短，且起身会反扑 */
      if (foe.tim >= (foe.dur || 0.5)) {
        foe.enter('chase');
        foe.cd = 0.2;
      }
      return { spd: 0, faceTo: null };
    }

    faceTo = Math.atan2(P.pos.x - foe.pos.x, P.pos.z - foe.pos.z);

    switch (st) {
      /* ── 阶段过渡 ── */
      case 'phase': {
        var dur = foe.dur || 1.6;
        if (foe.tim > 0.55 && !foe._phaseBurst) {
          foe._phaseBurst = true;
          J.FX.ring(foe.pos.x, foe.pos.y + 0.8, foe.pos.z, ph.aura, 7.5);
          J.FX.ring(foe.pos.x, foe.pos.y + 1.4, foe.pos.z, 0xffd0a0, 5.0);
          J.FX.spark(foe.pos.x, foe.pos.y + 1.4, foe.pos.z, 46, ph.aura, 3.4);
          J.FX.shake(0.4, 0.6);
          /* 震开玩家 */
          var dxp = P.pos.x - foe.pos.x, dzp = P.pos.z - foe.pos.z;
          var dp = Math.hypot(dxp, dzp) || 1;
          if (dp < 6.5) {
            P.takeHit(0, foe.pos, true);
            P.pos.x += dxp / dp * 0.9; P.pos.z += dzp / dp * 0.9;
          }
        }
        if (foe.tim >= dur) {
          foe.bossInvuln = false;
          foe._phaseBurst = false;
          foe.enter('chase');
          foe.cd = 0.35;
        }
        return { spd: 0, faceTo: null };
      }

      case 'idle':
        if (distToP < 22) foe.enter('chase');
        break;

      case 'chase':
        if (distToP > (foe.cfg.range + 0.4)) {
          spd = ph.speed;
        } else if (foe.cd <= 0) {
          var mv = B.pickMove(foe, ph);
          B.startMove(foe, mv);
          return { spd: 0, faceTo: faceTo };
        } else {
          /* 贴身绕步：显出血衣门主的从容 */
          spd = 0.9;
          faceTo = faceTo + Math.sin(t * 0.9) * 0.6;
        }
        break;

      /* ── 三连斩 ── */
      case 's3wind':
        if (foe.tim >= 0.42 / foe._atkSpd) {
          foe.enter('s3strike', 0.62 / foe._atkSpd);
          foe._s3n = 0;
          foe._s3t = 0;
        }
        break;
      case 's3strike': {
        foe._s3t += dt;
        var marks = [0.10, 0.30, 0.50];
        if (foe._s3n < 3 && foe._s3t >= marks[foe._s3n]) {
          strikeHit(foe, foe._s3n === 2 ? 1.25 : 0.62, { arc: 1.15, reachMul: foe._s3n === 2 ? 1.15 : 1 });
          foe._s3n++;
          if (foe._s3n === 3) {
            J.FX.ring(foe.pos.x, foe.pos.y + 1.1, foe.pos.z, ph.aura, 4.0);
          }
        }
        if (foe.tim >= foe.dur) {
          foe.enter('recover', 0.55 / foe._atkSpd);
          foe.cd = 1.1 * foe._cdMul;
        }
        break;
      }

      /* ── 重劈（带小位移）── */
      case 'wind':
        if (foe.tim >= foe.dur) {
          foe.enter('strike', 0.20 / foe._atkSpd);
          foe._hitDone = false;
        }
        if (distToP > 3.0) spd = Math.min(2.6, ph.speed * 0.8);
        break;
      case 'strike':
        if (!foe._hitDone && foe.tim > 0.07) {
          foe._hitDone = true;
          strikeHit(foe, 1.35, { arc: 0.95, reachMul: 1.1 });
        }
        if (foe.tim >= foe.dur) {
          foe.enter('recover', 0.42 / foe._atkSpd);
          foe.cd = 0.95 * foe._cdMul;
        }
        break;

      /* ── 血影突进 ── */
      case 'dashWind':
        /* 后撤半步蓄势 */
        if (foe.tim < 0.12) spd = -2.0;
        if (foe.tim >= 0.30 / foe._atkSpd) {
          foe.enter('dashAtk', 0.34);
          foe._dashDir = new THREE.Vector3(Math.sin(foe.yaw), 0, Math.cos(foe.yaw));
          foe._dashHit = false;
          J.FX.spark(foe.pos.x, foe.pos.y + 0.4, foe.pos.z, 16, ph.aura, 1.8);
        }
        break;
      case 'dashAtk': {
        var dsp = 19 * (1 - foe.tim / foe.dur * 0.55);
        foe.pos.x += foe._dashDir.x * dsp * dt;
        foe.pos.z += foe._dashDir.z * dsp * dt;
        spd = 0;
        if (!foe._dashHit && foe.tim > 0.05) {
          foe._dashHit = true;
          strikeHit(foe, 1.15, { arc: 1.4, reachMul: 1.2 });
        }
        if (foe.tim >= foe.dur) {
          foe.enter('recover', 0.38 / foe._atkSpd);
          foe.cd = 1.0 * foe._cdMul;
          J.FX.ring(foe.pos.x, foe.pos.y + 0.2, foe.pos.z, ph.aura, 2.6);
        }
        break;
      }

      /* ── 刀气波 ── */
      case 'waveWind': {
        if (foe.tim > 0.18 && !foe._telegraph) {
          foe._telegraph = true;
          /* 地面上给玩家一个预警圈 */
          var w = makeWaveMesh(ph.aura);
          w.rotation.x = -Math.PI / 2;
          w.scale.setScalar(2.2);
          w.position.set(foe.pos.x, foe.pos.y + 0.08, foe.pos.z);
          w.material.opacity = 0.35;
          J.S.add(w);
          foe._tele = w;
        }
        if (foe.tim >= 0.78 / foe._atkSpd) {
          if (foe._tele) { J.S.remove(foe._tele); foe._tele = null; }
          spawnWave(foe, ph, foe.cfg.dmg);
          foe._telegraph = false;
          foe.enter('recover', 0.45 / foe._atkSpd);
          foe.cd = 1.25 * foe._cdMul;
        }
        break;
      }

      /* ── 旋风斩（第三阶段）── */
      case 'stormWind':
        if (foe.tim >= 0.45 / foe._atkSpd) {
          foe.enter('storm', 1.05);
          foe._stormN = 0;
          foe._stormT = 0;
          J.FX.ring(foe.pos.x, foe.pos.y + 0.3, foe.pos.z, ph.aura, 3.6);
        }
        break;
      case 'storm': {
        foe._stormT += dt;
        /* 旋转的同时快步行进 */
        spd = 3.2;
        foe.yaw += dt * 7.5;
        var marks2 = [0.10, 0.38, 0.66, 0.90];
        if (foe._stormN < 4 && foe._stormT >= marks2[foe._stormN]) {
          strikeHit(foe, 0.55, { arc: -1.0, reachMul: 1.15 });   // 全向
          foe._stormN++;
        }
        if (foe._stormT >= foe.dur) {
          foe.enter('recover', 0.6 / foe._atkSpd);
          foe.cd = 1.4 * foe._cdMul;
        }
        break;
      }

      /* ── 召唤血影 ── */
      case 'summonWind':
        if (foe.tim > 0.3 && !foe._summoned) {
          foe._summoned = true;
          B.summon(foe, ph);
          foe.enter('summonRec', 0.6);
        }
        break;
      case 'summonRec':
        if (foe.tim >= foe.dur) { foe.enter('chase'); foe.cd = 1.3; }
        break;

      case 'recover':
        if (foe.tim >= foe.dur) foe.enter('chase');
        break;
    }

    /* 召唤物自动消失由 update 处理 */
    return { spd: spd, faceTo: faceTo };
  };

  /* 招式选择：带权重，且不连续重复同一个 */
  B.pickMove = function (foe, ph) {
    var pool = [];
    for (var i = 0; i < ph.moves.length; i++) {
      var m = ph.moves[i];
      if (m[0] === foe._lastMove && ph.moves.length > 1) continue;
      for (var w = 0; w < m[1]; w++) pool.push(m[0]);
    }
    if (!pool.length) pool.push(ph.moves[0][0]);
    var pick = pool[J.U.randi(0, pool.length - 1)];
    foe._lastMove = pick;
    return pick;
  };

  B.startMove = function (foe, mv) {
    var sp = foe._atkSpd || 1;
    foe._hitDone = false;
    foe._telegraph = false;
    foe._summoned = false;
    switch (mv) {
      case 'slash3':
        foe.enter('s3wind', 0.42 / sp);
        J.FX.ring(foe.pos.x, foe.pos.y + 0.2, foe.pos.z, 0x8a1210, 2.4);
        break;
      case 'heavy':
        foe.enter('wind', 0.62 / sp);
        break;
      case 'dashSlash':
        foe.enter('dashWind', 0.30 / sp);
        break;
      case 'wave':
        foe.enter('waveWind', 0.78 / sp);
        J.UI && J.UI.toast && J.UI.toast('刀 气', 0.8);
        break;
      case 'storm':
        foe.enter('stormWind', 0.45 / sp);
        J.UI && J.UI.flashText && J.UI.flashText('血 影 旋 风');
        break;
      case 'summon':
        foe.enter('summonWind', 0.9 / sp);
        J.UI && J.UI.flashText && J.UI.flashText('血 影 分 身');
        break;
    }
    /* 出招前的小提示动画 */
    foe.swingSide = J.U.pick([1, -1]);
  };

  /* ── 召唤两只血影 ── */
  B.summon = function (foe, ph) {
    for (var i = 0; i < 2; i++) {
      var a = (i === 0 ? -1 : 1) * 1.9 + foe.yaw;
      var x = foe.pos.x + Math.sin(a) * 2.6;
      var z = foe.pos.z + Math.cos(a) * 2.6;
      var f = new J.Foe('shade', x, z, foe.yaw);
      f.shadeT = 22;
      f.noKillQuest = true;
      J.foes.push(f);
      J.FX.ring(x, J.Terrain.heightAt(x, z) + 0.3, z, 0xb01810, 3.0);
      J.FX.spark(x, J.Terrain.heightAt(x, z) + 1.0, z, 22, 0xff4030, 1.8);
    }
    J.FX.shake(0.2, 0.3);
  };

  /* ── 进入新阶段 ── */
  B.enterPhase = function (foe, idx) {
    var ph = PHASES[idx];
    foe.phase = idx;
    foe.phaseName = ph.name;
    foe.bossInvuln = true;
    foe.enter('phase', 1.55);
    foe._phaseBurst = false;
    foe.poise = foe.maxPoise = ph.poise;
    foe.cfg.dmg = ph.dmg;
    foe.cfg.speed = ph.speed;
    foe._cdMul = ph.cdMul;
    foe._atkSpd = 1 + idx * 0.12;
    if (foe._aura) {
      foe._aura.mesh.material.color.setHex(ph.aura);
      foe._aura.ring.material.color.setHex(ph.aura);
      foe._aura.light.color.setHex(ph.aura);
      foe._aura.light.intensity = ph.lightI;
    }
    /* 清掉残留刀气预警 */
    if (foe._tele) { J.S.remove(foe._tele); foe._tele = null; }
    if (B.onPhase) B.onPhase(foe, idx);
    J.Cine.phaseBreak(foe, '第' + ph.ch + '阶段 · ' + ph.name, '萧无极：' + (idx === 1 ? '让你看看秘藏真正的样子。' : '这一刀，替你父亲送你。'));
    J.UI && J.UI.bossPhase && J.UI.bossPhase(foe);
    J.slowMo = 0.6;
    setTimeout(function () { J.slowMo = 1; }, 420);
  };

  /* ══ 每帧：刀气波 / 光环 / 血影寿命 ══ */
  B.update = function (dt, t) {
    /* 刀气波 */
    for (var i = B.projectiles.length - 1; i >= 0; i--) {
      var p = B.projectiles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      var gy = J.Terrain.heightAt(p.x, p.z);
      p.m.position.set(p.x, gy + 1.15, p.z);
      p.m.material.opacity = Math.min(0.9, p.life * 1.6);
      p.m.rotateZ(dt * 3.4);
      /* 拖尾火花 */
      if (Math.random() < 0.5) J.FX.spark(p.x, gy + 1.1, p.z, 1, p.color, 0.5);

      if (!p.hit) {
        var list = targets();
        for (var k = 0; k < list.length; k++) {
          var T = list[k];
          if (Math.hypot(T.pos.x - p.x, T.pos.z - p.z) < 1.35) {
            T.takeHit(p.dmg, { x: p.x, z: p.z }, true);
            p.hit = true;
            p.life = Math.min(p.life, 0.18);
            J.FX.spark(p.x, gy + 1.2, p.z, 18, 0xff6a40, 1.6);
            break;
          }
        }
      }
      if (p.life <= 0) {
        J.S.remove(p.m);
        p.m.geometry && (p.m.geometry = null);
        p.m.material.dispose();
        B.projectiles.splice(i, 1);
      }
    }

    /* 血影寿命 */
    for (var j = 0; j < J.foes.length; j++) {
      var f = J.foes[j];
      if (!f.cfg.shade || f.dead || f.gone) continue;
      f.shadeT -= dt;
      if (f.shadeT <= 0) {
        f.hp = 0;
        f.die();
      } else if (f.shadeT < 3) {
        f.M.root.scale.setScalar(0.6 + f.shadeT / 3 * 0.4);
      }
    }

    /* Boss 光环呼吸 */
    var b = B.active;
    if (b && !b.dead && !b.gone && b._aura) {
      var pulse = 0.82 + Math.sin(t * 3.2) * 0.18;
      b._aura.mesh.material.opacity = (0.16 + b.phase * 0.06) * pulse;
      b._aura.ring.material.opacity = 0.32 * pulse;
      b._aura.ring.scale.setScalar(1 + Math.sin(t * 2.1) * 0.06);
      b._aura.light.intensity = PHASES[Math.max(0, b.phase)].lightI * (0.85 + pulse * 0.25);
    }
  };

  /* ── Boss 专属动画姿态 ── */
  B.anim = function (foe, dt, t, moving) {
    var M = foe.M;
    var st = foe.state;
    var swing = Math.sin(foe.walkPhase);
    var sp = foe._atkSpd || 1;

    /* 基础呼吸与腿部 */
    var amp = moving ? 0.5 : 0.06;
    M.legL.hip.rotation.x = swing * amp;
    M.legR.hip.rotation.x = -swing * amp;
    M.legL.knee.rotation.x = Math.max(0, -swing) * 0.6 * (moving ? 1 : 0.2);
    M.legR.knee.rotation.x = Math.max(0, swing) * 0.6 * (moving ? 1 : 0.2);
    M.body.position.y = 0.86 * foe.cfg.scale + (moving ? Math.abs(swing) * 0.03 : Math.sin(t * 1.5) * 0.01);
    M.torso.rotation.z = moving ? swing * 0.04 : 0;
    M.head.rotation.x = 0;
    M.head.rotation.y = 0;

    var R = M.armR, L = M.armL;

    if (st === 'phase') {
      /* 仰头咆哮，双臂张开，刀指天 */
      var k = Math.min(1, foe.tim / 0.5);
      var shake = Math.sin(foe.tim * 26) * 0.02;
      M.torso.rotation.x = -0.36 * k;
      M.torso.rotation.y = 0;
      M.head.rotation.x = -0.45 * k;
      R.sh.rotation.x = -2.55 * k + shake;
      R.sh.rotation.z = -0.95 * k;
      R.el.rotation.x = -0.35 * k;
      L.sh.rotation.x = -1.65 * k;
      L.sh.rotation.z = 0.95 * k;
      L.el.rotation.x = -0.5 * k;
      M.weapon.rotation.x = 1.55 * k;
      M.body.position.y += 0.05 * k;
    } else if (st === 's3wind' || st === 's3strike') {
      var n = foe._s3n || 0;
      var side = (n % 2 === 0) ? 1 : -1;
      if (st === 's3wind') {
        var w = Math.min(1, foe.tim / (0.42 / sp));
        M.torso.rotation.y = 0.85 * side * w;
        M.torso.rotation.x = -0.18 * w;
        R.sh.rotation.x = -1.15 * w;
        R.sh.rotation.z = -1.5 * side * w;
        R.el.rotation.x = -0.9 * w;
        L.sh.rotation.x = -0.5 * w;
        M.weapon.rotation.x = 1.15;
        M.body.position.y += 0.03;
      } else {
        var sw = Math.min(1, (foe._s3t % 0.22) / 0.09);
        var reachOut = Math.sin(Math.min(1, sw) * Math.PI);
        M.torso.rotation.y = -1.55 * side * (0.6 + reachOut * 0.8);
        M.torso.rotation.x = 0.16 * reachOut;
        R.sh.rotation.x = -0.4 + reachOut * 0.75;
        R.sh.rotation.z = 1.55 * side * reachOut * 1.1;
        R.el.rotation.x = 0.1;
        L.sh.rotation.x = -0.2;
        M.weapon.rotation.x = 0.55;
      }
    } else if (st === 'wind') {
      var wp = Math.min(1, foe.tim / foe.dur);
      var e = wp * wp;
      R.sh.rotation.x = -2.9 * e;
      R.sh.rotation.z = -0.35 * e;
      R.el.rotation.x = -0.9 * e;
      L.sh.rotation.x = -2.4 * e;
      L.sh.rotation.z = 0.3 * e;
      M.torso.rotation.x = -0.3 * e;
      M.torso.rotation.y = 0.12 * e;
      M.weapon.rotation.x = 1.85;
      M.body.position.y += 0.04 * e;
    } else if (st === 'strike') {
      var sp2 = Math.min(1, foe.tim / foe.dur);
      var f = Eo(sp2, 3.2);
      R.sh.rotation.x = -2.9 + 4.0 * f;
      R.sh.rotation.z = -0.35 + 0.5 * f;
      R.el.rotation.x = -0.9 + 1.05 * f;
      L.sh.rotation.x = -2.4 + 3.2 * f;
      M.torso.rotation.x = -0.3 + 0.72 * f;
      M.weapon.rotation.x = 1.85 - 2.2 * f;
    } else if (st === 'dashWind') {
      var dw = Math.min(1, foe.tim / 0.3);
      M.torso.rotation.x = 0.35 * dw;
      M.torso.rotation.y = -0.6 * dw;
      R.sh.rotation.x = -0.1;
      R.sh.rotation.z = -1.35 * dw;
      R.el.rotation.x = -0.55;
      L.sh.rotation.x = 0.4 * dw;
      M.weapon.rotation.x = 0.25;
      M.body.position.y -= 0.05 * dw;
    } else if (st === 'dashAtk') {
      M.torso.rotation.x = 0.55;
      M.torso.rotation.y = 0.35;
      R.sh.rotation.x = 0.35;
      R.sh.rotation.z = 1.15;
      R.el.rotation.x = 0.15;
      L.sh.rotation.x = -0.45;
      M.weapon.rotation.x = 0.1;
      M.body.position.y -= 0.08;
    } else if (st === 'waveWind' || st === 'summonWind') {
      var ww = Math.min(1, foe.tim / (foe.dur || 0.8));
      R.sh.rotation.x = -1.5 * ww;
      R.sh.rotation.z = -1.15 * ww;
      R.el.rotation.x = -0.75 * ww;
      L.sh.rotation.x = -1.35 * ww;
      L.sh.rotation.z = 1.05 * ww;
      L.el.rotation.x = -0.6 * ww;
      M.torso.rotation.y = 0.55 * ww;
      M.torso.rotation.x = -0.12 * ww;
      M.weapon.rotation.x = 0.9;
      /* 刀身发光 */
      M.weapon.children.forEach(function (c) {
        if (c.material && c.material.emissive) c.material.emissiveIntensity = 0.4 + ww * 1.6;
      });
    } else if (st === 'stormWind') {
      var sw2 = Math.min(1, foe.tim / (foe.dur || 0.5));
      M.torso.rotation.x = 0.3 * sw2;
      R.sh.rotation.x = -1.3 * sw2;
      R.sh.rotation.z = -1.7 * sw2;
      R.el.rotation.x = -0.25;
      L.sh.rotation.x = -1.3 * sw2;
      L.sh.rotation.z = 1.7 * sw2;
      M.weapon.rotation.x = 0.3;
    } else if (st === 'storm') {
      M.torso.rotation.x = 0.24;
      R.sh.rotation.x = -0.3;
      R.sh.rotation.z = 1.45;
      R.el.rotation.x = 0.05;
      L.sh.rotation.x = 0.3;
      L.sh.rotation.z = -1.2;
      M.weapon.rotation.x = 0.35;
      M.body.position.y += Math.sin(t * 22) * 0.012;
    } else if (st === 'summonRec' || st === 'recover') {
      var rr = 1 - Math.min(1, foe.tim / (foe.dur || 0.5));
      M.torso.rotation.x = 0.35 * rr;
      R.sh.rotation.x = 0.35 * rr;
      L.sh.rotation.x = 0.25 * rr;
      M.weapon.rotation.x = 0.45;
    } else if (st === 'break') {
      /* 复用父类的破防姿态 */
      return false;
    } else {
      /* 走动/待机：单手持刀斜垂 */
      R.sh.rotation.x = -0.18 + (moving ? -swing * 0.45 : Math.sin(t * 1.4) * 0.03);
      R.sh.rotation.z = -0.16;
      R.el.rotation.x = -0.5;
      L.sh.rotation.x = -0.16 + (moving ? swing * 0.45 : 0);
      L.sh.rotation.z = 0.14;
      L.el.rotation.x = -0.32;
      M.torso.rotation.x = moving ? 0.09 : 0.02;
      M.weapon.rotation.x = 0.4;
    }
    return true;
  };

  function Eo(t, p) { return 1 - Math.pow(1 - t, p); }

  B.reset = function () {
    for (var i = 0; i < B.projectiles.length; i++) J.S.remove(B.projectiles[i].m);
    B.projectiles.length = 0;
    B.active = null;
  };

  return B;
})();
