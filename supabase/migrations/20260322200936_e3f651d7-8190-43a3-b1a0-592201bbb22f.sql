UPDATE sbo_games
SET status = 'closed'
WHERE game_date AT TIME ZONE 'America/New_York' >= '2026-03-21 00:00:00'
AND game_date AT TIME ZONE 'America/New_York' < '2026-03-22 00:00:00';