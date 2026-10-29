/* ═══════════════════════════════════════════════
   interact.js — 统一交互系统
   宝箱 / 秘籍 / 石碑 / 传送点，全部走同一接口
   ═══════════════════════════════════���═══════════ */
J.Interact = (function () {

  var I = {
    list: [],
    near: null,
    _hintT: 0,

    /* cfg: { id, x, y, z, r, label, once, onUse, tag } */
    add: function (cfg) {
      cfg.r = cfg.r || 2.8;
      cfg.once = cfg.once === undefined ? true : cfg.once;
      cfg.taken = false;
      I.list.push(cfg);
      return cfg;
    },

    /* 建一个实体宝箱（带外观） */
    addChest: function (x, z, opt) {
      opt = opt || {};
      var y = J.Terrain.heightAt(x, z);
      var g = new THREE.Group();
      var woodM = new THREE.MeshStandardMaterial({ color: 0x6a4f30, roughness: 0.85, metalness: 0.05 });
      var goldM = new THREE.MeshStandardMaterial({ color: 0xc9a45a, metalness: 1.0, roughness: 0.3, emissive: 0x3a2a08, emissiveIntensity: 0.5 });

      var body = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.56, 0.62), woodM);
      body.position.y = 0.28; body.castShadow = true; g.add(body);
      var lid = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.86, 10, 1, false, 0, Math.PI), woodM);
      lid.rotation.z = Math.PI / 2;
      lid.position.y = 0.56; lid.castShadow = true;
      g.add(lid);
      /* 铁箍 */
      for (var i = -1; i <= 1; i += 2) {
        var band = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.64), goldM);
        band.position.set(i * 0.3, 0.28, 0); g.add(band);
      }
      var lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.08), goldM);
      lock.position.set(0, 0.42, 0.32); g.add(lock);

      g.position.set(x, y, z);
      J.S.add(g);

      var item = I.add({
        id: opt.id || ('chest_' + I.list.length),
        x: x, y: y, z: z,
        label: opt.label || '打开木箱',
        tag: 'chest',
        mesh: g, lid: lid,
        onUse: function (it) {
          /* 开盖动画 */
          lid.rotation.x = -1.1;
          lid.position.z = -0.24;
          lid.position.y = 0.66;
          J.FX.ring(x, y + 0.6, z, 0xffd070, 2.2);
          J.FX.spark(x, y + 0.7, z, 16, 0xffd890, 1.2);
          if (opt.reward) {
            J.UI.toast(opt.reward, 2.0);
            if (J.Obj) J.Obj.onLoot(it.id, opt.reward);
          }
        }
      });
      /* 宝箱朝向 */
      if (opt.ry) g.rotation.y = opt.ry;
      return item;
    },

    /* 一个可阅读的石碑 / 木牌 */
    addStele: function (x, z, text, ry) {
      var y = J.Terrain.heightAt(x, z);
      var item = I.add({
        id: 'stele_' + I.list.length,
        x: x, y: y, z: z,
        label: '查看碑文',
        tag: 'stele',
        onUse: function () { J.UI.toast(text, 3.4); }
      });
      return item;
    },

    /* 每帧：找最近的可交互目标 */
    update: function (dt, pos) {
      var best = null, bd = 1e9;
      for (var i = 0; i < I.list.length; i++) {
        var it = I.list[i];
        if (it.taken) continue;
        var d = Math.hypot(it.x - pos.x, it.z - pos.z);
        if (d > it.r) continue;
        if (Math.abs(it.y - pos.y) > 3.2) continue;
        if (d < bd) { bd = d; best = it; }
      }
      if (best !== I.near) {
        I.near = best;
        if (J.UI && J.UI.interactHint) J.UI.interactHint(best ? best.label : null);
      }
    },

    /* 执行当前交互 */
    use: function () {
      var it = I.near;
      if (!it) return false;
      if (it.onUse) it.onUse(it);
      if (it.once) {
        it.taken = true;
        if (it.mesh) it.mesh.userData.opened = true;
      }
      I.near = null;
      if (J.UI && J.UI.interactHint) J.UI.interactHint(null);
      return true;
    }
  };

  return I;
})();
