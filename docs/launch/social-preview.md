# Social preview (Open Graph) card

GitHub repo setting: Settings → General → Social preview → upload
`demo/social-preview.png` (1280×640). This image is what X/Slack/Discord/
Zenn render when the repo URL is shared — without it, links show a bare
avatar.

The committed asset is generated from `demo/scripts/social-preview.html`
(self-contained, system fonts — needs a CJK font installed, e.g.
`fonts-noto-cjk`) via Playwright's Chromium:

```bash
cd web && node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
  await page.goto('file://' + process.cwd() + '/../demo/scripts/social-preview.html');
  await page.screenshot({ path: '../demo/social-preview.png' });
  await browser.close();
})();"
```

Regenerate whenever the tagline or supported languages change. Keep the
design rule of the card: show all ten languages as equals (no single
language leads — the same name → label round-trip in each), and the
on-device claim. No feature lists.
