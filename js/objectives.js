/* ═══════════════════════════════════════════════
   objectives.js — 任务与据点状态
   8 个目标，全部由真实事件驱动，不做假进度
   ═══════════════════════════════════════════════ */
J.Obj = (function () {

  var O = {
    list: [],
    visited: {},
    clearedVillage: false,
    bossDown: false,
    looted: {},

    init: function () {
      O.list = [
        { id: 'o1', name: '踏入青崖山', done: false, hint: '从山门进入' },
        { id: 'o2', name: '穿过竹海山道', done: false, hint: '' },
        { id: 'o3', name: '清剿山道山贼', done: false, hint: '竹海一带的山贼' },
        { id: 'o4', name: '找到隐藏山洞', done: false, hint: '竹海西侧崖下' },
        { id: 'o5', name: '踏过断崖吊桥', done: false, hint: '峡谷只此一条路' },
        { id: 'o6', name: '荡平黑风山寨', done: false, hint: '山寨内全部敌人' },
        { id: 'o7', name: '取得古寺武学秘籍', done: false, hint: '大雄宝殿之内' },
        { id: 'o8', name: '击败断剑谷首领', done: false, hint: '山顶石台' }
      ];
      J.UI.buildObjectives(O.list);
    },

    done: function (id) {
      for (var i = 0; i < O.list.length; i++) {
        var o = O.list[i];
        if (o.id === id && !o.done) {
          o.done = true;
          J.UI.objectiveDone(o.name);
          return true;
        }
      }
      return false;
    },

    onLoot: function (id, reward) {
      O.looted[id] = true;
      if (id.indexOf('secret') >= 0) O.done('o7');
    },

    /* 每帧检查条件 */
    update: function (dt, P) {
      var W = J.World;

      /* 区域进入 */
      var r = W.regionAt(P.pos.x, P.pos.z);
      if (r && r.id >= 1) {
        if (!O.visited[r.id]) {
          O.visited[r.id] = true;
          J.UI.regionBanner(r.name);
          if (r.id === 1) O.done('o1');
          if (r.id === 2) O.done('o2');
          if (r.id === 3) O.done('o5');
          if (r.id === 6) { /* 到断剑谷是 o8 的前置，不算完成 */ }
        }
      }

      /* 山洞 */
      if (W.cavePos && !O.visited.cave) {
        var d = Math.hypot(P.pos.x - W.cavePos.x, P.pos.z - W.cavePos.z);
        if (d < 7) { O.visited.cave = true; O.done('o4'); }
      }

      /* 竹海清剿：统计竹海区存活敌人 */
      if (!O.bambooCleared) {
        var aliveB = 0;
        for (var i = 0; i < J.foes.length; i++) {
          var f = J.foes[i];
          if (f.dead || f.gone) continue;
          if (f.pos.z > 60 && f.pos.z < 170) aliveB++;
        }
        if (O.visited[2] && aliveB === 0 && J._bambooSpawned) {
          O.bambooCleared = true;
          O.done('o3');
        }
      }

      /* 山寨清剿 */
      if (!O.clearedVillage && W.villageCenter) {
        var alive = 0;
        for (var j = 0; j < J.foes.length; j++) {
          var g = J.foes[j];
          if (g.dead || g.gone) continue;
          if (Math.hypot(g.pos.x - W.villageCenter.x, g.pos.z - W.villageCenter.z) < 40) alive++;
        }
        if (O.visited[4] && alive === 0) {
          O.clearedVillage = true;
          O.done('o6');
          J.UI.toast('山寨已肃清', 2.4);
        }
      }

      /* Boss */
      if (!O.bossDown && J.boss && J.boss.dead) {
        O.bossDown = true;
        O.done('o8');
        J.UI.toast('断剑谷 · 已平定', 3.0);
      }
    }
  };

  return O;
})();
