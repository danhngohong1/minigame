Lumen is a quiet, product-first system: big type, lots of air, one blue for actions, and the product picture doing the talking. Its visual language follows the style of apple.com (measured November 2026). It carries no logos or product imagery of its own; supply your own brand mark.

## Content fundamentals

- **Short and declarative.** A headline is a product name or a 2–4 word claim that ends with a period: "Gifts they'll love." "Pro, further." "Endless entertainment."
- **One idea per tile.** Headline, one subhead line, at most two actions. No paragraphs on a tile.
- **Verbs on buttons.** "Learn more", "Buy", "Shop gifts". Sentence case, no trailing punctuation, no icons inside primary buttons.
- **Speak to the reader as "you"**; the brand never says "we" in headlines.
- **No emoji, no exclamation marks.** Numbers carry claims ("Get up to 3% back"); footnote them in `footnote`.

## Color

- Ground is `surface`; alternate full-width tiles between `surface`, `surface-alt` and `tile-dark-bg` so each product gets its own band. Never two `surface-alt` tiles touching.
- Text is `ink` on light grounds, `tile-dark-ink` on `tile-dark-bg`. Supporting text is `ink-secondary`. Keep `ink-tertiary` for disabled and placeholder only: it fails 4.5:1.
- `accent` is the only hue. It fills the primary button and nothing else. Links use `link` (or `tile-dark-link` on a dark tile).
- `danger` and `success` always come with words ("In stock", "Enter a valid ZIP code").

## Typography

- Display faces (`hero-headline`, `section-headline`, `tile-headline`, `intro`, `tile-subhead`) use `--font-display`; anything 19px and below uses `--font-text`. The stacks resolve to the system UI face on Apple devices and Helvetica Neue / Arial elsewhere. No web font ships with the system.
- Headlines are weight 600; everything else 400. No bold body copy, no italics.
- Below 734px viewport swap `tile-headline` for `tile-headline-compact` and `tile-subhead` drops to 19px/23px.
- Center headlines and CTAs on promo tiles; left-align running text and footers.

## Layout and spacing

- Promo tiles are full-bleed, `radius-none`, stacked with a `space-3` (12px) gap, two columns on desktop with the same gap.
- Tile text starts `space-6` (52px) from the tile top; the picture fills the rest.
- Nav and footer content sit in a `content-max` (980px) column with a `space-5` (22px) gutter.
- Buttons in a row are `space-4` (17px) apart.

## Shape, depth, motion

- Every button is a pill: `radius-pill`. Cards use `radius-card`, inputs `radius-input`.
- Flat by default. Only store cards lift, with `shadow-card` → `shadow-card-hover` and a 1.01 scale over 300ms ease.
- The global nav is translucent: `nav-bg` with `backdrop-filter: saturate(180%) blur(20px)`.
- Focus: 2px solid `focus` outline, 2px offset, on every link, button and input.

## Iconography

- Use the platform's system symbols where available; elsewhere a thin-stroke outline set (1.5px stroke at 24px). Icons take the color of the adjacent text.
- Links that lead on end with a chevron `›` (U+203A) set in the same text style, never an arrow icon.
- No logo is included. Set your brand name in `body-tight` weight 600 in the nav until you add a mark under `assets/Logos/`.

## Components

`Button`, `TextLink`, `PromoTile`, `GlobalNav`, `Footer`. Their classes live in `components/bundle.css` and read only the tokens above.
