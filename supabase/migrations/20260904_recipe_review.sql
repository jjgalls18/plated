-- Flags recipes the extractor wasn't confident about, so most saves can skip
-- the review screen while the shaky ones still get a second look.
--
-- confidence is the 0.0-1.0 completeness score the extraction prompt already
-- produces (1.0 = every measurement clear, 0.4 = significant gaps). It was
-- being computed and thrown away; storing it is what makes needs_review
-- explainable rather than a mystery badge.
--
-- Safe to re-run.

alter table public.recipes
  add column if not exists confidence   real,
  add column if not exists needs_review boolean not null default false;

-- Partial index: the review list only ever asks for the flagged ones, and
-- they're a small minority of rows.
create index if not exists recipes_needs_review_idx
  on public.recipes (needs_review)
  where needs_review;
