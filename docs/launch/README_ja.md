# ローンチ計画（ランチ計画）

**最終更新:** 2026-07-09 · **対象リリース:** v0.3.1

v0.3.1 は「リポジトリからビルドして使う」状態から「`pip install` / `npx` で
ワンコマンド導入できる」状態へ切り替える初回公開リリースです。公開と
同時に一度だけ大きく告知する前提で、手順と原稿をこのディレクトリに
集約しています。

英語の実行チェックリストは [CHECKLIST.md](CHECKLIST.md)。タグ付け・
ビルドの詳細は [../RELEASING.md](../RELEASING.md)。

## 現在地サマリー

| 区分 | 状態 | メモ |
| --- | --- | --- |
| コード・バージョン | ✅ 完了 | `0.3.1`（PyPI / npm 全パッケージで一致） |
| パッケージ README / LICENSE | ✅ 完了 | 公開対象 npm 7 パッケージすべて |
| ローカル dry-run | ✅ 完了 | `uv build`、全 npm `pnpm pack` 成功（2026-07-08） |
| デモ GIF（全言語） | ✅ 完了 | README 埋め込み用に再生成済み（PR #33） |
| Social preview 画像 | ✅ 資産あり | `demo/social-preview.png` — GitHub 設定へのアップロードは未 |
| PyPI Trusted Publishing | ⏳ 管理者作業 | `PYPI_PUBLISH=true` + pending publisher 登録 |
| npm Trusted Publishing | ⏳ 管理者作業 | `@prompt-anonymizer` org + `NPM_PUBLISH=true` |
| README の「未公開」注記削除 | ✅ 完了 | 全言語 README を `pip install` / `npx` ワンライナーに統一 |
| Chrome Web Store | ⏳ 未着手 | リリース zip は GitHub Releases から取得可 |
| 告知投稿 | ⏳ 公開後 | 下記タイムライン参照 |

## ゴール

1. **配布:** PyPI + npm で `prompt-anonymizer` / `@prompt-anonymizer/*` を
   インストール可能にする（OIDC 署名付き）。
2. **README:** 全言語 README から `git+https://…` や「まだ PyPI/npm にない」
   注記を消し、ワンライナーに統一する。
3. **告知:** パッケージが live になった直後に、Zenn → Show HN → Reddit →
   awesome-list PR の順で一気に出す。
4. **コントリビュータ入口:** トラフィックが来たら
   [issues-to-file.md](issues-to-file.md) の 10 件を Issue 化する。

## 公開前（リポジトリ側 — この PR で完了可能）

- [x] `uv build` が成功する
- [x] `pnpm --filter "./packages/*" build && … pack` が成功する
- [x] tarball に `dist/` / `README.md` / `LICENSE` / `package.json` のみ（余計なファイルなし）
- [x] 全 `docs/i18n/README_*.md` の PyPI/npm 未公開注記を削除（`README_it.md` 含む）
- [x] 告知原稿のバージョン表記を `v0.3.1` に統一（Zenn の pre-commit 例など）

## 公開スイッチ（リポジトリ管理者 — 外部アカウント）

### PyPI

