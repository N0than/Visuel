# Prompt : régénérer l'Atelier Visuels TV

> Copie tout ce qui suit dans ton outil de développement. Le prompt est autonome. Si l'outil accepte des fichiers joints, ajoute `engine.js` du dépôt : il pourra reprendre les dessins tels quels et obtenir des images identiques à l'octet près.

---

## 1. Ce que tu dois construire

Une application web **sans dépendance ni serveur**, en français, qui génère des illustrations vectorielles 16:9 (320×180) de programmes télé dans un style « flat design » à personnages mascottes, à partir d'une **graine** et de quelques réglages. Elle fournit ensuite **le code qui reproduit exactement l'image ailleurs**.

Livrables :

1. `engine.js` : le moteur, en JavaScript pur, sans dépendance. Il expose un objet global `TVP` dans le navigateur et le même objet par `module.exports` dans Node (`if (typeof module !== 'undefined' && module.exports) module.exports = TVP;`). Il ne doit jamais contenir la chaîne `</script`.
2. `ui.html` : l'interface, avec un emplacement `/*__ENGINE__*/` dans une balise `<script id="tvp-engine">`.
3. `build.js` : script Node qui remplace l'emplacement par le contenu de `engine.js` et écrit `index.html`, page unique autonome.
4. `README.md` court.

Règle d'or : **même graine + mêmes options = même SVG, caractère pour caractère**, dans le navigateur comme dans Node. Aucun `Math.random()` dans le moteur. Les champs d'étoiles, confettis, etc. sont générés à l'initialisation avec un générateur pseudo-aléatoire à graine fixe.

## 2. API du moteur

```js
TVP.svg({ seed, genre, subgenre, palette, backgroundColor, size })   // chaîne SVG
TVP.render(opts)      // { svg, trace } ; trace = toutes les décisions du tirage
TVP.resolve(opts)     // trace seule
TVP.dataUri(opts)     // 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
TVP.toPrompt(optsOuTrace) // prompt d'IA calibré (§ 8)
TVP.career(id)        // { seed: 'career:<id>', genre, subgenre?, palette }
TVP.hash, TVP.value, TVP.PALETTES, TVP.GENRES, TVP.SUBGENRES, TVP.CAREER, TVP.LABELS, TVP.counts, TVP.version
```

Options :

- `seed` : texte, `'tv-programs'` si vide.
- `genre` : l'un des 18 genres, `'generique'` si inconnu.
- `subgenre` : ignoré (`''`) s'il n'appartient pas à `SUBGENRES[genre]`.
- `palette` : nom d'une des 10 palettes, ou objet `{ sky, skyAlt, … }` complété par « jour » ; sinon tirée (§ 3.2).
- `backgroundColor` : hex sans `#`, ajoute `<rect width="320" height="180" fill="#…"/>` en tout premier.
- `size` : largeur en px ; ajoute `width` et `height = size × 9/16` sur la balise `<svg>`. Sans `size`, pas de dimensions.

## 3. Algorithme de tirage (à respecter exactement)

### 3.1 Aléa

```js
function hash(str) {                       // FNV-1a 32 bits sur les unités UTF-16
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function value(seed, key) {                // nombre dans [0, 1), un par décision
  let state = hash(seed + ':' + key);
  let z = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(z ^ (z >>> 15), z | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function mulberry(a) {                     // générateur Mulberry32 classique
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

### 3.2 Palette

Si `palette` n'est pas fournie : `allowed = GENRES[genre]` (liste ordonnée du § 5.2) et `palette = allowed[hash(seed + '|palette') % allowed.length]`. Le hachage porte sur la **graine brute** (`p123`), pas sur `cuisine:p123`. Contrôle : graine `p123` + genre `cuisine` → palette `jour`.

### 3.3 Graine DiceBear et tags

- `dseed = genre + ':' + seed` (ex. `cuisine:p123`) : toutes les décisions suivantes l'utilisent.
- Tags demandés : `{ genre: [genre] }`, plus `{ sub: [subgenre] }` si un sous-genre est choisi. La trace garde aussi `tags = ['genre:<g>', 'sub:<s>']`.

### 3.4 Tirages

- **Présence** : `chance(name, p) = value(dseed, name + 'Probability') * 100 < p`.
- **Variante** : `pick(name, groupe, tagsDemandés)`.
  1. Filtrer les variantes par tags. Pour chaque catégorie demandée (`genre`, `sub`), une variante passe si elle n'a aucun tag de cette catégorie, ou si l'un de ses tags de cette catégorie est demandé.
  2. Trier les clés restantes avec `.sort()` (ordre des unités de code).
  3. `seuil = value(dseed, name + 'Variant') * somme des poids` (poids 1 par défaut).
  4. Rendre la première clé dont le cumul des poids est **strictement supérieur** au seuil ; `null` si la liste filtrée est vide.
- **Couleur** : `color(name, candidats, différentDe)`.
  1. Retirer les candidats égaux (sans casse) aux couleurs de `différentDe`. Si la liste devient vide, garder tous les candidats.
  2. Mélanger avec Fisher-Yates : `rng = mulberry(hash(dseed + ':' + name + 'Color'))`, puis `for (i = n-1; i > 0; i--) { j = floor(rng() * (i+1)); swap(i, j) }`.
  3. Prendre le premier élément.

### 3.5 Ordre et clés

```
scene        = pick('scene', SCENES, tags)
composition  = pick('composition', COMPOSITIONS, {})          // poids : duo 3, hostLeft 2, hostRight 2, center 2, trio 1
prop         = pick('prop', PROPS, tags)
accessory    = chance('accessory', 85) ? pick('accessory', ACCESSORIES, tags) : null
character    = personnage(suffixe '')
character2   = personnage(suffixe '2')
decor        = chance('decor', 75) ? pick('decor', DECOR, tags) : null
```

Pour un personnage de suffixe `s` :

```
variant  = pick('character'+s, {fem, masc})                    // 50/50
legs     = pick('legs'+s, LEGS)
torso    = pick((fem ? 'torsoF' : 'torsoM')+s, fem ? TORSO_F : TORSO_M)
armLeft  = pick('armLeft'+s, ARM_LEFT)
armRight = pick('armRight'+s, { hold })
hair     = pick((fem ? 'hairF' : 'hairM')+s, …)
head     = pick((fem ? 'headF' : 'headM')+s, { round })
face     = pick((fem ? 'faceF' : 'faceM')+s, …)
headwear = chance('headwear'+s, 45) ? pick('headwear'+s, HEADWEAR, tags) : null
handheld = chance('handheld'+s, s ? 60 : 85) ? pick('handheld'+s, HANDHELD, tags) : null
```

Couleurs des personnages, dans cet ordre :

```
skin    = color('skin', SKIN)
hair    = color('hair', HAIR)
top     = color('top', TOP, [accent, accentAlt])
bottom  = color('bottom', BOTTOM, [top])
skin2   = color('skin2', SKIN)
hair2   = color('hair2', HAIR, [hair])
top2    = color('top2', TOP, [top, accent, accentAlt])
bottom2 = color('bottom2', BOTTOM, [bottom, top2])
```

## 4. Rendu SVG

```
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"[ width height]>
  [<rect width="320" height="180" fill="#fond"/>]
  <g>SCÈNE</g>
  <g>PREMIER PLAN : objet central, accessoire, ombre + personnage 1, ombre + personnage 2</g>
  [<g>SURCOUCHE</g>]
