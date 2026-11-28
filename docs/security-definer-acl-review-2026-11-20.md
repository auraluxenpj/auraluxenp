# Production SECURITY DEFINER and function ACL review

**Review date:** 2026-11-20  
**Target:** Supabase project `auraluxe-production` (`jsshaoucrjorbyuzagdr`)  
**Method:** Read-only catalog inspection, Supabase security advisor, and source-call-path review.  
**Change status:** No production SQL, grants, data, or application code changed.

## Executive summary

The production advisor reports 19 public-schema `SECURITY DEFINER` functions executable by `anon` and `authenticated`. This does not mean all 19 are exploitable: several have database-side role checks and two storefront RPCs are intentionally public. The grants are nevertheless broader than necessary for trigger-only functions and the role helper.

## Findings

### 1. Restrict `has_role` — high priority

The live `SECURITY DEFINER` helper accepts arbitrary `_user_id` and `_role` values and is executable by `anon` and `authenticated`. It can therefore act as a role-membership oracle for known UUIDs. The app uses it for current-user RLS/admin checks and inventory-health checks. Recommended remediation: constrain ordinary callers to checking their own identity, retaining an explicit, reviewed admin-only path only if cross-user role checks are required. Preserve RLS behavior and test profile/user_roles policies before deployment.

### 2. Revoke direct execution from trigger-only functions — medium priority

Trigger handlers with public execution grants:
- `audit_payment_settings()`
- `handle_new_user()`
- `lock_pos_credit_customer()`

Keep their triggers intact, but revoke direct `EXECUTE` from `PUBLIC`, `anon`, and `authenticated`, retaining owner/service privileges as required. Verify trigger execution in isolation.

### 3. Narrow grants on guarded admin/POS RPCs — medium priority

Database-side checks were verified:
- `can_use_pos()` requires a non-null authenticated user with admin/staff role.
- `complete_pos_sale`, `get_pos_catalog`, `get_pos_customer_balances`, and `get_pos_qr` call `can_use_pos()`.
- `get_business_day_summary`, `get_khata_statement`, `get_purchase_data`, `record_business_expense`, `record_pos_repayment`, `record_purchase_bill`, and `record_purchase_payment` require an authenticated admin.
- `restock_order` checks the admin role.
- Application server functions also use `requireSupabaseAuth`, but database checks remain the authoritative boundary.

These should not be executable by anonymous users. Narrow grants to `authenticated` (and `service_role` only where an actual service caller exists), preserving internal role checks. Confirm application call paths and test every workflow before deployment.

### 4. Preserve the two intentional public storefront RPCs

- `place_order(...)` supports guest checkout. It validates customer fields, payment configuration, product availability, trusted prices, coupon, shipping/tax, and performs the order/stock write atomically. Keep public access only with negative tests for malformed payloads, duplicate keys, overselling and disabled payment settings.
- `track_order(text,text)` returns a limited summary only after order-number and email/phone matching. Consider exact normalized phone matching: current suffix matching accepts a matching suffix of at least seven digits. Test false positives and enumeration before changing behavior.

### 5. Mutable search_path warnings — medium/low priority

The advisor flags `touch_updated_at()` and `reject_unsupported_payment_insert()`. They are not reported as SECURITY DEFINER, but should use a fixed safe search path or schema-qualified references in a reviewed forward migration.

## Advisor observations

- Three inventory-sync tables have RLS enabled and no user-facing policies. This is intentional; direct client access is blocked.
- All five `inv_sync_*` functions are confirmed executable only by `service_role`.
- Public execution of `can_use_pos()` returns false to anonymous callers, but the grant is still unnecessary.
- Trigger-only functions should not have direct public execution grants.

## Remediation sequence

1. Add a forward migration to tighten trigger and admin/POS grants without breaking authenticated application calls.
2. Restrict `has_role` to prevent probing other users' roles while preserving current-user RLS checks.
3. Keep `place_order` and `track_order` public by design; add regression tests and review phone suffix matching.
4. Set fixed search paths for the two flagged trigger functions.
5. Test anonymous, authenticated, admin and staff access across checkout, tracking, POS, purchase ledger, expenses, repayments, restocking, profiles and RLS.
6. Apply only after isolated testing and a fresh recovery checkpoint.

## Evidence boundaries

This review establishes live grants, function definitions, advisor findings and source call paths. It did not run attacker-style HTTP requests against the live REST API. It does not establish a confirmed breach or prove that guarded admin functions can be bypassed.
