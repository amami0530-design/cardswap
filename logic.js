/**
 * Critter Swap logic: pure functions only (no DOM, no network), so they can be reused and tested anywhere.
 * Loaded by index.html with <script src="logic.js"></script>; Node can require() it too.
 *
 * Card codes: "12" = normal card 12, "12F" = foil card 12.
 * A "user" looks like {playerId, username, forTrade: [codes], lookingFor: [codes]}.
 */
(function (root) {
  const TOTAL = 135;                                   // cards per version (15 sets x 9)
  const GOLD = new Set([63, 72, 80, 90, 96, 98, 106, 108, 113, 114, 117, 121, 123, 125, 131, 134, 135]);

  const num = c => parseInt(c, 10);
  const isFoil = c => String(c).endsWith('F');
  const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  const sortCodes = a => [...new Set(a)].sort((x, y) => num(x) - num(y) || (isFoil(x) - isFoil(y)));

  // "3, 12F, [40]" -> {ok: ['3','12F','40'], bad: [...]}
  function parseList(text) {
    const toks = String(text || '').replace(/[\[\]"']/g, ' ').split(/[\s,;]+/).filter(Boolean);
    const ok = [], bad = [];
    toks.forEach(t => {
      const m = /^#?(\d{1,3})(f)?$/i.exec(t);
      const n = m && +m[1];
      if (m && n >= 1 && n <= TOTAL) ok.push(n + (m[2] ? 'F' : '')); else bad.push(t);
    });
    return {ok: sortCodes(ok), bad};
  }

  function sheetIdFrom(text) {
    const t = String(text || '').trim();
    if (/\/spreadsheets\/d\/e\//.test(t)) return 'PUBLISHED';   // "publish to web" link: different ID, can't be read live
    const m = t.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    return /^[a-zA-Z0-9_-]{20,}$/.test(t) ? t : '';
  }

  // The album tab is a grid: column A = card numbers, then one column per player.
  //   row 1 = username, row 2 = player ID (PUID), rows 3-137 = cards 1-135, rows 138-272 = 1F-135F.
  //   A player's cell holds FT (for trade) or LF (looking for), or stays blank.
  function parseGrid(rows) {
    const out = [];
    const width = Math.max(0, ...rows.map(r => r.length));
    for (let c = 1; c < width; c++) {
      const name = String((rows[0] && rows[0][c]) ?? '').trim();
      const pid = String((rows[1] && rows[1][c]) ?? '').trim();
      if (!name && !pid) continue;
      const forTrade = [], lookingFor = [];
      for (let i = 0; i < TOTAL * 2; i++) {
        const mark = String((rows[i + 2] && rows[i + 2][c]) ?? '').trim().toUpperCase();
        if (mark !== 'FT' && mark !== 'LF') continue;
        const code = i < TOTAL ? String(i + 1) : (i - TOTAL + 1) + 'F';
        (mark === 'FT' ? forTrade : lookingFor).push(code);
      }
      out.push({playerId: pid, username: name, forTrade, lookingFor});
    }
    return out;
  }

  /**
   * Matches for one player. A trade is 1 card for 1 card, so for each other player P:
   *   get  = my Looking for  ∩ P's For trade   (cards I can receive)
   *   give = my For trade    ∩ P's Looking for (cards P wants from me)
   * mutual: P has at least one card I want AND wants at least one card I have -> an even swap is possible.
   * oneWay: P has a card I want but wants nothing I have.
   * Both are grouped by the card I'd receive: [{code, providers: [{user, give: [codes]}]}].
   * While gold trading is closed, gold cards are left out of `give` (a gold card I'd receive stays visible, flagged by the page).
   */
  function findMatches(me, users, opts) {
    const goldOpen = !!(opts && opts.goldOpen);
    const tradeable = c => goldOpen || !GOLD.has(num(c));
    const myId = String(me.playerId || '').trim();
    const others = users.filter(u => !(myId && u.playerId && same(u.playerId, myId)));
    const mutual = new Map(), oneWay = new Map();
    const add = (map, code, user, give) => {
      if (!map.has(code)) map.set(code, {code, providers: []});
      map.get(code).providers.push({user, give});
    };
    others.forEach(u => {
      const give = sortCodes(me.forTrade.filter(c => u.lookingFor.includes(c) && tradeable(c)));
      me.lookingFor.filter(c => u.forTrade.includes(c)).forEach(code => add(give.length ? mutual : oneWay, code, u, give));
    });
    const list = m => sortCodes([...m.keys()]).map(k => m.get(k));
    return {mutual: list(mutual), oneWay: list(oneWay)};
  }

  const api = {TOTAL, GOLD, sortCodes, parseList, sheetIdFrom, parseGrid, findMatches};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CritterLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
