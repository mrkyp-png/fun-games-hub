/* V1650 C 사용자: 스코어·일일·퀘스트를 광장 게시판 하나에 모음 — 칸 3개 내용(글자·빨간 점)과 칸 그림.
   게시판 3D 모델(사용자 Tripo)이 오면 renderer 가 이 그림을 칸 자리에 붙임. */
(function (root) {
  'use strict';
  const KINDS = ['score', 'daily', 'quest'];
  const RIM = { score: '#f2909c', daily: '#7cc3ee', quest: '#7fd6a6' };

  // 칸 3개 내용: { score|daily|quest: { title, line, dot } }
  function panelData(MG, ko) {
    const best = MG.ScoreScreen && MG.ScoreScreen.myBest ? MG.ScoreScreen.myBest() : null;
    const daily = !!(MG.Daily && MG.Daily.claimable && MG.Daily.claimable());
    const q = MG.Quest && MG.Quest.claimable ? MG.Quest.claimable() : 0;
    const n = (v) => Number(v).toLocaleString('en-US');
    /* 스코어 칸 = 여러 장(두더지팡 / 리듬팡 비치 / 리듬팡 네온)을 넘김. 장마다 1~5위 + 내 순위·점수(사용자) */
    const S = MG.ScoreScreen, me = ko ? '나' : 'Me';
    const page = (title, list, sortFn, scoreOf) => { const all = (sortFn ? sortFn(list) : list).slice(), mi = all.findIndex((e) => e.isMe);
      return { title, rows: [0, 1, 2, 3, 4].map((i) => all[i] ? { rank: i + 1, name: all[i].playerName || '', score: n(scoreOf(all[i])), me: !!all[i].isMe } : { rank: i + 1, name: '—', score: '—', me: false }),
        mine: mi >= 0 ? { rank: mi + 1, score: n(scoreOf(all[mi])) } : null }; };
    const pages = [];
    for (const g of SCORE_GAMES) for (const pg of g(MG, S, ko, me, best)) pages.push(page(pg.title, pg.list, pg.sort, pg.scoreOf));
    return {
      score: { title: ko ? '스코어' : 'Score', line: best ? (ko ? best.round + '라운드 · ' + n(best.score) + '점' : 'R' + best.round + ' · ' + n(best.score)) : (ko ? '첫 기록에 도전!' : 'Set a record!'), pages, dot: false },
      daily: { title: ko ? '일일 선물' : 'Daily Gift', line: daily ? (ko ? '오늘 선물 도착!' : 'Gift ready!') : (ko ? '내일 또 만나요' : 'See you tomorrow'), dot: daily },
      quest: { title: ko ? '퀘스트' : 'Quest', line: q > 0 ? (ko ? '보상 ' + q + '개 받기' : q + ' to claim') : (ko ? '도전 중' : 'In progress'), dot: q > 0 }
    };
  }

  // 칸 그림 한 장(캔버스 2D): 크림 바탕 + 칸 색 테두리 + 제목 + 한 줄 + 빨간 점
  /* 스코어 칸에 나오는 게임 목록 — 새 게임이 나오면 여기에 하나 추가(사용자 V1650 C). 각 항목 = 장 목록 [{ title, list(순위 항목), sort, scoreOf }] */
  const SCORE_GAMES = [
    (MG, S, ko, me, best) => { const list = S && S.RankingSource ? S.RankingSource.top('mole_pang').slice() : [];
      if (best) list.push({ playerName: me, highestRound: best.round, highestScore: best.score, isMe: true });
      return [{ title: ko ? '두더지팡' : 'Mole Pang', list, sort: S && S.sortRanking, scoreOf: (e) => e.highestScore }]; },
    (MG, S, ko, me) => { const songs = (MG.Rhythm && MG.Rhythm.rules && MG.Rhythm.rules.config && MG.Rhythm.rules.config.bSongs) || [];
      if (!(S && S.rpMyBest && songs.length)) return [];
      return [['A', ko ? '리듬팡 비치' : 'Rhythm Beach'], ['B', ko ? '리듬팡 네온' : 'Rhythm Neon']].map(([type, title]) => {
        const song = songs.find((sg) => S.rpMyBest(type, sg.id)) || songs[0], mine = S.rpMyBest(type, song.id), list = S.RankingSource.top('rhythm_pang:' + type + ':' + song.id).slice();
        if (mine) list.push({ playerName: me, diff: mine.diff, grade: mine.grade, score: mine.score, isMe: true });
        return { title, list, sort: (l) => l.slice().sort(S.rpCmp), scoreOf: (e) => e.score }; }); }
  ];
  const ko = (pg) => /[가-힣]/.test(pg.title);
  function drawPanel(ctx, w, h, kind, p) {
    const r = w * 0.09, pad = w * 0.05;
    const round = (x, y, ww, hh, rr) => { ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + ww, y, x + ww, y + hh, rr); ctx.arcTo(x + ww, y + hh, x, y + hh, rr); ctx.arcTo(x, y + hh, x, y, rr); ctx.arcTo(x, y, x + ww, y, rr); ctx.closePath(); };
    ctx.clearRect(0, 0, w, h);
    if (p.bare) { ctx.fillStyle = '#fff8ea'; ctx.fillRect(0, 0, w, h); } /* 게시판 모델에 칸 테두리가 있음 → 크림만 */
    else { round(0, 0, w, h, r); ctx.fillStyle = RIM[kind]; ctx.fill(); round(pad, pad, w - pad * 2, h - pad * 2, r * 0.7); ctx.fillStyle = '#fff8ea'; ctx.fill(); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#6b4426';
    if (p.pages) { /* 스코어 칸: 지금 장(p.at) 제목 + 1~5위 + 내 순위·점수 */
      const pg = p.pages[(p.at || 0) % p.pages.length], MED = ['#f2b705', '#a9b4c2', '#d08a4a', '#c9b79a', '#c9b79a'], fs = (k) => Math.round(h * k) + 'px Jua, system-ui, sans-serif';
      ctx.font = '900 ' + fs(0.12); ctx.fillText(pg.title, w / 2, h * 0.15, w - pad * 4);
      pg.rows.forEach((row, i) => { const y = h * (0.3 + i * 0.105);
        ctx.beginPath(); ctx.arc(pad * 3, y, h * 0.04, 0, Math.PI * 2); ctx.fillStyle = MED[i]; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '900 ' + fs(0.055); ctx.fillText(String(row.rank), pad * 3, y + h * 0.004);
        ctx.fillStyle = row.me ? '#d2556a' : '#6b4426'; ctx.textAlign = 'left'; ctx.font = '700 ' + fs(0.075); ctx.fillText(row.name, pad * 4.6, y, w * 0.42);
        ctx.textAlign = 'right'; ctx.fillText(row.score, w - pad * 2.4, y, w * 0.34); });
      ctx.textAlign = 'center'; ctx.fillStyle = '#d2556a'; ctx.font = '900 ' + fs(0.08);
      ctx.fillText(pg.mine ? (ko(pg) ? '내 순위 ' + pg.mine.rank + '위 · ' + pg.mine.score + '점' : 'My rank #' + pg.mine.rank + ' · ' + pg.mine.score) : (ko(pg) ? '내 기록 없음' : 'No record yet'), w / 2, h * 0.86, w - pad * 4);
    } else {
    ctx.font = '900 ' + Math.round(h * 0.2) + 'px Jua, system-ui, sans-serif'; ctx.fillText(p.title, w / 2, h * 0.36, w - pad * 4);
    ctx.font = '700 ' + Math.round(h * 0.13) + 'px Jua, system-ui, sans-serif'; ctx.fillStyle = '#9a6b3f'; ctx.fillText(p.line, w / 2, h * 0.66, w - pad * 4);
    }
    if (p.dot) { ctx.beginPath(); ctx.arc(w - pad * 2.2, pad * 2.2, h * 0.075, 0, Math.PI * 2); ctx.fillStyle = '#ff4b4b'; ctx.fill(); ctx.lineWidth = h * 0.02; ctx.strokeStyle = '#fff'; ctx.stroke(); }
  }

  const api = { KINDS, SCORE_GAMES, panelData, drawPanel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MoleGame = root.MoleGame || {};
  root.MoleGame.Home3DBoard = api;
})(typeof window !== 'undefined' ? window : globalThis);
