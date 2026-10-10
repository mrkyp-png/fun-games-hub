// v1007 메일함 — 바탕화면 "메일함 UI 및 에셋/MOLE_PANG_메일함_UI_구현_명세서" 기준.
// 데이터(MG.Mailbox): 폰 저장소(localStorage)에 메일 목록. 다른 화면은 MG.Mailbox.send({...})로 메일을 넣는다.
// MailData: id, title, description, mailType, rewardType, rewardAmount, isRead, isClaimed, createdAt, expireAt
// (title/description 은 i18n 키 또는 글자. isRead·isClaimed 는 따로 관리 — 명세 §6·§8)
(function (root) {
  'use strict';
  var KEY = 'mole.mailbox', WELCOME_KEY = 'mole.mailbox.welcome1';
  var SEALS = { coin: 'red', ticket: 'blue', heart: 'pink', gift: 'yellow' };

  function ls() { try { return root.localStorage; } catch (e) { return null; } }
  function load() { try { return JSON.parse((ls() && ls().getItem(KEY)) || '[]') || []; } catch (e) { return []; } }
  function save(list) { try { ls() && ls().setItem(KEY, JSON.stringify(list)); } catch (e) { /* 무시 */ } }

  function send(m) {
    var list = load(), now = Date.now();
    list.unshift({ id: m.id || ('m' + now + Math.floor(Math.random() * 1000)), title: m.title || '', description: m.description || '',
      mailType: m.mailType || 'system', rewardType: m.rewardType || 'coin', rewardAmount: m.rewardAmount | 0,
      isRead: false, isClaimed: false, createdAt: now, expireAt: m.expireAt || 0 });
    save(list);
  }
  function list() { var now = Date.now(); return load().filter(function (m) { return !m.expireAt || m.expireAt > now; }); }
  function unreadCount() { return list().filter(function (m) { return !m.isRead; }).length; }
  function markRead(id) { var l = load(); l.forEach(function (m) { if (m.id === id) m.isRead = true; }); save(l); }

  // 보상 지급 — 이미 받은 메일은 다시 주지 않음(명세 §7). gift = 액티브 스킬 아이템 무작위 1종.
  function grant(m) {
    var MG = root.MoleGame || {}, E = MG.Economy, S = MG.Skills, n = m.rewardAmount || 1;
    if (m.rewardType === 'coin' && E) E.addCoins(n);
    else if (m.rewardType === 'ticket' && E) E.addTickets(n);
    else if (m.rewardType === 'heart' && E) E.addHearts(n);
    else if (m.rewardType === 'gift' && S) { var a = S.activeSkills(); if (a.length) S.addQuantity(a[Math.floor(Math.random() * a.length)].id, n); }
  }
  function claim(id) {
    var l = load(), got = null;
    l.forEach(function (m) { if (m.id === id && !m.isClaimed) { grant(m); m.isClaimed = true; m.isRead = true; got = m; } });
    save(l); return got;
  }
  function claimAll() { var got = []; list().forEach(function (m) { if (!m.isClaimed) { var g = claim(m.id); if (g) got.push(g); } }); return got; }

  // v1007(사용자 지정: "메일은 내가 보낼 수도 있고, 타이머에 맞춰 보낸다") — 운영자 메일 = mail.json.
  // 각 항목 { id, title, description, rewardType, rewardAmount, sendAt, expireAt } (sendAt/expireAt = "2026-10-11T09:00" 형식).
  // sendAt 이 지난 것만 메일함에 들어오고, 같은 id 는 한 번만 들어온다(이미 받은 메일 재지급 없음).
  var GOT_KEY = 'mole.mailbox.got';
  function syncRemote(done) {
    if (!root.fetch) { if (done) done(); return; }
    root.fetch('mail.json?_=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : []; }).then(function (arr) {
      var got = {}; try { got = JSON.parse((ls() && ls().getItem(GOT_KEY)) || '{}') || {}; } catch (e) { got = {}; }
      var now = Date.now(), added = 0;
      (Array.isArray(arr) ? arr : []).forEach(function (m) {
        if (!m || !m.id || got[m.id]) return;
        var at = m.sendAt ? Date.parse(m.sendAt) : 0, ex = m.expireAt ? Date.parse(m.expireAt) : 0;
        if (at && at > now) return; if (ex && ex <= now) return;
        got[m.id] = 1; added++;
        send({ id: 'r_' + m.id, title: m.title, description: m.description, mailType: 'admin', rewardType: m.rewardType, rewardAmount: m.rewardAmount, expireAt: ex });
      });
      try { ls() && ls().setItem(GOT_KEY, JSON.stringify(got)); } catch (e) { /* 무시 */ }
      if (done) done(added);
    }).catch(function () { if (done) done(0); });
  }

  // 처음 한 번만 환영 선물(사용자 결정: 메일 보내는 곳은 이후 각 화면에서 연결)
  if (ls() && !ls().getItem(WELCOME_KEY)) {
    ls().setItem(WELCOME_KEY, '1');
    send({ id: 'welcome1', title: 'mole.mail.welcomeTitle', description: 'mole.mail.welcomeDesc', mailType: 'event', rewardType: 'coin', rewardAmount: 1000 });
  }

  // ---------- 화면 ----------
  function createScreen(opts) {
    var el = opts.root, T = function (k) { var I = root.FGH && root.FGH.I18N; return I ? I.t(k) : k; };
    var tx = function (s) { var v = T(s); return v === s || !v ? s : v; };
    el.classList.add('mb-screen');
    el.innerHTML =
      '<div class="mb-frame">' +
        '<div class="mb-head">' +
          '<div class="mb-plank"><img class="mb-plank-img" src="assets/mailbox/plank.png" alt=""><img class="mb-plank-env" src="assets/mailbox/env-heart.png" alt=""></div>' +
          '<button type="button" class="mb-all" data-mb-all aria-label="claim all"><img src="assets/mailbox/ic-mail.png" alt=""><img src="assets/mailbox/ic-check.png" alt=""></button>' +
        '</div>' +
        '<div class="mb-list" data-mb-list></div>' +
      '</div>';
    var listEl = el.querySelector('[data-mb-list]');
    el.querySelector('[data-mb-all]').addEventListener('click', function () {
      var got = claimAll(); if (!got.length) return;
      render(false); if (opts.onClaim) opts.onClaim();
    });

    function fmtDate(t) { var d = new Date(t); return d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + ('0' + d.getDate()).slice(-2); }
    function fmtN(n) { return 'x' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

    function render(enter) {
      var mails = list();
      if (!mails.length) { listEl.innerHTML = '<p class="mb-empty"></p>'; listEl.firstChild.textContent = T('mole.shop.mailboxEmpty'); return; }
      listEl.innerHTML = '';
      mails.forEach(function (m, i) {
        var c = document.createElement('div');
        c.className = 'mb-card' + (m.isClaimed ? ' is-claimed' : '') + (enter ? ' is-enter' : '');
        c.style.animationDelay = (i * 0.06).toFixed(2) + 's';
        c.innerHTML =
          '<div class="mb-env"><img src="assets/mailbox/' + (m.isClaimed ? 'env-read' : 'env-' + (SEALS[m.rewardType] || 'red')) + '.png" alt="">' + (m.isRead ? '' : '<i class="mb-dot"></i>') + '</div>' +
          '<div class="mb-txt"><b class="mb-title"></b><span class="mb-desc"></span><span class="mb-date"></span></div>' +
          '<div class="mb-reward"><img src="assets/mailbox/rw-' + m.rewardType + '.png" alt=""><span class="mb-amt"></span></div>' +
          '<button type="button" class="mb-claim' + (m.isClaimed ? ' is-done' : '') + '"></button>';
        c.querySelector('.mb-title').textContent = tx(m.title);
        c.querySelector('.mb-desc').textContent = tx(m.description);
        c.querySelector('.mb-date').textContent = fmtDate(m.createdAt);
        c.querySelector('.mb-amt').textContent = fmtN(m.rewardAmount || 1);
        var b = c.querySelector('.mb-claim');
        b.textContent = m.isClaimed ? '✓ ' + T('mole.mail.claimed') : T('mole.mail.claim');
        b.disabled = m.isClaimed;
        c.addEventListener('click', function () { if (!m.isRead) { markRead(m.id); var d = c.querySelector('.mb-dot'); if (d) d.remove(); } });
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          if (!claim(m.id)) return;
          var rw = c.querySelector('.mb-reward'); rw.classList.add('is-pop');
          setTimeout(function () { render(false); }, 520);
          if (opts.onClaim) opts.onClaim();
        });
        listEl.appendChild(c);
      });
      // v1009(사용자 지정): 제목·설명 "…" 없이 — 넘치면 글자 폭만 줄여 한 줄
      requestAnimationFrame(function () {
        listEl.querySelectorAll('.mb-title, .mb-desc').forEach(function (t) {
          var room = t.parentNode.clientWidth; if (!room || t.scrollWidth <= room) return;
          t.style.transform = 'scaleX(' + Math.max(room / t.scrollWidth, 0.55).toFixed(3) + ')';
        });
      });
    }
    return { show: function () { listEl.scrollTop = 0; render(true); syncRemote(function (n) { if (n) render(false); }); } };
  }

  var api = { syncRemote: syncRemote, send: send, list: list, unreadCount: unreadCount, markRead: markRead, claim: claim, claimAll: claimAll, createScreen: createScreen };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Mailbox = api; }
})(typeof window !== 'undefined' ? window : null);
