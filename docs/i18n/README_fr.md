[English](../../README.md) | [日本語](README_ja.md) | [Español](README_es.md) | [Tiếng Việt](README_vi.md) | [中文](README_zh.md) | [한국어](README_ko.md) | Français | [Deutsch](README_de.md) | [Português](README_pt.md) | [Italiano](README_it.md)

# Prompt Anonymizer

> **Utilisez les LLM de pointe sans leur montrer vos PII.**
> Anonymisation réversible, sur l'appareil — n'échangez pas l'intelligence
> contre la vie privée.

[![CI](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml/badge.svg)](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/akazah/prompt-anonymizer)](https://github.com/akazah/prompt-anonymizer/releases)
[![Python](https://img.shields.io/badge/python-3.12%E2%80%933.13-blue)](pyproject.toml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)

Aujourd'hui, vous avez deux options. Exécuter un modèle local — privé, mais
vous renoncez à l'intelligence de pointe. Ou coller votre texte dans
ChatGPT / Claude / Gemini et vous surveiller vous-même, prompt après prompt.
Prompt Anonymizer se situe entre les deux :

|  | Intelligence | Vie privée | Ce à quoi vous devez faire confiance |
|---|---|---|---|
| Modèle local | ✗ sacrifiée | ✓ | rien |
| Modèle de pointe, brut | ✓ | ✗ | le fournisseur, et votre propre vigilance |
| **Modèle de pointe + Prompt Anonymizer** | **✓** | **✓** | **du code que vous pouvez lire + une relecture finale** |

Il remplace les PII par des étiquettes cohérentes (`<人名_1>`, `<Name_1>`,
`<Nombre_1>`, `<Tên_1>`, …) **avant** que le texte ne quitte votre machine.
Comme la même valeur reçoit toujours la même étiquette, la réponse du LLM
reste cohérente. Quand la réponse revient, le mapping — qui n'a jamais
quitté votre appareil — restaure les valeurs réelles.

Langues prises en charge : anglais (`en`), japonais (`ja`), espagnol (`es`),
vietnamien (`vi`) et — nouveauté — chinois (`zh`), coréen (`ko`), français
(`fr`), allemand (`de`), portugais (`pt`) et italien (`it`). La valeur par
défaut de `PromptAnonymizer(languages=…)` reste `("en", "ja")` ; toutes les
autres langues s'activent via `languages=[...]`. Tous les sélecteurs de
langue des interfaces et la détection automatique couvrent les dix. La prise
en charge des langues est pilotée par un registre — ajouter une langue se
résume à une entrée dans le registre (`languages.py` / `types.ts`) plus un
fichier d'étiquettes.

La détection s'exécute sur l'appareil (WebGPU / WASM dans le navigateur,
spaCy ou transformers locaux en Python). Ne nous croyez pas sur parole :
ouvrez les DevTools, surveillez l'onglet réseau ou lisez le code source. Le
projet est sous licence MIT et assez petit pour être audité d'une traite.

<details>
<summary><b>Table des matières</b></summary>

- [Démo](#démo)
- [Essayez-le](#essayez-le)
- [Démarrage rapide (Python)](#démarrage-rapide-python)
- [Démarrage rapide (JavaScript / TypeScript)](#démarrage-rapide-javascript--typescript)
- [Démarrage rapide (proxy local)](#démarrage-rapide-proxy-local)
- [Garde-fou au commit / en CI (`scan`)](#garde-fou-au-commit--en-ci-scan)
- [Pourquoi pas… ?](#pourquoi-pas-)
- [Comment ça marche](#comment-ça-marche)
- [Entités prises en charge](#entités-prises-en-charge)
- [Précision](#précision)
- [Limites](#limites)
- [Feuille de route](#feuille-de-route)
- [Contributing / Security / License](#contributing--security--license)

</details>

## Démo

Anonymiser → le mapping reste local → la réponse du LLM conserve les
étiquettes → restaurer :

<img alt="Démo de l'app navigateur : anonymisation, mapping et restauration aller-retour" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_web.gif?raw=true" width="85%">

<details>
<summary>Démo de la CLI (japonais / anglais — les huit autres langues fonctionnent de la même façon)</summary>

<img alt="Démo de la CLI (japonais)" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_ja.gif?raw=true" width="49%"> <img alt="Démo de la CLI (anglais)" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_en.gif?raw=true" width="49%">
</details>

<details>
<summary>Démo de l'extension Chrome (panneau latéral)</summary>

<img alt="Démo de l'extension Chrome" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_extension.gif?raw=true" width="40%">
</details>

## Essayez-le

| Cible | Comment | Notes |
|---|---|---|
| **Navigateur (WebGPU)** | [akazah.github.io/prompt-anonymizer](https://akazah.github.io/prompt-anonymizer/) | 100 % sur l'appareil : le NER s'exécute dans votre navigateur via WebGPU (repli WASM). Votre texte n'est jamais envoyé à un serveur — vérifiez-le dans l'onglet réseau. |
| **App de bureau** | Téléchargez depuis [Releases](https://github.com/akazah/prompt-anonymizer/releases) (`.dmg` / `.msi` / `.exe` / `.AppImage` / `.deb` / `.rpm`) | Tauri 2. Non signée pour l'instant — votre OS affichera un avertissement au premier lancement. |
| **Extension Chrome** | `prompt-anonymizer-extension-*.zip` depuis [Releases](https://github.com/akazah/prompt-anonymizer/releases) | Décompressez → `chrome://extensions` → activez le mode développeur → « Charger l'extension non empaquetée ». Sélectionnez du texte → clic droit → *Anonymize selection*. |
| **Python / CLI** | `pip install git+https://github.com/akazah/prompt-anonymizer` (pas encore sur PyPI) | Presidio + spaCy. Voir le démarrage rapide ci-dessous. |
| **CLI Node (npx)** | `npx @prompt-anonymizer/cli` (pas encore sur npm — à compiler depuis `web/packages/cli`) | Mêmes commandes et options que la CLI Python ; NER transformers.js, entièrement sur l'appareil. |
| **Web Component** | `@prompt-anonymizer/element` (pas encore sur npm) | Élément `<prompt-anonymizer>` indépendant du framework : intégrez le panneau complet anonymiser → restaurer dans n'importe quel site (HTML pur, Svelte, Angular, …). |
| **React / Vue** | `@prompt-anonymizer/react` / `@prompt-anonymizer/vue` (pas encore sur npm) | Composant `<AnonymizerPanel />` prêt à l'emploi plus un hook `useAnonymizer()` / composable pour les interfaces personnalisées. Voir le démarrage rapide ci-dessous. |
| **Proxy local + GUI d'administration** | `@prompt-anonymizer/proxy` (pas encore sur npm — à compiler depuis `web/packages/proxy`) | Proxy inverse compatible OpenAI : pointez `OPENAI_BASE_URL` vers lui et les PII sont masquées avant de quitter votre machine, les étiquettes étant restaurées dans les réponses (streaming inclus). GUI d'administration sur `http://127.0.0.1:8787/admin/`. Voir le démarrage rapide ci-dessous. |
| **Hook de commit / garde-fou CI** | `prompt-anonymizer scan` (les deux CLI) + [`.pre-commit-hooks.yaml`](../../.pre-commit-hooks.yaml) | Garde-fou PII par code de sortie pour les vérifications au commit et en CI : rapporte `file:line:col` et le type d'entité, jamais le texte détecté. Hors ligne et sans modèle par défaut. Voir ci-dessous. |

## Démarrage rapide (Python)

```bash
# Pas encore publié sur PyPI - installez depuis GitHub (un tag, ou main pour la dernière version) :
pip install git+https://github.com/akazah/prompt-anonymizer@v0.2.2
python -m spacy download ja_core_news_sm   # en: en_core_web_sm; es: es_core_news_sm
python -m spacy download xx_ent_wiki_sm    # vi : pas de pipeline spaCy officiel — WikiNER
# zh: zh_core_web_sm; ko: ko_core_news_sm; fr/de/pt/it: *_core_news_sm — ou
# installez tous les modèles sm d'un coup : uv sync --group models (lg : --group models-lg)
```

```python
from prompt_anonymizer import PromptAnonymizer

pa = PromptAnonymizer(languages=["ja"])
result = pa.anonymize("山田太郎の電話は090-1234-5678", language="ja")

result.text     # '<人名_1>の電話は<電話番号_1>'
result.mapping  # {'<人名_1>': '山田太郎', '<電話番号_1>': '090-1234-5678'}

pa_es = PromptAnonymizer(languages=["es"])
pa_es.anonymize(
    "El cliente es Javier Moreno, teléfono 612 345 678", language="es"
).text  # 'El cliente es <Nombre_1>, teléfono <Teléfono_1>'

# les noms vi nécessitent le backend transformer (voir « Backend NER transformer optionnel »)
pa_vi = PromptAnonymizer(languages=["vi"], ner_backend="hf")
pa_vi.anonymize(
    "Tôi tên là Nguyễn Văn An, số điện thoại 0912 345 678", language="vi"
).text  # 'Tôi tên là <Tên_1>, số điện thoại <SốĐiệnThoại_1>'

llm_output = call_your_llm(result.text)          # les étiquettes survivent à l'aller-retour
pa.deanonymize(llm_output, result.mapping)       # valeurs réelles restaurées, en local
```

CLI (`-l ja|en|es|vi|zh|ko|fr|de|pt|it`) :

```bash
prompt-anonymizer anonymize -l ja --interactive --mapping-file mapping.json \
  -t "山田太郎の電話は090-1234-5678"
prompt-anonymizer anonymize -l es -t "El cliente es Javier Moreno, teléfono 612 345 678"
prompt-anonymizer anonymize -l fr -t "Le client est Pierre Durand, téléphone 06 12 34 56 78"
prompt-anonymizer deanonymize --mapping-file mapping.json -t "<人名_1>様 ..."
```

## Démarrage rapide (JavaScript / TypeScript)

La CLI Node reproduit la CLI Python (mêmes commandes, options et sortie
JSON), en exécutant le cœur TypeScript avec le NER transformers.js sur
l'appareil :

```bash
# Pas encore publié sur npm — à compiler depuis le dépôt :
cd web && pnpm install && pnpm --filter "./packages/*" build
node packages/cli/dist/cli.js anonymize -t "山田太郎の電話は090-1234-5678"
# Une fois publié : npx @prompt-anonymizer/cli anonymize -t "..."
```

Pour intégrer le panneau anonymiser → restaurer prêt à l'emploi dans
n'importe quel frontend, utilisez le web component indépendant du
framework :

```html
<script type="module">
  import { definePromptAnonymizer } from "@prompt-anonymizer/element";
  definePromptAnonymizer();
</script>
<prompt-anonymizer language="auto"></prompt-anonymizer>
```

React (`@prompt-anonymizer/react`) et Vue 3 (`@prompt-anonymizer/vue`)
fournissent un `<AnonymizerPanel />` typé qui enveloppe cet élément :

```tsx
import { AnonymizerPanel } from "@prompt-anonymizer/react"; // ou "@prompt-anonymizer/vue"

<AnonymizerPanel language="auto" denyList={["ProjectX"]}
  onAnonymize={(result) => console.log(result.text)} />
```

Pour les interfaces personnalisées, les deux paquets exposent aussi la
session anonymiser → LLM → restaurer sous forme de hook / composable :

```ts
import { useAnonymizer } from "@prompt-anonymizer/react"; // ou "@prompt-anonymizer/vue"

const { anonymize, restore, mapping, busy, error } = useAnonymizer();
const result = await anonymize(input, { language: "ja" });
// envoyez result.text au LLM — le mapping ne quitte jamais l'appareil — puis :
const { text: restored, unresolved } = await restore(llmReply);
```

Par défaut, la détection repose uniquement sur des expressions régulières
(e-mails, numéros de téléphone, …) ; passez un `ner` (p. ex.
`new TransformersNerBackend()` de `@prompt-anonymizer/core`) pour masquer
aussi les noms et les lieux.

## Démarrage rapide (proxy local)

Lancez le proxy compatible OpenAI et pointez n'importe quel client vers
lui — les PII sont masquées avant que la requête ne quitte votre machine et
les étiquettes sont restaurées dans la réponse (streaming inclus). Les
mappings restent dans la mémoire du proxy, par requête :

```bash
# Pas encore publié sur npm — à compiler depuis le dépôt :
cd web && pnpm install && pnpm --filter @prompt-anonymizer/proxy... build
node packages/proxy/dist/cli.js            # écoute sur http://127.0.0.1:8787
# Une fois publié : npx @prompt-anonymizer/proxy

# Dans votre app / shell :
export OPENAI_BASE_URL=http://127.0.0.1:8787/v1
```

La GUI d'administration sur `http://127.0.0.1:8787/admin/` affiche l'état en
direct et les événements de masquage (étiquettes et décomptes uniquement),
permet d'éditer la configuration du proxy (upstream, NER, listes deny/allow)
et offre un bac à sable d'anonymisation strictement local. Le proxy écoute
sur `127.0.0.1` par défaut ; les valeurs originales ne peuvent être révélées
dans la GUI que si vous activez explicitement `--record-mappings`.

## Garde-fou au commit / en CI (`scan`)

Les deux CLI incluent une sous-commande `scan` conçue pour les hooks git et
la CI : elle sort avec le code `0` quand les entrées sont propres, `1` quand
des PII sont trouvées et `2` en cas d'erreur. Elle ne rapporte que
`file:line:col` et le type d'entité — **le texte détecté n'est jamais
imprimé**, si bien que la sortie du hook et les logs de CI restent exempts
de PII. Par défaut, elle est hors ligne, déterministe et sans modèle (PII
structurées : e-mails, numéros de téléphone, codes postaux JP, My Number,
cartes de crédit — plus les termes `--deny`) ; `--ner` active la détection
des noms/lieux là où des modèles sont disponibles.

```bash
prompt-anonymizer scan src/prompt.txt docs/*.md      # fichiers (p. ex. en stage)
git diff --cached -U0 | prompt-anonymizer scan       # ou passez un diff en pipe
prompt-anonymizer scan --deny ProjectX --json -t "..."
```

Avec le framework [pre-commit](https://pre-commit.com)
(définition du hook : [`.pre-commit-hooks.yaml`](../../.pre-commit-hooks.yaml)) :

```yaml
repos:
  - repo: https://github.com/akazah/prompt-anonymizer
    rev: v0.2.2  # premier tag qui fournit ce hook
    hooks:
      - id: prompt-anonymizer-scan
        # args: [--deny, ProjectX, --allow, support@example.com]
```

Les projets Node peuvent brancher le même garde-fou via husky + lint-staged
(`npx @prompt-anonymizer/cli` une fois publié ; d'ici là, compilez depuis
`web/packages/cli`) :

```json
{ "lint-staged": { "*": "prompt-anonymizer scan" } }
```

Comme tout le reste ici, la détection fonctionne au mieux : considérez
`scan` comme un filet de sécurité contre les fuites évidentes, pas comme une
garantie.

## Pourquoi pas… ?

**Pourquoi ne pas utiliser Presidio directement ?** Utilisez
[Microsoft Presidio](https://github.com/microsoft/presidio) directement si
vous avez besoin d'un framework généraliste de détection / anonymisation de
PII. Prompt Anonymizer utilise Presidio comme moteur de son cœur Python et
ajoute par-dessus le flux aller-retour avec le LLM : placeholders cohérents,
prompt anonymisé en sortie, restauration locale après la réponse — plus des
surfaces navigateur, extension et bureau qui ne nécessitent aucun Python.

**Pourquoi pas LLM Guard ?** [LLM Guard](https://github.com/protectai/llm-guard)
est une solide suite de garde-fous côté Python avec ses propres
Anonymize/Deanonymize. Prompt Anonymizer s'en distingue sur trois points :
une détection pensée d'abord pour le japonais (noms japonais, adresses,
My Number avec validation du chiffre de contrôle), des surfaces pour
non-développeurs (collez du texte dans une page de navigateur — aucune
installation Python) et une base de code assez petite pour être réellement
lue.

**Pourquoi pas une extension Chrome « 100 % locale » ?** Plusieurs
extensions closed-source revendiquent un traitement local. Une affirmation
n'est pas un audit. Ce projet est sous licence MIT : ouvrez l'onglet réseau
ou lisez le code source. (Des extensions malveillantes de « confidentialité
IA » qui exfiltrent des conversations ont été documentées — la catégorie a
mérité ce scepticisme.)

## Comment ça marche

1. Détection — NER Presidio + spaCy (Python) ou NER transformers.js +
   reconnaisseurs regex (navigateur/bureau/extension), étendus par des
   motifs téléphoniques par région pilotés par le registre (JP, US/NANP, ES,
   VN, CN, KR, FR, DE, PT, IT) et des reconnaisseurs spécifiques au Japon
   (codes postaux 〒, My Number avec validation du chiffre de contrôle). Les
   e-mails et les cartes de crédit sont indépendants de la langue ;
   JP_POSTAL_CODE et JP_MY_NUMBER sont détectés dans tous les modes de
   langue.
2. Étiquetage cohérent — les spans sont fusionnés (priorité au score) et
   remplacés par offset depuis la fin ; les valeurs identiques partagent une
   même étiquette.
3. Réversion — `deanonymize(text, mapping)` restaure les originaux,
   l'étiquette la plus longue d'abord. Le mapping vous est renvoyé et n'est
   **jamais persisté** par la bibliothèque ; le stocker en sécurité relève
   de votre responsabilité.

## Entités prises en charge

| Entité | étiquette ja | étiquette en | étiquette es | étiquette vi | Moteur |
|---|---|---|---|---|---|
| PERSON | 人名 | Name | Nombre | Tên | NER |
| LOCATION | 住所 | Location | Dirección | ĐịaChỉ | NER |
| EMAIL_ADDRESS | メールアドレス | Email | Correo | Email | motif |
| PHONE_NUMBER | 電話番号 | Phone | Teléfono | SốĐiệnThoại | motifs par langue pilotés par le registre + régions libphonenumber (JP/US/ES/VN/CN/KR/FR/DE/PT/IT) |
| JP_POSTAL_CODE | 郵便番号 | PostalCode | CódigoPostal | MãBưuĐiện | motif (personnalisé) |
| JP_MY_NUMBER | マイナンバー | MyNumber | MyNumber | MyNumber | motif + chiffre de contrôle (personnalisé) |
| CREDIT_CARD | クレジットカード | CreditCard | Tarjeta | ThẻTínDụng | motif + contrôle de Luhn (les deux cœurs, toutes les langues) |
| CUSTOM (deny list) | 秘匿情報 | Custom | Personalizado | TùyChỉnh | correspondance exacte |
| US_SSN (optionnel) | 社会保障番号 | SSN | SSN | SSN | motif + règles d'invalidation (les deux cœurs, toutes les langues) |
| IBAN_CODE (optionnel) | IBAN | IBAN | IBAN | IBAN | motif + contrôle mod-97 (les deux cœurs, toutes les langues) |

Les étiquettes des six nouvelles langues (zh, ko, fr, de, pt, it) sont
fournies dans `src/prompt_anonymizer/labels/*.yaml` (Python) et dans
`LABELS` dans `web/packages/core/src/labeling.ts` (TS).

`deny_list` force le masquage de chaînes précises ; `allow_list` les en
exempte. Les entités optionnelles ne sont pas détectées par défaut —
demandez-les explicitement : `PromptAnonymizer(entities=[...])`,
`new Anonymizer({ entities })` ou
`--entities PERSON,EMAIL_ADDRESS,US_SSN,IBAN_CODE` sur l'une ou l'autre CLI.

### Backend NER transformer optionnel (Python)

Le NER par défaut est spaCy, le modèle de chaque langue étant résolu depuis
le registre central (voir le tableau ci-dessous ; installez tous les modèles
`sm` avec `uv sync --group models`, les `lg` avec `--group models-lg`, ou
utilisez `python -m spacy download <modèle>`). Le vietnamien n'a pas de
pipeline spaCy officiel — les deux tailles de modèle utilisent le modèle
WikiNER multilingue `xx_ent_wiki_sm` pour la tokenisation et un NER PER/LOC
de base. Pour un bon rappel des noms/lieux vietnamiens, utilisez plutôt le
backend transformer (voir ci-dessous).

Pour un rappel PERSON/LOCATION nettement meilleur (surtout `ja` et `vi`),
installez l'extra `hf` et changez de backend — modèles Hugging Face par
langue, entièrement en local :

| Langue | spaCy (`sm` / `lg`) | HF NER (`ner_backend="hf"`) |
|---|---|---|
| `ja` | `ja_core_news_sm` / `ja_core_news_lg` | `tsmatz/xlm-roberta-ner-japanese` |
| `en` | `en_core_web_sm` / `en_core_web_lg` | `dslim/bert-base-NER` |
| `es` | `es_core_news_sm` / `es_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `vi` | `xx_ent_wiki_sm` (les deux tailles) | `NlpHUST/ner-vietnamese-electra-base` |
| `zh` | `zh_core_web_sm` / `zh_core_web_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `ko` | `ko_core_news_sm` / `ko_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `fr` | `fr_core_news_sm` / `fr_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `de` | `de_core_news_sm` / `de_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `pt` | `pt_core_news_sm` / `pt_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `it` | `it_core_news_sm` / `it_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |

Le modèle HRL multilingue couvre nativement `de`/`es`/`fr`/`it`/`pt`/`zh` ;
le coréen n'a pas de checkpoint dédié dans cette famille et repose sur le
transfert interlingue de mBERT.

Le cœur TypeScript (navigateur / extension / bureau / CLI Node) exécute des
modèles ONNX transformers.js : `ja` et `en` utilisent les mêmes familles que
ci-dessus ; `es`, `vi`, `zh`, `ko`, `fr`, `de`, `pt` et `it` utilisent tous
`Xenova/bert-base-multilingual-cased-ner-hrl` (il n'existe pas d'export ONNX
d'un modèle NER vietnamien dédié ; le modèle multilingue se transfère bien
au vietnamien, et la même réserve de transfert s'applique au coréen).

```bash
pip install "prompt-anonymizer[hf]"
```

```python
pa = PromptAnonymizer(languages=["ja"], ner_backend="hf")  # CLI: --ner-backend hf
pa_vi = PromptAnonymizer(languages=["vi"], ner_backend="hf")  # recommandé pour les noms vi
```

Le traitement par lots est également disponible et bien plus rapide qu'une
boucle :

```python
results = pa.anonymize_batch(texts, language="ja", batch_size=16)
```

## Précision

Mesurée au niveau des spans sur un jeu doré synthétique généré avec graine
(200 documents pour chacune des dix langues dans
`tests/golden/golden_{lang}.json`) — voir [docs/EVAL.md](../EVAL.md) pour
le tableau complet et `uv run python -m prompt_anonymizer.evals` pour
reproduire (les dix langues par défaut). Points saillants (cœur Python,
modèles `sm`) : rappel 1.00 pour ja PHONE_NUMBER / EMAIL_ADDRESS /
JP_POSTAL_CODE / CREDIT_CARD ; rappel ja PERSON de 0.82 avec spaCy, 1.00
avec `ner_backend="hf"`. Le rappel es/vi PHONE_NUMBER est aussi de 1.00 ;
vi PERSON/LOCATION bénéficient fortement de `ner_backend="hf"`. Le rappel
des PII structurées (téléphone / e-mail / carte) est de 1.00 pour les six
nouvelles langues (zh, ko, fr, de, pt, it) sur le jeu doré —
[docs/EVAL.md](../EVAL.md) contient le tableau du cœur TS ; les chiffres
NER Python sont produits par l'évaluation hebdomadaire.

Ces chiffres servent à détecter des régressions, pas à promettre un rappel
sur du texte réel.

## Limites

- **La détection fonctionne au mieux et n'est pas garantie.** Des faux
  négatifs se produisent ; relisez toujours le texte anonymisé avant de
  l'envoyer où que ce soit (`--interactive` et les tableaux de mapping dans
  les interfaces existent pour cela).
- L'anonymisation masque les identifiants, pas le contexte. Des détails
  quasi identifiants dans le texte environnant (un intitulé de poste rare,
  un événement précis) peuvent encore réduire le champ de qui ou de quoi
  vous parlez.
- LOCATION est l'entité au rappel le plus faible, surtout pour les adresses
  japonaises partielles.
- Le modèle NER du navigateur représente un téléchargement unique d'environ
  100–300 Mo (mis en cache ensuite).
- Les builds bureau et extension ne sont pas signés pour l'instant.

## Feuille de route

Consultez les [issues](https://github.com/akazah/prompt-anonymizer/issues)
ouvertes et [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md). Points
saillants : publication sur npm / PyPI, publication sur les stores (Chrome
Web Store), signature du code, modèles NER japonais plus petits, PII
structurées multi-régions (plus de formats de téléphone / d'identifiants
nationaux avec validation par somme de contrôle), serveur MCP.

## Contributing / Security / License

- [CONTRIBUTING.md](../../.github/CONTRIBUTING.md) — configuration de développement (uv / pnpm), commandes de test et d'évaluation
- [SECURITY.md](../../.github/SECURITY.md) — signalement des vulnérabilités et des contournements d'anonymisation
- [MIT](../../LICENSE)