</svg>
```

Les dessins s'écrivent avec des jetons de couleur, jamais en hexadécimal : `$sky $skyAlt $ground $groundAlt $accent $accentAlt $ink $light` pour la palette, `$skin $hair $top $bottom` pour un personnage. Le rendu remplace chaque `$nom` par `#hex` : regex `/\$([a-zA-Z]+[0-9]?)/g`. Le personnage 2 est rempli avec `skin2`, `hair2`, `top2`, `bottom2` sous les noms `$skin`, `$hair`, `$top`, `$bottom`. Arrondis numériques : `+(+v).toFixed(2)`.

### 4.1 Compositions (sol à y = 162)

| Variante | Poids | Objet central (x, échelle) | Accessoire | Personnage 1 | Personnage 2 (retourné) |
|---|---|---|---|---|---|
| duo | 3 | 160, 1 | non affiché | 74, 1 | 246, 1 |
| hostLeft | 2 | 196, 1 | 290, 0,9 | 86, 1 | — |
| hostRight | 2 | 126, 1 | 32, 0,9 | — | 240, 1 |
| center | 2 | 76, 0,82 | 260, 1 | 170, 1 | — |
| trio | 1 | 244, 0,9 | 30, 0,8 | 92, 1 | 150, 0,94 |

Transformations, pour une échelle `s` :

- objet central : `translate(x−60s, 160−100s) scale(s)` ;
- accessoire : `translate(x−25s, 164−50s) scale(s)` ;
- personnage : `translate(x−30s, 162−110s) scale(s)` ;
- personnage retourné : `translate(x+30s, 162−110s) scale(−s, s)`.

Avant chaque personnage affiché, dessiner une ombre : `<ellipse cx=x cy=162 rx=20s ry=4 fill=ink opacity=0.12>`. Les deux personnages sont toujours tirés, même ceux que la composition n'affiche pas.

### 4.2 Personnage (boîte 60×110, pieds à y = 110)

Ordre d'empilement : `legs`, `torso`, `armLeft`, `hair` (la coiffure contient `{head}`, qui contient `{face}`), `headwear`, `armRight` (qui contient `{handheld}`).

- **Tête `round`** :
  - oreilles : cercles r 3 en (19,19) et (41,19), `$skin` ;
  - visage : cercle r 11 en (30,18) ;
  - joues : cercles r 2,3 en (23,5 ; 22) et (36,5 ; 22), `$accentAlt` à 30 % ;
  - puis `{face}`.
- **Cou et torse** :
  - cou : rectangle (26,5 ; 24 ; 7×8) `$skin` ;
  - torse de base : `M17 36Q17 30 23 30L37 30Q43 30 43 36L42 70L18 70Z` en `$top`, avec un col en V `M26 30L30 34.5L34 30Z` en `$skin`.
- **Torses** :
  - `tee` ;
  - `jacket` : plastron `$light`, revers, 2 boutons ;
  - `hoodie` : capuche et cordons, poche ;
  - `dress` (fem seulement) : robe évasée jusqu'à y = 88, ceinture ;
  - `stripes` : 4 bandes `$light` à 55 %.
- **Jambes**, avec baskets `$light` de 12×6 et semelle `$ink` à 20 % :
  - `pants` : deux jambes 7,6×42 à partir de y = 64, en `$bottom` ;
  - `stride` : jambes écartées en traits épais ;
  - `shorts` : jambes en peau et chaussettes ;
  - `jeans` : coutures `$light` à 30 %.
