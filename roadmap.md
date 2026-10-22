# Phase 1: Secure checkout and remove COD

## Current request: Editable Payment Settings

- [x] Review existing schema and storage policies; current live settings still cod,bank_transfer.
- [ ] Implement Settings → Payment Settings with admin-only access, validated QR upload, bank fields and audit trail — delegated to Secure Payment Settings review draft; its own chat will report results/blockers.
- [ ] Integrate configured/enabled methods with checkout and enforce no new COD without changing legacy orders.
- [ ] Test save/refresh, customer instructions, disabled methods, unauthorized edits, direct COD rejection and data preservation.
- [ ] Present test results and configuration blockers; do not publish or activate Live restrictions without approval.

- [x] Audit existing backend, checkout paths, payment settings and legacy order baseline.
- [x] Record owner-confirmed newest backup timestamp: October 21, 2026, 15:04:14 UTC (2026-10-21T15:04:14Z); not independently inspected.
- [x] Owner confirms supported full database export downloaded (not independently inspected).
- [x] Owner confirms required storage files downloaded (not independently inspected).
- [x] Review planned schema/security changes and isolated draft approach with owner.
- [x] Create Secure Payment Settings review draft with explicit isolation, preservation and no-publish instructions.
- [ ] Verify backend isolation before mutations — delegated to draft; not yet confirmed here.
- [ ] Implement trusted atomic checkout, validation, idempotency and COD rejection in isolated draft.
- [ ] Add genuine merchant payment settings, proof review and authorized verification.
- [ ] Add recorded product WhatsApp enquiries without order/payment/stock effects.
- [x] Run existing CSV tests (3 passed) and inspect automatic build (OK).
- [ ] Run Phase 1 automated and end-to-end tests; compare legacy order fingerprints and catalogue/auth/image preservation — blocked by backup gate and implementation.
- [ ] Present results and required configuration; wait for owner release approval.