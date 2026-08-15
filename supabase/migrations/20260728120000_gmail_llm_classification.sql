-- Adds an LLM-backed classifier for the ambiguous reply categories (interested/
-- not_interested/referral/question/unknown) in ingest-gmail-replies, gated behind
-- its own flag. The compliance-sensitive categories (unsubscribe/legal/complaint/
-- out_of_office) stay on the existing deterministic regex path unconditionally --
-- this flag only ever changes classification for the fuzzy remainder, and the
-- function falls back to the old regex rules if the LLM call fails.

alter table public.system_config
  add column if not exists gmail_llm_classification_enabled boolean not null default false;

alter table public.messages
  add column if not exists classification_method text not null default 'regex'
    check (classification_method in ('regex', 'llm'));
