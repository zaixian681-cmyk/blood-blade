/* ═══════════════════════════════════════════════
   cinema.js — 过场动画 / 电影镜头
   黑边 · 字幕 · 运镜 · 慢镜 · 白闪
   所有镜头都是数据驱动的关键帧，可跳过
   ═══════════════════════════════════════════════ */
J.Cine = (function () {

  var C = {
    active: false,
    t: 0, total: 0,
    shots: [], si: 0, st: 0,
    subs: [], onEnd: null, skipped: false,
    _endCam: null,
    _lock: true
  };

  var $top, $bot, $sub, $who, $txt, $layer, $flash;

  function dom() {
    if ($layer) return;
    $top = document.getElementById('cineTop');
    $bot = document.getElementById('cineBot');
    $sub = document.getElementById('cineSub');
    $who = document.getElementById('cineWho');
    $txt = document.getElementById('cineTxt');
    $layer = document.getElementById('cineLayer');
    $flash = document.getElementById('cineFlash');
    if ($layer) {
      $layer.addEventListener('pointerdown', function (e) {
        e.preventDefault(); e.stopPropagation();
        C.skip();
      });
    }
  }

  function ease(k, kind) {
    if (kind === 'out') return 1 - Math.pow(1 - k, 3);
    if (kind === 'in') return k * k * k;
    if (kind === 'lin') return k;
    if (kind === 'outExpo') return k >= 1 ? 1 : 1 - Math.pow(2, -10 * k);
    return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  }

  function v(p) {
    if (p && p.isVector3) return p;
    if (Array.isArray(p)) return new THREE.Vector3(p[0], p[1], p[2]);
    if (p && p.x !== undefined) return new THREE.Vector3(p.x, p.y, p.z);
    return new THREE.Vector3();
  }

  /* ══ 播放 ══
     cfg = {
       shots: [{ from:[x,y,z]|fn, to:[x,y,z]|fn, lookFrom, lookTo, fov, dur, ease, shake }],
       subs:  [{ t, who, text, dur }],
       onEnd, soft (不禁用输入)
     } */
  C.play = function (cfg) {
    dom();
    if (!cfg || !cfg.shots || !cfg.shots.length) return;
    C.shots = cfg.shots;
    C.subs = cfg.subs || [];
    C.onEnd = cfg.onEnd || null;
    C.si = 0; C.st = 0;
    C.t = 0;
    C.total = 0;
    for (var i = 0; i < C.shots.length; i++) C.total += (C.shots[i].dur || 1);
    C.active = true;
    C.skipped = false;
    C._lock = cfg.soft ? false : true;
    if ($top) { $top.classList.add('on'); $bot.classList.add('on'); }
    if ($flash) $flash.classList.remove('on');
    /* 清掉输入残余，避免过场里放技能 */
    J.IN.mag = 0; J.IN.mx = 0; J.IN.mz = 0;
    J.IN._press.atk = J.IN._press.heavy = J.IN._press.dash = J.IN._press.ult = J.IN._press.jump = 0;
    J.IN.held.atk = J.IN.held.heavy = 0;
    C._apply(C.shots[0], 0);
  };

  C._apply = function (shot, k) {
    var cam = J.C;
    var p0 = v(shot.from), p1 = v(shot.to);
    var l0 = v(shot.lookFrom), l1 = v(shot.lookTo);
    if (!p1) p1 = p0.clone();
    var pos = p0.clone().lerp(p1, k);
    var lk = l0.clone().lerp(l1, k);
    cam.position.copy(pos);
    cam.lookAt(lk.x, lk.y, lk.z);
    var f0 = shot.fov || 55, f1 = shot.fovTo === undefined ? f0 : shot.fovTo;
    cam.fov = f0 + (f1 - f0) * k;
    cam.updateProjectionMatrix();
    if (shot.shake) {
      var a = shot.shake * (1 - k * 0.5);
      cam.position.x += (Math.random() - 0.5) * a;
      cam.position.y += (Math.random() - 0.5) * a;
    }
    if (shot.onK) shot.onK(k);
  };

  C.update = function (dt) {
    if (!C.active) return;
    C.t += dt;

    /* 字幕 */
    if ($sub) {
      var cur = null;
      for (var i = 0; i < C.subs.length; i++) {
        var s = C.subs[i];
        var d = s.dur === undefined ? 2.4 : s.dur;
        if (C.t >= s.t && C.t < s.t + d) { cur = s; break; }
      }
      if (cur) {
        if ($who.textContent !== (cur.who || '')) $who.textContent = cur.who || '';
        if ($txt.textContent !== cur.text) $txt.textContent = cur.text;
        $sub.classList.add('on');
      } else {
        $sub.classList.remove('on');
      }
    }

    /* 镜头推进 */
    var shot = C.shots[C.si];
    if (!shot) { C.finish(); return; }
    C.st += dt;
    var d = shot.dur || 1;
    var k = Math.min(1, C.st / d);
    C._apply(shot, ease(k, shot.ease));
    if (k >= 1) {
      C.si++;
      C.st = 0;
      if (C.si >= C.shots.length) C.finish();
    }

    /* 过场期间锁输入 */
    if (C._lock) {
      J.IN.mag = 0; J.IN.mx = 0; J.IN.mz = 0;
      J.IN._press.atk = J.IN._press.heavy = J.IN._press.dash = J.IN._press.ult = J.IN._press.jump = 0;
      J.IN.held.atk = J.IN.held.heavy = 0;
    }
  };

  C.finish = function () {
    if (!C.active) return;
    C.active = false;
    if ($top) { $top.classList.remove('on'); $bot.classList.remove('on'); }
    if ($sub) $sub.classList.remove('on');
    /* 让第三人称相机从当前过场位置平滑回位，不硬切 */
    if (J.P && J.C) {
      if (!J.P._camPos) J.P._camPos = new THREE.Vector3();
      J.P._camPos.copy(J.C.position);
    }
    var cb = C.onEnd;
    C.onEnd = null;
    if (cb) cb();
  };

  C.skip = function () {
    if (!C.active) return;
    C.skipped = true;
    C.finish();
  };

  /* ── 屏幕闪光 ── */
  C.flash = function (color, dur, strength) {
    dom();
    if (!$flash) return;
    $flash.style.background = '#' + ('000000' + (color || 0xffffff).toString(16)).slice(-6);
    $flash.style.opacity = strength === undefined ? 0.85 : strength;
    $flash.classList.remove('on');
    void $flash.offsetWidth;
    $flash.classList.add('on');
    $flash.style.animationDuration = (dur || 0.5) + 's';
  };

  /* ══ 预制镜头 ══ */
  function P() { return J.P ? J.P.pos : new THREE.Vector3(); }

  /* 章节开场：从高空推向角色，再转到正面 */
  C.chapterIntro = function (title, sub) {
    var p = P().clone();
    var y = p.y;
    var back = J.P ? J.P.camYaw : Math.PI;
    C.play({
      shots: [
        {
          from: [p.x + Math.sin(back) * 46, y + 44, p.z + Math.cos(back) * 46],
          to: [p.x + Math.sin(back) * 16, y + 9.5, p.z + Math.cos(back) * 16],
          lookFrom: [p.x, y + 6, p.z],
          lookTo: [p.x, y + 1.5, p.z],
          fov: 52, fovTo: 44, dur: 2.6, ease: 'out'
        },
        {
          from: [p.x + Math.sin(back) * 16, y + 9.5, p.z + Math.cos(back) * 16],
          to: [p.x - Math.sin(back) * 5.2, y + 2.4, p.z - Math.cos(back) * 5.2],
          lookFrom: [p.x, y + 1.5, p.z],
          lookTo: [p.x, y + 1.35, p.z],
          fov: 44, fovTo: 40, dur: 1.9, ease: 'inOut'
        }
      ],
      subs: sub
        ? [{ t: 0.5, who: '', text: title, dur: 3.2 }, { t: 3.6, who: '', text: sub, dur: 2.4 }]
        : [{ t: 0.5, who: '', text: title, dur: 4.0 }],
      onEnd: function () {
        if (J.UI) J.UI.regionBanner(title);
      }
    });
  };

  /* Boss 登场 */
  C.bossIntro = function (foe, title, sub) {
    if (!foe) return;
    var b = foe.pos.clone();
    var ang = J.P ? Math.atan2(J.P.pos.x - b.x, J.P.pos.z - b.z) : 0;
    C.play({
      shots: [
        {
          from: [b.x - Math.sin(ang) * 1.1, b.y + 0.35, b.z - Math.cos(ang) * 1.1],
          to: [b.x - Math.sin(ang) * 2.6, b.y + 1.15, b.z - Math.cos(ang) * 2.6],
          lookFrom: [b.x, b.y + 2.5, b.z],
          lookTo: [b.x, b.y + 1.85, b.z],
          fov: 62, fovTo: 50, dur: 1.5, ease: 'out'
        },
        {
          from: [b.x + Math.sin(ang + 1.1) * 4.2, b.y + 2.0, b.z + Math.cos(ang + 1.1) * 4.2],
          to: [b.x + Math.sin(ang + 1.5) * 3.0, b.y + 1.7, b.z + Math.cos(ang + 1.5) * 3.0],
          lookFrom: [b.x, b.y + 1.7, b.z],
          lookTo: [b.x, b.y + 1.6, b.z],
          fov: 50, fovTo: 46, dur: 1.5, ease: 'inOut'
        }
      ],
      subs: [
        { t: 0.2, who: '', text: title || foe.cfg.name, dur: 1.5 },
        { t: 1.7, who: '', text: sub || '', dur: 1.4 }
      ]
    });
  };

  /* Boss 换阶段：短促压迫感 */
  C.phaseBreak = function (foe, name, sub) {
    if (!foe) return;
    var b = foe.pos.clone();
    var ang = J.P ? Math.atan2(J.P.pos.x - b.x, J.P.pos.z - b.z) : 0;
    C.flash(0xff2a12, 0.55, 0.55);
    C.play({
      shots: [
        {
          from: [b.x - Math.sin(ang) * 2.0, b.y + 0.6, b.z - Math.cos(ang) * 2.0],
          to: [b.x - Math.sin(ang) * 4.4, b.y + 2.35, b.z - Math.cos(ang) * 4.4],
          lookFrom: [b.x, b.y + 1.9, b.z],
          lookTo: [b.x, b.y + 1.55, b.z],
          fov: 68, fovTo: 50, dur: 1.15, ease: 'outExpo', shake: 0.16
        }
      ],
      subs: [
        { t: 0.05, who: '', text: name, dur: 1.2 },
        { t: 1.1, who: '', text: sub || '', dur: 0.9 }
      ],
      soft: true
    });
  };

  /* 顾长风 授刀 */
  C.mentor = function (npc, lines, onEnd) {
    if (!npc) return;
    var n = npc.pos.clone(), p = P().clone();
    var mx = (n.x + p.x) / 2, mz = (n.z + p.z) / 2;
    var ang = Math.atan2(n.x - p.x, n.z - p.z);
    C.play({
      shots: [
        {
          from: [mx + Math.sin(ang + 1.4) * 4.6, n.y + 2.5, mz + Math.cos(ang + 1.4) * 4.6],
          to: [mx + Math.sin(ang + 2.0) * 3.2, n.y + 1.55, mz + Math.cos(ang + 2.0) * 3.2],
          lookFrom: [n.x, n.y + 1.3, n.z],
          lookTo: [n.x, n.y + 1.15, n.z],
          fov: 46, fovTo: 40, dur: 2.4, ease: 'inOut'
        },
        {
          from: [p.x + Math.sin(ang - 0.9) * 2.6, p.y + 1.55, p.z + Math.cos(ang - 0.9) * 2.6],
          to: [p.x + Math.sin(ang - 1.3) * 2.0, p.y + 1.45, p.z + Math.cos(ang - 1.3) * 2.0],
          lookFrom: [p.x, p.y + 1.3, p.z],
          lookTo: [p.x, p.y + 1.3, p.z],
          fov: 40, fovTo: 38, dur: 2.2, ease: 'inOut'
        }
      ],
      subs: lines || [{ t: 0.4, who: '顾长风', text: '刀不是握在手里的。', dur: 2.0 }],
      onEnd: onEnd || null
    });
  };

  /* 终局：绕人缓慢升起 */
  C.finale = function (onEnd) {
    var p = P().clone();
    var ang = J.P ? J.P.yaw : 0;
    C.play({
      shots: [
        {
          from: [p.x + Math.sin(ang + 2.2) * 5.0, p.y + 1.9, p.z + Math.cos(ang + 2.2) * 5.0],
          to: [p.x + Math.sin(ang + 3.6) * 3.4, p.y + 2.6, p.z + Math.cos(ang + 3.6) * 3.4],
          lookFrom: [p.x, p.y + 1.4, p.z],
          lookTo: [p.x, p.y + 1.5, p.z],
          fov: 44, fovTo: 40, dur: 3.0, ease: 'inOut'
        },
        {
          from: [p.x + Math.sin(ang + 3.6) * 3.4, p.y + 2.6, p.z + Math.cos(ang + 3.6) * 3.4],
          to: [p.x + Math.sin(ang + 4.6) * 14, p.y + 11, p.z + Math.cos(ang + 4.6) * 14],
          lookFrom: [p.x, p.y + 1.5, p.z],
          lookTo: [p.x, p.y + 1.2, p.z],
          fov: 40, fovTo: 52, dur: 4.0, ease: 'inOut'
        }
      ],
      subs: [
        { t: 0.4, who: '', text: '江 湖 未 平', dur: 3.2 },
        { t: 4.2, who: '', text: '这一刀，为守住该守的人', dur: 3.4 }
      ],
      onEnd: onEnd || null
    });
  };

  C.isBusy = function () { return C.active; };

  return C;
})();
