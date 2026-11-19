'use strict';
/* MAX STORE — serveur Node.js sans dépendance (Node 18+).
   Lance :  node server.js
   Variables d'environnement (toutes optionnelles) :
     PORT, DATA_DIR, ADMIN_CODE (code admin initial), WHATSAPP, NATCASH, MONCASH,
     GOOGLE_CLIENT_ID */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), https = require('https');
const { baseProducts, extraProducts } = require('./seed.js');

const PORT = +process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID || '';
const INDEX = path.join(__dirname, 'index.html');
const UPLOADS = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'db.json');

/* ---------- utilitaires ---------- */
const hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) => salt + ':' + crypto.scryptSync(String(pw), salt, 32).toString('hex');
const checkPw = (pw, h) => { if (!h || !h.includes(':')) return false; const [s, x] = h.split(':'); const y = crypto.scryptSync(String(pw), s, 32).toString('hex'); return x.length === y.length && crypto.timingSafeEqual(Buffer.from(x), Buffer.from(y)); };
const rnd = n => crypto.randomBytes(n).toString('hex');
const str = (v, max = 300) => String(v ?? '').trim().slice(0, max);
const TIERS = [[10, 1], [20, 2], [40, 3], [80, 4], [100, 6], [200, 8], [400, 10], [600, 12], [1000, 20]];
const feeOf = a => (TIERS.find(t => a <= t[0]) || [0, 0])[1];
const fmt = n => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const E = (status, msg) => Object.assign(new Error(msg), { status });
const cleanPhone = v => { const t = str(v, 30); const d = t.replace(/\D/g, ''); return d.length >= 8 && d.length <= 15 ? (t.startsWith('+') ? '+' : '') + d : ''; };
const validEmail = e => /^\S+@\S+\.\S+$/.test(e) && e.length <= 120;

/* ---------- base de données (fichier JSON) ---------- */
function seed() {
  let adminCode = process.env.ADMIN_CODE;
  if (!adminCode) { adminCode = rnd(5); console.warn('⚠  ADMIN_CODE non défini. CODE ADMIN INITIAL (généré) : ' + adminCode + '  — change-le dans Admin → Site & réglages.'); }
  return {
    counter: 0, uc: 0, users: [], orders: [], proofs: [], txs: [], sells: [], workers: [], sessions: {},
    settings: { adminHash: hashPw(adminCode), whatsapp: process.env.WHATSAPP || '50900000000', natcash: process.env.NATCASH || '0000 0000', moncash: process.env.MONCASH || '0000 0000', natcashName: process.env.NATCASH_NAME || '', moncashName: process.env.MONCASH_NAME || '', minDeposit: parseInt(process.env.MIN_DEPOSIT) || 160 },
    site: { name: 'MAX STORE', color: '#483D8B', logo: '', tagline: 'Ta boutique digitale, simple et fiable.' },
    champTitle: 'Championnat', champ: [], news: ['Ff2018', 'Efootball'],
    products: [...baseProducts(), ...extraProducts()], added: extraProducts().map(p => p.id)
  };
}
let db;
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { db = seed(); }
for (const k of ['apps', 'notifs', 'withdrawals', 'bonuses', 'workers', 'sells', 'proofs']) db[k] = db[k] || [];
db.settings.natcashName = db.settings.natcashName || ''; db.settings.moncashName = db.settings.moncashName || ''; db.settings.minDeposit = db.settings.minDeposit || 160;
let timer = null;
function flush() { timer = null; try { fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db)); fs.renameSync(DB_FILE + '.tmp', DB_FILE); } catch (e) { console.error('Sauvegarde impossible :', e.message); } }
function save() { if (!timer) timer = setTimeout(flush, 150); }
save();
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flush(); process.exit(0); });

/* ---------- sessions, limites ---------- */
const adminTokens = new Map(); // token -> expiration
const hits = new Map();
function limit(key, max, ms) { const n = Date.now(); const h = (hits.get(key) || []).filter(t => n - t < ms); if (h.length >= max) throw E(429, 'Trop de tentatives. Réessaie dans quelques minutes.'); h.push(n); hits.set(key, h); }
setInterval(() => { const n = Date.now(); for (const [t, x] of adminTokens) if (x < n) adminTokens.delete(t); for (const t of Object.keys(db.sessions)) if (db.sessions[t].exp < n) delete db.sessions[t]; hits.clear(); save(); }, 3600e3).unref();
function newSession(uid) { const t = rnd(24); db.sessions[t] = { uid, exp: Date.now() + 30 * 864e5 }; save(); return t; }
const userByToken = t => { const s = t && db.sessions[t]; return s && s.exp > Date.now() ? db.users.find(u => u.id === s.uid) : null; };
const isAdminTok = t => !!t && (adminTokens.get(t) || 0) > Date.now();

