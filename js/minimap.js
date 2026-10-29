/* ═══════════════════════════════════════════════
   minimap.js — 小地图 / 全图
   底图由真实 heightAt 采样生成，与地形一一对应
   ═══════════════════════════════════════════════ */
J.Minimap = (function () {

  var M = {
    size: 168,          // 底图分辨率
    world: 440,         // 覆盖世界尺寸（与 Terrain.SIZE 一致）
    canvas: null, ctx: null,
    base: null,         // 底图
    open: false,        // 全图模式
    viewR: 150          // 小地图可视半径（米）
  };

  /* ── 生成地形俯视底图 ── */
  function buildBase() {
    var N = M.size, S = M.world, half = S / 2;
    var cv = document.createElement('canvas');
    cv.width = cv.height = N;
    var g = cv.getContext('2d');
    var img = g.createImageData(N, N);
    var d = img.data;

    for (var iy = 0; iy < N; iy++) {
      for (var ix = 0; ix < N; ix++) {
        var wx = -half + (ix + 0.5) / N * S;
        var wz = -half + (iy + 0.5) / N * S;
        var h = J.Terrain.heightAt(wx, wz);
        var sl = J.Terrain.slopeAt(wx, wz);
        var r, gg, b;

        if (h < -14) { r = 26; gg = 40; b = 56; }              // 峡谷深底
        else if (h < -4) { r = 44; gg = 58; b = 42; }          // 谷底
        else if (h < 8) { r = 78; gg = 92; b = 58; }           // 草地
        else if (h < 20) { r = 96; gg = 92; b = 66; }          // 草坡
        else if (h < 34) { r = 108; gg = 100; b = 86; }        // 岩坡
        else if (h < 48) { r = 122; gg = 118; b = 112; }       // 高岩
        else { r = 148; gg = 152; b = 158; }                   // 山顶

        /* 山坡加深，形成立体感 */
        var shade = 1 - sl * 0.42;
        r *= shade; gg *= shade; b *= shade;

        /* 主路：浅色带 */
        var dRoad = Math.abs(wx - J.Terrain.pathX(wz));
        if (dRoad < 7 && h > -6) {
          var f = (1 - dRoad / 7) * 0.55;
          r = r + (168 - r) * f; gg = gg + (150 - gg) * f; b = b + (116 - b) * f;
        }
        /* 吊桥位置 */
        if (wz > J.Terrain.GORGE_Z0 - 6 && wz < J.Terrain.GORGE_Z1 + 6 &&
          dRoad < 4.5 && h < -10) {
          r = 168; gg = 138; b = 96;
        }

        var k = (iy * N + ix) * 4;
        d[k] = r; d[k + 1] = gg; d[k + 2] = b; d[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return cv;
  }

  /* ── 绘制 ── */
  function draw(P) {
    var ctx = M.ctx, cv = M.canvas;
    if (!ctx) return;
    var W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);

    /* 圆角裁剪 */
    ctx.save();
    ctx.beginPath();
    var rr = 10;
    ctx.moveTo(rr, 0);
    ctx.arcTo(W, 0, W, H, rr);
    ctx.arcTo(W, H, 0, H, rr);
    ctx.arcTo(0, H, 0, 0, rr);
    ctx.arcTo(0, 0, W, 0, rr);
    ctx.closePath();
    ctx.clip();

    var worldS = M.world, half = worldS / 2;
    var px, pz;

    if (M.open) {
      /* 全图：整张底图缩放铺满 */
      ctx.drawImage(M.base, 0, 0, W, H);
      px = (P.pos.x + half) / worldS * W;
      pz = (P.pos.z + half) / worldS * H;
    } else {
      /* 小地图：跟随玩家，显示 viewR 半径 */
      var viewW = M.viewR * 2;
      var sx = (P.pos.x - M.viewR + half) / worldS * M.base.width;
      var sy = (P.pos.z - M.viewR + half) / worldS * M.base.height;
      var sw = viewW / worldS * M.base.width;
      var sh = viewW / worldS * M.base.height;
      ctx.drawImage(M.base, sx, sy, sw, sh, 0, 0, W, H);
      px = W / 2; pz = H / 2;
    }

    /* 区域标记 */
    for (var i = 0; i < J.World.regions.length; i++) {
      var r = J.World.regions[i];
      var rx, rz;
      if (M.open) {
        rx = (r.x + half) / worldS * W;
        rz = (r.z + half) / worldS * H;
      } else {
        if (Math.hypot(r.x - P.pos.x, r.z - P.pos.z) > M.viewR * 0.95) continue;
        rx = W / 2 + (r.x - P.pos.x) / M.viewR * (W / 2);
        rz = H / 2 + (r.z - P.pos.z) / M.viewR * (H / 2);
      }
      var visited = J.Obj && J.Obj.visited && J.Obj.visited[r.id];
      ctx.beginPath();
      ctx.arc(rx, rz, M.open ? 4 : 3.2, 0, 6.283);
      ctx.fillStyle = visited ? 'rgba(240,210,140,0.95)' : 'rgba(160,150,130,0.6)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(30,24,16,0.8)';
      ctx.stroke();
      if (M.open) {
        ctx.fillStyle = visited ? '#f0d8a8' : '#b8ac94';
        ctx.font = '9px serif';
        ctx.textAlign = 'center';
        ctx.fillText(r.name, rx, rz - 7);
      }
    }

    /* 敌人红点 */
    for (var j = 0; j < J.foes.length; j++) {
      var f = J.foes[j];
      if (f.dead || f.gone) continue;
      var fx, fz;
      if (M.open) {
        fx = (f.pos.x + half) / worldS * W;
        fz = (f.pos.z + half) / worldS * H;
      } else {
        var dd = Math.hypot(f.pos.x - P.pos.x, f.pos.z - P.pos.z);
        if (dd > M.viewR * 0.92) continue;
        fx = W / 2 + (f.pos.x - P.pos.x) / M.viewR * (W / 2);
        fz = H / 2 + (f.pos.z - P.pos.z) / M.viewR * (H / 2);
      }
      ctx.beginPath();
      ctx.arc(fx, fz, f.cfg.boss ? 3.4 : 2.1, 0, 6.283);
      ctx.fillStyle = f.cfg.boss ? 'rgba(255,120,60,1)' : 'rgba(220,70,60,0.85)';
      ctx.fill();
    }

    /* 可交互物 */
    if (J.Interact) {
      for (var k = 0; k < J.Interact.list.length; k++) {
        var it = J.Interact.list[k];
        if (it.taken) continue;
        var ix, iz;
        if (M.open) {
          ix = (it.x + half) / worldS * W;
          iz = (it.z + half) / worldS * H;
        } else {
          if (Math.hypot(it.x - P.pos.x, it.z - P.pos.z) > M.viewR * 0.9) continue;
          ix = W / 2 + (it.x - P.pos.x) / M.viewR * (W / 2);
          iz = H / 2 + (it.z - P.pos.z) / M.viewR * (H / 2);
        }
        ctx.fillStyle = 'rgba(255,215,120,0.95)';
        ctx.fillRect(ix - 1.6, iz - 1.6, 3.2, 3.2);
      }
    }

    /* 玩家箭头 */
    ctx.save();
    ctx.translate(px, pz);
    /* 游戏里 yaw=0 面向 -Z，地图上 -Z 是上方 */
    ctx.rotate(-P.yaw + Math.PI);
    ctx.beginPath();
    ctx.moveTo(0, -6.5);
    ctx.lineTo(4.6, 5);
    ctx.lineTo(0, 2.4);
    ctx.lineTo(-4.6, 5);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.restore();

    ctx.restore();

    /* 外框 */
    ctx.beginPath();
    ctx.moveTo(rr, 0.5);
    ctx.arcTo(W - 0.5, 0.5, W - 0.5, H - 0.5, rr);
    ctx.arcTo(W - 0.5, H - 0.5, 0.5, H - 0.5, rr);
    ctx.arcTo(0.5, H - 0.5, 0.5, 0.5, rr);
    ctx.arcTo(0.5, 0.5, W - 0.5, 0.5, rr);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(214,182,128,0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  M.init = function () {
    M.canvas = document.getElementById('minimap');
    if (!M.canvas) return;
    M.ctx = M.canvas.getContext('2d');
    M.base = buildBase();
    draw(J.P);

    /* 点击小地图 → 切换全图 */
    var el = document.getElementById('minimapWrap');
    if (el) {
      el.addEventListener('pointerdown', function (e) {
        e.preventDefault(); e.stopPropagation();
        M.toggle();
      });
    }
  };

  M.toggle = function () {
    M.open = !M.open;
    var cv = M.canvas;
    var wrap = document.getElementById('minimapWrap');
    if (M.open) {
      cv.width = 300; cv.height = 300;
      wrap.classList.add('big');
    } else {
      cv.width = 112; cv.height = 112;
      wrap.classList.remove('big');
    }
    draw(J.P);
  };

  M.update = function (dt, P) {
    M._t = (M._t || 0) + dt;
    /* 小地图 12fps 足够，省性能 */
    if (M._t < 0.08 && !M.open) return;
    M._t = 0;
    draw(P);
  };

  return M;
})();
