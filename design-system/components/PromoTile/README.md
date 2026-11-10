# PromoTile

A full-bleed, centered product band: headline, one subhead, up to two buttons, then the product picture filling the rest.

- **Provide:** `<section class="lm-tile">` with `lm-tile__headline`, `lm-tile__subhead`, `lm-tile__ctas` and `lm-tile__media` (your image). Variants: `lm-tile--alt` (`surface-alt`), `lm-tile--dark` (`tile-dark-bg`, stays dark in both themes).
- **Layout:** stack tiles with a `space-3` gap; two columns from 734px up. Hero tiles span the full width.
- **Do** alternate grounds so neighbouring tiles differ. **Do** let the picture bleed off the bottom edge.
- **Don't** add body paragraphs, badges, shadows or rounded corners to a tile.
- Below 734px the headline drops to `tile-headline-compact` automatically.