const pub = u => ({ id: u.id, code: u.code, name: u.name, email: u.email, phone: u.phone || '', bal: u.bal, google: !!u.google, joined: u.joined, refBy: u.refBy || '' });
function tx(u, type, amt, note = '') { db.txs.unshift({ id: 'T' + Date.now() + rnd(2), uid: u.id, type, amt, note, date: Date.now() }); }
function newUser({ name, email, pw, google, phone, ref }) {
  const n = Math.max(db.uc || 0, ...db.users.map(u => parseInt(u.id) || 0)) + 1; db.uc = n;
  const pre = db.site.name.split(' ')[0].slice(0, 3).toUpperCase(); const al = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let code; do { code = pre + '-'; for (let i = 0; i < 8; i++) code += al[crypto.randomInt(al.length)]; } while (db.users.some(u => u.code === code));
  const u = { id: String(n).padStart(7, '0'), code, name, email, pw: pw ? hashPw(pw) : '', phone: phone || '', bal: 0, google: !!google, joined: Date.now(), refBy: str(ref, 30).toUpperCase() };
  db.users.push(u); save(); return u;
}

/* ---------- images ---------- */
function saveImage(dataUrl, max = 2.5e6) {
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw E(400, 'Image invalide.');
  const buf = Buffer.from(m[2], 'base64'); if (buf.length > max) throw E(413, 'Image trop lourde.');
  const name = rnd(12) + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]); fs.writeFileSync(path.join(UPLOADS, name), buf); return '/uploads/' + name;
}
const imgField = (v, old) => { v = String(v ?? ''); if (v === '[keep]') return old || ''; if (v.startsWith('data:')) return saveImage(v); if (!v) return ''; if (/^https?:\/\//i.test(v) || v.startsWith('/uploads/')) return v.slice(0, 500); return ''; };

/* ---------- messages dans le site ---------- */
function pushNotif(uid, text) { db.notifs.unshift({ id: 'N' + Date.now() + rnd(2), uid, text: str(text, 600), date: Date.now(), read: false }); if (db.notifs.length > 800) db.notifs.length = 800; }
const bon = x => { const e = parseInt(x && x.every), t = str(x && x.text, 120); return e > 0 && t ? { every: Math.min(e, 1000), text: t } : undefined; };

/* ---------- état envoyé au client ---------- */
function wstat(w) { const os = db.orders.filter(o => o.promo === w.code && !['Annulé', 'Refusé'].includes(o.status)); return { registered: db.users.filter(x => x.refBy === w.code).length, buyers: new Set(os.map(o => o.uid)).size, orders: os.length }; }
function state(u, admin) {
  const w = u && db.workers.find(x => x.uid === u.id);
  const s = db.settings;
  const base = { site: db.site, settings: { whatsapp: s.whatsapp, natcash: s.natcash, moncash: s.moncash, natcashName: s.natcashName, moncashName: s.moncashName, minDeposit: s.minDeposit }, products: db.products, news: db.news, champTitle: db.champTitle, champ: db.champ, stats: { users: db.users.length, orders: db.orders.length }, googleId: GOOGLE_ID, me: u ? pub(u) : null, isAdmin: !!admin, users: [], orders: [], proofs: [], txs: [], sells: [], workers: [], apps: [], withdrawals: [], bonuses: [], notifs: [], myApp: null };
  if (!u && !admin) return base;
  if (admin) return { ...base, users: db.users.map(pub), orders: db.orders, proofs: db.proofs, txs: db.txs, sells: db.sells, workers: db.workers.map(x => ({ ...x, stats: wstat(x) })), apps: db.apps, withdrawals: db.withdrawals, bonuses: db.bonuses, notifs: u ? db.notifs.filter(n => n.uid === u.id).slice(0, 30) : [], myApp: u ? db.apps.find(a => a.uid === u.id) || null : null };
  return { ...base, orders: db.orders.filter(o => o.uid === u.id || (w && o.worker === w.uid)), proofs: db.proofs.filter(p => p.uid === u.id), txs: db.txs.filter(t => t.uid === u.id), workers: w ? [{ ...w, stats: wstat(w) }] : [], withdrawals: db.withdrawals.filter(x => x.uid === u.id), bonuses: db.bonuses.filter(b => b.uid === u.id), notifs: db.notifs.filter(n => n.uid === u.id).slice(0, 30), myApp: db.apps.find(a => a.uid === u.id) || null };
}

/* ---------- commandes ---------- */
function priceItem(it) {
  const p = db.products.find(x => x.id === it.pid); if (!p || p.kind === 'game') throw E(400, 'Produit introuvable.');
  let price, label, name = p.name, opt = '';
  if (p.kind === 'listing') { const i = (p.items || [])[it.idx | 0]; if (!i) throw E(400, 'Article introuvable.'); price = i.p; label = i.d || i.t; name = p.name + ' — ' + i.t; opt = i.t; }
  else if (p.kind === 'recharge') { const a = Number(it.amt); if (!(a >= 1 && a <= 1000)) throw E(400, 'Montant invalide (1 à 1000 $).'); const f = feeOf(a); price = Math.round((a + f) * p.rate); label = 'Recharge ' + a + '$ (frais ' + f + '$)'; }
  else { const o = (p.offers || [])[it.sel | 0]; if (!o) throw E(400, 'Offre introuvable.'); price = o.p; label = o.l; opt = o.l; }
  const data = {};
  for (const f of p.fields || []) { const v = str(it.data && it.data[f.l], 300); if (f.req && !v) throw E(400, 'Champ obligatoire : ' + f.l); if (v) data[f.l] = v; }
  return { pid: p.id, name, label, price, data, opt };
}
function pickWorker(code) { return (code && db.workers.find(x => x.code === code)) || null; }
const isWorker = u => !!u && db.workers.some(x => x.uid === u.id);

/* ---------- API publique / utilisateur ---------- */
const R = {};
R.state = c => state(c.u, c.admin);
R.register = c => {
  limit('reg' + c.ip, 10, 36e5);
  const name = str(c.b.name, 60), email = str(c.b.email, 120).toLowerCase(), pw = String(c.b.pw || ''), phone = cleanPhone(c.b.phone);
  if (name.length < 2) throw E(400, "Entre un nom d'utilisateur."); if (!validEmail(email)) throw E(400, 'Email invalide.');
  if (pw.length < 6 || pw.length > 100) throw E(400, 'Mot de passe : 6 caractères minimum.'); if (!phone) throw E(400, 'Entre un numéro de téléphone valide.');
  if (db.users.some(u => u.email === email)) throw E(400, 'Un compte existe déjà avec cet email.');
  const u = newUser({ name, email, pw, phone, ref: c.b.ref }); return { token: newSession(u.id) };
};
R.login = c => {
  const email = str(c.b.email, 120).toLowerCase(); limit('login' + c.ip + email, 10, 6e5);
  const u = db.users.find(x => x.email === email);
  if (!u) throw E(400, 'Email ou mot de passe incorrect.');
  if (!u.pw) throw E(400, 'Ce compte utilise Google : clique sur « Continuer avec Google ».');
  if (!checkPw(c.b.pw, u.pw)) throw E(400, 'Email ou mot de passe incorrect.');
  return { token: newSession(u.id) };
};
R.google = async c => {
  if (!GOOGLE_ID) throw E(400, 'Connexion Google non configurée sur le serveur.');
  const info = await new Promise((ok, ko) => https.get('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(String(c.b.credential || '')), r => { let d = ''; r.on('data', x => d += x); r.on('end', () => { try { ok(JSON.parse(d)); } catch (e) { ko(e); } }); }).on('error', ko));
  if (info.aud !== GOOGLE_ID || String(info.email_verified) !== 'true' || !info.email) throw E(400, 'Connexion Google refusée.');
  const email = info.email.toLowerCase(); let u = db.users.find(x => x.email === email);
  if (!u) u = newUser({ name: str(info.name || email.split('@')[0], 60), email, google: true, ref: c.b.ref });
  return { token: newSession(u.id) };
};
R.logout = c => { const t = c.tok; if (t && db.sessions[t]) { delete db.sessions[t]; save(); } return {}; };
const need = c => { if (!c.u) throw E(401, 'Connecte-toi.'); return c.u; };
R.profile = c => {
  const u = need(c); const name = str(c.b.name, 60), email = str(c.b.email, 120).toLowerCase(), phone = cleanPhone(c.b.phone);
  if (name.length < 2 || !validEmail(email)) throw E(400, 'Nom ou email invalide.'); if (!phone) throw E(400, 'Numéro de téléphone invalide.');
  if (db.users.some(x => x.email === email && x.id !== u.id)) throw E(400, 'Cet email est déjà utilisé.');
  u.name = name; u.email = email; u.phone = phone; save(); return {};
};
R.phone = c => { const u = need(c); const p = cleanPhone(c.b.phone); if (!p) throw E(400, 'Numéro invalide (8 à 15 chiffres).'); u.phone = p; save(); return {}; };
function bonusRule(p, opt) {
  const o = p.kind === 'listing' ? (p.items || []).find(x => x.t === opt) : p.kind === 'offers' ? (p.offers || []).find(x => x.l === opt) : null;
  if (o && o.bonus && o.bonus.every > 0) return { every: o.bonus.every, text: o.bonus.text, opt };
  if (p.bonus && p.bonus.every > 0) return { every: p.bonus.every, text: p.bonus.text, opt: null };
  return null;
}
R.order = c => {
  const u = need(c); if (!u.phone) throw E(400, 'Ajoute ton numéro de téléphone.');
  const manual = c.b.pay === 'manual';
  const raw = Array.isArray(c.b.items) ? c.b.items.slice(0, 30) : []; if (!raw.length) throw E(400, 'Panier vide.');
  const items = raw.map(priceItem); const total = items.reduce((s, i) => s + i.price, 0);
  if (!manual) { if (u.bal < total) throw E(400, 'Solde insuffisant : il manque ' + fmt(total - u.bal) + ' HTG.'); u.bal -= total; tx(u, 'Achat', -total, items.map(i => i.name).join(', ')); }
  const code = str(c.b.promo || u.refBy, 30).toUpperCase(); const out = []; let agent = null;
  for (const i of items) {
    const w = pickWorker(code); db.counter++;
    const byCode = !!(w && w.code === code);
    const o = { id: 'CMD' + String(db.counter).padStart(5, '0'), uid: u.id, uname: u.name, phone: u.phone, ...i, worker: w ? w.uid : '', promo: byCode ? code : '', agent: byCode ? { name: w.name, phone: w.phone || '', code: w.code } : undefined, pay: manual ? 'manual' : 'wallet', status: manual ? 'En attente de paiement' : 'En attente', date: Date.now() };
    db.orders.unshift(o); out.push(o); if (byCode) agent = o.agent;
    if (w) pushNotif(w.uid, '🛒 Nouvelle commande ' + o.id + ' — ' + o.name + ' — ' + o.label + ' (' + fmt(o.price) + ' HTG)\nClient : ' + u.name + ' · ' + u.phone);
  }
  save(); return { ids: out.map(o => o.id), agent };
};
R.proof = c => {
  const u = need(c); const amt = parseInt(c.b.amt), ref = str(c.b.ref, 80), method = c.b.method === 'MonCash' ? 'MonCash' : 'NatCash';
  if (!(amt > 0 && amt <= 1e7) || !ref) throw E(400, 'Montant et ID de transaction obligatoires.');
  if (amt < db.settings.minDeposit) throw E(400, 'Montant minimum : ' + fmt(db.settings.minDeposit) + ' HTG.');
  const img = c.b.img ? saveImage(c.b.img) : '';
  db.proofs.unshift({ id: 'P' + Date.now() + rnd(2), uid: u.id, amt, method, ref, img, status: 'En attente', date: Date.now() }); save(); return {};
};
R.lookup = c => {
  const lu = need(c); if (!c.admin && !isWorker(lu)) throw E(403, 'Réservé aux agents.'); let q = str(c.b.q, 120).toLowerCase(); if (!q) return { users: [] };
  const num = /^#?\d{1,7}$/.test(q) ? q.replace('#', '').padStart(7, '0') : null;
  const L = db.users.filter(u => u.id === q || (num && u.id === num) || u.code.toLowerCase() === q || u.email === q || u.name.toLowerCase() === q);
  return { users: L.slice(0, 5).map(u => ({ id: u.id, name: u.name })) };
};
R.transfer = c => {
  const u = need(c); if (!c.admin && !isWorker(u)) throw E(403, 'Transfert vers un compte du site réservé aux agents.'); const a = parseInt(c.b.amt); if (!(a >= 100)) throw E(400, 'Montant minimum : 100 HTG.'); if (a > u.bal) throw E(400, 'Solde insuffisant.');
  const q = str(c.b.to, 120).toLowerCase(); const num = /^#?\d{1,7}$/.test(q) ? q.replace('#', '').padStart(7, '0') : null;
  const L = db.users.filter(x => x.id === q || (num && x.id === num) || x.code.toLowerCase() === q || x.email === q || x.name.toLowerCase() === q);
  if (!L.length) throw E(400, 'Destinataire introuvable.'); if (L.length > 1) throw E(400, "Plusieurs comptes trouvés : utilise l'ID ou le code client.");
  const r = L[0]; if (r.id === u.id) throw E(400, 'Tu ne peux pas te transférer à toi-même.');
  u.bal -= a; r.bal += a; tx(u, 'Transfert envoyé', -a, 'à ' + r.name); tx(r, 'Transfert reçu', a, 'de ' + u.name); save(); return { name: r.name };
};
R.spin = c => {
  const u = need(c); const b = parseInt(c.b.bet); if (!(b >= 25 && b <= 4000)) throw E(400, 'Mise entre 25 et 4000 HTG.'); if (u.bal < b) throw E(400, 'Solde insuffisant.');
  const O = [[0, 40], [.5, 25], [1, 15], [1.5, 10], [2, 7], [5, 3]]; let r = crypto.randomInt(100), m = 0; for (const [x, w] of O) { if (r < w) { m = x; break; } r -= w; }
  const win = Math.round(b * m); u.bal += win - b; tx(u, 'Jeu Ti Robo Chans', win - b, m + '×'); save(); return { m, win, bal: u.bal };
};
R.sell = c => {
  const u = need(c); const g = str(c.b.game, 80), d = str(c.b.details, 1000), p = parseInt(c.b.price), w = str(c.b.wa, 30);
  if (!g || !d || !(p > 0) || !w) throw E(400, 'Remplis tous les champs obligatoires.');
  db.sells.unshift({ id: 'S' + Date.now() + rnd(2), uid: u.id, uname: u.name, game: g, details: d, price: p, wa: w, img: c.b.img ? saveImage(c.b.img) : '', done: false, date: Date.now() }); save(); return {};
};
R['agent.apply'] = c => {
  const u = need(c); if (isWorker(u)) throw E(400, 'Tu es déjà agent.');
  const old = db.apps.find(a => a.uid === u.id); if (old && old.status === 'En attente') throw E(400, 'Ta demande est déjà en attente.');
  if (old) db.apps = db.apps.filter(a => a.uid !== u.id);
  db.apps.unshift({ id: 'AP' + Date.now() + rnd(2), uid: u.id, name: u.name, email: u.email, phone: u.phone, msg: str(c.b.msg, 600), status: 'En attente', date: Date.now() }); save(); return {};
};
R['worker.settings'] = c => {
  const u = need(c); const w = db.workers.find(x => x.uid === u.id); if (!w) throw E(403, 'Réservé aux agents.');
  if (typeof c.b.online === 'boolean') w.online = c.b.online;
  if (c.b.phone !== undefined) { const ph = cleanPhone(c.b.phone); if (!ph) throw E(400, 'Numéro invalide (8 à 15 chiffres).'); w.phone = ph; }
  save(); return {};
};
R['notif.read'] = c => { const u = need(c); db.notifs.forEach(n => { if (n.uid === u.id) n.read = true; }); save(); return {}; };
R.withdraw = c => {
  const u = need(c); const a = parseInt(c.b.amt), method = c.b.method === 'MonCash' ? 'MonCash' : 'NatCash', name = str(c.b.name, 60), number = str(c.b.number, 30);
  if (!(a >= 100)) throw E(400, 'Montant minimum : 100 HTG.'); if (a > u.bal) throw E(400, 'Solde insuffisant.');
  if (!name || !cleanPhone(number)) throw E(400, 'Entre le nom et le numéro du compte ' + method + '.');
  u.bal -= a; tx(u, 'Retrait ' + method + ' demandé', -a, number);
  const w = { id: 'W' + Date.now() + rnd(2), uid: u.id, uname: u.name, phone: u.phone, amt: a, method, name, number: cleanPhone(number), status: 'En attente', date: Date.now() };
  db.withdrawals.unshift(w); save(); return {};
};
function decide(c, verdict) {
  const u = need(c); const o = db.orders.find(x => x.id === c.b.id); if (!o) throw E(404, 'Commande introuvable.');
  if (!c.admin && o.worker !== u.id) throw E(403, 'Non autorisé.');
  if (!['En attente', 'En attente de paiement'].includes(o.status)) throw E(400, 'Statut invalide.');
  if (verdict === 'valid') {
    o.status = 'Livré'; pushNotif(o.uid, '✅ Ta commande ' + o.id + ' (' + o.name + ') est validée.');
    const p = db.products.find(x => x.id === o.pid); const rule = p && bonusRule(p, o.opt);
    if (rule) {
      const n = db.orders.filter(x => x.uid === o.uid && x.pid === p.id && (rule.opt == null || x.opt === rule.opt) && x.status === 'Livré').length;
      if (n % rule.every === 0) { const b = { id: 'B' + Date.now() + rnd(2), uid: o.uid, uname: o.uname, phone: o.phone, pid: p.id, pname: p.name + (rule.opt ? ' — ' + rule.opt : ''), text: rule.text || 'Bonus', order: o.id, status: 'En attente', date: Date.now() }; db.bonuses.unshift(b); pushNotif(o.uid, '🎁 Bonus gagné sur ' + b.pname + ' : ' + b.text + '. L\'admin te le donnera dès qu\'il est disponible.'); }
    }
  } else {
    const cu = db.users.find(x => x.id === o.uid); const refund = cu && o.pay === 'wallet';
    if (refund) { cu.bal += o.price; tx(cu, 'Commande refusée (remboursée)', o.price, o.id); }
    o.status = 'Refusé'; pushNotif(o.uid, '❌ Ta commande ' + o.id + ' (' + o.name + ') est refusée.' + (refund ? ' Ton solde a été remboursé.' : ''));
  }
  save(); return {};
}
R.deliver = c => decide(c, 'valid');
R['order.refuse'] = c => decide(c, 'refuse');

/* ---------- API admin ---------- */
R['admin/login'] = c => {
  limit('adm' + c.ip, 5, 6e5);
  if (!checkPw(c.b.code, db.settings.adminHash)) throw E(403, 'Code incorrect.');
  const t = rnd(24); adminTokens.set(t, Date.now() + 12 * 36e5); return { adminToken: t };
};
const A = {};
A.productSave = c => {
  const b = c.b.product || {}; const old = b.id ? db.products.find(p => p.id === b.id) : null;
  const name = str(b.name, 80); if (!name) throw E(400, 'Nom obligatoire.');
  const kind = ['offers', 'listing', 'recharge'].includes(b.kind) ? b.kind : 'offers';
  const p = old || { id: name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20) + Date.now().toString(36).slice(-3) };
  Object.assign(p, { name, cat: str(b.cat, 40) || 'Divers', kind, desc: str(b.desc, 600), tuto: str(b.tuto, 2000), art: (Array.isArray(b.art) ? b.art : []).slice(0, 3).map(x => str(x, 20)), img: imgField(b.img, old && old.img),
    fields: (Array.isArray(b.fields) ? b.fields : []).slice(0, 12).map(f => ({ l: str(f.l, 60), req: f.req ? 1 : 0 })).filter(f => f.l) });
  const be = parseInt(b.bonusEvery); if (be > 0 && str(b.bonusText, 120)) p.bonus = { every: Math.min(be, 1000), text: str(b.bonusText, 120) }; else delete p.bonus;
  if (p.art.length < 3) p.art = ['#483D8B', '#241f4a', '🎮'];
  if (kind === 'listing') { p.items = (b.items || []).slice(0, 100).map(i => ({ t: str(i.t, 100), d: str(i.d, 300), p: parseInt(i.p), img: imgField(i.img, ''), bonus: bon(i.bonus) })).filter(i => i.t && i.p > 0); delete p.offers; }
  else if (kind === 'recharge') { p.rate = parseFloat(b.rate) || 140; delete p.offers; delete p.items; }
  else { p.offers = (b.offers || []).slice(0, 100).map(o => ({ l: str(o.l, 120), p: parseInt(o.p), g: str(o.g, 60) || undefined, bonus: bon(o.bonus) })).filter(o => o.l && o.p > 0); delete p.items; }
  if (!old) db.products.push(p); save(); return {};
};
A.productDelete = c => { db.products = db.products.filter(p => p.id !== c.b.id); db.news = db.news.filter(i => i !== c.b.id); save(); return {}; };
A.newsToggle = c => { const i = c.b.id; db.news = db.news.includes(i) ? db.news.filter(x => x !== i) : [...db.news, i]; save(); return {}; };
A.proofApprove = c => { const p = db.proofs.find(x => x.id === c.b.id); if (!p || p.status !== 'En attente') throw E(400, 'Preuve déjà traitée.'); const a = parseInt(c.b.amt); if (!(a > 0)) throw E(400, 'Montant invalide.'); const u = db.users.find(x => x.id === p.uid); if (u) { u.bal += a; tx(u, 'Dépôt', a, p.method); } p.status = 'Validé'; save(); return {}; };
A.proofReject = c => { const p = db.proofs.find(x => x.id === c.b.id); if (p && p.status === 'En attente') p.status = 'Rejeté'; save(); return {}; };
A.orderPaid = c => { const o = db.orders.find(x => x.id === c.b.id); if (o && o.status === 'En attente de paiement') o.status = 'En attente'; save(); return {}; };
A.orderCancel = c => { const o = db.orders.find(x => x.id === c.b.id); if (!o || !['En attente', 'En attente de paiement'].includes(o.status)) throw E(400, 'Statut invalide.'); const u = db.users.find(x => x.id === o.uid); if (u && o.pay === 'wallet' && o.status === 'En attente') { u.bal += o.price; tx(u, 'Remboursement', o.price, o.id); } o.status = 'Annulé'; pushNotif(o.uid, '❌ Ta commande ' + o.id + ' a été annulée' + (o.pay === 'wallet' ? ' et remboursée.' : '.')); save(); return {}; };
A.userCredit = c => { const u = db.users.find(x => x.id === c.b.id); const a = parseInt(c.b.amt); if (!u || !a) throw E(400, 'Montant invalide.'); u.bal += a; tx(u, a > 0 ? 'Crédit admin' : 'Débit admin', a); save(); return {}; };
A.userRename = c => { const u = db.users.find(x => x.id === c.b.id); const n = str(c.b.name, 60); if (!u || n.length < 2) throw E(400, 'Nom invalide.'); u.name = n; save(); return {}; };
A.userResetpw = c => { const u = db.users.find(x => x.id === c.b.id); const p = String(c.b.pw || ''); if (!u || p.length < 6) throw E(400, 'Mot de passe : 6 caractères minimum.'); u.pw = hashPw(p); for (const t of Object.keys(db.sessions)) if (db.sessions[t].uid === u.id) delete db.sessions[t]; save(); return {}; };
A.appAccept = c => {
  const a = db.apps.find(x => x.id === c.b.id); if (!a || a.status !== 'En attente') throw E(400, 'Demande déjà traitée.');
  const u = db.users.find(x => x.id === a.uid); if (!u) throw E(400, 'Utilisateur introuvable.');
  let code = str(c.b.code, 30).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code) { const base = u.name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 5) || 'AGENT'; do { code = base + crypto.randomInt(10, 100); } while (db.workers.some(w => w.code === code)); }
  if (db.workers.some(w => w.code === code)) throw E(400, 'Ce code est déjà utilisé.');
  db.workers.push({ uid: u.id, name: u.name, email: u.email, phone: u.phone, code, online: true, tg: '', since: Date.now() });
  a.status = 'Accepté'; pushNotif(u.id, '✅ Ta demande est acceptée ! Ton code promo : ' + code + '. Ouvre « Espace agent » dans ton profil.'); save(); return {};
};
A.appReject = c => { const a = db.apps.find(x => x.id === c.b.id); if (a && a.status === 'En attente') { a.status = 'Refusé'; pushNotif(a.uid, 'Ta demande d\'agent n\'a pas été acceptée.'); } save(); return {}; };
A.workerDel = c => { db.workers = db.workers.filter(w => w.uid !== c.b.uid); save(); return {}; };
A.withdrawDone = c => { const w = db.withdrawals.find(x => x.id === c.b.id); if (!w || w.status !== 'En attente') throw E(400, 'Déjà traité.'); w.status = 'Payé'; pushNotif(w.uid, '✅ Ton retrait de ' + fmt(w.amt) + ' HTG vers ' + w.method + ' a été envoyé.'); save(); return {}; };
A.withdrawReject = c => { const w = db.withdrawals.find(x => x.id === c.b.id); if (!w || w.status !== 'En attente') throw E(400, 'Déjà traité.'); const u = db.users.find(x => x.id === w.uid); if (u) { u.bal += w.amt; tx(u, 'Retrait refusé (remboursé)', w.amt, w.method); } w.status = 'Refusé'; pushNotif(w.uid, 'Ton retrait de ' + fmt(w.amt) + ' HTG a été refusé et remboursé.'); save(); return {}; };
A.bonusDone = c => { const b = db.bonuses.find(x => x.id === c.b.id); if (!b || b.status !== 'En attente') throw E(400, 'Déjà traité.'); b.status = 'Livré'; pushNotif(b.uid, '🎁 Ton bonus « ' + b.text + ' » (' + b.pname + ') a été livré.'); save(); return {}; };
A.champTitle = c => { db.champTitle = str(c.b.title, 60) || 'Championnat'; save(); return {}; };
A.champAdd = c => { const n = str(c.b.name, 60); if (!n) throw E(400, 'Nom obligatoire.'); db.champ.push({ name: n, logo: imgField(c.b.logo, ''), pts: parseInt(c.b.pts) || 0 }); save(); return {}; };
A.champEdit = c => { const t = db.champ[c.b.i | 0]; if (!t) throw E(400, 'Équipe introuvable.'); const n = str(c.b.name, 60); if (n) t.name = n; if (c.b.pts !== undefined && c.b.pts !== '') t.pts = parseInt(c.b.pts) || 0; if (c.b.logo !== undefined) t.logo = imgField(c.b.logo, t.logo); save(); return {}; };
A.champPts = c => { const t = db.champ[c.b.i | 0]; if (t) t.pts += parseInt(c.b.d) || 0; save(); return {}; };
A.champDel = c => { db.champ.splice(c.b.i | 0, 1); save(); return {}; };
A.sellOk = c => { const s = db.sells.find(x => x.id === c.b.id); if (s) s.done = true; save(); return {}; };
A.siteSave = c => {
  const si = c.b.site || {}, st = c.b.settings || {}; const n = str(si.name, 40); if (!n) throw E(400, 'Nom du site obligatoire.');
  db.site.name = n; db.site.tagline = str(si.tagline, 120); db.site.color = /^#[0-9a-f]{6}$/i.test(si.color) ? si.color : '#483D8B'; db.site.logo = imgField(si.logo, db.site.logo);
  db.settings.whatsapp = str(st.whatsapp, 20).replace(/\D/g, ''); db.settings.natcash = str(st.natcash, 40); db.settings.moncash = str(st.moncash, 40); db.settings.natcashName = str(st.natcashName, 60); db.settings.moncashName = str(st.moncashName, 60); db.settings.minDeposit = Math.max(1, parseInt(st.minDeposit) || 160); save(); return {};
};
A.codeChange = c => { const code = String(c.b.code || ''); if (code.length < 6) throw E(400, 'Code : 6 caractères minimum.'); db.settings.adminHash = hashPw(code); adminTokens.clear(); save(); return { relogin: true }; };

/* ---------- HTTP ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.json': 'application/json' };
const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN' };
function send(res, code, body, headers = {}) { res.writeHead(code, { ...SEC, ...headers }); res.end(body); }
const json = (res, code, obj) => send(res, code, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
function readBody(req, max = 8e6) { return new Promise((ok, ko) => { let n = 0; const ch = []; req.on('data', d => { n += d.length; if (n > max) { ko(E(413, 'Requête trop grosse.')); req.destroy(); } else ch.push(d); }); req.on('end', () => ok(Buffer.concat(ch).toString('utf8'))); req.on('error', ko); }); }
function serveFile(res, file, cache) {
  fs.readFile(file, (e, d) => { if (e) return send(res, 404, 'Introuvable', { 'Content-Type': 'text/plain; charset=utf-8' }); send(res, 200, d, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': cache }); });
}
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x'); const p = decodeURIComponent(url.pathname);
    if (req.method === 'POST' && p.startsWith('/api/')) {
      const name = p.slice(5); const tok = str(req.headers['x-token'], 100), atok = str(req.headers['x-admin'], 100);
      let b = {}; const raw = await readBody(req); if (raw) { try { b = JSON.parse(raw); } catch (e) { throw E(400, 'JSON invalide.'); } }
      const ip = str((req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress, 60);
      const c = { b, tok, ip, u: userByToken(tok), admin: isAdminTok(atok) };
      let h = R[name];
      if (!h && name.startsWith('admin/')) { const k = name.slice(6).replace(/\.(\w)/g, (_, x) => x.toUpperCase()); if (A[k]) { if (!c.admin) throw E(403, 'Accès admin requis.'); h = A[k]; } }
      if (!h) throw E(404, 'API inconnue.');
      return json(res, 200, (await h(c)) || {});
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Méthode non autorisée');
    if (p.startsWith('/uploads/')) { const f = path.join(UPLOADS, path.basename(p)); if (!/\.(png|jpe?g|webp|gif)$/i.test(f)) return send(res, 404, 'Introuvable'); return serveFile(res, f, 'public, max-age=31536000, immutable'); }
    if (p === '/' || p === '/index.html') return serveFile(res, INDEX, 'no-cache');
    return send(res, 404, 'Introuvable', { 'Content-Type': 'text/plain; charset=utf-8' });
  } catch (e) {
    if (!e.status) console.error(e);
    json(res, e.status || 500, { error: e.status ? e.message : 'Erreur serveur.' });
  }
}).listen(PORT, () => console.log('MAX STORE prêt sur http://localhost:' + PORT + '  (données : ' + DATA_DIR + ')'));
