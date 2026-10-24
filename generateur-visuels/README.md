# Atelier Visuels TV

Générateur autonome d'illustrations 16:9 (320×180) dans le style tv-programs d'Audience Masters.

- `engine.js` : le moteur, sans dépendance. Il reprend l'algorithme du guide : FNV-1a, Mulberry32, tirage pondéré trié, filtre par tags, palette tirée sur `hash(graine|palette)`, couleurs par Fisher-Yates, compositions exactes. Les dessins sont recréés.
- `ui.html` : l'interface de l'artefact.
- `build.js` : assemble `index.html` (interface + moteur embarqué). Lancer `node build.js`.

Reproduire un visuel en Node :

```js
const TVP = require('./engine.js');
require('fs').writeFileSync('cuisine.svg', TVP.svg({ seed: 'p123', genre: 'cuisine' }));
```

Options : `seed`, `genre`, `subgenre`, `palette` (nom ou objet), `backgroundColor`, `size`.
Pour l'image exacte du jeu, utiliser `generate.mjs` ou `dist/tv-programs.bundle.js` du dépôt Audience Masters.
