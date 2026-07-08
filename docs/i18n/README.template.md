# README template outline

Do not edit generated `README.md` or `docs/i18n/README_*.md` by hand.
Change locale strings under `docs/i18n/locales/` and regenerate:

```bash
uv run python scripts/render_readme_i18n.py
```

The renderer concatenates, in order:

- `{{ sections.preamble }}` — see `locales/<code>.yaml`
- `{{ sections.demo }}` — see `locales/<code>.yaml`
- `{{ sections.try_it }}` — see `locales/<code>.yaml`
- `{{ sections.quickstart_python }}` — see `locales/<code>.yaml`
- `{{ sections.quickstart_js }}` — see `locales/<code>.yaml`
- `{{ sections.quickstart_proxy }}` — see `locales/<code>.yaml`
- `{{ sections.quickstart_mcp }}` — see `locales/<code>.yaml`
- `{{ sections.scan }}` — see `locales/<code>.yaml`
- `{{ sections.why_not }}` — see `locales/<code>.yaml`
- `{{ sections.how_it_works }}` — see `locales/<code>.yaml`
- `{{ sections.supported_entities }}` — see `locales/<code>.yaml`
- `{{ sections.accuracy }}` — see `locales/<code>.yaml`
- `{{ sections.limitations }}` — see `locales/<code>.yaml`
- `{{ sections.roadmap }}` — see `locales/<code>.yaml`
- `{{ sections.contributing }}` — see `locales/<code>.yaml`

The language switcher (first line) is generated from `config.yaml`.

