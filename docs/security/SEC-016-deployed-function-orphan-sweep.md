# SEC-016 — Deployed-but-not-in-repo edge function sweep

**Filed:** 2026-08-11
**Trigger:** `external-db-proxy` source was deleted from the repo but stayed deployed and reachable.
Deleting source does NOT undeploy. Every removal must be verified with a live probe.

## Method
Function names appearing in git history under `supabase/functions/*/index.ts` but absent from the
current tree (17 names), each probed with `POST /functions/v1/<name>` using the project anon key.
`404 NOT_FOUND` = not deployed. Anything else = still live.

## Result — 16 of 17 confirmed gone (404)
agent-self-learn, clipper-qa-runner, create-dc-agents, create-va-direct,
dc-import-phone-to-elevenlabs, dc-update-agent-settings, dd-restore-ai-key, debug-resend-domains,
elevenlabs-conversation-token, elevenlabs-tts, external-db-proxy (now undeployed),
gasmask-voice-flow-selftest, qa-temp-create-test-user, sbo-intake-test-harness,
twilio-elevenlabs-bridge, update-agent-prompts

## Still live: `outbound-campaign-manager` — STATUS: LIVE, SOURCE MISSING
```
POST /functions/v1/outbound-campaign-manager  (anon key, body {})
500 {"success":false,"error":"Unknown action: undefined"}
```
- Responds to an **anon-key** call — no JWT gate at the entry point (it got as far as action dispatch).
- No source in the repo → unmaintained, unreviewable, unpatchable code running in production.
- It is NOT unused: `src/hooks/useOutboundCampaigns.ts` invokes it at lines 66, 80, 98, 116.

### Decision needed
Either (a) restore the source into `supabase/functions/outbound-campaign-manager/` from git history,
review it, add JWT verification, and redeploy; or (b) undeploy it and accept that the four
`useOutboundCampaigns` mutations break. Not fixed in this pass — reported per instruction.

## Standing rule
Removal of an edge function = delete source **and** undeploy, then probe for `404`.
