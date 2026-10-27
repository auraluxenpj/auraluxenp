# Auraluxe home-screen installation

## Files
- `public/manifest.webmanifest`: Auraluxe name/short name, stable `/` identity/start/scope, standalone display, light `#faf7ec` theme and white background.
- `public/favicon.png`: supplied official favicon, padded to 64 × 64. Removed the previous `public/favicon.ico`.
- `src/assets/icon-192.png.asset.json`, `icon-512.png.asset.json`: CDN pointers for circular PNGs; only the outer canvas was circularly masked, without changing the logo artwork.
- `src/assets/icon-maskable-512.png.asset.json`: supplied opaque maskable PNG; artwork lies within the central 80%-diameter safe circle.
- `src/assets/apple-touch-icon.png.asset.json`: supplied 180 × 180 Apple touch icon.
- `src/routes/__root.tsx`: manifest, icon, Apple touch icon, theme and iOS home-screen head tags.
- `src/lib/app-manifest.test.ts`: four focused configuration tests.
- October 27 icon update: the CDN pointers and local favicon now use the owner's newer full master logo (emblem, wordmark and tagline), preserving the artwork. Circular regular/Apple icons and safely padded maskable artwork were recreated from the supplied master after temporary drafts were unavailable. The root Apple reference automatically follows its updated pointer; the favicon link uses a new version suffix. This update is not published.
- `AGENTS.md`, `roadmap.md`: installation architecture and validation record.

## Validation
- October 27 update: four manifest tests passed; all four new CDN icons returned HTTP 200 with expected dimensions, local favicon returned HTTP 200 at 64 × 64, root head references matched the new assets, homepage rendered without page errors, and automatic build reported OK. No publication or physical-device installation test was performed.
- Three tests passed. Automatic preview build reported OK.
- Manifest and all PNG references returned HTTP 200 with expected image dimensions.
- Chromium parsed the manifest without errors and reported no installability errors in a normal profile.
- Desktop Chromium installation and launch commands succeeded. The headless environment did not report standalone display mode; window presentation requires a real desktop check.
- Homepage and shop rendered without page errors. No app-shell worker or offline cache was added.
- Existing `https://www.auraluxe.com.np/` returned HTTP 200 over HTTPS before deployment; this did not verify the new manifest on the published version.
- Android Chrome and iPhone Safari installation were not physically tested.

## Deployment and use
Publish the current project snapshot after validation. This also includes previously unpublished POS, Khata, expenses and purchase tracking code; publishing cannot deploy just the manifest independently.
After deployment, verify `/manifest.webmanifest`, `/favicon.png` and each manifest icon on the custom domain.
On Android Chrome, use the browser's Install app/Add to Home screen command. On supported desktop browsers, use the browser's install command. On iPhone Safari, use Share → Add to Home Screen (enable Open as Web App if offered).
Automatic prompts depend on browser/device settings and engagement; they are not guaranteed. This release adds home-screen installation, not offline shopping. Existing authentication, database, inventory and business logic were not modified.