/*
 * Moteur TV Visuels : générateur autonome d'illustrations 320×180 dans le style tv-programs.
 * Algorithme du guide : FNV-1a, Mulberry32, tirage pondéré trié, filtre par tags,
 * palette tirée sur hash(`${seed}|palette`), couleurs par Fisher-Yates, compositions exactes.
 * Les dessins sont une recréation : mêmes noms de variantes, rendu propre à ce moteur.
 * Aucune dépendance. Navigateur : global TVP. Node : module.exports.
 */
var TVP = (function () {
  'use strict';

  // ---------- Aléa déterministe ----------
  function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function value(seed, key) {
    let state = hash(seed + ':' + key);
    let z = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(z ^ (z >>> 15), z | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Primitives SVG ----------
  const n = (v) => +(+v).toFixed(2);
  const at = (o) => (o ? ' ' + o : '');
  const R = (x, y, w, h, f, o) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${f}"${at(o)}/>`;
  const C = (x, y, r, f, o) => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${f}"${at(o)}/>`;
  const E = (x, y, rx, ry, f, o) => `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${f}"${at(o)}/>`;
  const P = (d, f, o) => `<path d="${d}" fill="${f}"${at(o)}/>`;
  const S = (d, s, w, o) => `<path d="${d}" fill="none" stroke="${s}" stroke-width="${w == null ? 1.5 : w}" stroke-linecap="round" stroke-linejoin="round"${at(o)}/>`;
  const G = (t, c, o) => `<g transform="${t}"${at(o)}>${c}</g>`;
  const op = (a) => `opacity="${a}"`;
  const rx = (r) => `rx="${r}"`;
  const ring = (x, y, r, s, w, o) => C(x, y, r, 'none', `stroke="${s}" stroke-width="${w}"${at(o)}`);
  const rep = (k, fn) => { let s = ''; for (let i = 0; i < k; i++) s += fn(i); return s; };
  const star = (x, y, r, f, o) => {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      d += (i ? 'L' : 'M') + n(x + rr * Math.cos(a)) + ' ' + n(y + rr * Math.sin(a));
    }
    return P(d + 'Z', f, o);
  };
  const spark = (x, y, r, f, o) => P(`M${n(x)} ${n(y - r)}Q${n(x + r * 0.18)} ${n(y - r * 0.18)} ${n(x + r)} ${n(y)}Q${n(x + r * 0.18)} ${n(y + r * 0.18)} ${n(x)} ${n(y + r)}Q${n(x - r * 0.18)} ${n(y + r * 0.18)} ${n(x - r)} ${n(y)}Q${n(x - r * 0.18)} ${n(y - r * 0.18)} ${n(x)} ${n(y - r)}Z`, f, o);
  const heart = (x, y, s, f, o) => G(`translate(${n(x)} ${n(y)}) scale(${n(s)})`, P('M0 3C-1 1-6-1-6-4.5C-6-7 -3-8 0-5.5C3-8 6-7 6-4.5C6-1 1 1 0 3Z', f), o);
  const field = (seed, k, fn) => { const r = mulberry(seed); return rep(k, (i) => fn(r, i)); };

  // ---------- Éléments de décor réutilisables ----------
  const sky = (c) => R(0, 0, 320, 180, c || '$sky');
  const ground = (y, c) => R(0, y, 320, 180 - y, c || '$ground') + R(0, 150, 320, 30, '$groundAlt', op(0.55));
  const floor = (y, c) => R(0, y, 320, 180 - y, c || '$ground') + R(0, y, 320, 2.5, '$ink', op(0.08));
  const sun = (x, y, r) => C(x, y, r + 9, '$light', op(0.35)) + C(x, y, r, '$accent');
  const cloud = (x, y, s) => G(`translate(${x} ${y}) scale(${s || 1})`, E(0, 0, 16, 6.5, '$light') + E(8, -5, 10, 8, '$light') + E(-8, -3, 8, 6, '$light'), op(0.85));
  const hill = (x, y, rx_, ry, c) => E(x, y, rx_, ry, c || '$groundAlt');
  const tree = (x, y, s) => G(`translate(${x} ${y}) scale(${s || 1})`, R(-2.5, -18, 5, 18, '$ink', op(0.35)) + C(0, -28, 14, '$groundAlt') + C(-8, -22, 9, '$groundAlt') + C(8, -21, 9, '$groundAlt') + C(-4, -32, 5, '$light', op(0.12)));
  const pine = (x, y, s, c) => G(`translate(${x} ${y}) scale(${s || 1})`, R(-2, -8, 4, 8, '$ink', op(0.35)) + P('M0-46L13-20L7-20L17-6L-17-6L-7-20L-13-20Z', c || '$groundAlt'));
  const palm = (x, y, s, flip) => G(`translate(${x} ${y}) scale(${(flip ? -1 : 1) * (s || 1)} ${s || 1})`, S('M0 0Q2-28 10-52', '$ink', 4.5, op(0.45)) + P('M10-52Q-6-60-22-48Q-6-54 10-50Z', '$groundAlt') + P('M10-52Q26-64 40-50Q24-56 10-50Z', '$groundAlt') + P('M10-52Q0-70-14-70Q2-64 10-50Z', '$groundAlt') + P('M10-52Q22-74 34-68Q20-64 10-50Z', '$groundAlt') + P('M10-52Q16-40 22-28Q12-40 10-50Z', '$groundAlt') + C(12, -50, 2.5, '$ink', op(0.4)));
  const wallBase = (c) => R(0, 0, 320, 180, c || '$skyAlt');
  const studioBack = () => R(0, 0, 320, 180, '$sky') + E(160, 40, 190, 90, '$skyAlt', op(0.25)) + R(0, 128, 320, 52, '$ground') + E(160, 160, 165, 18, '$groundAlt') + E(160, 156, 120, 10, '$light', op(0.06));
  const spot = (x, w) => P(`M${x - 4} 0L${x + 4} 0L${x + (w || 34)} 164L${x - (w || 34)} 164Z`, '$light', op(0.08));
  const lampRig = () => R(0, 6, 320, 3, '$ink', op(0.35)) + rep(6, (i) => R(24 + i * 54, 8, 10, 8, '$ink', op(0.6)) + C(29 + i * 54, 17, 3, '$accent', op(0.9)));
  const bulbs = (x, y, w, h, k) => rep(k, (i) => { const t = i / k; const p = t < 0.25 ? [x + w * t * 4, y] : t < 0.5 ? [x + w, y + h * (t - 0.25) * 4] : t < 0.75 ? [x + w - w * (t - 0.5) * 4, y + h] : [x, y + h - h * (t - 0.75) * 4]; return C(p[0], p[1], 2, '$accent'); });
  const building = (x, w, h, c, base) => { const b = base || 130; let s = R(x, b - h, w, h, c || '$groundAlt'); for (let yy = b - h + 6; yy < b - 8; yy += 10) for (let xx = x + 4; xx < x + w - 5; xx += 9) s += R(xx, yy, 4, 5, '$accent', op(0.55)); return s; };
  const window_ = (x, y, w, h, inner) => R(x - 3, y - 3, w + 6, h + 6, '$light') + R(x, y, w, h, '$sky') + (inner || '') + R(x + w / 2 - 1.2, y, 2.4, h, '$light') + R(x, y + h / 2 - 1.2, w, 2.4, '$light');
  const crowd = (y, k, seed) => field(seed || 7, k, (r, i) => { const x = (i / k) * 330 - 5 + r() * 4; const c = ['$accent', '$accentAlt', '$light', '$skyAlt'][i % 4]; return C(x, y - r() * 3, 4.2, c, op(0.75)) + R(x - 5, y + 2 - r() * 3, 10, 10, c, op(0.55)); });
  const bleachers = (y0, rows, seed) => R(0, y0 - 6, 320, rows * 11 + 6, '$groundAlt') + rep(rows, (j) => crowd(y0 + j * 11, 40, (seed || 3) + j));
  const curtains = (c) => P('M0 0L52 0Q42 60 58 132L0 132Z', c || '$accentAlt') + P('M320 0L268 0Q278 60 262 132L320 132Z', c || '$accentAlt') + S('M14 0Q12 60 18 132M30 0Q26 60 36 132M306 0Q308 60 302 132M290 0Q294 60 284 132', '$ink', 2, op(0.12)) + R(0, 0, 320, 14, c || '$accentAlt') + R(0, 12, 320, 3, '$ink', op(0.15));
  const stars = (k, seed, h) => field(seed || 11, k, (r) => C(r() * 320, r() * (h || 100), 0.6 + r() * 1.1, '$light', op(0.5 + r() * 0.4)));
  const books = (x, y, w, seed) => field(seed || 5, Math.floor(w / 6), (r, i) => { const h = 12 + r() * 6; return R(x + i * 6, y - h, 5, h, ['$accent', '$accentAlt', '$sky', '$light', '$groundAlt'][Math.floor(r() * 5)], op(0.9)); });
  const shelf = (x, y, w) => R(x, y, w, 3, '$ink', op(0.35));
  const screen = (x, y, w, h, inner) => R(x - 2, y - 2, w + 4, h + 4, '$ink', rx(2)) + R(x, y, w, h, '$skyAlt') + (inner || '') + P(`M${x} ${y}L${x + w * 0.45} ${y}L${x} ${y + h * 0.8}Z`, '$light', op(0.18));
  const firework = (x, y, r, c) => rep(12, (i) => { const a = (i * Math.PI) / 6; return S(`M${n(x + Math.cos(a) * r * 0.35)} ${n(y + Math.sin(a) * r * 0.35)}L${n(x + Math.cos(a) * r)} ${n(y + Math.sin(a) * r)}`, c, 1.6); }) + C(x, y, 2, c);
  const columns = (x, y, k, gap, h, c) => rep(k, (i) => R(x + i * gap, y, 7, h, c || '$light') + R(x + i * gap - 2, y - 3, 11, 3, c || '$light') + R(x + i * gap - 2, y + h, 11, 3, c || '$light'));
  const snow = (k, seed) => field(seed || 21, k, (r) => C(r() * 320, r() * 150, 0.8 + r() * 1.4, '$light', op(0.85)));

  // ---------- Décors (scene) ----------
  const ST = (svg, genres, subs, weight) => ({ svg, tags: genres.map((g) => 'genre:' + g).concat((subs || []).map((s) => 'sub:' + s)), weight });
  const SCENES = {
    jungle: ST(sky() + hill(60, 128, 130, 46) + hill(270, 130, 120, 50) + palm(28, 134, 1.2) + palm(300, 132, 1.1, 1) + tree(90, 124, 0.9) + tree(236, 124, 1) + S('M60 0Q66 30 58 52M250 0Q246 24 254 40', '$groundAlt', 2.5) + ground(128), ['aventure'], ['survie']),
    plage: ST(sky() + sun(256, 38, 16) + cloud(70, 34) + R(0, 102, 320, 30, '$accentAlt', op(0.45)) + S('M20 112Q30 108 40 112M120 118Q130 114 140 118M220 110Q230 106 240 110', '$light', 1.5, op(0.8)) + R(0, 130, 320, 50, '$ground') + palm(30, 140, 1.15) + R(0, 150, 320, 30, '$groundAlt', op(0.4)), ['aventure', 'telerealite'], ['survie']),
    montagne: ST(sky() + sun(60, 36, 13) + cloud(240, 30, 0.9) + P('M-10 130L70 40L150 130Z', '$groundAlt') + P('M70 40L84 56L74 54L66 60L58 54Z', '$light') + P('M110 130L210 22L320 130Z', '$groundAlt') + P('M210 22L228 42L216 40L206 48L196 40Z', '$light') + P('M220 130L290 60L350 130Z', '$groundAlt', op(0.7)) + pine(30, 132, 0.7) + pine(296, 132, 0.8) + ground(128), ['aventure', 'documentaire'], ['montagne', 'nature']),
    temple: ST(sky() + sun(270, 34, 12) + tree(30, 128, 1.1) + tree(292, 128, 1.1) + R(90, 104, 140, 26, '$groundAlt') + R(106, 82, 108, 24, '$groundAlt') + R(122, 62, 76, 22, '$groundAlt') + R(140, 44, 40, 20, '$groundAlt') + R(90, 104, 140, 26, '$ink', op(0.1)) + R(122, 62, 76, 22, '$ink', op(0.1)) + R(152, 50, 16, 14, '$ink', op(0.45)) + R(150, 82, 20, 48, '$ink', op(0.2)) + ground(128), ['aventure'], ['survie']),
    canyon: ST(sky() + sun(248, 40, 15) + P('M-10 130L-10 60L40 60L52 76L90 76L104 130Z', '$accentAlt', op(0.6)) + P('M330 130L330 50L280 50L268 70L236 70L222 130Z', '$accentAlt', op(0.6)) + P('M100 130L120 88L176 88L196 130Z', '$accent', op(0.45)) + R(0, 64, 40, 3, '$ink', op(0.12)) + R(280, 58, 50, 3, '$ink', op(0.12)) + ground(126), ['aventure', 'documentaire'], ['survie', 'nature']),
    ile: ST(sky() + sun(60, 36, 14) + cloud(240, 26) + R(0, 96, 320, 84, '$accentAlt', op(0.4)) + E(160, 104, 70, 12, '$ground') + palm(146, 104, 0.8) + palm(176, 104, 0.6, 1) + S('M10 120Q20 116 30 120M270 116Q280 112 290 116', '$light', 1.5) + E(160, 168, 220, 40, '$ground') + E(160, 176, 200, 22, '$groundAlt', op(0.5)), ['aventure', 'telerealite', 'dating'], ['survie']),
    savane: ST(sky() + C(160, 120, 44, '$accent', op(0.85)) + C(160, 120, 56, '$accent', op(0.2)) + P('M40 122L44 84', '$ink') + S('M48 124L46 86', '$ink', 3, op(0.55)) + E(46, 82, 26, 7, '$ink', op(0.55)) + S('M266 124L268 92', '$ink', 3, op(0.55)) + E(268, 90, 22, 6, '$ink', op(0.55)) + hill(110, 128, 100, 10) + ground(124), ['aventure', 'documentaire'], ['survie', 'nature']),
    foret: ST(sky() + hill(160, 130, 200, 40) + pine(20, 130, 1.3) + pine(56, 128, 1) + pine(98, 126, 0.8) + pine(222, 126, 0.85) + pine(262, 128, 1.1) + pine(302, 130, 1.35) + rep(5, (i) => pine(130 + i * 16, 124, 0.5, '$ground')) + ground(126), ['aventure', 'documentaire', 'jeunesse'], ['survie', 'nature']),
    villa: ST(sky() + sun(270, 32, 13) + R(70, 64, 170, 64, '$light') + R(60, 58, 190, 8, '$light') + R(60, 64, 190, 3, '$ink', op(0.08)) + R(86, 78, 30, 26, '$sky') + R(136, 78, 40, 50, '$sky') + R(196, 78, 30, 26, '$sky') + R(155, 78, 2, 50, '$light') + palm(40, 130, 1) + palm(286, 130, 1, 1) + ground(128) + E(250, 154, 44, 7, '$accentAlt', op(0.45)), ['telerealite', 'dating']),
    loft: ST(wallBase() + field(8, 60, (r, i) => R((i % 10) * 34 - (Math.floor(i / 10) % 2) * 17, Math.floor(i / 10) * 20, 32, 18, '$ink', op(0.04))) + window_(96, 24, 128, 78, building(98, 22, 40, '$groundAlt', 102) + building(124, 18, 56, '$groundAlt', 102) + building(146, 26, 34, '$groundAlt', 102) + building(176, 20, 62, '$groundAlt', 102) + building(200, 24, 44, '$groundAlt', 102)) + S('M44 0L44 26', '$ink', 1, op(0.4)) + P('M34 26L54 26L48 18L40 18Z', '$accent') + floor(128) + rep(8, (i) => R(i * 40, 128, 1.2, 52, '$ink', op(0.07))), ['telerealite', 'magazine']),
    coucher: ST(sky('$skyAlt') + R(0, 0, 320, 40, '$accentAlt', op(0.18)) + R(0, 40, 320, 30, '$accent', op(0.15)) + C(160, 110, 40, '$accent') + R(0, 108, 320, 26, '$accentAlt', op(0.5)) + rep(5, (i) => R(130 + i * 3, 114 + i * 4, 60 - i * 6, 1.6, '$light', op(0.6))) + palm(30, 140, 1.1) + palm(290, 140, 0.9, 1) + R(0, 130, 320, 50, '$ground') + R(0, 150, 320, 30, '$groundAlt', op(0.4)), ['telerealite', 'dating']),
    ocean: ST(sky() + sun(60, 34, 13) + cloud(230, 30) + R(0, 84, 320, 96, '$accentAlt', op(0.42)) + P('M210 96Q216 84 226 82Q220 90 224 96Z', '$ink', op(0.55)) + E(218, 98, 22, 4, '$ink', op(0.35)) + S('M20 100Q30 96 40 100M90 110Q100 106 110 110M260 112Q270 108 280 112', '$light', 1.5) + R(0, 136, 320, 44, '$ground') + rep(8, (i) => R(i * 40, 136, 1.2, 44, '$ink', op(0.1))) + R(0, 132, 320, 5, '$groundAlt'), ['documentaire'], ['nature']),
    musee: ST(wallBase() + R(0, 118, 320, 10, '$ink', op(0.06)) + R(30, 30, 60, 46, '$accent') + R(36, 36, 48, 34, '$sky') + P('M36 70L52 50L64 62L72 54L84 70Z', '$groundAlt') + R(230, 26, 56, 56, '$accent') + R(236, 32, 44, 44, '$sky') + C(258, 52, 10, '$accentAlt', op(0.8)) + R(142, 28, 36, 44, '$accent') + R(147, 33, 26, 34, '$skyAlt') + C(160, 46, 6, '$ink', op(0.3)) + R(154, 52, 12, 12, '$ink', op(0.3)) + floor(128) + S('M110 128L110 108M210 128L210 108', '$accent', 2) + S('M110 110Q160 124 210 110', '$accentAlt', 2), ['documentaire'], ['histoire', 'culture']),
    espace: ST(sky('$ink') + R(0, 0, 320, 180, '$sky', op(0.25)) + stars(70, 11, 130) + C(250, 50, 20, '$accent') + S('M218 56Q250 40 282 44', '$accentAlt', 3) + C(244, 44, 4, '$ink', op(0.15)) + C(60, 40, 8, '$accentAlt') + R(0, 134, 320, 46, '$groundAlt') + E(60, 150, 18, 4, '$ink', op(0.2)) + E(250, 160, 24, 5, '$ink', op(0.2)) + E(160, 142, 12, 3, '$ink', op(0.2)), ['documentaire', 'jeunesse'], ['science']),
    bibliotheque: ST(wallBase() + R(16, 14, 288, 112, '$groundAlt', op(0.5)) + rep(4, (j) => shelf(16, 40 + j * 28, 288) + books(20, 40 + j * 28, 280, 30 + j)) + floor(128) + E(160, 156, 90, 10, '$accent', op(0.25)), ['documentaire', 'info', 'magazine'], ['histoire', 'culture', 'science']),
    carteMonde: ST(sky() + R(0, 0, 320, 180, '$ink', op(0.12)) + screen(40, 16, 240, 100, rep(9, (i) => R(40 + i * 30, 16, 0.6, 100, '$ink', op(0.15))) + P('M70 40Q90 30 110 38Q116 54 100 60Q92 76 84 92Q74 80 76 62Q62 54 70 40Z', '$ground') + P('M134 36Q160 26 176 36Q170 48 156 50Q150 64 160 80Q148 96 140 80Q132 60 140 52Q128 46 134 36Z', '$ground') + P('M186 34Q230 24 256 40Q246 56 226 54Q216 66 204 58Q192 50 186 34Z', '$ground') + P('M228 76Q246 72 252 84Q240 92 228 86Z', '$ground') + C(156, 44, 3, '$accentAlt')) + floor(130), ['documentaire', 'info'], ['histoire', 'culture']),
    plateauQuiz: ST(studioBack() + C(160, 64, 54, '$ink', op(0.25)) + ring(160, 64, 54, '$accent', 3) + rep(16, (i) => C(160 + Math.cos((i * Math.PI) / 8) * 54, 64 + Math.sin((i * Math.PI) / 8) * 54, 2.4, '$light')) + P('M148 48Q148 36 160 36Q172 36 172 47Q172 56 162 60L162 70L157 70L157 57Q166 53 166 47Q166 42 160 42Q154 42 154 48Z', '$accent') + C(159.5, 78, 3.5, '$accent') + spot(40) + spot(280), ['jeu']),
    plateauEcrans: ST(studioBack() + rep(3, (j) => rep(5, (i) => screen(40 + i * 50, 16 + j * 34, 42, 26, R(40 + i * 50, 30 + j * 34, 42, 12, (i + j) % 2 ? '$accent' : '$accentAlt', op(0.35))))) + spot(20) + spot(300), ['jeu', 'info']),
    plateauRoue: ST(studioBack() + C(160, 64, 52, '$ink', op(0.3)) + rep(12, (i) => { const a = (i * Math.PI) / 6, b = ((i + 1) * Math.PI) / 6; return P(`M160 64L${n(160 + Math.cos(a) * 48)} ${n(64 + Math.sin(a) * 48)}A48 48 0 0 1 ${n(160 + Math.cos(b) * 48)} ${n(64 + Math.sin(b) * 48)}Z`, ['$accent', '$accentAlt', '$light'][i % 3]); }) + C(160, 64, 7, '$ink') + P('M154 8L166 8L160 20Z', '$light') + spot(40) + spot(280), ['jeu', 'divertissement']),
    plateauJT: ST(studioBack() + R(0, 0, 320, 128, '$accent', op(0.12)) + screen(20, 22, 110, 70, building(24, 16, 30, '$groundAlt', 92) + building(42, 14, 44, '$groundAlt', 92) + building(58, 20, 26, '$groundAlt', 92) + building(80, 14, 38, '$groundAlt', 92) + building(96, 30, 22, '$groundAlt', 92)) + R(156, 30, 150, 8, '$light', op(0.25) + ' ' + rx(4)) + R(156, 46, 110, 8, '$light', op(0.15) + ' ' + rx(4)) + C(286, 76, 22, '$accent', op(0.5)) + C(286, 76, 14, '$sky') + R(0, 112, 320, 6, '$accentAlt', op(0.7)), ['info']),
    rideau: ST(sky('$ink') + R(0, 0, 320, 180, '$accentAlt', op(0.25)) + curtains() + P('M120 0L200 0L250 164L70 164Z', '$light', op(0.08)) + R(0, 132, 320, 48, '$groundAlt') + R(0, 132, 320, 3, '$accent', op(0.5)) + E(160, 158, 90, 12, '$light', op(0.12)), ['divertissement', 'humour', 'talent']),
    escalier: ST(studioBack() + rep(6, (i) => R(110 - i * 0 + i * 0, 128 - (i + 1) * 14, 100, 14, '$skyAlt', op(0.4 + i * 0.05)) + R(110, 128 - (i + 1) * 14, 100, 2, '$accent')) + rep(7, (i) => C(98, 40 + i * 14, 2.4, '$light') + C(222, 40 + i * 14, 2.4, '$light')) + spot(60) + spot(260), ['divertissement', 'talent']),
    gala: ST(sky() + R(0, 0, 320, 180, '$ink', op(0.15)) + rep(8, (i) => P(`M${i * 40} 0Q${i * 40 + 20} 30 ${i * 40 + 40} 0Z`, '$accent', op(0.45))) + rep(3, (i) => S(`M${80 + i * 80} 0L${80 + i * 80} 22`, '$light', 1, op(0.6)) + E(80 + i * 80, 28, 12, 6, '$accent') + rep(5, (k) => C(70 + i * 80 + k * 5, 36, 1.6, '$light'))) + R(0, 130, 320, 50, '$ground') + E(160, 160, 160, 16, '$groundAlt') + spot(80, 30) + spot(240, 30), ['divertissement', 'humour', 'talent']),
    studioTV: ST(studioBack() + lampRig() + R(40, 34, 240, 80, '$skyAlt', op(0.3) + ' ' + rx(8)) + C(160, 74, 24, '$accent') + C(160, 74, 14, '$sky') + P('M154 66L170 74L154 82Z', '$light') + R(20, 50, 6, 78, '$ink', op(0.4)) + R(294, 50, 6, 78, '$ink', op(0.4)), ['divertissement', 'magazine', 'generique']),
    standup: ST(sky('$ink') + field(4, 72, (r, i) => R((i % 9) * 38 - (Math.floor(i / 9) % 2) * 19, Math.floor(i / 9) * 17, 36, 15, '$accentAlt', op(0.22))) + P('M140 0L180 0L250 164L70 164Z', '$light', op(0.12)) + C(160, 30, 46, '$accent', op(0.12)) + R(0, 134, 320, 46, '$groundAlt') + E(160, 158, 80, 12, '$light', op(0.15)), ['humour']),
    plateauMag: ST(wallBase() + R(20, 20, 120, 100, '$sky', op(0.6) + ' ' + rx(14)) + R(180, 20, 120, 100, '$sky', op(0.6) + ' ' + rx(14)) + C(160, 56, 30, '$accent', op(0.7)) + C(160, 56, 22, '$skyAlt') + P('M44 128Q36 100 48 84Q56 100 52 128Z', '$groundAlt') + P('M52 128Q60 96 72 90Q66 110 58 128Z', '$groundAlt') + R(44, 118, 20, 12, '$accentAlt') + floor(128), ['humour', 'magazine', 'generique']),
    bonbons: ST(sky() + cloud(60, 26) + cloud(250, 36, 0.8) + E(70, 132, 100, 40, '$accentAlt', op(0.55)) + E(250, 132, 110, 44, '$accent', op(0.5)) + rep(3, (i) => S(`M${40 + i * 120} 128L${40 + i * 120} 76`, '$light', 3) + C(40 + i * 120, 66, 16, ['$accent', '$accentAlt', '$sky'][i]) + S(`M${40 + i * 120} 66m-10 0a10 10 0 1 1 10 10a6 6 0 1 1-6-6`, '$light', 2.5)) + ground(128), ['humour', 'jeunesse']),
    concert: ST(sky('$ink') + R(0, 0, 320, 180, '$sky', op(0.3)) + P('M60 0L80 0L150 140L60 140Z', '$accent', op(0.15)) + P('M240 0L260 0L260 140L170 140Z', '$accentAlt', op(0.15)) + P('M150 0L170 0L200 140L120 140Z', '$light', op(0.1)) + R(10, 70, 36, 60, '$ink', op(0.8)) + C(28, 88, 9, '$light', op(0.2)) + C(28, 114, 11, '$light', op(0.2)) + R(274, 70, 36, 60, '$ink', op(0.8)) + C(292, 88, 9, '$light', op(0.2)) + C(292, 114, 11, '$light', op(0.2)) + R(0, 128, 320, 52, '$groundAlt') + lampRig(), ['talent']),
    terrasse: ST(wallBase() + rep(10, (i) => P(`M${i * 32} 20L${i * 32 + 32} 20L${i * 32 + 32} 34Q${i * 32 + 16} 42 ${i * 32} 34Z`, i % 2 ? '$accent' : '$light')) + R(0, 16, 320, 4, '$ink', op(0.3)) + window_(40, 50, 70, 56) + window_(210, 50, 70, 56) + S('M0 6Q80 18 160 6Q240 18 320 6', '$ink', 0.8, op(0.4)) + rep(9, (i) => C(18 + i * 36, 10 + Math.sin(i) * 2 + (i % 2 ? 3 : 0), 2.2, '$accent')) + floor(128) + rep(16, (i) => R(i * 20, 128, 1, 52, '$ink', op(0.06))), ['dating']),
    chandelles: ST(sky() + R(0, 0, 320, 180, '$ink', op(0.4)) + R(0, 100, 320, 6, '$ink', op(0.4)) + rep(7, (i) => C(30 + i * 44, 84, 12, '$accent', op(0.18)) + R(26 + i * 44, 88, 8, 12 + (i % 3) * 3, '$light') + P(`M${30 + i * 44} 78Q${33 + i * 44} 84 ${30 + i * 44} 88Q${27 + i * 44} 84 ${30 + i * 44} 78Z`, '$accent')) + curtains('$accentAlt') + R(0, 130, 320, 50, '$ground') + R(0, 130, 320, 50, '$ink', op(0.25)), ['dating', 'drame']),
    salon: ST(wallBase() + window_(200, 30, 70, 64, cloud(235, 60, 0.8)) + P('M190 20L200 20L198 104L186 104Z', '$accentAlt') + P('M280 20L270 20L272 104L284 104Z', '$accentAlt') + R(186, 18, 98, 4, '$ink', op(0.4)) + R(50, 36, 46, 34, '$accent') + R(54, 40, 38, 26, '$sky') + C(73, 53, 7, '$accentAlt', op(0.6)) + floor(128) + E(150, 158, 110, 12, '$accent', op(0.25)), ['magazine', 'drame', 'generique']),
    ruelle: ST(sky() + R(0, 0, 320, 180, '$ink', op(0.2)) + building(0, 70, 120, '$groundAlt') + building(70, 40, 90, '$groundAlt') + building(210, 44, 96, '$groundAlt') + building(254, 66, 124, '$groundAlt') + R(0, 0, 320, 130, '$ink', op(0.1)) + S('M160 128L160 54Q160 46 168 46', '$ink', 2, op(0.7)) + C(170, 50, 18, '$accent', op(0.15)) + E(170, 50, 4, 3, '$accent') + R(0, 128, 320, 52, '$ground') + R(0, 128, 320, 52, '$ink', op(0.2)) + E(170, 160, 30, 3, '$accent', op(0.25)), ['drame', 'policier']),
    fenetreVille: ST(wallBase() + window_(40, 18, 240, 96, R(40, 18, 240, 96, '$ink', op(0.1)) + building(44, 30, 50, '$groundAlt', 114) + building(78, 22, 74, '$groundAlt', 114) + building(104, 38, 40, '$groundAlt', 114) + building(146, 26, 84, '$groundAlt', 114) + building(176, 34, 56, '$groundAlt', 114) + building(214, 26, 70, '$groundAlt', 114) + building(244, 34, 46, '$groundAlt', 114)) + floor(128), ['info', 'drame', 'policier']),
    pluie: ST(sky() + R(0, 0, 320, 180, '$ink', op(0.3)) + cloud(60, 20, 1.6) + cloud(200, 16, 1.8) + building(20, 50, 70, '$groundAlt') + building(240, 60, 80, '$groundAlt') + field(31, 60, (r) => { const x = r() * 330, y = r() * 150; return S(`M${n(x)} ${n(y)}L${n(x - 4)} ${n(y + 10)}`, '$light', 1, op(0.55)); }) + R(0, 128, 320, 52, '$ground') + R(0, 128, 320, 52, '$ink', op(0.25)) + E(90, 158, 30, 3, '$light', op(0.2)) + E(240, 166, 40, 3, '$light', op(0.2)), ['drame']),
    cuisine: ST(wallBase() + rep(11, (i) => R(i * 30, 50, 0.8, 60, '$ink', op(0.08))) + rep(3, (j) => R(0, 60 + j * 20, 320, 0.8, '$ink', op(0.08))) + R(10, 8, 300, 38, '$accent') + rep(5, (i) => R(14 + i * 60, 12, 54, 30, '$light', op(0.25)) + C(64 + i * 60, 27, 1.5, '$ink', op(0.4))) + S('M60 50L60 62M90 50L90 66', '$ink', 1, op(0.4)) + C(60, 68, 6, '$ink', op(0.6)) + C(90, 72, 7, '$ink', op(0.6)) + R(0, 108, 320, 22, '$groundAlt') + R(0, 104, 320, 5, '$light') + floor(130), ['cuisine']),
    marche: ST(sky() + cloud(160, 24) + rep(3, (i) => R(16 + i * 104, 70, 84, 58, '$groundAlt', op(0.5)) + rep(6, (k) => P(`M${16 + i * 104 + k * 14} 50L${30 + i * 104 + k * 14} 50L${30 + i * 104 + k * 14} 66Q${23 + i * 104 + k * 14} 72 ${16 + i * 104 + k * 14} 66Z`, k % 2 ? '$light' : i === 1 ? '$accentAlt' : '$accent')) + R(20 + i * 104, 100, 76, 28, '$ink', op(0.3)) + field(40 + i, 12, (r, k) => C(26 + i * 104 + (k % 6) * 12, 96 + Math.floor(k / 6) * 6, 5, ['$accent', '$accentAlt', '$groundAlt'][Math.floor(r() * 3)]))) + ground(128), ['cuisine']),
    studioCuisine: ST(studioBack() + lampRig() + rep(3, (j) => shelf(40, 44 + j * 22, 240) + rep(8, (i) => R(48 + i * 30, 32 + j * 22, 12, 12, ['$accent', '$accentAlt', '$light'][(i + j) % 3], op(0.85) + ' ' + rx(3)))) + R(30, 106, 260, 22, '$light', op(0.85)) + R(30, 104, 260, 4, '$accent'), ['cuisine']),
    bureauEnquete: ST(wallBase() + R(30, 24, 130, 80, '$accent', op(0.45)) + R(34, 28, 122, 72, '$groundAlt', op(0.4)) + rep(5, (i) => R(42 + (i % 3) * 38, 34 + Math.floor(i / 3) * 34, 24, 26, '$light') + C(54 + (i % 3) * 38, 36 + Math.floor(i / 3) * 34, 2, '$accentAlt')) + S('M54 36L92 36L130 70L54 70L92 36', '$accentAlt', 1) + window_(200, 30, 80, 66, rep(8, (i) => R(200, 32 + i * 8, 80, 4, '$light', op(0.5)))) + R(290, 64, 24, 64, '$ink', op(0.35)) + floor(128), ['policier']),
    sceneCrime: ST(sky() + R(0, 0, 320, 180, '$ink', op(0.35)) + building(0, 60, 100, '$groundAlt') + building(250, 70, 110, '$groundAlt') + C(40, 40, 30, '$accentAlt', op(0.18)) + C(290, 30, 30, '$accent', op(0.18)) + R(0, 128, 320, 52, '$ground') + R(0, 128, 320, 52, '$ink', op(0.2)) + G('rotate(-6 160 118)', R(-10, 112, 340, 9, '$accent') + rep(12, (i) => P(`M${i * 30} 112L${i * 30 + 10} 112L${i * 30 + 4} 121L${i * 30 - 6} 121Z`, '$ink', op(0.75)))), ['policier']),
    salonTV: ST(wallBase() + R(96, 22, 128, 74, '$ink', rx(3)) + R(100, 26, 120, 66, '$sky') + C(160, 59, 50, '$skyAlt', op(0.25)) + P('M100 26L150 26L100 80Z', '$light', op(0.15)) + R(96, 98, 128, 8, '$ink', op(0.35)) + R(30, 40, 40, 4, '$ink', op(0.3)) + books(32, 40, 36, 77) + C(270, 60, 12, '$accent', op(0.6)) + floor(128) + E(160, 158, 120, 12, '$accent', op(0.2)), ['generique']),
    ceremonie: ST(sky('$ink') + R(0, 0, 320, 180, '$accentAlt', op(0.2)) + curtains('$accentAlt') + P('M150 18Q160 10 170 18L174 38Q168 46 172 92L148 92Q152 46 146 38Z', '$accent', op(0.75)) + C(160, 18, 8, '$accent', op(0.75)) + R(144, 92, 32, 10, '$accent', op(0.75)) + spot(80) + spot(240) + R(0, 128, 320, 52, '$groundAlt') + rep(5, (i) => R(i * 64, 128, 64, 4, i % 2 ? '$accent' : '$light', op(0.5))), ['cinema'], ['ceremonie']),
    tapisRouge: ST(wallBase('$sky') + rep(24, (i) => R((i % 8) * 40 + 12, Math.floor(i / 8) * 36 + 12, 16, 16, '$light', op(0.25) + ' ' + rx(8))) + R(0, 128, 320, 52, '$ground') + P('M110 128L210 128L270 180L50 180Z', '$accentAlt') + rep(4, (i) => R(36 + i * 76, 104, 4, 26, '$accent') + C(38 + i * 76, 104, 3, '$accent')) + S('M38 110Q76 122 114 110M190 110Q228 122 266 110', '$accentAlt', 2.5), ['cinema'], ['festival']),
    salleCinema: ST(sky('$ink') + R(30, 12, 260, 92, '$light', op(0.9)) + R(30, 12, 260, 92, '$sky', op(0.25)) + P('M30 104L290 104L320 140L0 140Z', '$light', op(0.06)) + rep(2, (j) => rep(12, (i) => R(4 + i * 27, 120 + j * 12, 22, 14, '$accentAlt', op(0.65) + ' ' + rx(4)))) + R(0, 146, 320, 34, '$groundAlt'), ['cinema'], ['film']),
    plateauTournage: ST(wallBase('$sky') + R(70, 20, 180, 104, '$skyAlt', op(0.6)) + window_(120, 34, 60, 48) + R(70, 20, 6, 108, '$ink', op(0.2)) + R(244, 20, 6, 108, '$ink', op(0.2)) + S('M30 128L30 40M20 128L30 92L40 128M290 128L290 40M280 128L290 92L300 128', '$ink', 2, op(0.7)) + P('M22 30L38 30L42 46L18 46Z', '$ink', op(0.8)) + P('M282 30L298 30L302 46L278 46Z', '$ink', op(0.8)) + P('M18 46L42 46L90 128L-30 128Z', '$light', op(0.08)) + floor(128) + S('M0 172L320 172M0 166L320 166', '$ink', 1.5, op(0.3)), ['cinema'], ['serie']),
    stade: ST(sky() + bleachers(40, 6, 3) + rep(2, (i) => S(`M${20 + i * 280} 40L${20 + i * 280} 4`, '$ink', 2, op(0.6)) + R(8 + i * 280, 0, 24, 10, '$light')) + R(0, 112, 320, 68, '$ground') + rep(8, (i) => R(i * 40, 112, 20, 68, '$groundAlt', op(0.3))) + S('M0 132L320 132M160 112L160 132', '$light', 1.5, op(0.8)) + E(160, 132, 36, 6, 'none', 'stroke="$light" stroke-width="1.5" opacity="0.8"'), ['sport'], ['football']),
    rugby: ST(sky() + bleachers(44, 5, 9) + R(0, 112, 320, 68, '$ground') + rep(8, (i) => R(i * 40, 112, 20, 68, '$groundAlt', op(0.3))) + S('M150 120L150 60M170 120L170 60M150 96L170 96', '$light', 2.5) + S('M0 134L320 134', '$light', 1.5, op(0.8)), ['sport'], ['rugby']),
    parquet: ST(sky() + bleachers(30, 6, 13) + R(0, 104, 320, 76, '$accent', op(0.35)) + R(0, 104, 320, 76, '$ground', op(0.5)) + rep(16, (i) => R(i * 20, 104, 1, 76, '$ink', op(0.08))) + S('M0 120L320 120M160 104L160 180', '$light', 1.5, op(0.8)) + E(160, 140, 30, 10, 'none', 'stroke="$light" stroke-width="1.5" opacity="0.8"'), ['sport'], ['basket', 'handball']),
    tennis: ST(sky() + bleachers(40, 5, 17) + R(0, 104, 320, 76, '$groundAlt') + P('M40 104L280 104L320 180L0 180Z', '$ground') + S('M40 104L280 104L320 180M0 180L40 104M80 104L56 180M240 104L264 180', '$light', 1.5) + R(10, 122, 300, 10, '$light', op(0.25)) + S(rep(31, (i) => `M${10 + i * 10} 122L${10 + i * 10} 132`).toString(), '$ink', 0.6, op(0.3)) + R(10, 120, 300, 2, '$light') + R(6, 118, 4, 18, '$ink', op(0.6)) + R(310, 118, 4, 18, '$ink', op(0.6)), ['sport'], ['tennis']),
    circuit: ST(sky() + R(0, 60, 320, 50, '$groundAlt') + rep(4, (j) => crowd(70 + j * 10, 36, 50 + j)) + R(0, 50, 320, 10, '$ink', op(0.5)) + rep(10, (i) => R(i * 32 + 4, 24, 2, 28, '$ink', op(0.5)) + P(`M${i * 32 + 6} 24L${i * 32 + 22} 28L${i * 32 + 6} 32Z`, i % 2 ? '$accent' : '$accentAlt')) + R(0, 110, 320, 6, '$ground') + R(0, 116, 320, 64, '$ink', op(0.65)) + rep(20, (i) => R(i * 16, 116, 16, 5, i % 2 ? '$light' : '$accentAlt')) + rep(8, (i) => R(i * 44 + 10, 146, 22, 2.5, '$light', op(0.6))), ['sport'], ['auto']),
    col: ST(sky() + sun(270, 32, 13) + P('M-20 130L80 30L170 130Z', '$groundAlt') + P('M120 130L230 40L340 130Z', '$groundAlt') + P('M80 30L94 48L80 44L68 50Z', '$light') + P('M230 40L246 58L230 54L216 60Z', '$light') + S('M230 46Q200 80 236 92Q264 102 220 118Q170 130 120 132', '$ink', 6, op(0.5)) + S('M230 46Q200 80 236 92Q264 102 220 118Q170 130 120 132', '$light', 0.8, 'stroke-dasharray="3 4"') + ground(130), ['sport'], ['velo']),
    surf: ST(sky() + sun(60, 34, 13) + R(0, 80, 320, 100, '$accentAlt', op(0.45)) + P('M120 140Q130 60 220 50Q290 46 320 80L320 140Z', '$accentAlt', op(0.55)) + P('M220 50Q190 54 186 76Q200 66 214 70Q206 58 220 50Z', '$light', op(0.9)) + S('M140 124Q170 100 220 96M180 132Q220 116 280 114', '$light', 1.5, op(0.7)) + R(0, 140, 320, 40, '$ground') + R(0, 138, 320, 4, '$light', op(0.7)), ['sport'], ['surf']),
    ring: ST(sky('$ink') + R(0, 0, 320, 180, '$sky', op(0.3)) + P('M140 0L180 0L240 120L80 120Z', '$light', op(0.1)) + crowd(116, 40, 61) + R(0, 128, 320, 52, '$skyAlt') + R(0, 128, 320, 52, '$light', op(0.3)) + R(20, 60, 7, 72, '$light') + R(293, 60, 7, 72, '$light') + S('M23 74L297 74', '$accentAlt', 2.5) + S('M23 90L297 90', '$light', 2.5) + S('M23 106L297 106', '$accent', 2.5), ['sport'], ['combat']),
    piste: ST(sky() + sun(260, 30, 12) + P('M-20 110L90 24L200 110Z', '$light') + P('M120 110L240 36L340 110Z', '$light', op(0.85)) + P('M90 24L120 50L104 52L84 44Z', '$skyAlt') + R(0, 108, 320, 72, '$light') + pine(30, 120, 0.8) + pine(56, 116, 0.6) + pine(284, 118, 0.8) + rep(4, (i) => S(`M${110 + i * 40} 110L${110 + i * 40} 92`, '$ink', 1, op(0.6)) + P(`M${110 + i * 40} 92L${120 + i * 40} 95L${110 + i * 40} 98Z`, i % 2 ? '$accent' : '$accentAlt')) + R(0, 150, 320, 30, '$skyAlt', op(0.5)), ['sport'], ['ski']),
    pisteAthle: ST(sky() + bleachers(36, 5, 71) + R(0, 96, 320, 12, '$ground') + R(0, 106, 320, 74, '$accentAlt', op(0.65)) + rep(5, (i) => R(0, 112 + i * 13, 320, 1.4, '$light', op(0.8))), ['sport'], ['athletisme']),
    hippodrome: ST(sky() + cloud(240, 26) + R(30, 50, 140, 56, '$groundAlt') + P('M20 50L180 50L170 36L30 36Z', '$accent') + rep(4, (j) => crowd(64 + j * 11, 18, 80 + j).replace(/cx="(\d+(\.\d+)?)"/g, (m, x) => `cx="${n(40 + (+x) * 0.4)}"`)) + R(0, 106, 320, 74, '$ground') + R(0, 118, 320, 3, '$light') + rep(17, (i) => R(i * 20, 112, 2, 9, '$light')) + R(0, 112, 320, 2, '$light'), ['sport'], ['hippisme']),
    salleSport: ST(wallBase() + R(40, 20, 240, 80, '$sky', op(0.5)) + R(40, 20, 240, 80, 'none', 'stroke="$light" stroke-width="3"') + rep(6, (i) => R(46 + i * 40, 104, 8, 22, '$ink', op(0.6) + ' ' + rx(2))) + R(30, 110, 260, 3, '$ink', op(0.35)) + floor(128, '$groundAlt') + rep(4, (i) => R(10 + i * 80, 140, 70, 30, '$ground', rx(3))), ['sport'], ['fitness']),
    arene: ST(sky('$ink') + R(0, 0, 320, 180, '$sky', op(0.35)) + E(160, 120, 200, 90, '$groundAlt') + rep(5, (j) => crowd(46 + j * 13, 40, 90 + j)) + P('M40 0L60 0L130 132L80 132Z', '$light', op(0.08)) + P('M260 0L280 0L240 132L190 132Z', '$light', op(0.08)) + R(0, 116, 320, 64, '$ground') + E(160, 150, 120, 20, '$accent', op(0.25)), ['sport']),
    parcArcEnCiel: ST(sky() + rep(4, (i) => S(`M${50 + i * 7} 132A${110 - i * 7} ${110 - i * 7} 0 0 1 ${270 - i * 7} 132`, ['$accentAlt', '$accent', '$groundAlt', '$sky'][i], 7)) + cloud(52, 120, 1.3) + cloud(268, 120, 1.3) + hill(60, 136, 110, 26) + hill(270, 138, 110, 30) + ground(132) + field(91, 14, (r) => { const x = r() * 320, y = 140 + r() * 30; return C(x, y, 2, r() > 0.5 ? '$accent' : '$accentAlt'); }), ['jeunesse']),
    chambre: ST(wallBase() + field(93, 20, (r) => star(r() * 320, r() * 110, 3, '$accent', op(0.35))) + window_(210, 26, 66, 60, C(244, 46, 8, '$accent', op(0.8))) + R(36, 30, 40, 54, '$accentAlt', rx(3)) + star(56, 56, 12, '$light') + shelf(100, 70, 70) + R(108, 58, 12, 12, '$accent', rx(2)) + C(140, 63, 7, '$sky') + R(152, 54, 10, 16, '$groundAlt', rx(2)) + floor(128) + E(150, 156, 100, 12, '$accentAlt', op(0.3)), ['jeunesse']),
    // Événements : un décor par sous-genre
    debat: ST(studioBack() + rep(9, (i) => R(i * 36, 20, 30, 96, '$accent', op(0.12 + (i % 2) * 0.1))) + R(110, 30, 100, 60, '$skyAlt', op(0.4) + ' ' + rx(4)) + R(150, 40, 20, 40, '$accentAlt', op(0.5)) + E(160, 150, 100, 12, '$accent', op(0.3)), ['evenement'], ['debat']),
    espaceMars: ST(sky('$ink') + stars(60, 41, 120) + C(260, 36, 10, '$sky') + P('M254 34Q260 30 264 36Q258 40 254 34Z', '$ground') + R(0, 116, 320, 64, '$accentAlt', op(0.75)) + E(80, 122, 60, 14, '$accentAlt') + E(250, 124, 70, 12, '$accentAlt') + E(80, 150, 16, 4, '$ink', op(0.2)) + E(240, 164, 22, 5, '$ink', op(0.2)) + E(170, 140, 10, 3, '$ink', op(0.2)), ['evenement'], ['espace']),
    vatican: ST(sky() + R(0, 0, 320, 180, '$accent', op(0.1)) + P('M120 76Q120 34 160 30Q200 34 200 76Z', '$light') + R(158, 12, 4, 20, '$light') + R(152, 18, 16, 3, '$light') + R(100, 76, 120, 48, '$light') + columns(108, 82, 8, 14, 36, '$skyAlt') + R(0, 92, 90, 34, '$light', op(0.85)) + R(230, 92, 90, 34, '$light', op(0.85)) + columns(6, 98, 6, 14, 22, '$skyAlt') + columns(236, 98, 6, 14, 22, '$skyAlt') + R(0, 126, 320, 54, '$ground') + E(160, 154, 140, 18, '$groundAlt', op(0.5)), ['evenement'], ['vatican']),
    soireeElectorale: ST(studioBack() + screen(30, 18, 120, 90, rep(5, (i) => R(42 + i * 21, 96 - (20 + ((i * 37) % 50)), 14, 20 + ((i * 37) % 50), i % 2 ? '$accent' : '$accentAlt'))) + screen(176, 18, 116, 90, rep(8, (i) => { const a = Math.PI + (i * Math.PI) / 8, b = Math.PI + ((i + 1) * Math.PI) / 8; return P(`M${n(234 + Math.cos(a) * 44)} ${n(90 + Math.sin(a) * 44)}A44 44 0 0 1 ${n(234 + Math.cos(b) * 44)} ${n(90 + Math.sin(b) * 44)}L${n(234 + Math.cos(b) * 22)} ${n(90 + Math.sin(b) * 22)}A22 22 0 0 0 ${n(234 + Math.cos(a) * 22)} ${n(90 + Math.sin(a) * 22)}Z`, ['$accentAlt', '$accent', '$sky', '$ink'][i % 4], op(0.85)); })), ['evenement'], ['election']),
    palaisRoyal: ST(sky() + cloud(60, 22) + R(40, 50, 240, 78, '$light') + P('M120 50L160 24L200 50Z', '$light') + R(40, 46, 240, 6, '$skyAlt') + columns(130, 58, 5, 14, 48, '$skyAlt') + rep(5, (i) => R(52 + i * 15, 64, 8, 14, '$sky') + R(214 + i * 15, 64, 8, 14, '$sky')) + R(150, 96, 20, 32, '$accent', op(0.7)) + S('M160 24L160 4', '$ink', 1.2) + P('M160 4L176 8L160 12Z', '$accentAlt') + R(0, 126, 320, 54, '$ground') + rep(30, (i) => S(`M${i * 11} 126L${i * 11} 108`, '$ink', 1.2, op(0.5)) + C(i * 11, 107, 1.4, '$accent')) + S('M0 112L320 112', '$ink', 1.2, op(0.5)), ['evenement'], ['royal']),
    enquete: ST(sky('$ink') + R(0, 0, 320, 180, '$sky', op(0.3)) + R(20, 16, 280, 100, '$groundAlt', op(0.35)) + field(101, 14, (r, i) => G(`rotate(${n(r() * 10 - 5)} ${40 + (i % 7) * 40} ${40 + Math.floor(i / 7) * 46})`, R(26 + (i % 7) * 40, 24 + Math.floor(i / 7) * 46, 28, 32, '$light', op(0.85)) + S(`M${30 + (i % 7) * 40} ${34 + Math.floor(i / 7) * 46}l18 0m-18 6l14 0m-14 6l16 0`, '$ink', 0.8, op(0.3)))) + S('M40 30L120 80L200 30L280 76', '$accentAlt', 1) + P('M120 0L200 0L250 164L70 164Z', '$light', op(0.07)) + floor(128), ['evenement'], ['enquete']),
    commission: ST(wallBase() + rep(10, (i) => R(i * 32, 0, 30, 110, '$accent', op(0.12)) + R(i * 32 + 4, 8, 22, 96, '$ink', op(0.04))) + S('M140 20L140 70M180 20L180 70', '$ink', 1.2, op(0.5)) + P('M140 20L156 22L156 44L140 42Z', '$accentAlt') + P('M180 20L196 22L196 44L180 42Z', '$accent') + R(0, 110, 320, 3, '$ink', op(0.2)) + floor(128), ['evenement'], ['commission']),
    eurovisionJunior: ST(sky('$ink') + R(0, 0, 320, 180, '$sky', op(0.4)) + heart(160, 60, 7, '$accentAlt', op(0.85)) + heart(160, 60, 5, '$accent', op(0.6)) + rep(10, (i) => P(`M${160 + (i - 4.5) * 8} 0L${160 + (i - 4.5) * 9} 0L${n(160 + (i - 4.5) * 40)} 140L${n(160 + (i - 4.5) * 36)} 140Z`, ['$accent', '$accentAlt', '$light'][i % 3], op(0.1))) + R(0, 128, 320, 52, '$groundAlt') + E(160, 156, 140, 16, '$accent', op(0.3)) + rep(20, (i) => C(8 + i * 16, 130, 2, ['$accent', '$accentAlt', '$light'][i % 3])), ['evenement'], ['eurovision']),
    esportArena: ST(sky('$ink') + R(0, 0, 320, 180, '$sky', op(0.2)) + screen(80, 14, 160, 84, P('M90 86L120 50L140 70L170 34L200 64L230 40L230 98L90 98Z', '$accent', op(0.4)) + C(160, 56, 12, '$accentAlt', op(0.6))) + screen(16, 34, 50, 40) + screen(254, 34, 50, 40) + R(0, 112, 320, 3, '$accent') + R(0, 118, 320, 2, '$accentAlt') + floor(128, '$groundAlt') + E(160, 156, 150, 14, '$accentAlt', op(0.2)), ['evenement'], ['esport']),
    concertWeb: ST(wallBase() + rep(4, (j) => rep(6, (i) => P(`M${70 + i * 30} ${16 + j * 24}l14 0l-7 20Z`, '$ink', op(0.18)) + P(`M${84 + i * 30} ${36 + j * 24}l14 0l-7 -20Z`, '$ink', op(0.1)))) + ring(40, 50, 22, '$light', 5) + ring(40, 50, 22, '$accent', 1.5, op(0.6)) + S('M40 72L40 128', '$ink', 1.5, op(0.6)) + R(250, 30, 56, 36, '$ink', rx(3)) + R(253, 33, 50, 30, '$sky') + C(278, 48, 6, '$accentAlt') + R(0, 112, 320, 2.5, '$accentAlt', op(0.8)) + floor(128), ['evenement'], ['concertweb']),
    spectacleNoel: ST(sky() + R(0, 0, 320, 180, '$ink', op(0.35)) + snow(60) + S('M0 10Q40 24 80 10Q120 24 160 10Q200 24 240 10Q280 24 320 10', '$groundAlt', 1.4) + rep(16, (i) => C(10 + i * 20, 15 + (i % 2) * 4, 2.6, ['$accent', '$accentAlt', '$light'][i % 3])) + star(160, 50, 14, '$accent') + R(0, 126, 320, 54, '$light') + E(60, 128, 70, 8, '$light') + E(260, 128, 80, 10, '$light') + R(0, 150, 320, 30, '$skyAlt', op(0.5)), ['evenement'], ['noel']),
    animationGeant: ST(sky() + cloud(60, 30) + building(0, 50, 80, '$groundAlt') + building(270, 50, 90, '$groundAlt') + S('M120 120L130 70M200 120L194 60', '$ink', 0.8, op(0.5)) + C(130, 48, 20, '$accent') + C(116, 32, 7, '$accent') + C(144, 32, 7, '$accent') + C(124, 46, 2, '$ink') + C(136, 46, 2, '$ink') + E(130, 54, 6, 4, '$light') + star(194, 38, 24, '$accentAlt') + C(188, 36, 2, '$ink') + C(200, 36, 2, '$ink') + rep(6, (i) => S(`M${i * 60} 0L${i * 60 + 30} 16L${i * 60 + 60} 0`, '$ink', 0.6, op(0.3)) + P(`M${i * 60 + 10} 4L${i * 60 + 18} 8L${i * 60 + 12} 14Z`, i % 2 ? '$accent' : '$accentAlt')) + ground(128), ['evenement'], ['animation']),
    concertVienne: ST(wallBase() + R(0, 0, 320, 180, '$accent', op(0.18)) + rep(14, (i) => R(100 + i * 9, 8 + Math.abs(i - 6.5) * 4, 6, 70 - Math.abs(i - 6.5) * 4, '$accent', op(0.7) + ' ' + rx(3))) + columns(20, 24, 3, 26, 84, '$accent') + columns(240, 24, 3, 26, 84, '$accent') + rep(3, (i) => C(60 + i * 100, 16, 8, '$accent', op(0.5)) + C(60 + i * 100, 16, 3, '$light')) + R(0, 112, 320, 16, '$groundAlt') + rep(16, (i) => C(10 + i * 20, 110, 5, i % 2 ? '$accentAlt' : '$accent', op(0.85))) + floor(128), ['evenement'], ['vienne']),
    toureiffel: ST(sky() + cloud(70, 30) + cloud(260, 46, 0.8) + P('M160 8L166 48L178 96L200 126L182 126Q160 96 138 126L120 126L142 96L154 48Z', '$ink', op(0.6)) + R(144, 92, 32, 4, '$ink', op(0.7)) + R(152, 46, 16, 3, '$ink', op(0.7)) + S('M150 60L170 76M170 60L150 76M146 100L174 118M174 100L146 118', '$ink', 0.8, op(0.4)) + building(0, 40, 26, '$groundAlt') + building(36, 30, 40, '$groundAlt') + building(240, 40, 30, '$groundAlt') + building(284, 36, 44, '$groundAlt') + ground(128), ['evenement'], ['toureiffel']),
    comedieFrancaise: ST(sky('$ink') + R(0, 0, 320, 180, '$accentAlt', op(0.3)) + P('M40 140L40 50Q160 -6 280 50L280 140L262 140L262 58Q160 10 58 58L58 140Z', '$accent', op(0.75)) + curtains('$accentAlt') + rep(2, (j) => rep(5, (i) => E(i * 10 + 6, 50 + j * 30, 4, 3, '$accent', op(0.6)) + E(314 - i * 10, 50 + j * 30, 4, 3, '$accent', op(0.6)))) + R(0, 128, 320, 52, '$groundAlt') + R(40, 128, 240, 3, '$accent'), ['evenement'], ['theatre']),
    operaBallet: ST(sky('$ink') + R(0, 0, 320, 180, '$accentAlt', op(0.25)) + rep(3, (j) => rep(4, (i) => R(i * 18, 30 + j * 30, 16, 20, '$accent', op(0.35) + ' ' + rx(3)) + R(320 - 16 - i * 18, 30 + j * 30, 16, 20, '$accent', op(0.35) + ' ' + rx(3)))) + S('M160 0L160 14', '$light', 1) + E(160, 22, 22, 8, '$accent') + rep(7, (i) => C(142 + i * 6, 30, 1.8, '$light')) + P('M80 40L240 40L240 128L80 128Z', '$accentAlt', op(0.5)) + P('M80 40Q120 70 116 128L80 128Z', '$accentAlt') + P('M240 40Q200 70 204 128L240 128Z', '$accentAlt') + R(76, 36, 168, 6, '$accent') + R(0, 128, 320, 52, '$groundAlt'), ['evenement'], ['opera']),
    quatorzeJuillet: ST(sky('$ink') + R(0, 0, 320, 180, '$sky', op(0.3)) + firework(70, 40, 26, '$accent') + firework(160, 28, 22, '$light') + firework(250, 46, 28, '$accentAlt') + firework(120, 70, 14, '$accentAlt') + firework(210, 80, 12, '$accent') + building(0, 60, 30, '$groundAlt', 128) + building(260, 60, 36, '$groundAlt', 128) + rep(3, (i) => R(110 + i * 34, 94, 10, 34, '$ink', op(0.4)) + R(120 + i * 34, 96, 6, 10, ['$accent', '$light', '$accentAlt'][i])) + ground(128), ['evenement'], ['quatorze']),
    goncourt: ST(wallBase() + R(0, 0, 320, 110, '$groundAlt', op(0.35)) + rep(6, (i) => R(10 + i * 52, 14, 44, 84, '$groundAlt', op(0.4) + ' ' + rx(2))) + S('M160 0L160 12', '$ink', 1, op(0.6)) + E(160, 18, 18, 6, '$accent') + rep(5, (i) => C(148 + i * 6, 25, 1.6, '$light')) + shelf(20, 70, 80) + books(24, 70, 72, 113) + shelf(220, 70, 80) + books(224, 70, 72, 117) + floor(128), ['evenement'], ['goncourt']),
    eclipse: ST(sky('$ink') + R(0, 0, 320, 180, '$sky', op(0.25)) + stars(50, 131, 110) + C(160, 56, 34, '$light', op(0.15)) + C(160, 56, 27, '$light', op(0.35)) + C(160, 56, 24, '$accent', op(0.9)) + C(162, 55, 22.5, '$ink') + hill(60, 132, 120, 26) + hill(270, 134, 110, 30) + ground(130), ['evenement'], ['eclipse']),
    victoiresClassique: ST(sky('$ink') + R(0, 0, 320, 180, '$sky', op(0.35)) + rep(5, (i) => S(`M0 ${40 + i * 7}Q160 ${10 + i * 7} 320 ${40 + i * 7}`, '$accent', 1, op(0.5))) + field(141, 7, (r, i) => { const x = 30 + i * 42, y = 30 + Math.sin(i) * 6 + 14; return E(x, y + 8, 4, 3, '$light', op(0.9)) + S(`M${x + 3.5} ${y + 8}L${x + 3.5} ${y - 6}`, '$light', 1.2, op(0.9)); }) + spot(80) + spot(240) + R(0, 128, 320, 52, '$groundAlt') + E(160, 156, 140, 14, '$accent', op(0.25)), ['evenement'], ['victoires']),
    missFrance: ST(sky('$ink') + R(0, 0, 320, 180, '$accentAlt', op(0.3)) + rep(3, (i) => S(`M${60 - i * 20} 128A${100 + i * 20} ${100 + i * 20} 0 0 1 ${260 + i * 20} 128`, '$accent', 3, op(0.7 - i * 0.18)) + rep(9, (k) => { const a = Math.PI + ((k + 0.5) * Math.PI) / 9; return C(160 + Math.cos(a) * (100 + i * 20), 128 + Math.sin(a) * (100 + i * 20), 1.8, '$light'); })) + R(0, 128, 320, 52, '$groundAlt') + P('M130 128L190 128L230 180L90 180Z', '$light', op(0.25)) + rep(4, (i) => R(120 - i * 10, 120 + i * 0, 80 + i * 20, 0.1, '$light')), ['evenement'], ['miss'])
  };

  // ---------- Objets centraux (prop, 120×100, base y = 100) ----------
  const PT = (svg, genres, subs) => ST(svg, genres, subs);
  const legs4 = (x1, x2, y1, y2) => S(`M${x1} ${y1}L${x1} ${y2}M${x2} ${y1}L${x2} ${y2}`, '$ink', 2.5, op(0.6));
  const PROPS = {
    coffre: PT(R(30, 64, 60, 36, '$accentAlt', rx(3)) + P('M30 66Q30 46 60 46Q90 46 90 66Z', '$accentAlt') + R(30, 62, 60, 6, '$ink', op(0.25)) + R(40, 46, 6, 54, '$ink', op(0.25)) + R(74, 46, 6, 54, '$ink', op(0.25)) + R(55, 60, 10, 12, '$accent', rx(2)) + C(18, 96, 4, '$accent') + C(26, 98, 3.5, '$accent') + C(100, 97, 4, '$accent'), ['aventure', 'jeu']),
    campfire: PT(E(60, 96, 30, 5, '$ink', op(0.15)) + rep(7, (i) => C(34 + i * 8.5, 95, 4.5, '$groundAlt')) + S('M40 96L80 84M40 84L80 96', '$ink', 6, op(0.55)) + P('M60 40Q74 60 72 76Q70 90 60 90Q48 90 47 78Q46 64 56 58Q54 66 58 70Q60 56 60 40Z', '$accentAlt') + P('M60 58Q68 70 66 80Q64 88 60 88Q54 88 54 80Q54 72 60 58Z', '$accent'), ['aventure']),
    tente: PT(P('M10 100L60 30L110 100Z', '$accent') + P('M60 30L110 100L80 100Z', '$ink', op(0.12)) + P('M60 50L46 100L74 100Z', '$ink', op(0.4)) + S('M60 30L60 22M10 100L2 100M110 100L118 100', '$ink', 1.5, op(0.6)), ['aventure']),
    totem: PT(R(44, 24, 32, 76, '$groundAlt') + R(44, 24, 32, 24, '$accent') + R(44, 48, 32, 26, '$accentAlt') + C(53, 34, 3, '$ink') + C(67, 34, 3, '$ink') + R(53, 40, 14, 3, '$ink', op(0.6)) + C(53, 59, 3.5, '$light') + C(67, 59, 3.5, '$light') + C(53, 59, 1.5, '$ink') + C(67, 59, 1.5, '$ink') + P('M44 50L24 44L28 56L44 58Z', '$accent') + P('M76 50L96 44L92 56L76 58Z', '$accent') + R(50, 82, 20, 4, '$ink', op(0.3)), ['aventure']),
    trepied: PT(S('M60 56L38 100M60 56L82 100M60 56L60 100', '$ink', 2.5, op(0.75)) + R(36, 30, 40, 26, '$ink', rx(4)) + R(76, 36, 12, 14, '$ink', rx(2)) + C(52, 43, 9, '$light', op(0.9)) + C(52, 43, 5, '$sky') + C(70, 34, 2, '$accentAlt') + R(40, 24, 14, 6, '$ink', rx(2)), ['aventure', 'generique', 'telerealite', 'info', 'documentaire', 'evenement']),
    pupitre: PT(P('M26 48L94 48L86 100L34 100Z', '$accent') + P('M26 48L94 48L86 100L34 100Z', '$ink', op(0.1)) + R(22, 42, 76, 8, '$ink', op(0.8) + ' ' + rx(2)) + R(40, 60, 40, 22, '$light', op(0.85) + ' ' + rx(3)) + R(44, 64, 32, 14, '$sky') + E(60, 41, 9, 3, '$ink') + P('M52 41Q52 34 60 34Q68 34 68 41Z', '$accentAlt'), ['jeu', 'talent']),
    cagnotte: PT(R(32, 32, 56, 68, '$light', op(0.55) + ' ' + rx(8)) + R(32, 32, 56, 68, 'none', 'stroke="$ink" stroke-width="1.5" stroke-opacity="0.3" rx="8"') + rep(6, (j) => rep(4, (i) => E(42 + i * 12 + (j % 2) * 5, 94 - j * 9, 6, 2.6, '$accent'))) + R(40, 26, 40, 8, '$ink', op(0.7) + ' ' + rx(2)) + R(36, 40, 4, 40, '$light', op(0.6)), ['jeu', 'divertissement']),
    des: PT(G('rotate(-10 38 76)', R(16, 54, 44, 44, '$light', rx(8)) + C(28, 66, 4, '$ink') + C(48, 86, 4, '$ink') + C(38, 76, 4, '$ink')) + G('rotate(12 82 80)', R(64, 62, 36, 36, '$accentAlt', rx(7)) + C(74, 72, 3.2, '$light') + C(90, 72, 3.2, '$light') + C(74, 88, 3.2, '$light') + C(90, 88, 3.2, '$light')), ['jeu', 'jeunesse']),
    jury: PT(rep(3, (i) => R(16 + i * 32, 40, 24, 30, '$accentAlt', rx(6))) + R(4, 58, 112, 10, '$ink', op(0.8) + ' ' + rx(2)) + R(8, 68, 104, 32, '$accent') + rep(3, (i) => star(28 + i * 32, 84, 7, '$light', op(0.9))), ['jeu', 'talent']),
    ecranGeant: PT(R(10, 10, 100, 64, '$ink', rx(4)) + R(15, 15, 90, 54, '$skyAlt') + P('M15 15L60 15L15 60Z', '$light', op(0.25)) + C(80, 40, 10, '$accent', op(0.7)) + R(54, 74, 12, 18, '$ink', op(0.7)) + R(36, 92, 48, 8, '$ink', op(0.7) + ' ' + rx(2)), ['jeu', 'generique', 'info']),
    discoball: PT(S('M60 0L60 22', '$ink', 1.2, op(0.6)) + C(60, 46, 24, '$light') + rep(5, (i) => S(`M${36 + i * 12} 46Q${36 + i * 12} 30 60 22M${36 + i * 12} 46Q${36 + i * 12} 62 60 70`, '$ink', 0.6, op(0.2))) + rep(4, (i) => S(`M36 ${30 + i * 10}L84 ${30 + i * 10}`, '$ink', 0.6, op(0.2))) + R(48, 34, 8, 6, '$sky', op(0.8)) + R(64, 50, 8, 6, '$accent', op(0.6)) + spark(90, 24, 6, '$light') + spark(28, 70, 5, '$light') + E(60, 98, 24, 3, '$ink', op(0.1)), ['talent', 'divertissement', 'humour']),
    podiumShow: PT(E(60, 92, 54, 10, '$accentAlt') + R(6, 80, 108, 12, '$accentAlt') + E(60, 80, 54, 10, '$accent') + E(60, 72, 38, 7, '$accentAlt') + R(22, 64, 76, 8, '$accentAlt') + E(60, 64, 38, 7, '$light') + rep(9, (i) => C(12 + i * 12, 88, 1.6, '$light')), ['talent', 'divertissement', 'generique']),
    micStand: PT(E(60, 98, 18, 3.5, '$ink', op(0.85)) + S('M60 98L60 36', '$ink', 2.5) + S('M60 36L72 28', '$ink', 2) + R(70, 18, 6, 14, '$ink', rx(3) + ' transform="rotate(-30 73 25)"') + C(76, 20, 5, '$ink', op(0.8)), ['talent', 'divertissement', 'humour']),
    piano: PT(R(16, 30, 88, 62, '$ink', op(0.85) + ' ' + rx(3)) + R(12, 26, 96, 8, '$ink', rx(2)) + R(16, 56, 88, 12, '$light') + rep(12, (i) => S(`M${23 + i * 7} 56L${23 + i * 7} 68`, '$ink', 0.6, op(0.4))) + rep(8, (i) => R(21 + i * 10, 56, 4, 7, '$ink')) + R(20, 92, 6, 8, '$ink', op(0.85)) + R(94, 92, 6, 8, '$ink', op(0.85)) + R(40, 36, 40, 14, '$light', op(0.15)), ['talent', 'drame']),
    cadeau: PT(R(28, 52, 64, 48, '$accent', rx(3)) + R(24, 44, 72, 12, '$accent', rx(2)) + R(24, 44, 72, 12, '$ink', op(0.1) + ' ' + rx(2)) + R(55, 44, 10, 56, '$accentAlt') + P('M60 44Q40 24 38 36Q38 44 60 44Q80 44 82 36Q80 24 60 44Z', '$accentAlt'), ['divertissement', 'jeunesse']),
    gateau: PT(R(30, 92, 60, 6, '$ink', op(0.4) + ' ' + rx(2)) + S('M60 92L60 98', '$ink', 3, op(0.4)) + R(26, 70, 68, 22, '$light', rx(4)) + R(36, 50, 48, 22, '$light', rx(4)) + R(46, 32, 28, 20, '$light', rx(4)) + P('M26 74Q31 80 36 74Q41 80 46 74Q51 80 56 74Q61 80 66 74Q71 80 76 74Q81 80 86 74Q91 80 94 74L94 70L26 70Z', '$accent') + P('M36 54Q41 60 46 54Q51 60 56 54Q61 60 66 54Q71 60 76 54Q81 60 84 54L84 50L36 50Z', '$accentAlt') + rep(3, (i) => R(52 + i * 7, 22, 3, 10, '$accentAlt') + E(53.5 + i * 7, 19, 1.8, 3, '$accent')), ['divertissement', 'cuisine']),
    telescope: PT(S('M60 62L40 100M60 62L80 100M60 62L60 100', '$ink', 2.2, op(0.7)) + G('rotate(-28 60 56)', R(24, 48, 70, 16, '$accent', rx(4)) + R(88, 45, 10, 22, '$accent', rx(3)) + R(18, 51, 8, 10, '$ink', op(0.7) + ' ' + rx(2)) + R(40, 48, 4, 16, '$ink', op(0.2))), ['jeunesse', 'documentaire', 'evenement'], ['eclipse', 'espace']),
    tortue: PT(E(60, 96, 46, 5, '$ink', op(0.12)) + C(100, 80, 9, '$groundAlt') + C(103, 78, 1.6, '$ink') + E(34, 94, 8, 6, '$groundAlt') + E(84, 94, 8, 6, '$groundAlt') + P('M22 90Q22 52 60 52Q98 52 98 90Z', '$ground') + P('M22 90Q22 52 60 52Q98 52 98 90Z', '$ink', op(0.15)) + S('M46 58L40 72L48 88M74 58L80 72L72 88M40 72L80 72M48 88L72 88', '$light', 1.4, op(0.6)), ['jeunesse', 'documentaire']),
    globeProp: PT(E(60, 97, 22, 4, '$ink', op(0.75)) + S('M60 96L60 82', '$ink', 3) + S('M34 34A34 34 0 0 0 86 78', '$ink', 2.5, op(0.7)) + C(60, 50, 28, '$accentAlt', op(0.75)) + P('M44 34Q56 28 62 36Q58 46 48 46Q40 44 44 34Z', '$ground') + P('M64 52Q78 48 82 58Q76 72 66 68Q60 60 64 52Z', '$ground') + P('M42 58Q50 56 50 64Q46 70 40 66Z', '$ground'), ['jeunesse', 'info', 'documentaire']),
    cubes: PT(R(14, 64, 34, 34, '$accent', rx(3)) + R(50, 64, 34, 34, '$accentAlt', rx(3)) + R(32, 30, 34, 34, '$sky', rx(3)) + R(86, 72, 26, 26, '$groundAlt', rx(3)) + star(31, 81, 9, '$light') + C(67, 81, 8, '$light') + P('M49 38L57 54L41 54Z', '$light') + heart(99, 86, 1.1, '$light'), ['jeunesse']),
    toboggan: PT(S('M24 100L24 26M40 100L40 26', '$ink', 2.5, op(0.6)) + rep(6, (i) => S(`M24 ${92 - i * 12}L40 ${92 - i * 12}`, '$ink', 2, op(0.6))) + R(20, 22, 26, 6, '$accent', rx(2)) + P('M40 22Q60 24 76 60Q88 90 112 94L112 100Q80 98 70 66Q58 32 40 30Z', '$accentAlt'), ['jeunesse']),
    tabouret: PT(S('M50 56L40 100M70 56L80 100M60 58L60 100', '$ink', 2.5, op(0.7)) + S('M44 84L76 84', '$ink', 2, op(0.6)) + E(60, 54, 22, 6, '$accent') + R(38, 50, 44, 4, '$accent'), ['humour']),
    fauteuils: PT(rep(2, (i) => { const x = i * 58; return R(x + 6, 46, 46, 40, i ? '$accentAlt' : '$accent', rx(10)) + R(x + 2, 64, 14, 30, i ? '$accentAlt' : '$accent', rx(6)) + R(x + 42, 64, 14, 30, i ? '$accentAlt' : '$accent', rx(6)) + R(x + 12, 74, 34, 14, '$ink', op(0.12) + ' ' + rx(4)) + R(x + 8, 94, 4, 6, '$ink', op(0.6)) + R(x + 46, 94, 4, 6, '$ink', op(0.6)); }), ['humour', 'magazine', 'info']),
    televiseur: PT(S('M50 26L40 10M70 26L82 8', '$ink', 1.5, op(0.6)) + R(18, 26, 84, 62, '$accentAlt', rx(8)) + R(26, 34, 54, 46, '$skyAlt', rx(6)) + P('M26 34L56 34L26 66Z', '$light', op(0.3)) + C(91, 44, 4, '$ink', op(0.5)) + C(91, 58, 4, '$ink', op(0.5)) + S('M30 88L24 100M90 88L96 100', '$ink', 2.5, op(0.6)), ['humour', 'generique', 'magazine']),
    canape: PT(R(10, 44, 100, 36, '$accent', rx(10)) + R(4, 60, 18, 32, '$accent', rx(7)) + R(98, 60, 18, 32, '$accent', rx(7)) + R(18, 70, 84, 18, '$accent', rx(4)) + R(18, 70, 84, 18, '$ink', op(0.1) + ' ' + rx(4)) + R(24, 52, 22, 18, '$accentAlt', rx(5)) + R(74, 52, 22, 18, '$light', op(0.8) + ' ' + rx(5)) + R(10, 92, 4, 8, '$ink', op(0.6)) + R(106, 92, 4, 8, '$ink', op(0.6)), ['generique', 'drame', 'telerealite', 'magazine']),
    lampadaire: PT(C(60, 22, 26, '$light', op(0.18)) + E(60, 98, 16, 3, '$ink', op(0.8)) + S('M60 98L60 30', '$ink', 2.2, op(0.8)) + P('M46 34L74 34L68 10L52 10Z', '$accent'), ['generique', 'drame']),
    tableBasse: PT(E(60, 76, 46, 9, '$groundAlt') + R(14, 76, 92, 6, '$ink', op(0.2)) + S('M24 82L24 100M96 82L96 100M44 84L44 100M76 84L76 100', '$ink', 3, op(0.55)) + R(36, 62, 10, 12, '$light', rx(2)) + P('M74 74Q70 58 78 50Q84 60 80 74Z', '$groundAlt') + P('M78 74Q86 56 94 54Q90 66 82 74Z', '$ground') + R(70, 66, 16, 10, '$accentAlt', rx(2)), ['generique', 'magazine']),
    banc: PT(R(10, 50, 100, 8, '$accentAlt', rx(2)) + R(10, 62, 100, 8, '$accentAlt', rx(2)) + R(6, 76, 108, 7, '$accentAlt', rx(2)) + S('M18 50L18 100M102 50L102 100M24 84L16 100M96 84L104 100', '$ink', 3, op(0.6)), ['drame', 'dating', 'magazine']),
    bureau: PT(R(6, 56, 108, 8, '$ink', op(0.75) + ' ' + rx(2)) + R(12, 64, 30, 36, '$accent') + R(78, 64, 30, 36, '$accent') + R(16, 70, 22, 10, '$ink', op(0.12)) + R(16, 84, 22, 10, '$ink', op(0.12)) + R(42, 32, 34, 22, '$ink', rx(2)) + R(45, 35, 28, 16, '$skyAlt') + P('M38 56L80 56L76 52L42 52Z', '$ink', op(0.7)) + S('M96 56L90 36L100 30', '$ink', 1.5) + P('M94 26L110 30L104 38Z', '$accentAlt'), ['drame', 'magazine', 'policier', 'info']),
    bistro: PT(E(60, 58, 22, 5, '$light') + S('M60 60L60 98M50 98L70 98', '$ink', 2.5, op(0.7)) + R(54, 50, 6, 7, '$accentAlt', rx(1)) + R(64, 50, 6, 7, '$light', rx(1)) + S('M14 52L14 100M14 70L32 70L32 100', '$ink', 2.2, op(0.7)) + S('M106 52L106 100M106 70L88 70L88 100', '$ink', 2.2, op(0.7)), ['drame', 'dating']),
    transat: PT(S('M20 100L60 50M96 100L36 60M60 50L100 30', '$ink', 2.5, op(0.6)) + P('M30 88L74 50L104 32L108 40L80 58L40 94Z', '$light') + rep(3, (i) => P(`M${34 + i * 22} ${84 - i * 18}L${46 + i * 22} ${74 - i * 18}L${52 + i * 22} ${80 - i * 18}L${40 + i * 22} ${90 - i * 18}Z`, '$accent')), ['telerealite', 'dating']),
    confession: PT(C(60, 40, 40, '$light', op(0.12)) + R(28, 20, 64, 70, '$accentAlt', rx(26)) + R(18, 60, 18, 34, '$accentAlt', rx(8)) + R(84, 60, 18, 34, '$accentAlt', rx(8)) + R(32, 70, 56, 20, '$ink', op(0.12) + ' ' + rx(6)) + heart(60, 46, 2.2, '$light', op(0.7)) + R(30, 94, 4, 6, '$ink', op(0.6)) + R(86, 94, 4, 6, '$ink', op(0.6)), ['telerealite']),
    tableRomantique: PT(E(60, 60, 40, 7, '$light') + P('M20 60L100 60L96 92L24 92Z', '$light') + P('M20 60Q60 70 100 60L100 66Q60 76 20 66Z', '$ink', op(0.08)) + R(56, 38, 8, 22, '$light') + E(60, 34, 3, 5, '$accent') + C(60, 32, 10, '$accent', op(0.18)) + P('M38 46L46 46L44 56L40 56Z', '$accentAlt', op(0.8)) + S('M42 56L42 60', '$ink', 1) + C(80, 54, 4, '$accentAlt'), ['dating']),
    lutrin: PT(P('M36 40L84 40L76 100L44 100Z', '$groundAlt') + P('M36 40L84 40L76 100L44 100Z', '$ink', op(0.15)) + R(32, 34, 56, 8, '$ink', op(0.75) + ' ' + rx(2)) + R(44, 58, 32, 6, '$accent') + S('M60 34Q60 22 70 18', '$ink', 1.4) + E(71, 17, 3, 2, '$ink'), ['magazine', 'info', 'evenement'], ['debat', 'goncourt', 'royal', 'vatican', 'quatorze', 'enquete']),
    plateauCuisine: PT(R(8, 56, 104, 44, '$light') + R(4, 50, 112, 8, '$ink', op(0.75) + ' ' + rx(2)) + R(14, 64, 44, 30, '$accent', op(0.85) + ' ' + rx(2)) + R(62, 64, 44, 30, '$accent', op(0.85) + ' ' + rx(2)) + E(36, 48, 14, 4, '$ink', op(0.7)) + P('M24 48Q24 36 36 36Q48 36 48 48Z', '$ink', op(0.7)) + P('M74 50Q84 40 98 50Z', '$light') + C(84, 44, 3, '$accentAlt') + C(90, 45, 3, '$groundAlt'), ['magazine']),
    coinDeco: PT(R(10, 56, 100, 6, '$ink', op(0.6)) + S('M18 62L18 100M102 62L102 100', '$ink', 2.5, op(0.6)) + P('M30 56Q24 40 32 28Q40 40 34 56Z', '$accentAlt') + R(26, 44, 12, 12, '$sky', rx(3)) + R(52, 30, 26, 26, '$accent') + R(55, 33, 20, 20, '$skyAlt') + P('M88 56Q82 34 92 22Q100 36 96 56Z', '$groundAlt') + R(86, 46, 14, 10, '$light', rx(2)), ['magazine']),
    presentoir: PT(R(16, 40, 88, 60, '$light', rx(4)) + R(16, 40, 88, 60, 'none', 'stroke="$ink" stroke-opacity="0.15" stroke-width="1.5" rx="4"') + shelf(16, 64, 88) + R(24, 46, 16, 18, '$accent', rx(2)) + R(46, 50, 16, 14, '$accentAlt', rx(2)) + R(70, 44, 20, 20, '$sky', rx(10)) + R(26, 74, 22, 22, '$groundAlt', rx(2)) + R(56, 78, 14, 18, '$accent', rx(2)) + R(76, 76, 20, 20, '$accentAlt', rx(2)), ['magazine']),
    fourneau: PT(R(16, 40, 88, 60, '$light', rx(3)) + R(16, 40, 88, 10, '$ink', op(0.7)) + rep(4, (i) => C(26 + i * 22, 45, 3, '$accent')) + R(26, 58, 68, 34, '$ink', op(0.75) + ' ' + rx(3)) + R(32, 64, 56, 22, '$accent', op(0.55) + ' ' + rx(2)) + R(36, 52, 48, 3, '$ink', op(0.5)) + R(30, 22, 30, 18, '$ink', op(0.7) + ' ' + rx(2)) + S('M38 18Q34 12 38 6M48 18Q44 12 48 6', '$light', 1.5, op(0.6)), ['cuisine']),
    billot: PT(R(14, 58, 92, 42, '$accentAlt', op(0.85) + ' ' + rx(3)) + R(10, 52, 100, 10, '$accentAlt', rx(3)) + R(10, 52, 100, 10, '$ink', op(0.1) + ' ' + rx(3)) + R(20, 62, 80, 2, '$ink', op(0.15)) + R(24, 44, 30, 6, '$light', op(0.9) + ' ' + rx(1)) + R(54, 45, 14, 4, '$ink', op(0.7) + ' ' + rx(1)) + C(80, 46, 6, '$accent') + C(90, 47, 5, '$groundAlt') + E(98, 48, 5, 3, '$accentAlt'), ['cuisine']),
    voiturePolice: PT(P('M6 84Q6 70 18 68L32 68L44 50L82 50L94 68L108 70Q116 72 116 84L116 90L6 90Z', '$light') + R(6, 74, 110, 8, '$accent') + P('M48 54L60 54L60 68L38 68Z', '$sky') + P('M64 54L78 54L88 68L64 68Z', '$sky') + R(54, 44, 8, 6, '$accentAlt', rx(2)) + R(62, 44, 8, 6, '$accent', rx(2)) + C(30, 90, 10, '$ink') + C(30, 90, 4, '$light', op(0.6)) + C(92, 90, 10, '$ink') + C(92, 90, 4, '$light', op(0.6)), ['policier']),
    preuve: PT(R(10, 62, 100, 6, '$ink', op(0.7)) + S('M18 68L18 100M102 68L102 100', '$ink', 2.5, op(0.6)) + R(18, 44, 30, 18, '$groundAlt', rx(2)) + R(18, 44, 30, 5, '$ink', op(0.2)) + P('M60 62L66 50L72 62Z', '$accent') + P('M80 62L86 50L92 62Z', '$accent') + S('M98 58L104 52', '$ink', 2) + ring(96, 60, 5, '$ink', 1.5), ['policier']),
    deskJT: PT(P('M4 60Q60 46 116 60L110 100L10 100Z', '$accent') + P('M4 60Q60 46 116 60L114 66Q60 52 6 66Z', '$ink', op(0.7)) + R(10, 76, 100, 4, '$light', op(0.5)) + R(40, 82, 40, 10, '$light', op(0.2) + ' ' + rx(2)) + R(50, 44, 20, 10, '$ink', op(0.6) + ' ' + rx(1)), ['info']),
    buts: PT(S('M8 100L8 30L112 30L112 100', '$light', 4) + S(rep(10, (i) => `M${18 + i * 9.6} 30L${18 + i * 9.6} 100`).toString() + rep(7, (i) => `M8 ${40 + i * 10}L112 ${40 + i * 10}`).toString(), '$ink', 0.6, op(0.25)), ['sport'], ['football', 'handball']),
    panier: PT(R(56, 30, 6, 70, '$ink', op(0.65)) + E(59, 98, 14, 3, '$ink', op(0.6)) + R(30, 6, 60, 40, '$light', rx(2)) + R(48, 18, 24, 18, 'none', 'stroke="$accentAlt" stroke-width="2"') + E(60, 40, 12, 2.5, 'none', 'stroke="$accentAlt" stroke-width="2.5"') + S('M49 41L53 54L60 42L67 54L71 41M53 54L67 54', '$light', 1, op(0.9)), ['sport'], ['basket']),
    podiumSport: PT(R(40, 46, 40, 54, '$accent') + R(4, 64, 36, 36, '$skyAlt') + R(80, 74, 36, 26, '$skyAlt', op(0.8)) + R(4, 64, 112, 3, '$light', op(0.4)) + star(60, 62, 8, '$light') + C(22, 80, 6, '$light', op(0.8)) + C(98, 86, 5, '$light', op(0.6)), ['sport']),
    formule: PT(P('M4 82L20 70L50 66L58 56L72 56L76 66L108 70L116 76L116 86L4 86Z', '$accentAlt') + R(100, 56, 16, 6, '$accentAlt') + S('M108 62L106 72', '$ink', 2) + R(2, 72, 10, 4, '$accentAlt') + C(65, 58, 6, '$accent') + R(62, 56, 9, 3, '$ink', op(0.6)) + R(20, 76, 80, 3, '$light', op(0.6)) + C(26, 86, 12, '$ink') + C(26, 86, 4, '$light', op(0.5)) + C(96, 86, 12, '$ink') + C(96, 86, 4, '$light', op(0.5)), ['sport'], ['auto']),
    velo: PT(ring(28, 78, 20, '$ink', 3) + ring(92, 78, 20, '$ink', 3) + S('M28 78L48 50L82 50L92 78M48 50L60 78L82 50M60 78L28 78M46 44L56 44M82 50L80 40L90 38', '$accent', 3.5) + C(60, 78, 4, '$ink'), ['sport'], ['velo']),
    planche: PT(E(60, 98, 34, 6, '$ground') + E(60, 50, 16, 48, '$accent') + E(60, 50, 4, 46, '$light', op(0.8)) + P('M54 94L60 100L66 94Z', '$ink', op(0.5)), ['sport'], ['surf']),
    sacFrappe: PT(S('M14 100L14 6L86 6', '$ink', 3, op(0.65)) + E(14, 98, 12, 3, '$ink', op(0.6)) + S('M80 6L80 18', '$ink', 1.5) + R(66, 18, 28, 70, '$accentAlt', rx(12)) + R(66, 36, 28, 4, '$ink', op(0.2)) + R(66, 70, 28, 4, '$ink', op(0.2)), ['sport'], ['combat']),
    halteres: PT(S('M20 60L20 100M100 60L100 100', '$ink', 3, op(0.6)) + S('M8 100L32 100M88 100L112 100', '$ink', 3, op(0.6)) + S('M4 60L116 60', '$ink', 3) + R(12, 42, 10, 36, '$accent', rx(2)) + R(24, 48, 7, 24, '$accentAlt', rx(2)) + R(98, 42, 10, 36, '$accent', rx(2)) + R(89, 48, 7, 24, '$accentAlt', rx(2)), ['sport'], ['fitness']),
    raquettes: PT(G('rotate(-25 50 64)', E(50, 40, 18, 24, 'none', 'stroke="$accent" stroke-width="4"') + S('M40 22L40 58M50 16L50 64M60 22L60 58M34 32L66 32M32 42L68 42M34 52L66 52', '$ink', 0.6, op(0.3)) + R(47, 64, 6, 30, '$ink', rx(2))) + G('rotate(25 70 64)', E(70, 40, 18, 24, 'none', 'stroke="$accentAlt" stroke-width="4"') + S('M60 22L60 58M70 16L70 64M80 22L80 58M54 32L86 32M52 42L88 42M54 52L86 52', '$ink', 0.6, op(0.3)) + R(67, 64, 6, 30, '$ink', rx(2))) + C(60, 92, 7, '$groundAlt') + S('M54 90Q60 94 66 90', '$light', 1), ['sport'], ['tennis']),
    rugbyTee: PT(P('M50 100L54 88L66 88L70 100Z', '$accent') + G('rotate(-70 60 60)', E(60, 60, 30, 17, '$accentAlt') + S('M44 60L76 60', '$light', 1.5) + S('M52 56L52 64M58 56L58 64M64 56L64 64', '$light', 1.2)), ['sport'], ['rugby']),
    skis: PT(E(60, 98, 40, 6, '$light') + G('rotate(-8 50 60)', R(44, 6, 8, 94, '$accent', rx(4)) + R(44, 54, 8, 10, '$ink', op(0.5))) + G('rotate(8 70 60)', R(66, 6, 8, 94, '$accentAlt', rx(4)) + R(66, 54, 8, 10, '$ink', op(0.5))) + S('M30 98L40 20M90 98L80 20', '$ink', 1.6, op(0.7)), ['sport'], ['ski']),
    amphore: PT(R(34, 92, 52, 8, '$ink', op(0.4)) + P('M50 18L70 18L68 28Q90 40 84 64Q78 86 66 90L54 90Q42 86 36 64Q30 40 52 28Z', '$accentAlt') + S('M52 24Q40 24 40 36M68 24Q80 24 80 36', '$accentAlt', 3) + R(38, 48, 44, 4, '$accent') + S('M42 60L48 54L54 60L60 54L66 60L72 54L78 60', '$ink', 1, op(0.4)) + R(36, 70, 48, 3, '$accent'), ['documentaire']),
    fusee: PT(S('M30 100L30 70M90 100L90 70', '$ink', 2.5, op(0.4)) + P('M60 4Q76 20 76 56L76 84L44 84L44 56Q44 20 60 4Z', '$light') + P('M60 4Q70 14 73 28L47 28Q50 14 60 4Z', '$accentAlt') + C(60, 46, 7, '$sky') + ring(60, 46, 7, '$ink', 1.5, op(0.4)) + P('M44 64L30 86L44 84Z', '$accent') + P('M76 64L90 86L76 84Z', '$accent') + P('M50 84L70 84L64 100L56 100Z', '$accent', op(0.85)), ['evenement'], ['espace']),
    urne: PT(R(26, 44, 68, 56, '$light', op(0.5) + ' ' + rx(3)) + R(26, 44, 68, 56, 'none', 'stroke="$ink" stroke-width="1.5" stroke-opacity="0.3" rx="3"') + R(22, 38, 76, 8, '$accent', rx(2)) + R(50, 40, 20, 3, '$ink', op(0.6)) + field(151, 7, (r, i) => G(`rotate(${n(r() * 40 - 20)} ${36 + i * 8} ${88 - (i % 3) * 6})`, R(30 + i * 8, 82 - (i % 3) * 6, 12, 8, i % 2 ? '$light' : '$skyAlt'))) + P('M54 24L68 24L68 36L54 36Z', '$light') + P('M54 24L61 30L68 24', 'none', 'stroke="$ink" stroke-width="0.8" stroke-opacity="0.4"'), ['evenement'], ['election']),
    tableCommission: PT(R(2, 56, 116, 8, '$ink', op(0.75)) + R(6, 64, 108, 36, '$accent') + R(6, 64, 108, 36, '$ink', op(0.1)) + rep(3, (i) => R(14 + i * 36, 46, 22, 10, '$light') + S(`M${30 + i * 36} 56Q${30 + i * 36} 40 ${36 + i * 36} 36`, '$ink', 1.2) + E(36 + i * 36, 35, 2.4, 1.6, '$ink')), ['evenement'], ['commission', 'enquete']),
    deskGaming: PT(R(6, 60, 108, 6, '$ink', op(0.8)) + S('M14 66L14 100M106 66L106 100', '$ink', 3, op(0.7)) + R(10, 64, 100, 2, '$accentAlt') + rep(2, (i) => R(16 + i * 46, 22, 42, 28, '$ink', rx(2)) + R(19 + i * 46, 25, 36, 22, '$skyAlt') + R(19 + i * 46, 37, 36, 10, '$accentAlt', op(0.35)) + R(35 + i * 46, 50, 4, 10, '$ink', op(0.7))) + R(30, 56, 40, 4, '$ink', op(0.7)) + R(32, 56, 36, 1.2, '$accent') + E(84, 58, 5, 2.4, '$ink', op(0.7)), ['evenement'], ['esport']),
    microPied: PT(C(60, 30, 26, '$accent', op(0.15)) + E(60, 98, 16, 3, '$ink', op(0.85)) + S('M60 98L60 52', '$ink', 2.5) + S('M48 34Q48 52 60 52Q72 52 72 34', '$ink', 2) + R(50, 10, 20, 34, '$light', rx(10)) + S('M50 20L70 20M50 26L70 26M50 32L70 32', '$ink', 0.8, op(0.3)) + R(50, 30, 20, 3, '$accent'), ['evenement'], ['concertweb', 'eurovision', 'miss']),
    sapin: PT(R(54, 86, 12, 14, '$ink', op(0.45)) + P('M60 4L96 88L24 88Z', '$groundAlt') + P('M60 4L82 46L38 46Z', '$ground', op(0.35)) + S('M36 56Q60 64 84 52M30 74Q60 84 90 70', '$accent', 1.6) + rep(7, (i) => C([50, 70, 44, 62, 80, 54, 38][i], [36, 44, 60, 66, 62, 80, 82][i], 3, i % 2 ? '$accent' : '$accentAlt')) + star(60, 6, 8, '$accent') + R(84, 84, 16, 16, '$accentAlt', rx(2)) + R(90, 84, 4, 16, '$light'), ['evenement'], ['noel']),
    peluche: PT(C(36, 30, 10, '$accent') + C(84, 30, 10, '$accent') + C(36, 30, 5, '$light', op(0.5)) + C(84, 30, 5, '$light', op(0.5)) + E(60, 80, 30, 22, '$accent') + C(60, 44, 24, '$accent') + E(60, 52, 10, 7, '$light', op(0.85)) + C(51, 40, 2.6, '$ink') + C(69, 40, 2.6, '$ink') + E(60, 49, 3.5, 2.4, '$ink') + E(36, 96, 10, 6, '$accent') + E(84, 96, 10, 6, '$accent') + P('M48 66L60 72L72 66L72 76L60 72L48 76Z', '$accentAlt'), ['evenement'], ['animation', 'noel']),
    pianoQueue: PT(P('M8 50L60 50Q70 50 80 40Q96 26 108 34Q118 42 108 56Q100 64 100 70L8 70Z', '$ink', op(0.9)) + P('M8 50L20 14L70 34Z', '$ink', op(0.75)) + S('M20 50L40 22', '$ink', 1.5, op(0.6)) + R(8, 62, 40, 6, '$light') + rep(6, (i) => R(10 + i * 6, 62, 3, 3.5, '$ink')) + S('M14 70L14 100M60 70L60 100M96 70L96 100', '$ink', 3, op(0.85)), ['evenement'], ['vienne', 'victoires', 'opera']),
    fauteuilVelours: PT(P('M32 70Q28 20 60 18Q92 20 88 70Z', '$accent') + P('M36 70Q32 26 60 24Q88 26 84 70Z', '$accentAlt') + R(22, 62, 76, 22, '$accentAlt', rx(8)) + R(16, 56, 14, 30, '$accent', rx(6)) + R(90, 56, 14, 30, '$accent', rx(6)) + S('M28 86L24 100M92 86L96 100', '$accent', 3.5), ['evenement'], ['theatre', 'opera', 'royal']),
    cameraCine: PT(S('M56 64L36 100M56 64L76 100M56 64L56 100', '$ink', 2.5, op(0.75)) + ring(38, 22, 13, '$ink', 4) + ring(70, 22, 13, '$ink', 4) + C(38, 22, 3, '$ink') + C(70, 22, 3, '$ink') + R(28, 36, 56, 28, '$ink', rx(3)) + P('M84 42L104 34L104 66L84 58Z', '$ink', op(0.85)) + C(98, 50, 4, '$light', op(0.4)) + C(36, 44, 2, '$accentAlt'), ['cinema']),
    pupitreStatuette: PT(P('M34 54L86 54L80 100L40 100Z', '$ink', op(0.75)) + R(30, 50, 60, 6, '$ink', rx(2)) + R(46, 70, 28, 8, '$accent', op(0.8)) + C(60, 16, 5, '$accent') + P('M55 22L65 22L64 42L56 42Z', '$accent') + R(52, 42, 16, 8, '$ink') + R(56, 24, 2, 14, '$light', op(0.5)), ['cinema']),
    cordons: PT(rep(3, (i) => E(16 + i * 44, 98, 9, 2.5, '$accent') + R(13 + i * 44, 50, 6, 48, '$accent') + C(16 + i * 44, 48, 5, '$accent')) + S('M18 56Q38 76 58 56M62 56Q82 76 102 56', '$accentAlt', 4), ['cinema']),
    projecteurFilm: PT(P('M80 40L120 10L120 80Z', '$light', op(0.25)) + ring(38, 24, 14, '$ink', 4) + ring(66, 22, 11, '$ink', 4) + R(24, 40, 56, 32, '$ink', op(0.85) + ' ' + rx(4)) + R(80, 46, 10, 18, '$ink', rx(2)) + R(30, 72, 44, 8, '$ink', op(0.5)) + S('M40 80L36 100M64 80L68 100', '$ink', 2.5, op(0.7)) + C(40, 56, 3, '$accentAlt'), ['cinema']),
    chaiseRealisateur: PT(S('M34 54L86 100M86 54L34 100', '$ink', 3, op(0.7)) + S('M34 20L34 100M86 20L86 100', '$ink', 3, op(0.75)) + R(34, 22, 52, 18, '$accentAlt') + R(30, 54, 60, 8, '$accentAlt') + S('M30 62L90 62', '$ink', 2, op(0.6)), ['cinema'])
  };

  // ---------- Accessoires au sol (accessory, 50×50) ----------
  const ACCESSORIES = {
    backpack: PT(R(12, 18, 26, 30, '$accent', rx(8)) + R(16, 30, 18, 12, '$ink', op(0.15) + ' ' + rx(3)) + S('M18 18Q25 6 32 18', '$ink', 2.5, op(0.5)) + R(12, 18, 26, 6, '$accentAlt', rx(3)), ['aventure']),
    rocks: PT(E(18, 44, 14, 8, '$groundAlt') + E(36, 46, 10, 6, '$groundAlt', op(0.85)) + E(14, 40, 5, 2, '$light', op(0.25)), ['aventure', 'documentaire']),
    suitcase: PT(R(10, 16, 30, 32, '$accentAlt', rx(4)) + S('M19 16L19 10L31 10L31 16', '$ink', 2.5, op(0.6)) + R(10, 28, 30, 3, '$ink', op(0.2)) + R(14, 20, 6, 6, '$light', op(0.6) + ' ' + rx(3)), ['aventure', 'telerealite', 'policier', 'drame']),
    plant: PT(P('M14 34L36 34L32 50L18 50Z', '$accentAlt') + P('M24 34Q14 18 18 6Q28 18 26 34Z', '$groundAlt') + P('M26 34Q30 16 42 12Q38 26 28 34Z', '$groundAlt') + P('M24 34Q12 26 6 26Q14 34 24 36Z', '$groundAlt'), ['documentaire', 'drame', 'magazine', 'info', 'generique', 'evenement']),
    books: PT(R(6, 40, 38, 9, '$accent', rx(1)) + R(9, 31, 32, 9, '$accentAlt', rx(1)) + R(7, 22, 34, 9, '$sky', rx(1)) + R(36, 22, 2, 27, '$light', op(0.4)), ['documentaire', 'magazine', 'info']),
    cone: PT(R(10, 46, 30, 4, '$accent', rx(1)) + P('M17 46L25 10L33 46Z', '$accent') + R(19, 24, 12, 4, '$light') + R(17, 34, 16, 4, '$light'), ['sport']),
    ballGround: PT(C(25, 38, 11, '$light') + ring(25, 38, 11, '$ink', 1, op(0.3)) + P('M25 33L30 37L28 43L22 43L20 37Z', '$ink', op(0.8)), ['sport']),
    ferACheval: PT(S('M15 48L15 30Q15 16 25 16Q35 16 35 30L35 48', '$ink', 5, op(0.6)) + rep(4, (i) => C(15 + (i % 2) * 20, 26 + Math.floor(i / 2) * 12, 1, '$light')), ['sport'], ['hippisme']),
    haie: PT(S('M6 48L6 22M44 48L44 22', '$ink', 2, op(0.6)) + R(4, 18, 42, 8, '$light') + R(4, 18, 10, 8, '$accentAlt') + R(24, 18, 10, 8, '$accentAlt') + S('M2 48L10 48M40 48L48 48', '$ink', 2, op(0.6)), ['sport'], ['athletisme']),
    tyres: PT(ring(25, 42, 11, '$ink', 7) + ring(25, 28, 11, '$ink', 7, op(0.85)) + ring(25, 28, 7, '$light', 1, op(0.3)), ['sport'], ['auto']),
    basket: PT(P('M8 30L42 30L38 48L12 48Z', '$accentAlt') + S('M10 36L40 36M11 42L39 42', '$ink', 1, op(0.25)) + S('M12 30Q25 10 38 30', '$ink', 2, op(0.5)) + C(18, 27, 5, '$accent') + C(28, 26, 5, '$groundAlt') + E(23, 30, 5, 2, '$light'), ['cuisine', 'dating']),
    veggies: PT(P('M10 46Q4 36 14 30Q22 34 18 46Z', '$accent') + S('M14 30L12 22M14 30L18 24', '$groundAlt', 2) + C(30, 40, 9, '$accentAlt') + S('M30 31L32 26', '$groundAlt', 2) + E(42, 44, 6, 5, '$groundAlt'), ['cuisine']),
    float: PT(E(25, 40, 20, 9, '$accent') + E(25, 39, 9, 3.6, '$ground') + P('M9 36Q12 32 18 33L16 38Z', '$light', op(0.9)) + P('M32 32Q38 32 41 35L35 37Z', '$light', op(0.9)), ['dating', 'telerealite']),
    hydrant: PT(R(15, 20, 20, 30, '$accentAlt', rx(3)) + P('M15 20Q15 8 25 8Q35 8 35 20Z', '$accentAlt') + R(9, 26, 32, 7, '$accentAlt', rx(3)) + R(13, 46, 24, 4, '$ink', op(0.4)) + C(25, 30, 3, '$light', op(0.5)), ['policier']),
    clapperGround: PT(R(8, 26, 34, 22, '$ink', rx(2)) + G('rotate(-16 8 26)', R(8, 18, 34, 8, '$ink') + rep(4, (i) => P(`M${10 + i * 8} 18L${14 + i * 8} 18L${12 + i * 8} 26L${8 + i * 8} 26Z`, '$light'))) + rep(4, (i) => P(`M${10 + i * 8} 26L${14 + i * 8} 26L${12 + i * 8} 31L${8 + i * 8} 31Z`, '$light')) + S('M12 38L36 38M12 43L30 43', '$light', 1, op(0.6)), ['drame', 'cinema']),
    speaker: PT(R(10, 6, 30, 44, '$ink', op(0.85) + ' ' + rx(3)) + C(25, 18, 6, '$light', op(0.25)) + C(25, 36, 9, '$light', op(0.25)) + C(25, 36, 4, '$ink') + C(25, 18, 2.5, '$ink'), ['talent', 'humour', 'divertissement', 'jeunesse']),
    moneyBag: PT(P('M17 18Q4 32 10 44Q14 50 25 50Q36 50 40 44Q46 32 33 18Z', '$accent') + P('M17 18L20 10L30 10L33 18Z', '$accent') + S('M17 18L33 18', '$ink', 2, op(0.5)) + P('M28 26Q20 26 21 31Q22 35 26 35Q31 36 30 40Q28 44 21 42M25 24L25 46', 'none', 'stroke="$ink" stroke-width="2" stroke-opacity="0.45" stroke-linecap="round"'), ['divertissement', 'jeu']),
    toys: PT(R(6, 30, 18, 18, '$accent', rx(3)) + C(15, 39, 4, '$light') + C(34, 40, 9, '$accentAlt') + S('M26 40L42 40', '$light', 2) + R(18, 18, 14, 12, '$sky', rx(2)), ['jeunesse']),
    pileDossiers: PT(R(8, 40, 34, 9, '$accent', rx(1)) + R(10, 31, 32, 9, '$light') + R(8, 22, 34, 9, '$accentAlt', rx(1)) + R(11, 14, 30, 8, '$light') + S('M14 35L36 35M14 18L34 18', '$ink', 0.8, op(0.3)), ['evenement'], ['commission', 'enquete', 'debat', 'goncourt']),
    cadeaux: PT(R(4, 28, 22, 22, '$accent', rx(2)) + R(13, 28, 4, 22, '$light') + R(26, 34, 20, 16, '$accentAlt', rx(2)) + R(34, 34, 4, 16, '$light') + P('M15 28Q8 18 10 24Q12 28 15 28Q18 28 20 24Q22 18 15 28Z', '$light'), ['evenement'], ['noel']),
    manette: PT(P('M8 34Q8 26 16 26L34 26Q42 26 42 34L44 44Q44 50 38 48L32 42L18 42L12 48Q6 50 6 44Z', '$ink', op(0.85)) + S('M14 34L20 34M17 31L17 37', '$light', 1.5) + C(32, 32, 1.8, '$accent') + C(36, 36, 1.8, '$accentAlt'), ['evenement'], ['esport']),
    batonsLumineux: PT(G('rotate(-25 18 30)', R(15, 10, 6, 34, '$accent', rx(3)) + R(15, 10, 6, 34, '$light', op(0.35) + ' ' + rx(3))) + G('rotate(20 32 32)', R(29, 12, 6, 34, '$accentAlt', rx(3)) + R(29, 12, 6, 34, '$light', op(0.35) + ' ' + rx(3))), ['evenement'], ['eurovision', 'concertweb']),
    diademe: PT(E(25, 48, 16, 2.5, '$ink', op(0.12)) + P('M8 44Q25 34 42 44L40 46Q25 38 10 46Z', '$light') + P('M14 40L18 30L22 38L25 24L28 38L32 30L36 40Z', '$light') + C(25, 26, 2, '$accentAlt') + C(18, 32, 1.3, '$accent') + C(32, 32, 1.3, '$accent'), ['evenement'], ['miss']),
    coussinCouronne: PT(P('M4 44Q25 34 46 44Q25 52 4 44Z', '$accentAlt') + C(6, 46, 2, '$accent') + C(44, 46, 2, '$accent') + P('M14 38L14 26L19 31L25 22L31 31L36 26L36 38Z', '$accent') + C(25, 30, 1.6, '$accentAlt'), ['evenement'], ['royal']),
    popcornSeau: PT(P('M12 22L38 22L34 50L16 50Z', '$light') + rep(3, (i) => P(`M${15 + i * 8} 22L${19 + i * 8} 22L${18 + i * 6} 50L${16 + i * 6} 50Z`, '$accentAlt')) + rep(6, (i) => C(13 + i * 5, 20 - (i % 2) * 3, 4, '$light', 'stroke="$ink" stroke-opacity="0.12"')), ['cinema']),
    bobine: PT(C(25, 30, 18, '$ink', op(0.85)) + rep(5, (i) => C(25 + Math.cos(i * 1.2566) * 9, 30 + Math.sin(i * 1.2566) * 9, 3.6, '$skyAlt')) + C(25, 30, 2.5, '$skyAlt') + S('M40 40Q46 48 30 49L4 49', '$ink', 2.5, op(0.7)), ['cinema']),
    buzzerStand: PT(R(14, 30, 22, 20, '$ink', op(0.85) + ' ' + rx(2)) + E(25, 30, 13, 4, '$ink') + P('M15 30Q15 18 25 18Q35 18 35 30Z', '$accentAlt') + E(21, 22, 2.5, 1.4, '$light', op(0.6)), ['jeu'])
  };

  // ---------- Personnage (boîte 60×110, pieds à y = 110) ----------
  const shoes = (a, b) => R(a - 6, 104, 12, 6, '$light', rx(3)) + R(b - 6, 104, 12, 6, '$light', rx(3)) + R(a - 6, 108.6, 12, 1.4, '$ink', op(0.2)) + R(b - 6, 108.6, 12, 1.4, '$ink', op(0.2));
  const U = (svg) => ({ svg, tags: [] });
  const LEGS = {
    pants: U(R(22, 64, 7.6, 42, '$bottom', rx(3)) + R(30.4, 64, 7.6, 42, '$bottom', rx(3)) + shoes(24, 36)),
    stride: U(R(21, 62, 18, 9, '$bottom', rx(3)) + S('M26 67L19 104', '$bottom', 7.6) + S('M34 67L41 104', '$bottom', 7.6) + shoes(18, 42)),
    shorts: U(R(23, 72, 6, 34, '$skin', rx(3)) + R(31, 72, 6, 34, '$skin', rx(3)) + R(21, 63, 18, 17, '$bottom', rx(3)) + S('M30 70L30 80', '$ink', 0.8, op(0.25)) + R(23, 98, 6, 6, '$light', op(0.9)) + R(31, 98, 6, 6, '$light', op(0.9)) + shoes(25, 35)),
    jeans: U(R(22, 64, 7.6, 42, '$bottom', rx(3)) + R(30.4, 64, 7.6, 42, '$bottom', rx(3)) + S('M25.8 72L25.8 100M34.2 72L34.2 100', '$light', 0.6, op(0.3)) + R(22, 99, 16, 2.5, '$light', op(0.22)) + shoes(24, 36))
  };
  const neck = R(26.5, 24, 7, 8, '$skin');
  const tee = P('M17 36Q17 30 23 30L37 30Q43 30 43 36L42 70L18 70Z', '$top');
  const TORSO = {
    tee: U(neck + tee + P('M26 30L30 34.5L34 30Z', '$skin')),
    jacket: U(neck + tee + P('M25.5 30L30 48L34.5 30Z', '$light') + S('M25.5 30L29 50L25 70M34.5 30L31 50L35 70', '$ink', 0.9, op(0.3)) + C(29.6, 55, 0.9, '$ink', op(0.35)) + C(29.6, 62, 0.9, '$ink', op(0.35)) + S('M20 58L25 58', '$ink', 0.8, op(0.25))),
    hoodie: U(neck + tee + P('M21.5 31Q30 40 38.5 31Q36 26.5 30 26.5Q24 26.5 21.5 31Z', '$top') + P('M21.5 31Q30 40 38.5 31Q36 26.5 30 26.5Q24 26.5 21.5 31Z', '$ink', op(0.15)) + S('M27.5 36L27 44M32.5 36L33 44', '$light', 0.9, op(0.8)) + P('M23 56L37 56L35 66L25 66Z', '$ink', op(0.1))),
    dress: U(neck + P('M18 36Q18 30 23 30L37 30Q42 30 42 36L41 54L48 88L12 88L19 54Z', '$top') + P('M26 30L30 34.5L34 30Z', '$skin') + R(19, 52, 22, 3, '$ink', op(0.18)) + P('M19 54L12 88L22 88Z', '$ink', op(0.06))),
    stripes: U(neck + tee + P('M26 30L30 34.5L34 30Z', '$skin') + rep(4, (i) => R(17.6, 39 + i * 8, 24.8, 3.2, '$light', op(0.55))))
  };
  const TORSO_F = { tee: TORSO.tee, jacket: TORSO.jacket, hoodie: TORSO.hoodie, dress: TORSO.dress, stripes: TORSO.stripes };
  const TORSO_M = { tee: TORSO.tee, jacket: TORSO.jacket, hoodie: TORSO.hoodie, stripes: TORSO.stripes };
  const hand = (x, y, r) => C(x, y, r || 3.6, '$skin');
  const ARM_LEFT = {
    down: U(S('M20 34L14 58', '$top', 6.5) + hand(13.5, 60)),
    wave: U(S('M20 34Q9 30 9 15', '$top', 6.5) + hand(9, 12) + S('M4 8Q2 12 4 16M1 6Q-2 12 1 18', '$ink', 0.8, op(0.3))),
    point: U(S('M20 34Q10 38 3 38', '$top', 6.5) + hand(1.5, 38) + S('M0 37.5L-4 37', '$skin', 2.4)),
    hip: U(S('M20 34L11 47L19 56', '$top', 6.5) + hand(19.5, 56.5)),
    fist: U(S('M20 34L12 20', '$top', 6.5) + hand(11, 15.5, 4.4) + S('M9 14L13 14M9 16.5L13 16.5', '$ink', 0.6, op(0.25)))
  };
  const ARM_RIGHT = { hold: U(S('M40 34L45 50L49 55', '$top', 6.5) + hand(50, 56) + '{handheld}') };
  const HEAD = { round: U(C(19, 19, 3, '$skin') + C(41, 19, 3, '$skin') + C(30, 18, 11, '$skin') + C(23.5, 22, 2.3, '$accentAlt', op(0.3)) + C(36.5, 22, 2.3, '$accentAlt', op(0.3)) + '{face}') };
  const eyes = C(26, 17, 1.3, '$ink') + C(34, 17, 1.3, '$ink');
  const smile = S('M27 22.4Q30 25.4 33 22.4', '$ink', 1.2);
  const FACE = {
    smile: eyes + smile,
    laugh: S('M24.6 17.6Q26 15.8 27.4 17.6M32.6 17.6Q34 15.8 35.4 17.6', '$ink', 1.2) + P('M26.5 21.5L33.5 21.5Q33.5 26.2 30 26.2Q26.5 26.2 26.5 21.5Z', '$ink') + P('M28 24.6Q30 23.4 32 24.6Q31 26 30 26Q29 26 28 24.6Z', '$accentAlt'),
    glasses: ring(26, 17, 3.1, '$ink', 1) + ring(34, 17, 3.1, '$ink', 1) + S('M29.1 17L30.9 17M22.9 16.5L20 15.5M37.1 16.5L40 15.5', '$ink', 0.9) + C(26, 17, 1, '$ink') + C(34, 17, 1, '$ink') + smile,
    wow: C(26, 17, 1.6, '$ink') + C(34, 17, 1.6, '$ink') + C(26.5, 16.4, 0.5, '$light') + C(34.5, 16.4, 0.5, '$light') + E(30, 23.6, 1.7, 2.1, '$ink') + S('M24 13.4L27.5 12.8M32.5 12.8L36 13.4', '$ink', 0.8),
    wink: C(26, 17, 1.3, '$ink') + S('M32.6 17.4Q34 16 35.4 17.4', '$ink', 1.2) + S('M27 22.8Q30.5 25.4 33.5 21.8', '$ink', 1.2)
  };
  const lashes = S('M24.6 16.2L23.4 15.1M35.4 16.2L36.6 15.1', '$ink', 0.8);
  const U2 = (s) => U(s);
  const FACE_F = {}; Object.keys(FACE).forEach((k) => { FACE_F[k] = U2(FACE[k] + lashes); });
  const FACE_M = {}; Object.keys(FACE).forEach((k) => { FACE_M[k] = U2(FACE[k]); });
  FACE_M.beard = U(eyes + P('M19.4 18.5Q19.6 31.5 30 31.5Q40.4 31.5 40.6 18.5Q38.5 25 30 25.4Q21.5 25 19.4 18.5Z', '$hair') + S('M27.6 26.6Q30 27.8 32.4 26.6', '$light', 0.9, op(0.7)));
  FACE_M.mustache = U(eyes + P('M25.4 22.6Q28 20.4 30 22Q32 20.4 34.6 22.6Q32 24.2 30 23.2Q28 24.2 25.4 22.6Z', '$hair') + S('M28.4 25.6L31.6 25.6', '$ink', 0.9, op(0.6)));
  const HAIR_F = {
    bob: U(P('M16.5 20Q16 4.5 30 4.5Q44 4.5 43.5 20L43.5 31Q40 32.5 37 31L23 31Q20 32.5 16.5 31Z', '$hair') + '{head}' + P('M18.6 17Q19 6.2 30 6.2Q41 6.2 41.4 17Q37 11.5 31 12.8Q27 10.5 23.5 13.5Q20.5 14.5 18.6 17Z', '$hair')),
    long: U(P('M16 20Q15.5 4.5 30 4.5Q44.5 4.5 44 20L45.5 44Q40 47 36 44L24 44Q20 47 14.5 44Z', '$hair') + '{head}' + P('M18.6 18Q19 6 30 6Q41 6 41.4 18Q40 12 34 10.5Q28 13 18.6 18Z', '$hair')),
    bun: U(C(30, 3.6, 5.6, '$hair') + '{head}' + P('M18.8 16Q19 6 30 6Q41 6 41.2 16Q36 10.5 30 11Q24 10.5 18.8 16Z', '$hair') + R(26, 7, 8, 1.8, '$accent', rx(0.9))),
    ponytail: U(P('M39 9Q53 11 50 35Q45.5 28 41.5 21Z', '$hair') + '{head}' + P('M18.8 16Q19 6 30 6Q41 6 41.2 16Q36 10.5 30 11Q24 10.5 18.8 16Z', '$hair') + C(41.4, 11.2, 2, '$accent')),
    curly: U(C(19, 12, 6, '$hair') + C(25, 6, 6, '$hair') + C(35, 6, 6, '$hair') + C(41, 12, 6, '$hair') + C(17, 22, 5.5, '$hair') + C(43, 22, 5.5, '$hair') + C(18, 30, 5, '$hair') + C(42, 30, 5, '$hair') + '{head}' + C(22, 10, 4.5, '$hair') + C(28, 8, 4.5, '$hair') + C(34, 8, 4.5, '$hair') + C(39, 11, 4, '$hair'))
  };
  const shortCut = P('M18.8 17Q18.5 5.5 30 5.5Q41.5 5.5 41.2 17Q40 12 36 11Q30 13 24 11Q20 12 18.8 17Z', '$hair');
  const HAIR_M = {
    short: U('{head}' + shortCut),
    quiff: U('{head}' + shortCut + P('M23 9.5Q27 0 39.5 4Q35 5.5 33 9.5Z', '$hair')),
    curly: U('{head}' + C(21, 12, 4.5, '$hair') + C(26, 8, 4.8, '$hair') + C(32, 7.5, 4.8, '$hair') + C(37.5, 9.5, 4.6, '$hair') + C(40.5, 14, 3.8, '$hair') + C(19.5, 16, 3, '$hair')),
    bald: U('{head}' + P('M18.6 21Q18.4 15 20.6 13L21.8 21Z', '$hair') + P('M41.4 21Q41.6 15 39.4 13L38.2 21Z', '$hair') + E(25, 10.5, 3, 1.6, '$light', op(0.4)))
  };
  const H = (svg, genres, subs) => ST(svg, genres, subs);
  const HEADWEAR = {
    explorer: H(E(30, 8, 17, 3.2, '$groundAlt') + P('M20.5 8Q21-2 30-2Q39-2 39.5 8Z', '$groundAlt') + R(20.8, 4.4, 18.4, 2.6, '$ink', op(0.3)) + P('M20.5 8Q21-2 30-2Q39-2 39.5 8Z', '$light', op(0.15)), ['documentaire', 'aventure']),
    beanie: H(P('M18.5 13Q18 1 30 1Q42 1 41.5 13Z', '$accent') + R(18, 10.5, 24, 4.5, '$accent', rx(2)) + R(18, 10.5, 24, 4.5, '$ink', op(0.12) + ' ' + rx(2)) + C(30, 0, 3, '$light'), ['aventure', 'sport']),
    cap: H(P('M19 12Q19 2 30 2Q41 2 41 12Z', '$accentAlt') + P('M36 10.5Q48 9.5 50.5 12.8L36 13Z', '$accentAlt') + P('M36 10.5Q48 9.5 50.5 12.8L36 13Z', '$ink', op(0.2)) + C(30, 2.4, 1.4, '$ink', op(0.3)), ['telerealite', 'sport', 'jeunesse']),
    helmet: H(P('M17.5 14Q17-1 30-1Q43-1 42.5 14Z', '$accentAlt') + R(28, -1, 4, 15, '$light', op(0.6)) + R(17.5, 12, 25, 2.5, '$ink', op(0.25)), ['sport']),
    toque: H(R(20, 3, 20, 7, '$light') + C(22, -1, 6, '$light') + C(30, -4, 7, '$light') + C(38, -1, 6, '$light') + R(20, 8, 20, 1.2, '$ink', op(0.1)) + S('M26 2L26 7M34 2L34 7', '$ink', 0.6, op(0.12)), ['cuisine']),
    flower: H(C(40, 5.5, 2.6, '$accentAlt') + C(43.5, 8.5, 2.6, '$accentAlt') + C(42, 12.5, 2.6, '$accentAlt') + C(38, 12.5, 2.6, '$accentAlt') + C(36.5, 8.5, 2.6, '$accentAlt') + C(40, 9.3, 2, '$accent'), ['telerealite', 'dating']),
    party: H(P('M23 7L30-14L37 7Z', '$accent') + C(28.5, -2, 1.3, '$light') + C(32, 2.5, 1.3, '$light') + C(29, 4.5, 1, '$accentAlt') + C(30, -14.5, 2.6, '$accentAlt') + S('M23 7Q30 9 37 7', '$ink', 0.6, op(0.3)), ['divertissement', 'humour', 'jeunesse']),
    fedora: H(E(30, 8.5, 17, 3, '$ink', op(0.85)) + P('M21 8.5Q21-1 30-1.5Q39-1 39 8.5Z', '$ink', op(0.85)) + R(21.3, 4.6, 17.4, 2.6, '$accentAlt') + S('M27 0Q30 2 33 0', '$light', 0.6, op(0.2)), ['policier']),
    headset: H(S('M18 19Q17 2 30 2Q43 2 42 19', '$ink', 2.2) + R(15, 15, 5, 9, '$ink', rx(2)) + R(40, 15, 5, 9, '$ink', rx(2)) + S('M17.5 22Q19 28 25 25.5', '$ink', 1.3) + C(25.5, 25.3, 1.4, '$accentAlt'), ['talent', 'info', 'magazine', 'generique', 'jeu', 'evenement']),
    crown: H(P('M20 9L20 0L25 5L30-2L35 5L40 0L40 9Z', '$accent') + C(30, 3.5, 1.5, '$accentAlt') + C(25, 6, 1, '$light') + C(35, 6, 1, '$light') + R(20, 7.5, 20, 1.5, '$ink', op(0.15)), ['talent', 'divertissement'])
  };
  const HANDHELD = {
    mic: H(R(48.6, 51, 2.8, 11, '$ink', rx(1.2)) + C(50, 48.6, 3.8, '$ink', op(0.85)) + S('M47.2 47.6L52.8 47.6M47 49.8L53 49.8', '$light', 0.5, op(0.4)) + R(48, 53.4, 4, 1.6, '$accentAlt'), ['talent', 'divertissement', 'humour', 'info', 'magazine', 'generique', 'jeu', 'telerealite', 'cinema', 'evenement']),
    trophy: H(P('M44 34L56 34Q56 45 50 46Q44 45 44 34Z', '$accent') + S('M44 36Q40 36 41 40Q42 43 45 42M56 36Q60 36 59 40Q58 43 55 42', '$accent', 1.4) + R(48.8, 45.5, 2.4, 6, '$accent') + R(45.5, 51, 9, 3, '$accent', rx(1)) + R(46, 35.5, 1.6, 7, '$light', op(0.5)), ['talent', 'divertissement', 'jeu', 'sport']),
    glass: H(P('M46.6 37L53.4 37L51.6 48L48.4 48Z', '$light', op(0.75)) + P('M47.2 40.5L52.8 40.5L51.6 48L48.4 48Z', '$accent') + R(49.4, 48, 1.2, 8, '$light', op(0.9)) + E(50, 56.5, 3, 0.9, '$light'), ['divertissement', 'dating']),
    balloon: H(S('M50 56Q53 44 51 32', '$ink', 0.6, op(0.5)) + E(52, 22, 8, 10, '$accentAlt') + P('M50.5 31.5L53.5 31.5L52 33.6Z', '$accentAlt') + E(49, 18, 2, 3.5, '$light', op(0.5)), ['divertissement', 'jeunesse']),
    phone: H(R(46, 45, 8, 13, '$ink', rx(1.6)) + R(47, 46.5, 6, 9, '$skyAlt') + C(50, 56.7, 0.6, '$light'), ['humour', 'magazine', 'telerealite', 'jeunesse']),
    cue: H(G('rotate(-12 50 50)', R(44, 42, 12, 16, '$light', rx(1)) + R(44, 42, 12, 2.6, '$accent') + S('M46 47L54 47M46 50L53 50M46 53L52 53', '$ink', 0.6, op(0.4))), ['info', 'magazine', 'jeu']),
    notebook: H(R(44, 43, 12, 15, '$accent', rx(1)) + R(46, 45, 8, 11, '$light', op(0.9)) + S('M47.5 48L52.5 48M47.5 50.5L52.5 50.5M47.5 53L51 53', '$ink', 0.6, op(0.35)) + rep(5, (i) => C(44, 45 + i * 2.6, 0.7, '$ink', op(0.6))), ['info', 'policier', 'documentaire', 'evenement']),
    mug: H(R(45, 47, 9, 10, '$light', rx(1.5)) + S('M54 49.5Q57.5 50 57.5 52.5Q57.5 55 54 55', '$light', 1.6) + R(45, 49, 9, 2.5, '$accentAlt') + S('M48 44Q47 42 48.5 40M51 44Q50 42 51.5 40', '$light', 0.8, op(0.7)), ['info', 'magazine', 'generique']),
    script: H(G('rotate(8 50 50)', R(45.5, 38.5, 12, 17, '$light', op(0.7)) + R(43.5, 40, 12, 17, '$light') + S('M45.5 44L53 44M45.5 47L53 47M45.5 50L51 50', '$ink', 0.6, op(0.35))), ['magazine', 'drame']),
    buzzer: H(E(50, 52, 6, 2.2, '$ink') + R(44, 49, 12, 3, '$ink') + P('M45 49Q45 43 50 43Q55 43 55 49Z', '$accentAlt') + E(48, 45.5, 1.3, 0.8, '$light', op(0.6)), ['jeu']),
    camera: H(R(41, 46, 15, 11, '$ink', rx(2)) + C(47, 51.5, 3.8, '$light', op(0.9)) + C(47, 51.5, 2.2, '$ink') + R(52, 44, 3, 2, '$ink') + C(54, 48.5, 0.9, '$accentAlt'), ['telerealite', 'documentaire', 'aventure']),
    clapper: H(R(42, 46, 15, 11, '$ink', rx(1)) + G('rotate(-18 42 46)', R(42, 42, 15, 4, '$ink') + rep(3, (i) => P(`M${43.5 + i * 4.5} 42L${45.5 + i * 4.5} 42L${44.5 + i * 4.5} 46L${42.5 + i * 4.5} 46Z`, '$light'))) + S('M44 51L55 51M44 54L51 54', '$light', 0.6, op(0.6)), ['cinema', 'drame']),
    statuette: H(C(50, 36.5, 2.6, '$accent') + P('M47.5 39.5L52.5 39.5L51.5 50L48.5 50Z', '$accent') + R(46.5, 50, 7, 3, '$ink', op(0.7)) + R(48.6, 40, 1, 8, '$light', op(0.5)), ['cinema']),
    popcorn: H(P('M44 46L56 46L54.5 59L45.5 59Z', '$light') + P('M46.5 46L48.6 46L48.2 59L46.8 59ZM51.4 46L53.5 46L53.2 59L51.8 59Z', '$accentAlt') + rep(5, (i) => C([46, 50, 54, 48, 52][i], [44.5, 43.5, 44.5, 42, 41.8][i], [2.5, 2.8, 2.5, 2.2, 2.2][i], '$light', 'stroke="$ink" stroke-opacity="0.15" stroke-width="0.6"')), ['cinema']),
    magnifier: H(S('M50 57L53.5 49', '$ink', 2.4) + C(56, 43, 6, '$light', op(0.45)) + ring(56, 43, 6, '$ink', 2), ['policier', 'documentaire']),
    map: H(P('M41 44L47 42L53 44L59 42L59 54L53 56L47 54L41 56Z', '$light') + S('M47 42L47 54M53 44L53 56', '$ink', 0.5, op(0.2)) + S('M43 52Q48 46 55 48', '$accentAlt', 0.9, 'stroke-dasharray="1.6 1.4"') + S('M55.5 46.5L57.5 48.5M57.5 46.5L55.5 48.5', '$accentAlt', 0.9), ['documentaire', 'aventure']),
    compass: H(C(50, 49, 6, '$accent') + C(50, 49, 4.6, '$light') + P('M50 45L51.3 49L50 53L48.7 49Z', '$accentAlt') + C(50, 42.5, 1.2, '$accent'), ['aventure']),
    torch: H(S('M50 60L50 44', '$ink', 2.4, op(0.6)) + P('M47 44Q46 37 50 31Q54 37 53 44Z', '$accent') + P('M48.5 44Q48 40 50 36Q52 40 51.5 44Z', '$accentAlt'), ['aventure']),
    football: H(C(51, 48, 6.5, '$light') + ring(51, 48, 6.5, '$ink', 0.6, op(0.3)) + P('M51 45L53.6 47L52.6 50L49.4 50L48.4 47Z', '$ink', op(0.85)), ['sport'], ['football']),
    basketball: H(C(51, 48, 6.5, '$accent') + S('M44.5 48L57.5 48M51 41.5L51 54.5M46.4 43.4Q49 48 46.4 52.6M55.6 43.4Q53 48 55.6 52.6', '$ink', 0.6, op(0.6)), ['sport'], ['basket']),
    rugby: H(G('rotate(-30 51 47)', E(51, 47, 8, 5, '$accentAlt') + S('M47 47L55 47M49 45.6L49 48.4M51 45.6L51 48.4M53 45.6L53 48.4', '$light', 0.7)), ['sport'], ['rugby']),
    handball: H(C(51, 48, 6, '$light') + S('M45.4 46Q51 49 56.6 46M46 51Q51 47 56 51', '$accentAlt', 1), ['sport'], ['handball']),
    racket: H(S('M50 60L50 50', '$ink', 2) + E(50, 41, 6, 8, 'none', 'stroke="$accent" stroke-width="1.6"') + S('M47 35L47 47M50 33L50 49M53 35L53 47M44.5 38L55.5 38M44 41L56 41M44.5 44L55.5 44', '$ink', 0.4, op(0.35)), ['sport'], ['tennis']),
    flag: H(S('M50 60L50 30', '$ink', 1.2) + P('M50 31Q55 29 60 32Q65 35 70 32L70 42Q65 45 60 42Q55 39 50 41Z', '$accent') + P('M50 36Q55 34 60 37Q65 40 70 37L70 40Q65 43 60 40Q55 37 50 39Z', '$accentAlt', op(0.9)), ['sport']),
    gloves: H(E(51, 54, 6.6, 7, '$accentAlt') + E(47, 52, 3, 3.4, '$accentAlt') + R(46, 59.5, 10, 4, '$light') + E(53, 51, 2, 3, '$light', op(0.3)), ['sport'], ['combat']),
    flambeau: H(P('M47.5 42L52.5 42L50.8 60L49.2 60Z', '$accent') + R(46.5, 40, 7, 3, '$accent') + P('M47 40Q46 33 50 27Q54 33 53 40Z', '$accentAlt') + P('M48.6 40Q48.4 36 50 33Q51.6 36 51.4 40Z', '$accent'), ['sport'], ['athletisme']),
    spatula: H(S('M50 60L50 44', '$ink', 1.6, op(0.7)) + R(46.5, 34, 7, 10, '$light', rx(1.5)) + S('M48.5 36L48.5 41M51.5 36L51.5 41', '$ink', 0.6, op(0.3)), ['cuisine']),
    whisk: H(S('M50 60L50 46', '$ink', 2, op(0.7)) + S('M50 46Q43 37 50 29Q57 37 50 46M50 46Q46.5 37 50 29Q53.5 37 50 46', '$ink', 0.7, op(0.6)), ['cuisine']),
    plate: H(E(51, 53, 9, 2.6, '$light') + ring(51, 52.6, 6, '$ink', 0.5, op(0.1)) + C(49, 50, 3, '$accent') + C(53.5, 50.5, 2.4, '$groundAlt') + E(51, 48.6, 2, 1.2, '$accentAlt'), ['cuisine']),
    rose: H(S('M50 60Q49 50 50 40', '$groundAlt', 1.2) + P('M50 49Q45 46 44 48Q46 51 50 50Z', '$groundAlt') + C(50, 38, 3.6, '$accentAlt') + S('M48.8 37.6Q50 36 51.4 37.6Q50.6 39.6 49 38.8', '$light', 0.6, op(0.5)), ['dating']),
    lollipop: H(S('M50 58L50 42', '$light', 1.4) + C(50, 36, 6.5, '$accent') + S('M50 36m-4 0a4 4 0 1 1 4 4a2.4 2.4 0 1 1-2.4-2.4', '$light', 1), ['jeunesse'])
  };

  // ---------- Surcouches (decor, 320×180) ----------
  const DECOR = {
    confetti: ST(field(201, 46, (r) => { const x = r() * 320, y = r() * 100; return G(`rotate(${n(r() * 180)} ${n(x)} ${n(y)})`, R(x, y, 4, 2, ['$accent', '$accentAlt', '$light', '$sky'][Math.floor(r() * 4)])); }), ['divertissement', 'jeu', 'talent', 'jeunesse', 'humour', 'telerealite']),
    confetti2: ST(field(203, 9, (r) => { const x = r() * 320, y = r() * 60; return S(`M${n(x)} ${n(y)}q6 8 0 14t0 14`, ['$accent', '$accentAlt', '$light'][Math.floor(r() * 3)], 1.6); }) + field(207, 24, (r) => C(r() * 320, r() * 90, 1.6, ['$accent', '$accentAlt', '$light'][Math.floor(r() * 3)])), ['divertissement', 'jeu', 'talent', 'jeunesse']),
    sparkles: ST(field(211, 12, (r) => spark(r() * 320, 8 + r() * 80, 3 + r() * 4, '$light', op(0.85))), ['divertissement', 'talent', 'jeunesse', 'generique', 'magazine', 'dating', 'cinema']),
    notes: ST(field(213, 7, (r) => { const x = 10 + r() * 300, y = 18 + r() * 60; return E(x, y + 10, 3.4, 2.6, '$light', op(0.85) + ` transform="rotate(-20 ${n(x)} ${n(y + 10)})"`) + S(`M${n(x + 3)} ${n(y + 9)}L${n(x + 3)} ${n(y - 4)}l5 2`, '$light', 1.3, op(0.85)); }), ['divertissement', 'talent', 'jeunesse', 'humour']),
    stars: ST(field(217, 10, (r) => star(r() * 320, 6 + r() * 70, 2.5 + r() * 3.5, '$accent', op(0.85))), ['talent', 'humour', 'dating', 'cinema', 'drame', 'policier', 'info', 'evenement']),
    clouds: ST(cloud(40, 22, 0.8) + cloud(170, 14, 0.6) + cloud(282, 28, 0.9), ['jeunesse', 'telerealite', 'generique', 'magazine', 'aventure', 'documentaire', 'sport']),
    hearts: ST(field(219, 9, (r) => heart(r() * 320, 10 + r() * 70, 0.7 + r() * 0.7, '$accentAlt', op(0.85))), ['dating']),
    bokeh: ST(field(223, 14, (r) => C(r() * 320, r() * 110, 4 + r() * 12, '$light', op(0.1 + r() * 0.12))), ['dating', 'drame', 'policier', 'info', 'evenement']),
    flashs: ST(field(227, 5, (r) => { const x = r() * 320, y = 10 + r() * 60; return C(x, y, 9, '$light', op(0.25)) + spark(x, y, 9, '$light', op(0.9)); }), ['cinema', 'evenement']),
    birds: ST(field(229, 5, (r) => { const x = 20 + r() * 280, y = 10 + r() * 40; return S(`M${n(x - 5)} ${n(y)}q2.5-3 5 0q2.5-3 5 0`, '$ink', 1.1, op(0.5)); }), ['aventure', 'documentaire', 'drame', 'sport']),
    leaves: ST(field(231, 7, (r) => { const x = r() * 320, y = r() * 90; return G(`rotate(${n(r() * 360)} ${n(x)} ${n(y)})`, P(`M${n(x)} ${n(y)}q4-5 8 0q-4 5-8 0Z`, '$groundAlt', op(0.85))); }), ['aventure', 'documentaire', 'cuisine']),
    steam: ST(S('M150 54q-6-8 0-16t0-16M162 50q-6-8 0-16t0-16M174 54q-6-8 0-16t0-16', '$light', 2, op(0.55)), ['cuisine'])
  };

  // ---------- Compositions ----------
  const COMPOSITIONS = {
    duo: { weight: 3, prop: [160, 1], acc: null, p1: [74, 1], p2: [246, 1] },
    hostLeft: { weight: 2, prop: [196, 1], acc: [290, 0.9], p1: [86, 1], p2: null },
    hostRight: { weight: 2, prop: [126, 1], acc: [32, 0.9], p1: null, p2: [240, 1] },
    center: { weight: 2, prop: [76, 0.82], acc: [260, 1], p1: [170, 1], p2: null },
    trio: { weight: 1, prop: [244, 0.9], acc: [30, 0.8], p1: [92, 1], p2: [150, 0.94] }
  };

  // ---------- Palettes, genres ----------
  const PALETTES = {
    jour: ['cfeefa', 'eef9fd', '9bd48a', '74bb6c', 'ffb547', 'ff7a59', '263238', 'ffffff'],
    aube: ['ffd2b8', 'ffeadb', 'e9b48a', 'd39468', 'ff8a65', '7e57c2', '3e2a3c', 'fff8f2'],
    nuit: ['2f3b6e', '45528f', '3a4766', '28324d', 'ffd166', 'ef476f', '151b2e', 'f3f5ff'],
    studio: ['3b2d8f', '5a48c4', '271d63', '1c1549', 'ff4fa3', '3ec5f2', '140f33', 'fdf6ff'],
    neon: ['1f1446', '3a2276', '2a1b5c', '170f38', 'ffd400', 'ff3d7f', '0d0820', 'fff9e8'],
    pastel: ['fde4ef', 'fff4f8', 'cdeadf', 'a9d8c6', 'ff8fb1', '7cc6fe', '3a3352', 'ffffff'],
    menthe: ['d6f3ec', 'effbf8', 'a5dcc4', '7cc5a8', 'ff9f68', '2bb3a3', '1f3b3a', 'ffffff'],
    corail: ['ffe0d6', 'fff2ec', 'f6c2a8', 'ee9f80', 'ff6b6b', '4d96ff', '3b2626', 'ffffff'],
    cobalt: ['d9e6ff', 'f0f5ff', 'b4c8ee', '8fa9dc', '3d6bff', 'ffb020', '1b2440', 'ffffff'],
    tropical: ['bdeef0', 'e6fafa', 'f3dca2', 'e3c27a', 'ff7b54', '00a6a6', '203a43', 'ffffff']
  };
  const ROLES = ['sky', 'skyAlt', 'ground', 'groundAlt', 'accent', 'accentAlt', 'ink', 'light'];
  const paletteObj = (arr) => { const o = {}; ROLES.forEach((r, i) => { o[r] = arr[i]; }); return o; };
  const GENRES = {
    aventure: ['jour', 'tropical', 'aube', 'menthe'], jeu: ['studio', 'neon', 'cobalt'], divertissement: ['studio', 'neon', 'corail', 'cobalt'],
    telerealite: ['tropical', 'corail', 'jour', 'aube'], dating: ['aube', 'corail', 'pastel', 'nuit'], cuisine: ['menthe', 'corail', 'jour', 'pastel'],
    talent: ['neon', 'studio', 'nuit'], policier: ['nuit', 'cobalt', 'aube'], drame: ['aube', 'nuit', 'pastel', 'cobalt'], sport: ['jour', 'cobalt', 'menthe', 'nuit'],
    documentaire: ['jour', 'aube', 'menthe', 'tropical'], magazine: ['pastel', 'menthe', 'corail', 'jour'], info: ['cobalt', 'jour', 'nuit'], humour: ['neon', 'corail', 'studio'],
    jeunesse: ['pastel', 'jour', 'corail', 'menthe'], cinema: ['nuit', 'studio', 'neon', 'aube'], evenement: ['jour', 'nuit', 'cobalt', 'pastel'], generique: ['jour', 'pastel', 'cobalt', 'corail']
  };
  const SUBGENRES = {
    aventure: ['survie', 'montagne'],
    sport: ['football', 'rugby', 'basket', 'handball', 'tennis', 'auto', 'velo', 'surf', 'combat', 'ski', 'fitness', 'athletisme', 'hippisme'],
    documentaire: ['nature', 'histoire', 'science', 'culture'],
    cinema: ['ceremonie', 'festival', 'film', 'serie'],
    evenement: ['debat', 'espace', 'vatican', 'election', 'royal', 'enquete', 'commission', 'eurovision', 'esport', 'concertweb', 'noel', 'animation', 'vienne', 'toureiffel', 'theatre', 'opera', 'quatorze', 'goncourt', 'eclipse', 'victoires', 'miss']
  };
  const CHAR_COLORS = {
    skin: ['f8d5b5', 'e8b48e', 'c68a63', '8d5a3b', '5c3a28', 'f1c9a0'],
    hair: ['2b1d16', '5a3825', 'a0522d', 'e5b766', '1e2a3a', 'b8b8c4', 'c0392b'],
    top: ['4d96ff', 'ff6b6b', 'ffd166', '06d6a0', '8e7dff', 'ff9f68', '2ec4b6', 'f15bb5'],
    bottom: ['263859', '3d405b', '5c4b51', '2f4858', '6c757d', '1d3557']
  };
  const CAREER = {
    redressement: { genre: 'drame', palette: 'nuit' }, domination: { genre: 'talent', palette: 'studio' },
    ascension: { genre: 'aventure', subgenre: 'montagne', palette: 'jour' }, actionnaire: { genre: 'evenement', subgenre: 'commission', palette: 'cobalt' },
    marche: { genre: 'aventure', subgenre: 'survie', palette: 'nuit' }, thematiques: { genre: 'info', palette: 'jour' },
    courts: { genre: 'jeu', palette: 'neon' }, narratifs: { genre: 'policier', palette: 'nuit' }
  };

  // ---------- Tirages ----------
  function tagMatch(vtags, req) {
    for (const cat in req) {
      const mine = vtags.filter((t) => t.startsWith(cat + ':'));
      if (mine.length && !mine.some((t) => req[cat].includes(t.slice(cat.length + 1)))) return false;
    }
    return true;
  }
  function pick(seed, name, group, req) {
    const keys = Object.keys(group).filter((k) => tagMatch(group[k].tags || [], req || {})).sort();
    if (!keys.length) return null;
    const w = (k) => (group[k].weight == null ? 1 : group[k].weight);
    const total = keys.reduce((s, k) => s + w(k), 0);
    const threshold = value(seed, name + 'Variant') * total;
    let acc = 0;
    for (const k of keys) { acc += w(k); if (acc > threshold) return k; }
    return keys[keys.length - 1];
  }
  const chance = (seed, name, p) => value(seed, name + 'Probability') * 100 < p;
  function color(seed, name, candidates, notEqualTo) {
    const ban = (notEqualTo || []).map((c) => c.toLowerCase());
    const list = candidates.filter((c) => !ban.includes(c.toLowerCase()));
    const pool = list.length ? list.slice() : candidates.slice();
    const r = mulberry(hash(seed + ':' + name + 'Color'));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    return pool[0];
  }
  function fill(str, map) { return str.replace(/\$([a-zA-Z]+[0-9]?)/g, (m, k) => (map[k] ? '#' + map[k] : m)); }

  function resolveCharacter(seed, sfx, req) {
    const fem = pick(seed, 'character' + sfx, { fem: {}, masc: {} }) === 'fem';
    const c = { variant: fem ? 'fem' : 'masc' };
    c.legs = pick(seed, 'legs' + sfx, LEGS);
    c.torso = pick(seed, (fem ? 'torsoF' : 'torsoM') + sfx, fem ? TORSO_F : TORSO_M);
    c.armLeft = pick(seed, 'armLeft' + sfx, ARM_LEFT);
    c.armRight = pick(seed, 'armRight' + sfx, ARM_RIGHT);
    c.hair = pick(seed, (fem ? 'hairF' : 'hairM') + sfx, fem ? HAIR_F : HAIR_M);
    c.head = pick(seed, (fem ? 'headF' : 'headM') + sfx, HEAD);
    c.face = pick(seed, (fem ? 'faceF' : 'faceM') + sfx, fem ? FACE_F : FACE_M);
    c.headwear = chance(seed, 'headwear' + sfx, 45) ? pick(seed, 'headwear' + sfx, HEADWEAR, req) : null;
    c.handheld = chance(seed, 'handheld' + sfx, sfx ? 60 : 85) ? pick(seed, 'handheld' + sfx, HANDHELD, req) : null;
    return c;
  }
  function drawCharacter(c) {
    const fem = c.variant === 'fem';
    const face = (fem ? FACE_F : FACE_M)[c.face].svg;
    const head = HEAD[c.head].svg.replace('{face}', face);
    const hair = (fem ? HAIR_F : HAIR_M)[c.hair].svg.replace('{head}', head);
    const arm = ARM_RIGHT[c.armRight].svg.replace('{handheld}', c.handheld ? HANDHELD[c.handheld].svg : '');
    return LEGS[c.legs].svg + (fem ? TORSO_F : TORSO_M)[c.torso].svg + ARM_LEFT[c.armLeft].svg + hair + (c.headwear ? HEADWEAR[c.headwear].svg : '') + arm;
  }

  function resolve(opts) {
    const o = opts || {};
    const seed = o.seed == null || o.seed === '' ? 'tv-programs' : String(o.seed);
    const genre = GENRES[o.genre] ? o.genre : 'generique';
    const subgenre = (SUBGENRES[genre] || []).includes(o.subgenre) ? o.subgenre : '';
    let palName = null, pal;
    if (o.palette && typeof o.palette === 'object') pal = Object.assign({}, paletteObj(PALETTES.jour), o.palette);
    else if (o.palette && PALETTES[o.palette]) { palName = o.palette; pal = paletteObj(PALETTES[palName]); }
    else { const allowed = GENRES[genre]; palName = allowed[hash(`${seed}|palette`) % allowed.length]; pal = paletteObj(PALETTES[palName]); }
    for (const k in pal) pal[k] = String(pal[k]).replace('#', '').toLowerCase();
    const dseed = `${genre}:${seed}`;
    const req = { genre: [genre] };
    if (subgenre) req.sub = [subgenre];
    const tags = ['genre:' + genre].concat(subgenre ? ['sub:' + subgenre] : []);
    const t = { seed, genre, subgenre, dseed, tags, palette: palName || 'personnalisée', colors: pal };
    t.scene = pick(dseed, 'scene', SCENES, req);
    t.composition = pick(dseed, 'composition', COMPOSITIONS, {});
    t.prop = pick(dseed, 'prop', PROPS, req);
    t.accessory = chance(dseed, 'accessory', 85) ? pick(dseed, 'accessory', ACCESSORIES, req) : null;
    t.character = resolveCharacter(dseed, '', req);
    t.character2 = resolveCharacter(dseed, '2', req);
    t.decor = chance(dseed, 'decor', 75) ? pick(dseed, 'decor', DECOR, req) : null;
    const cc = {};
    cc.skin = color(dseed, 'skin', CHAR_COLORS.skin);
    cc.hair = color(dseed, 'hair', CHAR_COLORS.hair);
    cc.top = color(dseed, 'top', CHAR_COLORS.top, [pal.accent, pal.accentAlt]);
    cc.bottom = color(dseed, 'bottom', CHAR_COLORS.bottom, [cc.top]);
    cc.skin2 = color(dseed, 'skin2', CHAR_COLORS.skin);
    cc.hair2 = color(dseed, 'hair2', CHAR_COLORS.hair, [cc.hair]);
    cc.top2 = color(dseed, 'top2', CHAR_COLORS.top, [cc.top, pal.accent, pal.accentAlt]);
    cc.bottom2 = color(dseed, 'bottom2', CHAR_COLORS.bottom, [cc.bottom, cc.top2]);
    t.characterColors = cc;
    t.backgroundColor = o.backgroundColor ? String(o.backgroundColor).replace('#', '') : '';
    t.size = o.size ? +o.size : 0;
    return t;
  }

  function render(opts) {
    const t = resolve(opts);
    const pal = t.colors, cc = t.characterColors;
    const comp = COMPOSITIONS[t.composition];
    const map1 = Object.assign({}, pal, { skin: cc.skin, hair: cc.hair, top: cc.top, bottom: cc.bottom });
    const map2 = Object.assign({}, pal, { skin: cc.skin2, hair: cc.hair2, top: cc.top2, bottom: cc.bottom2 });
    let fg = '';
    if (t.prop) { const [x, s] = comp.prop; fg += G(`translate(${n(x - 60 * s)} ${n(160 - 100 * s)}) scale(${s})`, fill(PROPS[t.prop].svg, pal)); }
    if (t.accessory && comp.acc) { const [x, s] = comp.acc; fg += G(`translate(${n(x - 25 * s)} ${n(164 - 50 * s)}) scale(${s})`, fill(ACCESSORIES[t.accessory].svg, pal)); }
    const shadow = (x, s) => E(x, 162, 20 * s, 4, '#' + pal.ink, op(0.12));
    if (comp.p1) { const [x, s] = comp.p1; fg += shadow(x, s) + G(`translate(${n(x - 30 * s)} ${n(162 - 110 * s)}) scale(${s})`, fill(drawCharacter(t.character), map1)); }
    if (comp.p2) { const [x, s] = comp.p2; fg += shadow(x, s) + G(`translate(${n(x + 30 * s)} ${n(162 - 110 * s)}) scale(${-s} ${s})`, fill(drawCharacter(t.character2), map2)); }
    const dims = t.size ? ` width="${t.size}" height="${n((t.size * 9) / 16)}"` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"${dims}>` +
      (t.backgroundColor ? `<rect width="320" height="180" fill="#${t.backgroundColor}"/>` : '') +
      `<g>${fill(SCENES[t.scene].svg, pal)}</g><g>${fg}</g>` +
      (t.decor ? `<g>${fill(DECOR[t.decor].svg, pal)}</g>` : '') + '</svg>';
    return { svg, trace: t };
  }

  const svg = (o) => render(o).svg;
  const dataUri = (o) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg(o));
  const career = (id) => Object.assign({ seed: 'career:' + id }, CAREER[id]);
  const counts = { scene: Object.keys(SCENES).length, prop: Object.keys(PROPS).length, accessory: Object.keys(ACCESSORIES).length, handheld: Object.keys(HANDHELD).length, headwear: Object.keys(HEADWEAR).length, decor: Object.keys(DECOR).length };

  return { version: '1.0.0', hash, value, render, resolve, svg, dataUri, career, PALETTES: Object.fromEntries(Object.keys(PALETTES).map((k) => [k, paletteObj(PALETTES[k])])), GENRES, SUBGENRES, CAREER, counts };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = TVP;
