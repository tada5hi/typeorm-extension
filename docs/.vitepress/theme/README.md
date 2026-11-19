# Docs theme

A thin extension of VitePress's default theme. It follows the routup docs theme (`@routup/docs-theme`), kept local because this repository has one site.

## Decisions

- **Palette:** slate and sky, from the logo. The database piece is slate (`#7C8DA6`), the extension piece sky (`#0EA5E9`). All colours are `--te-*` tokens in `styles/tokens.css` and are bridged to VitePress's `--vp-c-brand-*` variables there.
- **Contrast:** buttons with white text use sky 700/800 (sky 600 is below 4.5:1). Text on light surfaces uses `--te-color-primary-text` (sky 700, sky 400 in dark mode).
- **Fixed dark surfaces:** the hero, code panels and footer use `--te-surface-dark*` / `--te-on-dark*` and stay dark in both colour modes.
- **Typeface:** VitePress's bundled Inter and its monospace stack. No extra font dependency.
- **No Tailwind:** plain CSS with custom properties.
- **Landing copy lives in `docs/index.md` frontmatter.** Each section is its own component in `../components/home/`, and `TeHome.vue` only composes them.
- **Chrome:** the nav is transparent over the hero while the page is at the top (`pageClass: te-home`, `styles/chrome.css`), and `Layout.vue` mounts `TeFooter` on every page. Footer columns come from `themeConfig.teFooter` in `config.mjs`.

## Files

| Path | Holds |
|------|-------|
| `styles/tokens.css` | Colour and font tokens, VitePress variable bridge |
| `styles/components.css` | `TeSection`, `TeHeading`, `TeCard`, `TeButton`, `TeCodePanel` |
| `styles/chrome.css` | Footer and the transparent nav on `te-home` |
| `styles/doc.css` | Code blocks, inline code, custom blocks and tables on guide pages |
| `Layout.vue` | Default layout plus the footer, and the sidebar offset while the footer is in view |
