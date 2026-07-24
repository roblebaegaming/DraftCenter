-- Repair recurring UTF-8 text that was stored as separate visible characters.
-- chr() keeps this migration safe when copied through a non-UTF-8 clipboard.
-- Safe to run more than once.

begin;

update public.daily_quizzes
set
  prompt = replace(
    replace(
      replace(prompt, chr(195) || chr(169), chr(233)),
      chr(195) || chr(137), chr(201)
    ),
    chr(226) || chr(8364) || chr(8482), chr(8217)
  ),
  hint = replace(
    replace(
      replace(hint, chr(195) || chr(169), chr(233)),
      chr(195) || chr(137), chr(201)
    ),
    chr(226) || chr(8364) || chr(8482), chr(8217)
  )
where
  prompt like '%' || chr(195) || '%'
  or hint like '%' || chr(195) || '%'
  or prompt like '%' || chr(226) || chr(8364) || '%'
  or hint like '%' || chr(226) || chr(8364) || '%';

update public.daily_polls
set
  question = replace(
    replace(
      replace(question, chr(195) || chr(169), chr(233)),
      chr(195) || chr(137), chr(201)
    ),
    chr(226) || chr(8364) || chr(8482), chr(8217)
  ),
  options = replace(
    replace(
      replace(options::text, chr(195) || chr(169), chr(233)),
      chr(195) || chr(137), chr(201)
    ),
    chr(226) || chr(8364) || chr(8482), chr(8217)
  )::jsonb
where
  question like '%' || chr(195) || '%'
  or options::text like '%' || chr(195) || '%'
  or question like '%' || chr(226) || chr(8364) || '%'
  or options::text like '%' || chr(226) || chr(8364) || '%';

commit;
