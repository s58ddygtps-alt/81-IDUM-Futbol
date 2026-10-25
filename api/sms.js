const DB = 'https://idum-futbol-default-rtdb.firebaseio.com';
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function has(text, t) {
  const n = String(t), g = n.replace(/\B(?=(\d{3})+(?!\d))/g, '#');
  const forms = new Set([n, ...[' ', ',', '.', '\u00a0'].map(c => g.replace(/#/g, c))]);
  return [...forms].some(f =>
    new RegExp('(?<!\\d)' + esc(f) + '(?!\\d|[ ,.\\u00a0]\\d{3}(?!\\d))').test(text));
}

module.exports = async (req, res) => {
  const q = req.query || {};
  if ((q.key || '') !== process.env.SECRET) return res.status(401).json({ ok: false, error: 'key' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = { text: body }; } }
  const text = String((body && body.text) || q.text || '');
  if (!text) return res.status(400).json({ ok: false, error: 'text yoq' });

  const r = await fetch(`${DB}/orders.json?orderBy=${encodeURIComponent('"$key"')}&limitToLast=100`);
  const orders = (await r.json()) || {};
  const now = Date.now();
  const found = Object.entries(orders)
    .filter(([, o]) => o && (o.status === 'pending' || (o.status === 'expired' && now - o.exp < 1800000)) && has(text, o.total))
    .sort((a, b) => (b[1].status === 'pending') - (a[1].status === 'pending') || b[1].created - a[1].created);
  if (!found.length) return res.json({ ok: false, error: 'mos buyurtma topilmadi' });

  const [k, o] = found[0];
  const ymd = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
  const date = new Date().toLocaleDateString('ru-RU', { timeZone: 'Asia/Tashkent' });
  const u = {};
  u[`orders/${k}/status`] = 'paid';
  u[`orders/${k}/paidAt`] = now;
  u[`players/${o.player}/paid`] = true;
  u[`players/${o.player}/payMonth`] = ymd.slice(0, 7);
  u[`payments/${o.player}/p${now}`] = { date, amount: o.base };
  const w = await fetch(`${DB}/.json`, { method: 'PATCH', body: JSON.stringify(u) });
  return res.json({ ok: w.ok, player: o.player, total: o.total });
};