- **Bras gauche**, trait `$top` d'épaisseur 6,5, bouts ronds, main = cercle r 3,6 `$skin` :
  - `down` : `M20 34L14 58`, main en (13,5 ; 60) ;
  - `wave` : `M20 34Q9 30 9 15`, main en (9,12), avec deux petits arcs de mouvement ;
  - `point` : `M20 34Q10 38 3 38`, main en (1,5 ; 38), doigt tendu ;
  - `hip` : `M20 34L11 47L19 56`, main en (19,5 ; 56,5) ;
  - `fist` : `M20 34L12 20`, poing r 4,4 en (11 ; 15,5).
- **Bras droit `hold`** : `M40 34L45 50L49 55`, main en (50,56), puis `{handheld}` dessiné **après** la main.
- **Visages**, yeux en points r 1,3 en (26,17) et (34,17), sourire `M27 22.4Q30 25.4 33 22.4` :
  - `smile` ;
  - `laugh` : yeux en arcs, bouche ouverte et langue ;
  - `glasses` : deux cercles r 3,1 et un pont ;
  - `wow` : yeux plus grands et bouche ronde ;
  - `wink` : un œil en arc.
  - `faceF` reprend ces 5 visages et ajoute des cils. `faceM` reprend les 5 et ajoute `beard` (barbe en `$hair`) et `mustache`. Jamais de barbe chez fem.
