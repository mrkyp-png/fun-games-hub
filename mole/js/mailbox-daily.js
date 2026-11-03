/* Daily mailbox delivery slots in Korea Standard Time (UTC+9). */
(function (root) {
  'use strict';
  var DAY = 86400000, HOUR = 3600000, KST = 9 * HOUR;
  function dayStart(time) { return Math.floor((time + KST) / DAY) * DAY - KST; }
  function nextAt(now) {
    var start = dayStart(now), evening = start + 21 * HOUR;
    return now < evening ? evening : start + DAY;
  }
  function due(now, after, retentionDays) {
    if (!Number.isInteger(retentionDays) || retentionDays < 1) throw new Error('Daily mail retention must be specified.');
    if (!Number.isFinite(after)) after = dayStart(now) - 1;
    var cutoff = now - retentionDays * DAY, result = [];
    for (var day = dayStart(Math.max(after, cutoff) + 1); day <= dayStart(now); day += DAY) {
      [0, 21].forEach(function (hour) {
        var at = day + hour * HOUR;
        if (at <= after || at <= cutoff || at > now) return;
        var date = new Date(day + KST).toISOString().slice(0, 10), heart = hour === 0;
        result.push({ id:'daily-' + date + (heart ? '-heart' : '-ticket'),
          title:heart ? 'mole.mail.dailyHeartTitle' : 'mole.mail.dailyTicketTitle',
          description:heart ? 'mole.mail.dailyHeartDesc' : 'mole.mail.dailyTicketDesc',
          mailType:'daily', rewardType:heart ? 'heart' : 'ticket', rewardAmount:heart ? 3 : 1,
          isRead:false, isClaimed:false, createdAt:at, expireAt:at + retentionDays * DAY });
      });
    }
    return result;
  }
  root.MoleGame = root.MoleGame || {};
  root.MoleGame.DailyMail = { due:due, nextAt:nextAt };
})(window);
