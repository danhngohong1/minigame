# Button

A full-pill action button: `accent` fill for the main action, `link` outline for the second.

- **Provide:** an `<a>` or `<button>` with class `lm-btn`; add `lm-btn--secondary` for the outline style, `lm-btn--lg` for a standalone 17px button.
- **Use** at most two per tile: primary first ("Learn more"), secondary second ("Buy"), `space-4` apart.
- **Do** write a short verb phrase in sentence case. **Don't** put icons, emoji or punctuation inside.
- On `tile-dark-bg` the secondary button switches to `tile-dark-link` automatically inside `.lm-tile--dark`.
- Disabled uses `surface-alt` with `ink-tertiary` and is never the only signal; say why near it.
