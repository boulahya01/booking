# UNEEM V2 open-match contract

Open matches extend an existing facility booking. They never reserve another facility slot.

## Core model

- The booking owner is the organizer and counts as one player.
- A booking can have at most one match.
- The organizer may reserve offline/friend spots before or while the match is open, but may never increase that count enough to displace students who already joined.
- Public spots are `facility capacity - organizer - reserved spots - joined students`.
- Eligible students join first-come-first-served. There is no organizer approval queue.
- Join capacity is serialized by locking the match row inside the database transaction.
- The organizer is not added to `match_participants`; that table contains public joiners only.
- Once any public student joins, the match cannot become private.
- A joined student may leave before the match starts.
- A restricted account cannot create, discover, join, leave, or read a roster.

## Privacy

Open-match discovery exposes only the public sports identity needed for the experience: full name and public username. Student ID, email, verification evidence and moderation notes are never part of match discovery or roster RPCs.

## Database layers

Apply after `013_public_username_identity.sql`:

1. `014_open_match_core.sql` — match/participant tables and authoritative create/join/leave/reserved/visibility transitions.
2. `015_open_match_reads.sql` — Open Matches, roster, My Matches and admin read models.
3. `tests/match_contract.sql` — transactional invariants.

The tables intentionally grant no direct student reads or writes. Student access goes through narrow security-definer RPCs so visibility and public-field selection stay explicit.

## Not in this slice

Waitlists, direct username invitations, reminders, share cards and notification fan-out should build on this contract only after hosted database execution validates capacity, locking and access behavior.
