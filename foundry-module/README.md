# QuiverDM Foundry Module (MVP)

This module forwards live Foundry VTT combat events to QuiverDM and adds an **Open QuiverDM Sidecar** button in the Foundry settings sidebar.

## Setup

1. Install this module in Foundry.
2. In QuiverDM campaign settings, open **Foundry Integration** and generate an API key.
3. In Foundry module settings (`quiverdm`):
   - Set `QuiverDM Base URL` (for example `https://app.quiverdm.com`)
   - Set `QuiverDM API Key`
4. Ensure QuiverDM server has `FOUNDRY_BRIDGE_ENABLED=true`.

## Events sent

- `combat_round`
- `combat_start`
- `combat_end`
- `hp_change`
- `actor_death`

## API endpoints used

- `POST /api/integrations/foundry/events`
- `GET /api/integrations/foundry/launch-token`
- `GET /api/integrations/foundry/capabilities`

## Notes

- API key auth uses `Authorization: Bearer <key>`.
- QuiverDM must have an active session for events to be accepted.

## Changelog

### 0.2.0

- Added import polling for pending QuiverDM export jobs.
- Added import delivery/error acknowledgements.
