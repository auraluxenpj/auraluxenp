# Phase 1: Secure checkout and remove COD

- [x] Audit existing backend, checkout paths, payment settings and legacy order baseline.
- [ ] Verify newest available backup timestamp — owner supplied "Aura Data3:04:14 pm utc" without a date; dated evidence still needed.
- [x] Owner confirms supported full database export downloaded (not independently inspected).
- [x] Owner confirms required storage files downloaded (not independently inspected).
- [x] Review planned schema/security changes and isolated draft approach with owner.
- [ ] Create isolated implementation draft from saved plan/baseline on next turn; verify backend isolation before mutations.
- [ ] Implement trusted atomic checkout, validation, idempotency and COD rejection in isolated draft.
- [ ] Add genuine merchant payment settings, proof review and authorized verification.
- [ ] Add recorded product WhatsApp enquiries without order/payment/stock effects.
- [x] Run existing CSV tests (3 passed) and inspect automatic build (OK).
- [ ] Run Phase 1 automated and end-to-end tests; compare legacy order fingerprints and catalogue/auth/image preservation — blocked by backup gate and implementation.
- [ ] Present results and required configuration; wait for owner release approval.