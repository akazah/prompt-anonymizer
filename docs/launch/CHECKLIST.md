# Launch checklist — publish + announce in one push

Goal: go from "installable only from the repo" to "one-command install
everywhere", and announce it once, loudly, when that is true. Mechanics of
tagging/building live in [../RELEASING.md](../RELEASING.md); this file is the
growth-facing runbook on top of it.

Everything below is written so a repo admin can execute top-to-bottom in one
sitting (registry account setup aside).

## 0. Pre-flight (repo-side, no external effect)

- [x] Per-package `README.md` + `LICENSE` for every publishable npm package
      (`core`, `cli`, `element`, `react`, `vue`, `proxy`, `mcp`) — the npm
      package page renders the README; without one the listing is blank.
- [x] `homepage` / `bugs` fields in each publishable `package.json`.
- [x] **Version consistency.** First published release uses `0.3.0` (bumped in
      the release PR; `rg` one-liner in [../RELEASING.md](../RELEASING.md)
      lists all version files).
- [ ] Local dry-runs pass: `uv build` and
      `cd web && pnpm --filter "./packages/*" build && pnpm --filter "./packages/*" exec pnpm pack`
      (inspect a tarball: it should contain `dist/`, `README.md`,
      `LICENSE`, `package.json` and nothing else).

## 1. PyPI

1. On [pypi.org](https://pypi.org/manage/account/publishing/), add a
   *pending publisher* for project `prompt-anonymizer`
   (owner `akazah`, repo `prompt-anonymizer`, workflow `release.yml`,
   environment `pypi`).
2. Set repository variable `PYPI_PUBLISH=true`.
3. The next `v*` tag publishes automatically. Verify with
   `pip install prompt-anonymizer==<ver>`.

## 2. npm

1. Create the `@prompt-anonymizer` org scope on npmjs.com.
2. First-ever publish of each package may need a one-time manual
   `pnpm publish` (from a built checkout) before a trusted publisher can be
   attached; then add trusted publishers (repo `akazah/prompt-anonymizer`,
   workflow `release-npm.yml`, environment `npm`) for `core`, `cli`,
   `element`, `react`, `vue`, `proxy`, `mcp`.
3. Create the `npm` environment in repo settings; set `NPM_PUBLISH=true`.
4. Verify: `npx @prompt-anonymizer/cli@<ver> version` and
   `npx @prompt-anonymizer/proxy@<ver> --help`.
5. Publishing via the workflow uses OIDC provenance — the npm page shows the
   "Built and signed on GitHub Actions" badge. Keep it that way; it is a
   trust signal this project's category depends on.

## 3. Chrome Web Store

1. Register a developer account (one-time $5 fee) at the
   [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Upload the `prompt-anonymizer-extension-<ver>.zip` release asset.
3. Listing copy and screenshots: see
   [chrome-web-store-listing.md](chrome-web-store-listing.md).
4. Privacy tab: declare that the extension collects **no** user data and
   makes no remote calls except the one-time Hugging Face model download;
   the single-purpose description is PII anonymization. Justify permissions
   (`contextMenus`, `sidePanel`, `storage`).
5. Expect a review round-trip (days, sometimes weeks for extensions with
   broad host permissions). Answer reviewer questions by pointing at the
   open source — that is the point of this project.

## 4. README cleanup (same PR as the switch-flip)

Once packages are live, delete every "not on PyPI/npm yet" caveat in
`README.md` / `README_ja.md` / `README_es.md` / `README_vi.md` and replace
the build-from-repo instructions with the one-liners
(`pip install prompt-anonymizer`, `npx @prompt-anonymizer/cli`, …).
Run `pnpm -C web docs:links` after editing.

## 5. Repo polish (GitHub settings, 5 minutes)

- [ ] Settings → Social preview: upload the 1280×640 card
      (see [social-preview.md](social-preview.md)).
- [ ] Pin the launch announcement Discussion once posted.

## 6. Announce (in this order, each linking the previous)

All drafts live in this directory — review, personalize, then post:

| Where | Draft | Timing |
| --- | --- | --- |
| Zenn (ja) | [zenn-article-ja.md](zenn-article-ja.md) | Day 0 — reaches a privacy-conscious dev audience in one of the four supported languages |
| Hacker News (Show HN) | [show-hn.md](show-hn.md) | Day 0–1, weekday morning US time |
| Reddit r/LocalLLaMA, r/privacy | adapt [show-hn.md](show-hn.md) | Day 1–2 |
| awesome-list PRs | [awesome-list-blurbs.md](awesome-list-blurbs.md) | Day 2+ (steady inbound afterwards) |
| GitHub Discussions "Show and tell" | short version of the Zenn article | Day 0 |

Rules of thumb: answer every comment in the first 24 h; the "open DevTools
and watch the network tab" demo is the strongest reply to skepticism; never
argue — link the source.

## 7. Contributor on-ramp (right after the traffic spike)

- [ ] File the prepared issues from [issues-to-file.md](issues-to-file.md)
      with `good first issue` / `help wanted` labels — arriving visitors who
      see zero open issues assume the project is done or dormant.
- [ ] Enable the Discussions welcome post pointing newcomers at
      `CONTRIBUTING.md` and the labeled issues.
