// Dessine l'exemple « Titanic » (1600×900) en SVG plat.
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const K = { sky: '#2f3b6e', alt: '#45528f', o1: '#3a4766', o2: '#28324d', gold: '#ffd166', red: '#ef476f', ink: '#151b2e', light: '#f3f5ff' };
let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">`;
s += `<rect width="1600" height="900" fill="${K.sky}"/>`;
s += `<rect y="380" width="1600" height="240" fill="${K.alt}" opacity="0.35"/>`;
for (let i = 0; i < 110; i++) { const x = rnd() * 1600, y = rnd() * 470, r = 0.8 + rnd() * 2; s += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${K.light}" opacity="${(0.35 + rnd() * 0.6).toFixed(2)}"/>`; }
s += `<circle cx="1420" cy="150" r="120" fill="${K.light}" opacity="0.06"/><circle cx="1420" cy="150" r="84" fill="${K.light}" opacity="0.1"/><circle cx="1420" cy="150" r="56" fill="${K.light}"/><circle cx="1402" cy="140" r="9" fill="${K.alt}" opacity="0.18"/><circle cx="1436" cy="168" r="6" fill="${K.alt}" opacity="0.15"/>`;
const cloud = (x, y, w, o) => `<g opacity="${o}" fill="${K.alt}"><rect x="${x}" y="${y - 22}" width="${w}" height="44" rx="22"/><circle cx="${x + w * 0.3}" cy="${y - 26}" r="${w * 0.16}"/><circle cx="${x + w * 0.6}" cy="${y - 34}" r="${w * 0.2}"/></g>`;
s += cloud(-40, 560, 360, 0.9) + cloud(260, 585, 260, 0.7) + cloud(1060, 575, 300, 0.75) + cloud(980, 600, 200, 0.6);
// Iceberg
s += `<path d="M1330 610 L1392 470 L1440 500 L1486 418 L1548 520 L1600 560 L1600 610 Z" fill="${K.light}" opacity="0.92"/><path d="M1392 470 L1440 500 L1420 610 L1330 610 Z" fill="${K.alt}" opacity="0.35"/><path d="M1486 418 L1548 520 L1500 610 L1470 520 Z" fill="${K.alt}" opacity="0.28"/><path d="M1486 418 L1470 520 L1440 500 Z" fill="${K.light}"/>`;
// Mer lointaine
s += `<rect y="600" width="1600" height="300" fill="${K.o1}"/>`;
s += `<path d="M0 604 L1600 604" stroke="${K.light}" stroke-width="2" opacity="0.18"/>`;
// Navire (repère local, proue à droite), incliné
let sh = '';
sh += `<path d="M-560 2 L-540 150 L-520 150 L-516 110 Z" fill="${K.ink}"/>`; // gouvernail
[[-505, 112], [-470, 118]].forEach(([x, y]) => { sh += `<g fill="${K.gold}" opacity="0.75"><circle cx="${x}" cy="${y}" r="7"/><ellipse cx="${x}" cy="${y - 16}" rx="6" ry="15"/><ellipse cx="${x}" cy="${y + 16}" rx="6" ry="15"/></g>`; });
sh += `<path d="M-560 0 L580 0 L545 110 L-515 110 Q-572 62 -560 0 Z" fill="${K.ink}"/>`;
sh += `<path d="M-537 74 L556 74 L545 110 L-515 110 Q-540 94 -537 74 Z" fill="${K.red}"/><path d="M-537 74 L556 74 L545 110 L-515 110 Q-540 94 -537 74 Z" fill="${K.ink}" opacity="0.28"/>`;
sh += `<path d="M-556 7 L574 7" stroke="${K.gold}" stroke-width="3" opacity="0.8"/>`;
for (let row = 0; row < 2; row++) for (let x = -500; x <= 530; x += 21) { const lit = rnd() > 0.22; sh += `<circle cx="${x}" cy="${24 + row * 22}" r="4" fill="${K.gold}" opacity="${lit ? 0.95 : 0.25}"/>`; }
sh += `<rect x="-470" y="-46" width="900" height="46" fill="${K.light}"/><rect x="-380" y="-84" width="710" height="38" fill="${K.light}"/><rect x="250" y="-104" width="70" height="22" fill="${K.light}"/>`;
sh += `<path d="M-470 -23 L430 -23 M-470 -46 L430 -46 M-380 -84 L330 -84" stroke="${K.ink}" stroke-width="2" opacity="0.3"/>`;
for (let x = -455; x <= 415; x += 17) sh += `<rect x="${x}" y="-36" width="9" height="7" fill="${K.gold}" opacity="${rnd() > 0.15 ? 0.95 : 0.3}"/>`;
for (let x = -455; x <= 415; x += 17) sh += `<rect x="${x}" y="-15" width="9" height="7" fill="${K.gold}" opacity="${rnd() > 0.2 ? 0.9 : 0.3}"/>`;
for (let x = -365; x <= 315; x += 16) sh += `<rect x="${x}" y="-72" width="8" height="7" fill="${K.gold}" opacity="${rnd() > 0.2 ? 0.95 : 0.3}"/>`;
for (let x = -360; x <= 300; x += 44) { if (x > -290 && x < 220 && Math.abs(x + 30) < 400) sh += `<rect x="${x}" y="-98" width="30" height="9" rx="4" fill="${K.light}" stroke="${K.ink}" stroke-width="1.5" opacity="0.95"/><path d="M${x + 2} -89 L${x + 2} -84 M${x + 28} -89 L${x + 28} -84" stroke="${K.ink}" stroke-width="2"/>`; }
[-230, -95, 40, 175].forEach((cx) => { sh += `<path d="M${cx - 24} -84 L${cx + 24} -84 L${cx + 2} -232 L${cx - 46} -232 Z" fill="${K.gold}"/><path d="M${cx - 40.5} -195 L${cx + 7.5} -195 L${cx + 2} -232 L${cx - 46} -232 Z" fill="${K.ink}"/><path d="M${cx + 14} -84 L${cx + 24} -84 L${cx + 2} -232 L${cx - 8} -232 Z" fill="${K.ink}" opacity="0.15"/>`; });
const rig = (d, w, o) => `<path d="${d}" fill="none" stroke="${K.light}" stroke-width="${w}" stroke-linecap="round" opacity="${o}"/>`;
sh += rig('M-430 -46 L-447 -330 M398 -46 L383 -330', 5, 0.8);
sh += rig('M-447 -330 L383 -330 M383 -330 L578 -4 M-447 -330 L-556 -2 M383 -330 L360 -46 M383 -330 L420 -46 M-447 -330 L-470 -46 M-447 -330 L-410 -46 M383 -250 L578 -4 M-447 -250 L-556 -2', 1.3, 0.5);
sh += rig('M-447 -330 L-251 -232 M383 -330 L177 -232', 1, 0.35);
s += `<g transform="translate(790 525) rotate(16)">${sh}</g>`;
// Vagues de premier plan
const wave = (y, amp, len, fill, op, phase) => { let d = `M0 900 L0 ${y}`; for (let x = 0; x <= 1600 + len; x += len) d += ` Q${x + len / 4 + phase} ${y - amp} ${x + len / 2 + phase} ${y} T${x + len + phase} ${y}`; return `<path d="${d} L1600 900 Z" fill="${fill}" opacity="${op}"/>`; };
const boat = (x, y, sc, people) => { let b = `<g transform="translate(${x} ${y}) scale(${sc})"><path d="M-40 0 L40 0 L30 14 L-30 14 Z" fill="${K.light}"/><path d="M-36 6 L36 6" stroke="${K.ink}" stroke-width="2" opacity="0.4"/>`; for (let i = 0; i < people; i++) { const px = -28 + i * (56 / Math.max(people - 1, 1)); b += `<circle cx="${px}" cy="-14" r="4" fill="${K.ink}"/><rect x="${px - 4}" y="-10" width="8" height="10" rx="3" fill="${K.ink}"/>`; } return b + '</g>'; };
s += wave(612, 10, 120, K.o1, 1, 0);
s += boat(150, 640, 0.8, 5) + boat(460, 652, 0.6, 4);
s += wave(648, 14, 160, K.o2, 0.85, 40);
// Reflets dorés
for (let i = 0; i < 26; i++) { const x = 640 + rnd() * 680, y = 660 + rnd() * 34, w = 14 + rnd() * 46; s += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="4" rx="2" fill="${K.gold}" opacity="${(0.3 + rnd() * 0.45).toFixed(2)}"/>`; }
s += wave(700, 18, 200, K.o2, 1, 90);
s += boat(1080, 722, 1, 6);
for (let i = 0; i < 10; i++) { const x = 650 + rnd() * 620, y = 720 + rnd() * 60; s += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${(18 + rnd() * 40).toFixed(0)}" height="4" rx="2" fill="${K.gold}" opacity="0.35"/>`; }
s += wave(790, 22, 240, K.ink, 0.55, 20);
s += `<path d="M0 800 Q60 778 120 800 M300 830 Q360 808 420 830 M980 820 Q1040 798 1100 820 M1360 800 Q1420 778 1480 800" fill="none" stroke="${K.light}" stroke-width="3" stroke-linecap="round" opacity="0.18"/>`;
s += '</svg>';
require('fs').writeFileSync(__dirname + '/titanic.svg', s);
console.log(s.length);
