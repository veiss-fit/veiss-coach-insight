-- Verify whether the one athlete/exercise combo that cleared the regression
-- bar (player_id 02d1b479-a4fc-473e-8b2d-dc44621ee55b) is real athlete data
-- or a seeded/test fixture, before Parts 1/5a-b of any redesign trust it.

select
  id as session_id,
  name,
  status,
  started_at,
  ended_at,
  created_at
from sessions
where user_id = '02d1b479-a4fc-473e-8b2d-dc44621ee55b'
order by started_at;

-- Also check whether this player_id resolves to a real player/profile record
-- or looks like a test account (e.g. name pattern, no real jersey number, etc.)
select p.id, p.full_name, p.jersey_number, p.team_id, p.user_id, p.created_at
from players p
where p.user_id = '02d1b479-a4fc-473e-8b2d-dc44621ee55b'
   or p.id = '02d1b479-a4fc-473e-8b2d-dc44621ee55b';
