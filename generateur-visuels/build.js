// Assemble index.html : interface (ui.html) + moteur (engine.js) embarqué.
const fs = require('fs');
const ui = fs.readFileSync(__dirname + '/ui.html', 'utf8');
const engine = fs.readFileSync(__dirname + '/engine.js', 'utf8').trim();
if (/<\/script/i.test(engine)) throw new Error('engine.js ne doit pas contenir </script');
fs.writeFileSync(__dirname + '/index.html', ui.replace('/*__ENGINE__*/', () => engine));
console.log('index.html', Math.round(fs.statSync(__dirname + '/index.html').size / 1024) + ' Ko');