1. [pypi.org](https://pypi.org/manage/account/publishing/) で pending publisher を登録
   （project: `prompt-anonymizer`, workflow: `release.yml`, environment: `pypi`）
2. GitHub リポジトリ変数 `PYPI_PUBLISH=true`
3. `v0.3.1` タグを push → `pip install prompt-anonymizer==0.3.1` で確認

### npm

1. npm で `@prompt-anonymizer` org を作成
2. 初回は手動 `pnpm publish` が必要な場合あり → trusted publisher 登録
   （workflow: `release-npm.yml`, environment: `npm`）
3. `NPM_PUBLISH=true` → `npx @prompt-anonymizer/cli@0.3.1 version` で確認

### README 最終掃除（packages live 確認後、同 PR または follow-up）

`README.md` と全 `docs/i18n/README_*.md` から未公開 caveat を削除。
`pnpm -C web docs:links` を実行。

## 公開後（順番厳守）

| 日 | チャネル | 原稿 | 備考 |
| --- | --- | --- | --- |
| Day 0 | Zenn（ja） | [zenn-article-ja.md](zenn-article-ja.md) | 体験談・スクショを自分のものに差し替えてから |
| Day 0 | GitHub Discussions | Zenn の短縮版 | 「Show and tell」カテゴリ |
| Day 0–1 | Hacker News Show HN | [show-hn.md](show-hn.md) | 平日朝（US 時間） |
| Day 1–2 | Reddit r/LocalLLaMA, r/privacy | show-hn を適宜短縮 | |
| Day 2+ | awesome-list PRs | [awesome-list-blurbs.md](awesome-list-blurbs.md) | リストごとに 1 PR |
| 並行 | Chrome Web Store | [chrome-web-store-listing.md](chrome-web-store-listing.md) | 審査は数日〜数週 |
| 公開直後 | GitHub 設定 | [social-preview.md](social-preview.md) | Social preview に PNG をアップロード |
| 公開直後 | Issue 10 件 | [issues-to-file.md](issues-to-file.md) | `good first issue` ラベル付き |

**ルール:** 最初の 24 時間はコメントに全部返信する。疑われたら DevTools の
ネットワークタブデモが最強。ソースへのリンクで議論を終わらせる。

## 告知で強調するポイント（v0.3.1）

- **立ち位置は「ポカヨケ／ダブルチェック」** — 「LLM に貼らない」という
  既存ルールへの二層目。うっかり送信を端末内で捕まえる（一次保証ではなく裏打ち）
- **10 言語**（en, ja, es, vi, zh, ko, fr, de, pt, it）— レジストリ駆動で
  両コアがパリティ
- **完全オンデバイス** — ブラウザは WebGPU/WASM、Python は spaCy / ローカル HF
- **一貫・可逆ラベル** — `<人名_1>` 形式、mapping は端末外に出さない
- **多面展開** — ブラウザ / 拡張 / デスクトップ / Python・Node CLI /
  OpenAI 互換プロキシ / **MCP サーバー** / pre-commit `scan` ゲート
- **正直な限界** — ベストエフォート検出、LOCATION が最弱、送信前レビュー必須

## 原稿一覧

| ファイル | 用途 |
| --- | --- |
| [CHECKLIST.md](CHECKLIST.md) | 英語・管理者向け実行チェックリスト |
| [zenn-article-ja.md](zenn-article-ja.md) | Zenn 投稿ドラフト |
| [show-hn.md](show-hn.md) | Show HN タイトル・初コメント |
| [awesome-list-blurbs.md](awesome-list-blurbs.md) | awesome-list 用 1 行説明 |
| [chrome-web-store-listing.md](chrome-web-store-listing.md) | CWS 掲載文 |
| [social-preview.md](social-preview.md) | OG カード生成手順 |
| [issues-to-file.md](issues-to-file.md) | 公開後に切る Issue 10 件 |

## リスク・ブロッカー

| リスク | 対策 |
| --- | --- |
| PyPI/npm スイッチを忘れてタグだけ push | CHECKLIST の順序どおり、変数を先に ON |
| イタリア語 README だけ旧 install 手順 | 本 PR で修正済み |
| CWS 審査が告知より遅い | Releases の zip + Load unpacked で先行 |
| 拡張・デスクトップ未署名 | README に理由と手順を明記済み — 署名は Issue 化 |

## 次のアクション（優先順）

1. **PyPI / npm の trusted publisher を登録し、公開フラグを ON**
2. **`v0.3.1` タグを push** → install 確認
3. **Social preview を GitHub にアップロード**
4. **Zenn + Show HN を同日投稿**
5. **Issue 10 件を file**
