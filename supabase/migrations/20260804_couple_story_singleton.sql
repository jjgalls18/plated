-- Plated — enforce couple_story as a true singleton at the DB level
--
-- useCoupleStory.js decides insert-vs-update by checking the client-side
-- query cache, not the database — if Jacob and Madi both hit "Write our
-- story" for the first time on separate devices around the same moment,
-- both would see no existing row and both insert, producing two rows with
-- no defined "current" one. A unique index on a constant expression is the
-- standard Postgres singleton-table pattern: it makes a second insert fail
-- with a unique violation (23505) rather than silently succeeding, so the
-- app can catch that and fall back to updating the row that won instead.

create unique index if not exists couple_story_singleton_idx on public.couple_story ((true));
