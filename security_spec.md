# Security Specification (`security_spec.md`)

## 1. Data Invariants & Master Source of Truth
1. **Organizer Ownership**: Only the verified organizer (`edinguer@gmail.com` with `email_verified == true` or registered in `/admins/{uid}`) can create/update `/raffle_config/main`, read `/tickets_private/{ticketId}`, mark tickets as `'paid'`, or reset tickets to `'available'`.
2. **Public Buyer Self-Service Reservation**: Any buyer can view `/raffle_config/main` and `/tickets/{ticketId}` and can reserve a ticket ONLY if that ticket is currently unoccupied (`!exists(...)` or `resource.data.status == 'available'`), transitioning it strictly to `status == 'reserved'`, and atomically writing the corresponding `/tickets_private/{ticketId}` document in the same batch (`existsAfter` / `getAfter`).
3. **PII Isolation**: Buyer phone numbers (`buyerPhone`) and private notes (`notes`) are stored exclusively in `/tickets_private/{ticketId}` and are strictly unreadable (`allow get, list: if isAdmin()`) by public visitors or other buyers.
4. **Strict Timestamp & Volumetric Bounds**: All `updatedAt` fields must equal `request.time`. All string fields enforce strict `.size()` upper bounds matching `firebase-blueprint.json`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Ticket**: `{ number: "01", status: "reserved", buyerPublicName: "Ana", paymentMethod: "transferencia", updatedAt: request.time, isAdmin: true }` -> Rejected by `hasOnly()`.
2. **State Hijack (Overwriting a Reserved/Paid Ticket)**: Public buyer attempts to update `/tickets/07` when `existing().status == 'reserved'` or `'paid'` -> Rejected by state transition guard (`existing().status == 'available'`).
3. **Unauthorized Self-Payment**: Public buyer attempts to set `status: "paid"` on `/tickets/05` -> Rejected because public buyers can only set `status == 'reserved'`.
4. **PII Scraping (`get` on `/tickets_private/07`)**: Unauthenticated or non-admin user requests `/tickets_private/07` -> Rejected by `isAdmin()`.
5. **PII List Scraping (`list` on `/tickets_private`)**: Non-admin executes collection query on `/tickets_private` -> Rejected by `isAdmin()`.
6. **Unverified Admin Email Spoofing**: Attacker with `email == 'edinguer@gmail.com'` but `email_verified == false` tries to modify `/raffle_config/main` -> Rejected by `request.auth.token.email_verified == true`.
7. **Orphaned Public Reservation Without Private Record**: Buyer writes `/tickets/12` as `'reserved'` without writing `/tickets_private/12` -> Rejected by `existsAfter(/databases/$(database)/documents/tickets_private/$(ticketId))`.
8. **Orphaned Private Record Overwrite**: Attacker tries to overwrite `/tickets_private/07` for an already paid/reserved ticket -> Rejected because existing `/tickets/07` is not `'available'`.
9. **Denial-of-Wallet String Bomb**: Buyer sends a 50KB `buyerPublicName` or `notes` -> Rejected by `.size() <= 60` and `.size() <= 200`.
10. **Invalid Ticket ID Poisoning**: Attacker writes to `/tickets/../../evil` or `/tickets/9999999` -> Rejected by `isValidTicketId(ticketId)` (`^[0-9]{1,4}$`).
11. **Timestamp Forgery**: Client passes a past or future timestamp instead of `serverTimestamp()` (`request.time`) -> Rejected by `data.updatedAt == request.time`.
12. **Unauthorized Config Tampering**: Public user attempts to lower `ticketPrice` to `1` in `/raffle_config/main` -> Rejected by `isAdmin()`.
