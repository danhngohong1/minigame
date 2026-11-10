# GlobalNav

A sticky, translucent top bar with evenly spaced 12px category links inside the 980px column.

- **Provide:** `<nav class="lm-nav">` › `.lm-nav__inner` › links; the first link with `lm-nav__brand` is your brand name or mark (no logo ships with the system).
- **Use** `position: sticky; top: 0` and keep 6–10 links; collapse to a menu button below 834px (height 48px).
- **Do** let content scroll under it; the `nav-bg` blur needs something behind it.
- **Don't** add buttons, colored links or dividers to the bar.
