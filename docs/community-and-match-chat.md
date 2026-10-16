# Community and match chat

Feature branch: `codex/community-and-match-chat`.

The speed/UX release was merged through PR 117 into `dev`, source commit
`66d89eb314b726d03bd7bb5253ca7092ee53f3a5`, and explicitly published to
[UNEEM](https://www.uneem.site/). GitHub CI passed 172 browser cases; 54 live
public/Auth checks passed afterward. The live Auth check reads provider settings;
it does not create an account or complete a real Google sign-in.

Community is a separate feature. Its migration has not been applied to production.

## User journeys

Primary navigation: Play, Community, My activity, Account.

| Surface | Behavior |
| --- | --- |
| Community / Lobby | Shared text conversation for verified players. Suggest a sport/time or attach an open-match card. |
| Community / Players | Search a bounded directory of players who explicitly opt in. |
| Player card | Initial avatar, existing public name/username, optional bio, favourite sports and a four-hour availability signal. |
| Invite to a match | Choose an open match and compose a public lobby invitation. Posting requires an explicit Send. |
| Share match | Share in the lobby, use native sharing, copy the booking link, or copy it manually when platform APIs fail. |
| Community / Chats | Organizer, joined-player and registered-reservation conversations; unread counts and mute settings persist. |
| Match details | Open the match conversation or share an open match. Usernames link to player cards. |

Sharing, planning and sending messages never create a booking, join a match or
reserve a place. The existing Join operation confirms capacity on the server.
Private bookings are excluded from shared cards. Cards show the latest snapshot
returned by the server; the match-details page checks current state before joining.

Directory discovery is off for existing and new players until they opt in.
Availability expires on the server after four hours and does not indicate online
presence. Peer read models omit email, Student ID, identity evidence, account
privileges and private booking history. Existing account/security editing remains
under Account.

## Conversation rules

- Lobby access requires the same confirmed, approved sports access as joining.
- Match conversations admit the organizer, self-joined players and named
  reservations linked to an eligible account. Offline guest names grant no access.
- A member who leaves loses access to subsequent history reads and sends. Sends
  share the existing booking lock with leave/cancel operations.
- Cancelled/finished matches are read-only. Remaining members can read their
  conversation for seven days after its end. This is an access window, not an
  automatic deletion job.
- Blocking hides communication in both directions; it never removes a player or
  changes the existing first-come-first-served match rules.
- Players can report through the existing support/report workflow. Admins can
  hide messages; hidden bodies are omitted from chat reads.
- Unread badges update when Community conversations are loaded and read. This
  slice adds no global chat polling or closed-app push delivery.

## Data and delivery

Layer 064 adds four RPC-only tables: player preferences, messages, read positions
and communication blocks. Existing bookings, membership, Auth and support records
remain authoritative. All new tables enable RLS; browser roles have no direct
table access. Definer RPCs enforce current authorization and allowlist outputs.

Message history uses stable integer cursors with bounded pages. Messages are
persisted before Broadcast signals are produced. Events carry only a message ID;
every body fetch rechecks current access. This avoids relying on a cached Realtime
channel authorization decision after membership changes. Clients cannot authorize
themselves by subscribing to a guessed channel name or forging an event.

Sending uses a stable client nonce. Concurrent retries return the same message;
reusing a nonce with different content is rejected. A sender-scoped transaction
lock enforces 20 messages per minute across tabs. Lost responses retain the draft
and nonce so Retry does not create a second message. Feedback stays in the composer.
A room-scoped transaction lock keeps message IDs in commit order across senders,
so reconnect cursors cannot skip an earlier transaction that commits late.

The open route subscribes to its conversation, fetches new IDs individually, and
recovers reconnect gaps in order. Older pages load on demand. Private drafts and
unread state clear when the account changes. Community reads are not added to the
critical path of Play or booking screens.

## Verification and rollout

`node scripts/test-community-database.mjs` requires `UNEEM_ISOLATED_DB_URL` to name
a new `uneem_community_test_<digits>` database on localhost/127.0.0.1. The harness
refuses nonlocal targets and existing database names. It creates minimal local
Auth/Storage/Realtime interfaces, applies the complete migration stack, and runs
the existing match contract plus the Community contract and multi-session races.
Fixtures use fictional identities. The Realtime stub verifies event payloads; it
does not certify delivery through the hosted Realtime service.

Browser tests intercept both HTTP and WebSockets. They verify the rendered
English/Arabic journeys and failures independently of production data.

Local verification completed:

- Full app regression run: 194 passed, with the two opt-in live Auth cases skipped.
- Community follow-up: 26 desktop/mobile cases passed; four final delayed-read and
  moderation-cache cases passed after the cache reconciliation change.
- Full migration stack, existing match contract, Community contract, duplicate
  sends, rate-limit concurrency, both send/leave race orders and sender commit
  ordering passed on isolated PostgreSQL 18 with fictional fixtures.
- Production build and release hygiene passed with zero Svelte/TypeScript errors
  or warnings. Screenshot review covered English desktop and Arabic dark at 320px;
  reduced-height composer interaction and navigation remained usable.

The Browser skill was unavailable for this run, so rendered checks used the
repository's Playwright workflow with Chrome desktop and Android emulation.
These checks do not certify hosted Auth/Realtime or physical-device behavior.

Before a Community release:

1. Validate the migration and private-channel access against an isolated hosted
   Supabase environment, including reconnect, suspension and membership revocation.
2. Review the additive migration and full contract results, then apply layer 064
   in a separate approved production rollout. Never use production fixtures.
3. Publish the matching frontend only after its backend is available. Verify the
   real provider connection, Community capabilities and private-channel denials.
4. Keep the previous frontend deployment for rollback. If backend rollback is
   necessary, revoke the new RPC grants and remove `community_receive` while
   retaining the new tables and message history. Do not drop or truncate user data.

Unrestricted direct messages, photo uploads, background push notifications and
structured planning polls are follow-up features.

References: [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization)
and [database-triggered Broadcast](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes).
