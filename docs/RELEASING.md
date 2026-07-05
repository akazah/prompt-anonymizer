# Releasing

Everything is driven by a `v*` tag push. One tag produces:

| Artifact | Workflow | Destination |
| --- | --- | --- |
| sdist + wheel | `release.yml` | PyPI (Trusted Publishing) + GitHub Release |
| `prompt-anonymizer-web-<ver>.zip` / `prompt-anonymizer-extension-<ver>.zip` | `release-apps.yml` | GitHub Release |
| Tauri desktop bundles (`.dmg` / `.msi` / `.AppImage` / `.deb`) | `release-apps.yml` | GitHub Release |

The browser app on GitHub Pages is deployed separately, on every push to
`main` that touches `web/**` (`pages.yml`) — it is not tied to tags.

## One-time repository setup

These cannot be automated from a workflow and must be done once by a repo
admin. Until they are done, the corresponding pipeline fails:

1. **GitHub Pages** — Settings → Pages → *Build and deployment* → Source:
   **GitHub Actions**. Without this, `pages.yml` fails at `deploy-pages`
   with `Failed to create deployment (status: 404)` because the `GITHUB_TOKEN`
   is not allowed to create the Pages site itself.
   After enabling, re-run the latest "Deploy web app to GitHub Pages" run
   (or push to `main`).
2. **PyPI Trusted Publishing** — on [pypi.org](https://pypi.org/manage/account/publishing/),
   add a *pending publisher* for project `prompt-anonymizer`:
   owner `akazah`, repository `prompt-anonymizer`, workflow `release.yml`,
   environment `pypi`. The `pypi` environment already exists in the repo
   (Settings → Environments); optionally add required reviewers to gate
   publishes.

## Release steps

1. Make sure `main` is green and the version is consistent everywhere.
   The single Python source of truth is `pyproject.toml` +
   `src/prompt_anonymizer/__init__.py`; the web side has its own copies:

   ```bash
   rg '"version"|^version|__version__' pyproject.toml src/prompt_anonymizer/__init__.py \
     web/package.json web/packages/core/package.json web/apps/web/package.json \
     web/apps/extension/package.json web/apps/extension/public/manifest.json \
     web/apps/desktop/package.json web/apps/desktop/src-tauri/tauri.conf.json \
     web/apps/desktop/src-tauri/Cargo.toml
   ```

   Bump them in one PR, run `uv lock` to refresh `uv.lock`, and move the
   `[Unreleased]` section of `CHANGELOG.md` to the new version.
2. Merge the release PR into `main`.
3. Tag and push:

   ```bash
   git checkout main && git pull
   git tag v0.2.0
   git push origin v0.2.0
   ```

4. Watch the two release workflows (`Release (PyPI)` and
   `Release (Desktop / Extension / Web)`). Both attach artifacts to the same
   GitHub Release for the tag. The desktop matrix (2× macOS, Linux, Windows)
   is the slowest leg.
5. Verify:
   - `pip install prompt-anonymizer==<ver>` works.
   - The GitHub Release lists wheel/sdist, web zip, extension zip, and
     desktop bundles for all four targets.
   - The Pages site serves the latest `main`.

## After the release

Start the next cycle by bumping to `<next>.dev0` in `pyproject.toml` and
`src/prompt_anonymizer/__init__.py` (plus `uv lock`), so development builds
are distinguishable from the released version.

Known gaps (tracked on the roadmap, not blockers):

- Chrome Web Store publication is manual; the release zip is for
  developer-mode loading.
- Desktop bundles are unsigned (no macOS notarization / Windows signing).
