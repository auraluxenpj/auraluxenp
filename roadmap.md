# Phase 1: Secure checkout and remove COD

- [x] Audit existing backend, checkout paths, payment settings and legacy order baseline.
- [ ] Verify newest available backup timestamp — requires owner evidence from Cloud Backups.
- [ ] Obtain supported full database export — requires owner to start and download Cloud export.
- [ ] Preserve required storage files — requires owner downloads from Cloud Storage.
- [ ] Review planned schema/security changes and isolated draft approach with owner.
- [ ] Implement trusted atomic checkout, validation, idempotency and COD rejection in isolated draft.
- [ ] Add genuine merchant payment settings, proof review and authorized verification.
- [ ] Add recorded product WhatsApp enquiries without order/payment/stock effects.
- [ ] Run automated and end-to-end tests; compare legacy order fingerprints and catalogue/auth/image preservation.
- [ ] Present results and required configuration; wait for owner release approval.