- **Coiffures** :
  - femme (`hairF`) : `bob`, `long` (arrière jusqu'à y = 46), `bun` (chignon en (30 ; 3,6) et barrette `$accent`), `ponytail`, `curly` (cercles) ;
  - homme (`hairM`) : `short`, `quiff`, `curly`, `bald` (tempes et reflet).
  - L'arrière des cheveux est dessiné avant `{head}`, la frange après.
- **Couvre-chefs** : posés vers y = 0 à 9, sans couvrir les yeux à y = 17.

### 4.3 Conventions des autres dessins

- **Boîtes** :
  - scène 320×180, horizon vers y = 110-130, sol à y = 162 ;
  - objet central 120×100, base à y = 100 ;
  - accessoire 50×50, base à y = 50 ;
  - objet tenu centré près de la main droite (50,56), à moins de 12 px.
- **Style** :
  - flat design, aplats, pas de dégradé ni de texture ;
  - traits seulement pour les détails, 1 à 2 px, en `$ink`, extrémités arrondies ;
  - profondeur par plans `ground` / `groundAlt`, voiles de 7 à 40 %, reflets `$light`.
- **Aides** à prévoir : `R, C, E, P, S` (rect, cercle, ellipse, path, trait), `G` (groupe transformé), `star`, `spark`, `heart`, `cloud`, `tree`, `pine`, `palm`, `building` (fenêtres `$accent`), `crowd`/`bleachers` (gradins), `curtains`, `spot` (cône de lumière), `screen`, `firework`, `columns`, `stars`, `snow`.
- **Surcouches** dans la zone haute (y < 110), pour ne pas cacher les visages.

## 5. Données

### 5.1 Palettes (ordre des rôles : sky, skyAlt, ground, groundAlt, accent, accentAlt, ink, light)

| Palette | Couleurs |
|---|---|
| jour | cfeefa eef9fd 9bd48a 74bb6c ffb547 ff7a59 263238 ffffff |
| aube | ffd2b8 ffeadb e9b48a d39468 ff8a65 7e57c2 3e2a3c fff8f2 |
| nuit | 2f3b6e 45528f 3a4766 28324d ffd166 ef476f 151b2e f3f5ff |
| studio | 3b2d8f 5a48c4 271d63 1c1549 ff4fa3 3ec5f2 140f33 fdf6ff |
| neon | 1f1446 3a2276 2a1b5c 170f38 ffd400 ff3d7f 0d0820 fff9e8 |
| pastel | fde4ef fff4f8 cdeadf a9d8c6 ff8fb1 7cc6fe 3a3352 ffffff |
| menthe | d6f3ec effbf8 a5dcc4 7cc5a8 ff9f68 2bb3a3 1f3b3a ffffff |
| corail | ffe0d6 fff2ec f6c2a8 ee9f80 ff6b6b 4d96ff 3b2626 ffffff |
| cobalt | d9e6ff f0f5ff b4c8ee 8fa9dc 3d6bff ffb020 1b2440 ffffff |
| tropical | bdeef0 e6fafa f3dca2 e3c27a ff7b54 00a6a6 203a43 ffffff |

### 5.2 Genres → palettes autorisées (ordre significatif)

```
aventure: jour, tropical, aube, menthe        jeu: studio, neon, cobalt
divertissement: studio, neon, corail, cobalt  telerealite: tropical, corail, jour, aube
dating: aube, corail, pastel, nuit            cuisine: menthe, corail, jour, pastel
talent: neon, studio, nuit                    policier: nuit, cobalt, aube
drame: aube, nuit, pastel, cobalt             sport: jour, cobalt, menthe, nuit
documentaire: jour, aube, menthe, tropical    magazine: pastel, menthe, corail, jour
info: cobalt, jour, nuit                      humour: neon, corail, studio
jeunesse: pastel, jour, corail, menthe        cinema: nuit, studio, neon, aube
evenement: jour, nuit, cobalt, pastel         generique: jour, pastel, cobalt, corail
```

### 5.3 Sous-genres

```
aventure: survie, montagne
sport: football, rugby, basket, handball, tennis, auto, velo, surf, combat, ski, fitness, athletisme, hippisme
documentaire: nature, histoire, science, culture
cinema: ceremonie, festival, film, serie
evenement: debat, espace, vatican, election, royal, enquete, commission, eurovision, esport, concertweb, noel,
           animation, vienne, toureiffel, theatre, opera, quatorze, goncourt, eclipse, victoires, miss
```

### 5.4 Couleurs des personnages

```
SKIN   f8d5b5 e8b48e c68a63 8d5a3b 5c3a28 f1c9a0
HAIR   2b1d16 5a3825 a0522d e5b766 1e2a3a b8b8c4 c0392b
TOP    4d96ff ff6b6b ffd166 06d6a0 8e7dff ff9f68 2ec4b6 f15bb5
BOTTOM 263859 3d405b 5c4b51 2f4858 6c757d 1d3557
```

### 5.5 Familles du Mode Carrière (graine `career:<id>`)

| id | genre | sous-genre | palette |
|---|---|---|---|
| redressement | drame | | nuit |
| domination | talent | | studio |
| ascension | aventure | montagne | jour |
| actionnaire | evenement | commission | cobalt |
| marche | aventure | survie | nuit |
| thematiques | info | | jour |
| courts | jeu | | neon |
| narratifs | policier | | nuit |

## 6. Catalogue des variantes

Format : `clé` [genres · sub: sous-genres] — description visuelle à dessiner (et libellé anglais réutilisé par le prompt calibré, § 8). Une variante sans tag `sub` passe quel que soit le sous-genre demandé. Toutes les variantes ont un poids de 1.

#### Personnage (aucun tag)

- `character` : fem, masc
- `legs` : pants, stride, shorts, jeans
- `torsoF` : tee, jacket, hoodie, dress, stripes · `torsoM` : tee, jacket, hoodie, stripes
- `armLeft` : down, wave, point, hip, fist · `armRight` : hold
- `hairF` : bob, long, bun, ponytail, curly · `hairM` : short, quiff, curly, bald
- `headF` / `headM` : round
- `faceF` : smile, laugh, glasses, wow, wink · `faceM` : smile, laugh, glasses, wow, wink, beard, mustache

#### Décors (scene, 320×180) — 80 variantes

- `jungle` [aventure · sub: survie] — a lush jungle with palm trees
- `plage` [aventure, telerealite · sub: survie] — a sunny beach with sea and palm trees
- `montagne` [aventure, documentaire · sub: montagne, nature] — snowy mountain peaks
- `temple` [aventure · sub: survie] — an ancient stepped jungle temple
- `canyon` [aventure, documentaire · sub: survie, nature] — a desert canyon with mesas
- `ile` [aventure, telerealite, dating · sub: survie] — a small tropical island in the sea
- `savane` [aventure, documentaire · sub: survie, nature] — an African savanna at sunset with acacia trees
- `foret` [aventure, documentaire, jeunesse · sub: survie, nature] — a pine forest
- `villa` [telerealite, dating] — a white luxury villa with a pool
- `loft` [telerealite, magazine] — an industrial brick loft with a city window
- `coucher` [telerealite, dating] — a beach at sunset
- `ocean` [documentaire · sub: nature] — a boat deck on the open ocean with a whale
- `musee` [documentaire · sub: histoire, culture] — a museum gallery with framed paintings
- `espace` [documentaire, jeunesse · sub: science] — outer space with planets and a moon surface
- `bibliotheque` [documentaire, info, magazine · sub: histoire, culture, science] — a library with tall bookshelves
- `carteMonde` [documentaire, info · sub: histoire, culture] — a studio with a giant world map screen
- `plateauQuiz` [jeu] — a quiz show studio with a giant question mark and light bulbs
- `plateauEcrans` [jeu, info] — a TV studio with a wall of screens
- `plateauRoue` [jeu, divertissement] — a game show studio with a big prize wheel
- `plateauJT` [info] — a TV news set with screens
- `rideau` [divertissement, humour, talent] — a theatre stage with red curtains
- `escalier` [divertissement, talent] — a show studio with an illuminated staircase
- `gala` [divertissement, humour, talent] — a gala hall with chandeliers
- `studioTV` [divertissement, magazine, generique] — a TV studio with a lighting rig
- `standup` [humour] — a stand-up comedy brick wall stage under a spotlight
- `plateauMag` [humour, magazine, generique] — a bright magazine talk show set
- `bonbons` [humour, jeunesse] — a candy land with giant lollipops
- `concert` [talent] — a concert stage with light beams and speakers
- `terrasse` [dating] — a café terrace with striped awnings and string lights
- `chandelles` [dating, drame] — a dark room lit by candles
- `salon` [magazine, drame, generique] — a cozy living room with a window
- `ruelle` [drame, policier] — a city alley at night with a street lamp
- `fenetreVille` [info, drame, policier] — an office with a large window on the city skyline
- `pluie` [drame] — a rainy city street
- `cuisine` [cuisine] — a home kitchen with cabinets and hanging pans
- `marche` [cuisine] — an open-air food market with striped stalls
- `studioCuisine` [cuisine] — a TV cooking studio
- `bureauEnquete` [policier] — a detective office with an evidence board
- `sceneCrime` [policier] — a night street behind police tape
- `salonTV` [generique] — a living room with a big TV
- `ceremonie` [cinema · sub: ceremonie] — an awards ceremony stage with a giant golden statuette
- `tapisRouge` [cinema · sub: festival] — a red carpet with a photo wall
- `salleCinema` [cinema · sub: film] — a movie theater with a glowing screen
- `plateauTournage` [cinema · sub: serie] — a TV series film set with lights
- `stade` [sport · sub: football] — a football stadium with crowds
- `rugby` [sport · sub: rugby] — a rugby stadium with H posts
- `parquet` [sport · sub: basket, handball] — an indoor basketball court
- `tennis` [sport · sub: tennis] — a tennis court
- `circuit` [sport · sub: auto] — a motor racing circuit with grandstands
- `col` [sport · sub: velo] — a mountain road for cycling
- `surf` [sport · sub: surf] — a big surfing wave
- `ring` [sport · sub: combat] — a boxing ring
- `piste` [sport · sub: ski] — a snowy ski slope
- `pisteAthle` [sport · sub: athletisme] — an athletics track
- `hippodrome` [sport · sub: hippisme] — a horse racing track with a grandstand
- `salleSport` [sport · sub: fitness] — a gym
- `arene` [sport] — a sports arena under spotlights
- `parcArcEnCiel` [jeunesse] — a park with a big rainbow
- `chambre` [jeunesse] — a child bedroom with posters
- `debat` [evenement · sub: debat] — a TV debate set
- `espaceMars` [evenement · sub: espace] — the surface of Mars
- `vatican` [evenement · sub: vatican] — a basilica dome and colonnade
- `soireeElectorale` [evenement · sub: election] — an election night studio with charts
- `palaisRoyal` [evenement · sub: royal] — a royal palace facade
- `enquete` [evenement · sub: enquete] — an investigation room with pinned documents
- `commission` [evenement · sub: commission] — a parliamentary hearing room
- `eurovisionJunior` [evenement · sub: eurovision] — a song contest stage with a heart-shaped screen
- `esportArena` [evenement · sub: esport] — an esports arena with giant screens
- `concertWeb` [evenement · sub: concertweb] — a home streaming studio with a ring light
- `spectacleNoel` [evenement · sub: noel] — a snowy Christmas show
- `animationGeant` [evenement · sub: animation] — a parade with giant balloons
- `concertVienne` [evenement · sub: vienne] — a golden concert hall with organ pipes
- `toureiffel` [evenement · sub: toureiffel] — the Eiffel Tower over Paris
- `comedieFrancaise` [evenement · sub: theatre] — a classic French theatre
- `operaBallet` [evenement · sub: opera] — an opera house with a chandelier
- `quatorzeJuillet` [evenement · sub: quatorze] — fireworks over the city
- `goncourt` [evenement · sub: goncourt] — an elegant literary salon
- `eclipse` [evenement · sub: eclipse] — a total solar eclipse
- `victoiresClassique` [evenement · sub: victoires] — a classical music awards stage
- `missFrance` [evenement · sub: miss] — a beauty pageant stage with light arches

#### Objets centraux (prop, boîte 120×100, base y=100) — 68 variantes

- `coffre` [aventure, jeu] — a treasure chest
- `campfire` [aventure] — a campfire
- `tente` [aventure] — a tent
- `totem` [aventure] — a tribal totem
- `trepied` [aventure, generique, telerealite, info, documentaire, evenement] — a camera on a tripod
- `pupitre` [jeu, talent] — a game show podium
- `cagnotte` [jeu, divertissement] — a jackpot jar of coins
- `des` [jeu, jeunesse] — giant dice
- `jury` [jeu, talent] — a judges desk
- `ecranGeant` [jeu, generique, info] — a big screen
- `discoball` [talent, divertissement, humour] — a disco ball
- `podiumShow` [talent, divertissement, generique] — a round show podium
- `micStand` [talent, divertissement, humour] — a microphone stand
- `piano` [talent, drame] — an upright piano
- `cadeau` [divertissement, jeunesse] — a big gift box
- `gateau` [divertissement, cuisine] — a tiered cake
- `telescope` [jeunesse, documentaire, evenement · sub: eclipse, espace] — a telescope
- `tortue` [jeunesse, documentaire] — a giant turtle
- `globeProp` [jeunesse, info, documentaire] — a globe
- `cubes` [jeunesse] — toy blocks
- `toboggan` [jeunesse] — a slide
- `tabouret` [humour] — a bar stool
- `fauteuils` [humour, magazine, info] — two armchairs
- `televiseur` [humour, generique, magazine] — a retro TV set
- `canape` [generique, drame, telerealite, magazine] — a sofa
- `lampadaire` [generique, drame] — a floor lamp
- `tableBasse` [generique, magazine] — a coffee table
- `banc` [drame, dating, magazine] — a bench
- `bureau` [drame, magazine, policier, info] — a desk with a laptop
- `bistro` [drame, dating] — a bistro table
- `transat` [telerealite, dating] — a deck chair
- `confession` [telerealite] — a diary-room armchair
- `tableRomantique` [dating] — a romantic candlelit table
- `lutrin` [magazine, info, evenement · sub: debat, goncourt, royal, vatican, quatorze, enquete] — a lectern
- `plateauCuisine` [magazine] — a kitchen island
- `coinDeco` [magazine] — a decorated shelf
- `presentoir` [magazine] — a product display
- `fourneau` [cuisine] — a stove
- `billot` [cuisine] — a chopping block
- `voiturePolice` [policier] — a police car
- `preuve` [policier] — an evidence table
- `deskJT` [info] — a news anchor desk
- `buts` [sport · sub: football, handball] — a goal
- `panier` [sport · sub: basket] — a basketball hoop
- `podiumSport` [sport] — a sports podium
- `formule` [sport · sub: auto] — a racing car
- `velo` [sport · sub: velo] — a racing bike
- `planche` [sport · sub: surf] — a surfboard
- `sacFrappe` [sport · sub: combat] — a punching bag
- `halteres` [sport · sub: fitness] — a barbell rack
- `raquettes` [sport · sub: tennis] — tennis rackets
- `rugbyTee` [sport · sub: rugby] — a rugby ball on a kicking tee
- `skis` [sport · sub: ski] — skis and poles
- `amphore` [documentaire] — an ancient amphora
- `fusee` [evenement · sub: espace] — a rocket
- `urne` [evenement · sub: election] — a ballot box
- `tableCommission` [evenement · sub: commission, enquete] — a hearing table with microphones
- `deskGaming` [evenement · sub: esport] — a gaming desk
- `microPied` [evenement · sub: concertweb, eurovision, miss] — a vintage studio microphone
- `sapin` [evenement · sub: noel] — a Christmas tree
- `peluche` [evenement · sub: animation, noel] — a giant teddy bear
- `pianoQueue` [evenement · sub: vienne, victoires, opera] — a grand piano
- `fauteuilVelours` [evenement · sub: theatre, opera, royal] — a velvet armchair
- `cameraCine` [cinema] — a film camera
- `pupitreStatuette` [cinema] — an awards lectern with a statuette
- `cordons` [cinema] — velvet rope stanchions
- `projecteurFilm` [cinema] — a film projector
- `chaiseRealisateur` [cinema] — a director chair

#### Accessoires au sol (accessory, boîte 50×50, base y=50) — 27 variantes

- `backpack` [aventure] — a backpack
- `rocks` [aventure, documentaire] — rocks
- `suitcase` [aventure, telerealite, policier, drame] — a suitcase
- `plant` [documentaire, drame, magazine, info, generique, evenement] — a potted plant
- `books` [documentaire, magazine, info] — a pile of books
- `cone` [sport] — a traffic cone
- `ballGround` [sport] — a ball on the ground
- `ferACheval` [sport · sub: hippisme] — a horseshoe
- `haie` [sport · sub: athletisme] — a hurdle
- `tyres` [sport · sub: auto] — a stack of tyres
- `basket` [cuisine, dating] — a picnic basket
- `veggies` [cuisine] — vegetables
- `float` [dating, telerealite] — a swim ring
- `hydrant` [policier] — a fire hydrant
- `clapperGround` [drame, cinema] — a clapperboard on the floor
- `speaker` [talent, humour, divertissement, jeunesse] — a speaker
- `moneyBag` [divertissement, jeu] — a money bag
- `toys` [jeunesse] — toys
- `pileDossiers` [evenement · sub: commission, enquete, debat, goncourt] — a pile of files
- `cadeaux` [evenement · sub: noel] — gifts
- `manette` [evenement · sub: esport] — a game controller
- `batonsLumineux` [evenement · sub: eurovision, concertweb] — glow sticks
- `diademe` [evenement · sub: miss] — a tiara
- `coussinCouronne` [evenement · sub: royal] — a crown on a cushion
- `popcornSeau` [cinema] — a popcorn bucket
- `bobine` [cinema] — a film reel
- `buzzerStand` [jeu] — a buzzer stand

#### Couvre-chefs (headwear, sur la tête du personnage) — 10 variantes

- `explorer` [documentaire, aventure] — an explorer hat
- `beanie` [aventure, sport] — a beanie
- `cap` [telerealite, sport, jeunesse] — a cap
- `helmet` [sport] — a helmet
- `toque` [cuisine] — a chef toque
- `flower` [telerealite, dating] — a flower in the hair
- `party` [divertissement, humour, jeunesse] — a party hat
- `fedora` [policier] — a fedora
- `headset` [talent, info, magazine, generique, jeu, evenement] — a headset
- `crown` [talent, divertissement] — a crown

#### Objets tenus (handheld, autour de la main droite en (50,56)) — 31 variantes

- `mic` [talent, divertissement, humour, info, magazine, generique, jeu, telerealite, cinema, evenement] — a microphone
- `trophy` [talent, divertissement, jeu, sport] — a trophy
- `glass` [divertissement, dating] — a champagne glass
- `balloon` [divertissement, jeunesse] — a balloon
- `phone` [humour, magazine, telerealite, jeunesse] — a phone
- `cue` [info, magazine, jeu] — cue cards
- `notebook` [info, policier, documentaire, evenement] — a notebook
- `mug` [info, magazine, generique] — a mug
- `script` [magazine, drame] — a script
- `buzzer` [jeu] — a buzzer
- `camera` [telerealite, documentaire, aventure] — a camera
- `clapper` [cinema, drame] — a clapperboard
- `statuette` [cinema] — a golden statuette
- `popcorn` [cinema] — popcorn
- `magnifier` [policier, documentaire] — a magnifying glass
- `map` [documentaire, aventure] — a map
- `compass` [aventure] — a compass
- `torch` [aventure] — a torch
- `football` [sport · sub: football] — a football
- `basketball` [sport · sub: basket] — a basketball
- `rugby` [sport · sub: rugby] — a rugby ball
- `handball` [sport · sub: handball] — a handball
- `racket` [sport · sub: tennis] — a tennis racket
- `flag` [sport] — a flag
- `gloves` [sport · sub: combat] — boxing gloves
- `flambeau` [sport · sub: athletisme] — an olympic torch
- `spatula` [cuisine] — a spatula
- `whisk` [cuisine] — a whisk
- `plate` [cuisine] — a plate of food
- `rose` [dating] — a rose
- `lollipop` [jeunesse] — a lollipop

#### Surcouches (decor, 320×180) — 12 variantes

- `confetti` [divertissement, jeu, talent, jeunesse, humour, telerealite] — confetti
- `confetti2` [divertissement, jeu, talent, jeunesse] — streamers
- `sparkles` [divertissement, talent, jeunesse, generique, magazine, dating, cinema] — sparkles
- `notes` [divertissement, talent, jeunesse, humour] — music notes
- `stars` [talent, humour, dating, cinema, drame, policier, info, evenement] — little stars
- `clouds` [jeunesse, telerealite, generique, magazine, aventure, documentaire, sport] — clouds
- `hearts` [dating] — floating hearts
- `bokeh` [dating, drame, policier, info, evenement] — soft bokeh lights
- `flashs` [cinema, evenement] — camera flashes
- `birds` [aventure, documentaire, drame, sport] — birds
- `leaves` [aventure, documentaire, cuisine] — falling leaves
- `steam` [cuisine] — rising steam

## 7. Libellés anglais complémentaires

- Genres :
  - aventure : adventure show ; jeu : game show ; divertissement : entertainment show ; telerealite : reality show ;
  - dating : dating show ; cuisine : cooking show ; talent : talent show ; policier : crime show ;
  - drame : drama series ; sport : sports broadcast ; documentaire : documentary ; magazine : magazine talk show ;
  - info : news program ; humour : comedy show ; jeunesse : kids show ; cinema : cinema program ;
  - evenement : live event ; generique : TV show.
- Gestes : down : arm relaxed ; wave : waving ; point : pointing ; hip : hand on hip ; fist : fist raised.
- Compositions : duo : facing each other ; hostLeft : host on the left ; hostRight : host on the right ; center : standing in the center ; trio : group shot.

## 8. Prompt calibré (`TVP.toPrompt`)

À partir de la trace `t`, produire **exactement** ce gabarit, sur une seule ligne :

```
Flat vector illustration, 16:9, clean geometric shapes, no gradients, no outlines except small dark details, soft ellipse drop shadows. Genre: <libellé genre> (<genre>[ / <sous-genre>]). Scene: <libellé scène>. Foreground: <one cartoon character |two cartoon characters ><libellé composition>, mascot proportions, big round head, simple dot-eyed face, rosy cheeks (<personnages>), next to <libellé objet>[, with <libellé accessoire> on the floor]. Overlay: <libellé surcouche | none>. Colors: sky #<sky>, background shapes #<skyAlt>, floor #<ground>/#<groundAlt>, accents #<accent> and #<accentAlt>, dark details #<ink>, highlights #<light>. Cheerful TV-show mood, minimal, friendly, no text. Seed: "<graine en JSON>".
```

Règles du gabarit :

- `<personnages>` ne contient que les personnages affichés par la composition, séparés par `; `. Chacun s'écrit : `a woman|a man`, puis ` wearing <couvre-chef>` s'il y en a un, puis `, <geste>`, puis `, holding <objet>` s'il y en a un.
- L'accessoire n'est mentionné que si la composition n'est pas `duo`.

## 9. Interface (`ui.html`)

### 9.1 Direction visuelle

Univers « régie TV ».

- **Titre** : « Atelier Visuels TV », avec une pastille « Antenne » façon voyant rouge à côté. `<title>Atelier Visuels TV</title>`.
- **Polices** (Google Fonts) : Bricolage Grotesque pour les titres, Figtree pour le texte, JetBrains Mono pour les libellés et le code, avec `font-variant-ligatures: none` dans les blocs de code.
- **Jetons de couleur**, thème clair et sombre (`prefers-color-scheme`, et `data-theme` sur la racine) :

| Jeton | Clair | Sombre |
|---|---|---|
| bg | #eef0f5 | #11131b |
| surface | #ffffff | #1a1d28 |
| sunken | #e3e6ee | #232736 |
| line | #d3d7e2 | #2e3345 |
| ink | #171a26 | #eceef5 |
| muted | #5a6075 | #9aa0b6 |
| accent | #e5484d | #ff6369 |
| focus | #3d63dd | #8aa4ff |
| code-bg | #171a26 | #0b0d13 |
| code-fg | #e8eaf2 | #e8eaf2 |

- **Mise en page** :
  - colonne de réglages de 300 px à gauche, contenu principal à droite ;
  - une seule colonne sous 860 px de large, marge latérale d'au moins 16 px, aucun défilement horizontal ;
  - focus clavier visible, et `prefers-reduced-motion` respecté.

### 9.2 Colonne Réglages

- **Genre** : liste déroulante « Cuisine (cuisine) »… pour les 18 genres.
- **Sous-genre** : « Aucun (tous les décors du genre) » suivi de la liste du genre. Le champ est désactivé avec « Aucun pour ce genre » quand le genre n'a pas de sous-genre.
- **Graine** : champ texte, bouton « Au hasard » (`'p' + entier 0-999`), et l'aide « Même graine et mêmes options : même image. Une majuscule ou un espace change tout. »
- **Palette** :
  - une pastille « AUTO » et 10 pastilles de 4×2 carrés montrant les 8 couleurs (`aria-pressed`) ;
  - en dessous, l'aide « Tirée pour cette graine : jour (parmi menthe, corail, jour, pastel). » ou « Palette forcée : nuit. ».
- **Fond plein** : hex facultatif, filtré sur `[0-9a-f]`, 6 caractères au plus.
- **Largeur en px** : facultative.
- **Familles du Mode Carrière** : 8 puces. Un clic applique la graine `career:<id>`, le genre, le sous-genre et la palette.

### 9.3 Zone principale, de haut en bas

1. **Moniteur** :
   - cadre sombre avec un bandeau en majuscules mono : `PGM · <genre / sous-genre>`, `graine <seed>`, `320×180 · sol y=162` ;
   - l'aperçu SVG en 16:9. Retirer `width` et `height` **uniquement sur la balise `<svg>`**, avec la regex `^<svg([^>]*?) width="…" height="…"`, sinon le rectangle du ciel perd ses dimensions.
2. **Actions** :
   - « Copier le SVG » ;
   - « Exporter en PNG » : canvas à la largeur choisie (1280 par défaut), image affichée avec « clic droit → Enregistrer l'image », boutons « Copier le PNG » (`ClipboardItem`) et « Télécharger le PNG » ;
   - « Copier la recette ».
3. **Conducteur du tirage** : tableau à deux colonnes.
   - Lignes :
     - Graine DiceBear (`dseed`) ;
     - Tags ;
     - Palette (nom et 8 carrés) ;
     - Décor ;
     - Composition (clé et libellé : « duo : objet au centre, deux personnages face à face », « animateur à gauche », « animateur à droite », « personnage au centre », « trio : deux personnages, objet à droite ») ;
     - Objet central ;
     - Accessoire (« non affiché en duo » si besoin, « aucun » sinon) ;
     - Personnage 1 et Personnage 2 (`fem · jeans · hoodie · bras fist · bun · smile · toque · spatula`, « sans couvre-chef », « mains libres ») ;
     - Surcouche.
   - Mentionner « non affiché » pour un personnage tiré que la composition ne montre pas.
4. **Code pour reproduire ce visuel** : six onglets (`role=tab`, navigation au clavier avec les flèches, onglet mémorisé), une phrase d'aide par onglet, un bloc de code sombre, et les boutons « Copier ce code » et « Télécharger ».
   - **HTML autonome** : page `<!doctype html>` qui embarque le moteur complet puis `document.getElementById("visuel").innerHTML = TVP.svg(<options JSON>)`.
   - **Node.js** : `// node visuel.cjs > <genre>-<graine>.svg`, le moteur complet, puis `process.stdout.write(TVP.svg(<options>))`.
   - Dans ces deux onglets, l'aperçu remplace le moteur par le commentaire `/* Moteur TV Visuels vX (NN Ko) : inclus en entier quand tu copies */`. Une case « Afficher le moteur » montre la version complète. La copie inclut toujours le moteur entier, lu dans `#tvp-engine`.
   - **Audience Masters** : code pour le dépôt d'origine du jeu, qui redonne l'image exacte du jeu :
     - (A) `cd tv-programs` puis `node generate.mjs --genre g [--subgenre s] --seed s [--palette p si forcée] [--background hex] [--size n] --out <genre>-<graine>.svg`, avec la variante `--png` ;
     - (B) `<script src="dist/tv-programs.bundle.js">` avec `TvPrograms.svg({…})` et `TvPrograms.dataUri({…})` ;
     - (C) `import { Avatar, Style } from '@dicebear/core'` (version 10.7.0) et `dist/tv-programs.json`, puis `new Avatar(new Style(definition), { seed: dseed, tags, skyColor: ['…'], …8 couleurs }).toString()`.
   - **Prompt IA** : `TVP.toPrompt(trace)`.
   - **SVG** : le SVG brut.
   - **Recette** : JSON `{ moteur: 'TV Visuels <version>', …options, paletteTiree, graineDiceBear }`.
   - Coloration minimale : commentaires `/* */`, `//`, `#` et `<!-- -->` en gris.
5. **Variations** : grille de 12 vignettes cliquables (graines `<graine>-1` à `<graine>-12`, mêmes réglages, sans `size`). Un clic reprend la graine et remonte en haut de la page.
6. **Pied de page** :
   - le moteur applique l'algorithme FNV-1a, Mulberry32, tirage pondéré trié, filtre par tags, palette `hash(graine|palette)` ;
   - les dessins sont recréés, et le code HTML ou Node redonne le visuel à l'octet près ;
   - pour l'image exacte du jeu, utiliser l'onglet Audience Masters.

### 9.4 Comportements

- Tout se met à jour en direct à chaque modification.
- `localStorage`, toujours dans un try/catch : les réglages (`tvp-state`) et l'onglet de code (`tvp-tab`).
- Copie par `navigator.clipboard.writeText`, avec repli sur `textarea` + `execCommand('copy')`, puis un toast de confirmation (« Code copié », « SVG copié »…).
- État de départ : genre `cuisine`, graine `p123`, palette AUTO.

## 10. Critères d'acceptation

1. `TVP.resolve({ seed: 'p123', genre: 'cuisine' }).palette === 'jour'`.
2. Déterminisme : deux appels identiques donnent le même SVG. Le script Node exporté écrit un SVG identique (`cmp`) à celui de la page.
3. Les 18 genres × leurs sous-genres × 40 graines se rendent sans exception et sans jeton résiduel : aucun `$nom`, `{`, `NaN` ni `undefined` dans le SVG.
4. Le décor tiré respecte le sous-genre : `sport` + `football` ne donne que `stade` ou `arene`.
5. Jamais de `beard` ni `mustache` chez fem, jamais de `dress` chez masc.
6. `TVP.counts` vaut `{ scene: 80, prop: 68, accessory: 27, handheld: 31, headwear: 10, decor: 12 }`.
7. La page ne produit aucune erreur console. Elle est lisible en clair et en sombre, et ne déborde pas à 400 px de large.
