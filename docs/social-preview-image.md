# Social preview image — 15 September 2026

The old “DIRECT SOLANA” caption was baked into the raster share image, not generated from the current page description.

The new caption is **SUPPORT YOUR PEERS, YOUR WAY.** It avoids claiming support for every possible payment method. The existing title, tagline, coin, palette, and composition are retained.

- Primary asset: `public/og-peer-support-v2.png` (1733 × 907 PNG).
- Compatibility asset: `public/og.png` contains the same revised image for older image references.
- Generation mode: built-in image-editing tool, not the API/CLI fallback. The selected result was copied into the permanent repository.
- Metadata uses the versioned asset so crawlers fetching current HTML discover a different image URL. Already-cached messages or previews are controlled by the sharing platform; a new asset URL does not promise their immediate replacement.

## Final image-edit prompt

```text
Use case: text-localization.
Asset type: Money Nerds website Open Graph/social sharing preview banner.
Input image: edit target is the original production banner at the referenced path, NOT a messenger screenshot.
Primary request: Make one surgical text replacement. Replace the entire small cream caption at the bottom left, which currently reads "0% FEES • DIRECT SOLANA", with the exact text "SUPPORT YOUR PEERS, YOUR WAY.".
Typography: one single line, uppercase, cream/off-white, same clean sans-serif style, slightly smaller if needed so it fits below "ASK. SHARE. FUND." within the left text column. It must be readable and exactly spelled. No "Solana" anywhere.
Invariants: preserve the MONEY NERDS title, ASK. SHARE. FUND. tagline, smiling glasses coin, neon lime transparent rim, all metallic surfaces, perspective, composition, black grain background, subtle grid lines, lighting, and margin positions. Keep the original wide 1733x907 composition/aspect ratio with no cropping. Do not add badges, logos, UI, watermarks, or any new content. Change only that small bottom caption.
```
