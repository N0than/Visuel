// Assemble index.html : interface (ui.html) + moteur (engine.js) + exemples (exemples/*.svg et .txt) embarqués.
const fs = require('fs');
const dir = __dirname;
const ui = fs.readFileSync(dir + '/ui.html', 'utf8');
const engine = fs.readFileSync(dir + '/engine.js', 'utf8').trim();
const TITLES = { titanic: 'Titanic' };
const examples = fs.readdirSync(dir + '/exemples').filter((f) => f.endsWith('.svg')).map((f) => {
  const id = f.slice(0, -4);
  return { id, title: TITLES[id] || id, prompt: fs.readFileSync(dir + '/exemples/' + id + '.txt', 'utf8').trim(), svg: fs.readFileSync(dir + '/exemples/' + f, 'utf8').trim() };
});
const exJson = JSON.stringify(examples).replace(/</g, '\\u003c');
if (/<\/script/i.test(engine)) throw new Error('engine.js ne doit pas contenir </script');
fs.writeFileSync(dir + '/index.html', ui.replace('/*__ENGINE__*/', () => engine).replace('/*__EXAMPLES__*/[]', () => exJson));
console.log('index.html', Math.round(fs.statSync(dir + '/index.html').size / 1024) + ' Ko,', examples.length, 'exemple(s)');
