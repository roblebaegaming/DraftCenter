-- Publish the reviewed official 2026 Pokémon GO qualified-competitor pool and open Pick 10.
-- The source records earned invitations, not confirmed registration, attendance, or pool assignments.

begin;

lock table public.worlds_pick_events in row exclusive mode;
lock table public.worlds_pick_competitors in row exclusive mode;

do $preflight$
begin
  if (select count(*) from public.worlds_pick_events where id = '2026-pokemon-go') <> 1 then
    raise exception 'Expected exactly one staged 2026 Pokémon GO event.';
  end if;

  if exists (
    select 1 from public.worlds_pick_events
    where id = '2026-pokemon-go'
      and (status <> 'draft' or discipline <> 'go' or entry_unit <> 'individual'
        or division <> 'Open' or picks_required <> 10
        or locks_at <> '2026-08-28T07:00:00Z'::timestamptz)
  ) then
    raise exception 'The staged 2026 Pokémon GO contract changed; review it before opening entries.';
  end if;

  if exists (select 1 from public.worlds_pick_competitors where event_id = '2026-pokemon-go') then
    raise exception 'Pokémon GO competitors already exist; reconcile them before applying migration 377.';
  end if;

  if exists (select 1 from public.worlds_pick_entries where event_id = '2026-pokemon-go') then
    raise exception 'Pokémon GO entries already exist; migration 377 only opens a zero-entry event.';
  end if;

  if (select count(*) from public.worlds_result_sources where event_id = '2026-pokemon-go') <> 1
     or exists (
       select 1 from public.worlds_result_sources
       where event_id = '2026-pokemon-go'
         and (enabled or state <> 'disabled' or feed_url is not null or external_event_id is not null)
     ) then
    raise exception 'The Pokémon GO result source must remain disabled and unconfigured.';
  end if;

  if has_table_privilege('anon', 'public.worlds_pick_competitors', 'select')
     or has_table_privilege('authenticated', 'public.worlds_pick_entries', 'select') then
    raise exception 'Direct Worlds table reads must remain revoked.';
  end if;

  if not has_function_privilege('anon', 'public.get_worlds_pick_hub(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.get_worlds_pick_hub(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.save_worlds_pick_entry(text,text[],text)', 'execute') then
    raise exception 'The Worlds Pick 10 RPC grants are incomplete.';
  end if;
end;
$preflight$;

insert into public.worlds_pick_competitors (
  event_id, slug, display_name, country_code, qualification_region,
  qualification_path, attendance_status, is_selectable, source_order,
  source_url, source_checked_at
) values
  ('2026-pokemon-go', 'makoto-abe', 'Makoto Abe', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 1, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'blair-abril', 'Blair Abril', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 2, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'audrey-acker', 'Audrey Acker', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 3, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'rasyid-adam', 'Rasyid Adam', 'IDN', 'Indonesia', '2026 World Championships invitation earned', 'invite_earned', true, 4, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'rifqi-aditya', 'RIFQI ADITYA', 'IDN', 'Indonesia', '2026 World Championships invitation earned', 'invite_earned', true, 5, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'mugdhesh-agalave', 'MUGDHESH AGALAVE', 'IND', 'India', '2026 World Championships invitation earned', 'invite_earned', true, 6, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'suvansh-ajmani', 'SUVANSH AJMANI', 'IND', 'India', '2026 World Championships invitation earned', 'invite_earned', true, 7, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'muhammad-akbar', 'MUHAMMAD AKBAR', 'IDN', 'Indonesia', '2026 World Championships invitation earned', 'invite_earned', true, 8, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'pranav-akhand', 'Pranav Akhand', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 9, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'nader-almaskeen', 'Nader Almaskeen', 'SAU', 'Middle East & South Africa', '2026 World Championships invitation earned', 'invite_earned', true, 10, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'marcos-alvarez', 'Marcos Alvarez', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 11, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'alex-anderson', 'Alex Anderson', 'AUS', 'Oceania', '2026 World Championships invitation earned', 'invite_earned', true, 12, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'pablo-andina', 'Pablo Andina', 'ESP', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 13, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'arianna-andrews', 'Arianna Andrews', 'CAN', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 14, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'fareed-anees', 'Fareed Anees', 'GBR', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 15, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'takumi-aoyagi', 'Takumi Aoyagi', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 16, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'methasit-apioranroj', 'METHASIT APIORANROJ', 'THA', 'Thailand', '2026 World Championships invitation earned', 'invite_earned', true, 17, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'dilson-ivan-arevalo-pachon', 'Dilson Ivan Arevalo Pachon', 'COL', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 18, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'javier-arregui', 'JAVIER ARREGUI', 'ESP', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 19, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'ryojin-ayers', 'Ryojin Ayers', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 20, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'shane-bailey', 'Shane Bailey', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 21, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'vinod-ved-bamb', 'Vinod Ved Bamb', 'IND', 'India', '2026 World Championships invitation earned', 'invite_earned', true, 22, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'adriel-barboza-bentos', 'Adriel Barboza Bentos', 'BRA', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 23, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'josh-bartram', 'Josh Bartram', 'GBR', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 24, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'rommel-basora', 'Rommel Basora', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 25, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'andres-bechis', 'Andres Bechis', 'ARG', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 26, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'leonardo-beltran', 'Leonardo Beltrán', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 27, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'mauro-benitez', 'Mauro Benítez', 'ARG', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 28, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'gordon-bill', 'Gordon Bill', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 29, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'siddharth-bindal', 'SIDDHARTH BINDAL', 'IND', 'India', '2026 World Championships invitation earned', 'invite_earned', true, 30, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'payden-bingham', 'Payden Bingham', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 31, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'connor-bogenn', 'Connor Bogenn', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 32, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'tatch-bollard', 'Tatch Bollard', 'AUS', 'Oceania', '2026 World Championships invitation earned', 'invite_earned', true, 33, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'marcus-borger', 'Marcus Borger', 'NOR', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 34, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'corey-bowman', 'Corey Bowman', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 35, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'romain-brehon', 'Romain Brehon', 'FRA', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 36, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'gabriel-bromley', 'Gabriel Bromley', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 37, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'lucas-henrique-bucci-de-landa', 'Lucas Henrique Bucci de Landa', 'BRA', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 38, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'david-bustos-nordgren', 'David Bustos Nordgren', 'SWE', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 39, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'daniel-caballero', 'Daniel Caballero', 'PER', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 40, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'ricardo-esteban-caceres-prada', 'Ricardo Esteban Cáceres Prada', 'CHL', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 41, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'javier-calihua', 'Javier Calihua', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 42, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'alexis-calles', 'Alexis Calles', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 43, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'federico-cammarota', 'Federico Cammarota', 'ARG', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 44, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'egon-cardenas', 'Egon Cardenas', 'AUS', 'Oceania', '2026 World Championships invitation earned', 'invite_earned', true, 45, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'pedro-carrizo', 'Pedro Carrizo', 'CHL', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 46, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'joshua-carter', 'Joshua Carter', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 47, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'victor-carvalho', 'Victor Carvalho', 'BRA', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 48, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'aureo-luis-cerezer', 'Aureo Luis Cerezer', 'BRA', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 49, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'vitor-chagas', 'Vitor Chagas', 'BRA', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 50, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'chu-wen-chang', 'CHU-WEN CHANG', 'TWN', 'Taiwan', '2026 World Championships invitation earned', 'invite_earned', true, 51, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'tanuj-chaudhuri', 'TANUJ CHAUDHURI', 'IND', 'India', '2026 World Championships invitation earned', 'invite_earned', true, 52, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'mike-chen', 'Mike Chen', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 53, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'heng-yi-chen', 'HENG YI CHEN', 'TWN', 'Taiwan', '2026 World Championships invitation earned', 'invite_earned', true, 54, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'wei-yu-chen', 'WEI YU CHEN', 'TWN', 'Taiwan', '2026 World Championships invitation earned', 'invite_earned', true, 55, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'yip-kai-cheng', 'YIP KAI CHENG', 'CHN', 'Chinese Mainland', '2026 World Championships invitation earned', 'invite_earned', true, 56, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'yu-chen-chiu', 'YU-CHEN CHIU', 'TWN', 'Taiwan', '2026 World Championships invitation earned', 'invite_earned', true, 57, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'hoseong-choe', 'HOSEONG CHOE', 'KOR', 'South Korea', '2026 World Championships invitation earned', 'invite_earned', true, 58, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'siwoo-choi', 'SIWOO CHOI', 'KOR', 'South Korea', '2026 World Championships invitation earned', 'invite_earned', true, 59, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'deni-christoper', 'DENI CHRISTOPER', 'IDN', 'Indonesia', '2026 World Championships invitation earned', 'invite_earned', true, 60, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'alfonso-collado', 'Alfonso Collado', 'ESP', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 61, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'leonardo-contreas', 'Leonardo Contreas', 'GBR', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 62, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'josh-cooper', 'Josh Cooper', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 63, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'joao-correia', 'João Correia', 'PRT', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 64, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'esteban-coser', 'Esteban Coser', 'ARG', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 65, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'arnaldo-costa', 'Arnaldo Costa', 'BRA', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 66, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'bernardo-coutinho', 'Bernardo Coutinho', 'BRA', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 67, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'sean-curran', 'Sean Curran', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 68, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'anton-dahlgren', 'Anton Dahlgren', 'SWE', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 69, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'kobayashi-daigo', 'Kobayashi Daigo', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 70, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'ekagra-das', 'EKAGRA DAS', 'IND', 'India', '2026 World Championships invitation earned', 'invite_earned', true, 71, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'james-davidson', 'James Davidson', 'ZAF', 'Middle East & South Africa', '2026 World Championships invitation earned', 'invite_earned', true, 72, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'rufino-de-bondt', 'Rufino De Bondt', 'BEL', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 73, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'billy-de-la-cruz', 'Billy DE LA CRUZ', 'FRA', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 74, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'inias-de-meyer', 'Inias De Meyer', 'BEL', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 75, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'carlos-eduardo-de-oliveira-lacerda', 'Carlos Eduardo de Oliveira Lacerda', 'BRA', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 76, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'laurens-de-ruiter', 'Laurens de Ruiter', 'NLD', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 77, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'bruno-de-souza-godoi-fred', 'Bruno de Souza Godoi Fred', 'BRA', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 78, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'aleandro-di-loreto', 'Aleandro Di Loreto', 'ITA', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 79, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'emilio-diaz', 'Emilio Diaz', 'CHL', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 80, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'wouter-didden', 'Wouter Didden', 'BEL', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 81, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'henrique-diesel-dietrich', 'Henrique Diesel Dietrich', 'BRA', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 82, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'adrian-diez', 'Adrián Díez', 'ESP', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 83, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'alex-doone', 'Alex Doone', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 84, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'bruce-dos-santos', 'Bruce dos Santos', 'BRA', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 85, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'baptiste-drieu-la-rochelle', 'Baptiste Drieu La Rochelle', 'AUS', 'Oceania', '2026 World Championships invitation earned', 'invite_earned', true, 86, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'cordell-dujardin', 'Cordell Dujardin', 'FRA', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 87, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'abhinav-dutt', 'Abhinav Dutt', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 88, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'benjamin-dweck', 'Benjamin Dweck', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 89, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'william-dwyer', 'William Dwyer', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 90, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'bechir-ayoub-elkebir', 'Bechir ayoub Elkebir', 'DEU', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 91, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'maxwell-ember', 'Maxwell Ember', 'CHE', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 92, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'matt-farrell', 'Matt Farrell', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 93, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'emmanuel-fasil', 'Emmanuel Fasil', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 94, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'aaron-faulkner', 'Aaron Faulkner', 'GBR', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 95, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'jack-fearn', 'Jack Fearn', 'GBR', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 96, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'bart-omiej-filipczak', 'Bartłomiej Filipczak', 'POL', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 97, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'alessandro-fissore', 'Alessandro Fissore', 'ITA', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 98, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'david-fitzgerald', 'David Fitzgerald', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 99, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'paige-fitzgerald', 'Paige Fitzgerald', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 100, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'jack-fitzpatrick', 'Jack Fitzpatrick', 'AUS', 'Oceania', '2026 World Championships invitation earned', 'invite_earned', true, 101, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'luis-fernando-flores-ruiz', 'Luis Fernando Flores Ruiz', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 102, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'gabriel-fonseca', 'Gabriel Fonseca', 'BRA', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 103, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'greg-fortier', 'Greg Fortier', 'AUS', 'Oceania', '2026 World Championships invitation earned', 'invite_earned', true, 104, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'hernan-franchino', 'Hernán Franchino', 'CHL', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 105, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'sean-gadasy', 'Sean Gadasy', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 106, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'martin-galderisi', 'Martin Galderisi', 'ARG', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 107, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'luis-eduardo-galicia-perez', 'Luis Eduardo Galicia Pérez', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 108, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'jamie-gallagher', 'Jamie Gallagher', 'GBR', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 109, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'tomas-ezequiel-gallardo', 'Tomas Ezequiel Gallardo', 'ARG', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 110, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'andre-garavello', 'André Garavello', 'BRA', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 111, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'christian-paul-garcia-aguilar', 'Christian Paul Garcia Aguilar', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 112, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'francisco-manuel-garcia-menchaca', 'Francisco Manuel García Menchaca', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 113, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'ricardo-gonzalez', 'Ricardo Gonzalez', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 114, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'bastian-gonzalez', 'Bastian Gonzalez', 'CHL', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 115, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'yamato-goto', 'Yamato Goto', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 116, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'sameep-grover', 'Sameep Grover', 'CAN', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 117, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'eddy-guan', 'Eddy Guan', 'CAN', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 118, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'samy-guglielmino', 'Samy Guglielmino', 'PER', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 119, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'joshua-guzman', 'Joshua Guzman', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 120, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'valerian-hanny', 'Valérian Hanny', 'FRA', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 121, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'kentaro-harada', 'Kentaro Harada', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 122, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'samuel-hardy', 'Samuel Hardy', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 123, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'moegsien-harris', 'Moegsien Harris', 'ZAF', 'Middle East & South Africa', '2026 World Championships invitation earned', 'invite_earned', true, 124, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'teddy-harvey', 'Teddy Harvey', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 125, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'jy-heath', 'Jy Heath', 'AUS', 'Oceania', '2026 World Championships invitation earned', 'invite_earned', true, 126, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'aiden-hedderly', 'Aiden Hedderly', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 127, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'gabriel-hernandez', 'Gabriel Hernández', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 128, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'muhammad-hidayat', 'MUHAMMAD HIDAYAT', 'IDN', 'Indonesia', '2026 World Championships invitation earned', 'invite_earned', true, 129, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'kaito-higa', 'Kaito Higa', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 130, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'hunter-hintz', 'Hunter Hintz', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 131, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'oshima-hiroyuki', 'Oshima Hiroyuki', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 132, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'philip-ho', 'Philip Ho', 'GBR', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 133, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'ana-hoffman', 'Ana Hoffman', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 134, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'liam-hogberg', 'Liam Högberg', 'SWE', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 135, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'pascal-hohlfeld', 'Pascal Hohlfeld', 'DEU', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 136, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'carlos-holguin', 'Carlos Holguín', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 137, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'hiroto-homma', 'Hiroto Homma', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 138, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'mao-hotta', 'Mao Hotta', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 139, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'jim-huang', 'Jim Huang', 'AUS', 'Oceania', '2026 World Championships invitation earned', 'invite_earned', true, 140, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'po-jui-huang', 'PO-JUI HUANG', 'TWN', 'Taiwan', '2026 World Championships invitation earned', 'invite_earned', true, 141, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'brandon-hubbard', 'Brandon Hubbard', 'GBR', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 142, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'ayasa-ideriha', 'Ayasa Ideriha', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 143, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'daniel-imaizumi', 'Daniel Imaizumi', 'BRA', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 144, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'sm-ghazanfar-imam', 'SM GHAZANFAR IMAM', 'IND', 'India', '2026 World Championships invitation earned', 'invite_earned', true, 145, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'alessio-innocenti', 'Alessio Innocenti', 'ITA', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 146, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'daisuke-itani', 'Daisuke Itani', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 147, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'sei-iwata', 'Sei Iwata', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 148, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'john-jackman', 'John Jackman', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 149, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'matthew-jackson', 'Matthew Jackson', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 150, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'justin-janssen', 'Justin Janssen', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 151, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'andy-jaquez', 'Andy Jaquez', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 152, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'angel-jaramillo', 'Angel Jaramillo', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 153, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'jacob-jean', 'jacob jean', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 154, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'kyle-jeffs', 'Kyle Jeffs', 'CAN', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 155, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'juyeong-jeong', 'JUYEONG JEONG', 'KOR', 'South Korea', '2026 World Championships invitation earned', 'invite_earned', true, 156, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'luke-jonkers', 'Luke Jonkers', 'ZAF', 'Middle East & South Africa', '2026 World Championships invitation earned', 'invite_earned', true, 157, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'justin-joseph', 'JUSTIN JOSEPH', 'IND', 'India', '2026 World Championships invitation earned', 'invite_earned', true, 158, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'mihir-joshi', 'MIHIR JOSHI', 'IND', 'India', '2026 World Championships invitation earned', 'invite_earned', true, 159, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'filipe-junqueira-pedras-passos', 'Filipe Junqueira Pedras Passos', 'BRA', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 160, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'masatoshi-kai', 'Masatoshi Kai', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 161, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'yusuke-kakara', 'Yusuke Kakara', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 162, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'lucas-kanan', 'Lucas Kanan', 'BRA', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 163, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'kelsey-kaplan', 'Kelsey Kaplan', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 164, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'aaron-kaplan', 'Aaron Kaplan', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 165, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'elsan-karuniawan', 'ELSAN KARUNIAWAN', 'IDN', 'Indonesia', '2026 World Championships invitation earned', 'invite_earned', true, 166, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'andrew-kazenas', 'Andrew Kazenas', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 167, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'md-asad-kazmi', 'MD ASAD KAZMI', 'IND', 'India', '2026 World Championships invitation earned', 'invite_earned', true, 168, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'enomoto-keita', 'Enomoto Keita', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 169, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'asim-ali-khan', 'Asim-Ali Khan', 'GBR', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 170, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'jongsu-kim', 'JONGSU KIM', 'KOR', 'South Korea', '2026 World Championships invitation earned', 'invite_earned', true, 171, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'jonghyun-kim', 'Jonghyun Kim', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 172, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'aathman-kirubaharan', 'Aathman Kirubaharan', 'CAN', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 173, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'yuki-kishida', 'Yuki Kishida', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 174, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'naoto-kishida', 'Naoto Kishida', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 175, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'kento-kishita', 'Kento Kishita', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 176, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'tetsuya-koga', 'Tetsuya Koga', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 177, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'hongo-koki', 'Hongo Koki', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 178, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'inoue-koki', 'Inoue Koki', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 179, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'alexander-konig', 'Alexander König', 'DEU', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 180, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'leonard-konig', 'Leonard König', 'DEU', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 181, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'takuya-kono', 'Takuya Kono', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 182, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'kanch-kruasuwan', 'KANCH KRUASUWAN', 'THA', 'Thailand', '2026 World Championships invitation earned', 'invite_earned', true, 183, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'naoya-kurihara', 'Naoya Kurihara', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 184, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'tatsuki-kuromori', 'Tatsuki Kuromori', 'CAN', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 185, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'adam-kury', 'Adam Kury', 'AUS', 'Oceania', '2026 World Championships invitation earned', 'invite_earned', true, 186, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'jerald-la-madrid', 'Jerald La Madrid', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 187, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'cristian-lago', 'Cristian Lago', 'ESP', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 188, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'ali-lahrime', 'Ali Lahrime', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 189, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'aaron-lai', 'AARON LAI', 'CHN', 'Chinese Mainland', '2026 World Championships invitation earned', 'invite_earned', true, 190, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'wei-kai-lai', 'WEI-KAI LAI', 'TWN', 'Taiwan', '2026 World Championships invitation earned', 'invite_earned', true, 191, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'andre-lancini', 'Andre Lancini', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 192, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'bo-langmaack', 'bo langmaack', 'DEU', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 193, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'cody-lawson', 'Cody Lawson', 'CAN', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 194, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'jooyeon-lee', 'JOOYEON LEE', 'KOR', 'South Korea', '2026 World Championships invitation earned', 'invite_earned', true, 195, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'pawat-lewnaparoj', 'Pawat Lewnaparoj', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 196, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'zhenghao-lin', 'Zhenghao Lin', 'NLD', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 197, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'jonathan-lo', 'Jonathan Lo', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 198, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'jesus-eduardo-lomas-basto', 'Jesus Eduardo Lomas Basto', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 199, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'nils-lundstrom', 'Nils Lundström', 'SWE', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 200, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'obed-macedo', 'obed macedo', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 201, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'borja-macias-nunez', 'Borja Macias nuñez', 'ESP', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 202, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'art-justin-maloco', 'Art Justin Maloco', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 203, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'ewerton-malvezzi', 'Ewerton Malvezzi', 'BRA', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 204, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'emanuele-manco', 'Emanuele Manco', 'ITA', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 205, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'elijah-marburger', 'Elijah Marburger', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 206, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'leo-marin-torres', 'Leo Marín Torres', 'ESP', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 207, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'thomas-martin', 'Thomas MARTIN', 'FRA', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 208, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'alec-martin', 'Alec Martin', 'FRA', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 209, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'hayden-martinez', 'Hayden Martinez', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 210, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'anan-masuda', 'Anan Masuda', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 211, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'ryan-matson', 'Ryan Matson', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 212, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'ayumu-matsuda', 'Ayumu Matsuda', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 213, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'jasper-mcavity', 'Jasper McAvity', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 214, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'andrew-medhurst', 'Andrew Medhurst', 'GBR', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 215, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'oswaldo-medina-rodriguez', 'Oswaldo Medina Rodríguez', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 216, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'adan-mejia', 'Adan Mejia', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 217, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'gilmar-mejia', 'Gilmar Mejía', 'SLV', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 218, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'sergio-merino-escutia', 'sergio merino escutia', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 219, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'joseph-middleton', 'Joseph Middleton', 'GBR', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 220, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'mi-osz-misio-ek', 'Miłosz Misiołek', 'POL', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 221, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'yuga-mita', 'Yuga Mita', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 222, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'kazuhiro-mitsuta', 'Kazuhiro Mitsuta', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 223, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'alexander-montalvo', 'Alexander Montalvo', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 224, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'cristobal-morales-pavat', 'Cristóbal Morales Pavat', 'CHL', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 225, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'ramses-morales-velasquez', 'ramses morales velasquez', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 226, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'keito-morita', 'Keito Morita', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 227, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'nathan-mortensen', 'Nathan Mortensen', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 228, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'paulo-mosquera', 'Paulo Mosquera', 'BRA', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 229, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'petr-muller', 'Petr Müller', 'CZE', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 230, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'julia-muniz', 'Julia Muniz', 'BRA', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 231, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'amit-nahmias', 'Amit Nahmias', 'ISR', 'Middle East & South Africa', '2026 World Championships invitation earned', 'invite_earned', true, 232, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'satomi-nakashima', 'Satomi Nakashima', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 233, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'jose-alberto-nava-rojas', 'Jose Alberto Nava Rojas', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 234, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'kai-rui-aldric-ng', 'KAI RUI ALDRIC NG', 'SGP', 'Singapore', '2026 World Championships invitation earned', 'invite_earned', true, 235, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'hieu-nguyen', 'Hieu Nguyen', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 236, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'haruki-nishimura', 'Haruki Nishimura', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 237, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'seto-nobuhiko', 'Seto Nobuhiko', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 238, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'david-norris', 'David Norris', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 239, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'katsunari-oda', 'Katsunari Oda', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 240, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'yuki-ohama', 'Yuki Ohama', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 241, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'jonasz-oles', 'Jonasz Oleś', 'POL', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 242, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'tateyama-osamu', 'Tateyama Osamu', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 243, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'derek-oudie', 'Derek Oudie', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 244, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'hyunwoo-park', 'HYUNWOO PARK', 'KOR', 'South Korea', '2026 World Championships invitation earned', 'invite_earned', true, 245, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'jacob-parra', 'Jacob Parra', 'CAN', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 246, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'sean-pawlowski', 'Sean Pawlowski', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 247, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'michelle-payne', 'Michelle Payne', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 248, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'sebastian-pazos', 'Sebastián Pazos', 'CHL', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 249, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'ho-pei-chin', 'HO PEI-CHIN', 'TWN', 'Taiwan', '2026 World Championships invitation earned', 'invite_earned', true, 250, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'caleb-peng', 'Caleb Peng', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 251, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'luis-perez-capistran', 'Luis Pérez capistran', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 252, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'rikus-pilat', 'Rikus Pilat', 'NLD', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 253, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'szymon-p-otka', 'Szymon Płotka', 'POL', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 254, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'kurt-potgieter', 'Kurt Potgieter', 'ZAF', 'Middle East & South Africa', '2026 World Championships invitation earned', 'invite_earned', true, 255, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'max-prasad', 'Max Prasad', 'GBR', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 256, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'navaneeth-praveen', 'NAVANEETH Praveen', 'IND', 'India', '2026 World Championships invitation earned', 'invite_earned', true, 257, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'brian-prendergast', 'Brian Prendergast', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 258, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'patryk-przybysz', 'Patryk Przybysz', 'POL', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 259, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'aurelien-pugin', 'Aurélien Pugin', 'CHE', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 260, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'carlos-rangel', 'Carlos Rangel', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 261, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'jeff-reimer', 'Jeff Reimer', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 262, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'chris-reisner', 'Chris Reisner', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 263, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'jorge-gustavo-ribeiro', 'Jorge Gustavo Ribeiro', 'BRA', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 264, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'gustav-ripperger', 'Gustav Ripperger', 'DEU', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 265, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'garcia-rivera', 'Garcia Rivera', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 266, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'carlos-abraham-rocha-hernandez', 'Carlos Abraham Rocha Hernandez', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 267, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'marcus-rock', 'Marcus Rock', 'AUS', 'Oceania', '2026 World Championships invitation earned', 'invite_earned', true, 268, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'marcos-rodriguez', 'Marcos Rodriguez', 'ESP', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 269, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'gonzalo-rojas', 'Gonzalo Rojas', 'CHL', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 270, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'ilam-rojas-guerrero', 'Ilam Rojas Guerrero', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 271, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'jacob-rosenberg', 'Jacob Rosenberg', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 272, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'austin-prince-sakayaraj', 'AUSTIN PRINCE SAKAYARAJ', 'IND', 'India', '2026 World Championships invitation earned', 'invite_earned', true, 273, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'yoshito-sakurabara', 'Yoshito Sakurabara', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 274, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'santiago-sanchez-lozano', 'Santiago Sánchez Lozano', 'ESP', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 275, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'michel-andrew-sanchez-manjarrez', 'Michel Andrew Sánchez Manjarrez', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 276, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'nicolas-santillan', 'Nicolas Santillan', 'ARG', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 277, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'neo-sasaki', 'Neo Sasaki', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 278, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'satoshi-sasaki', 'Satoshi Sasaki', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 279, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'yamato-sasaki', 'Yamato Sasaki', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 280, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'federico-scafidi', 'federico scafidi', 'ITA', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 281, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'andrea-scala', 'Andrea Scala', 'ITA', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 282, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'diederik-schiet', 'Diederik Schiet', 'NLD', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 283, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'heather-schirra', 'Heather Schirra', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 284, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'karim-sedaoui', 'Karim Sedaoui', 'GBR', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 285, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'tiwat-seearamroongruang', 'TIWAT SEEARAMROONGRUANG', 'THA', 'Thailand', '2026 World Championships invitation earned', 'invite_earned', true, 286, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'timothy-setiawan', 'TIMOTHY SETIAWAN', 'IDN', 'Indonesia', '2026 World Championships invitation earned', 'invite_earned', true, 287, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'prithvi-sharma', 'PRITHVI SHARMA', 'IND', 'India', '2026 World Championships invitation earned', 'invite_earned', true, 288, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'yogesh-sharma', 'YOGESH SHARMA', 'IND', 'India', '2026 World Championships invitation earned', 'invite_earned', true, 289, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'taichi-shimokawa', 'Taichi Shimokawa', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 290, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'masashi-shimura', 'Masashi Shimura', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 291, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'ryan-shoushi', 'ryan shoushi', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 292, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'jan-sikorski', 'Jan Sikorski', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 293, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'abhigyan-singh', 'ABHIGYAN SINGH', 'IND', 'India', '2026 World Championships invitation earned', 'invite_earned', true, 294, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'rica-smolinski', 'RICA SMOLINSKI', 'PHL', 'Philippines', '2026 World Championships invitation earned', 'invite_earned', true, 295, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'felipe-solis', 'Felipe Solis', 'CHL', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 296, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'daanish-soni', 'DAANISH SONI', 'IND', 'India', '2026 World Championships invitation earned', 'invite_earned', true, 297, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'sergio-hernan-soria', 'Sergio Hernan Soria', 'ARG', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 298, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'paula-sosa', 'Paula Sosa', 'ESP', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 299, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'colin-spa', 'Colin Spa', 'NLD', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 300, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'kelvin-spa', 'Kelvin Spa', 'NLD', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 301, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'damian-sromek', 'Damian Sromek', 'POL', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 302, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'jessica-stella', 'Jessica Stella', 'AUS', 'Oceania', '2026 World Championships invitation earned', 'invite_earned', true, 303, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'saradisuk-suksawat', 'SARADISUK SUKSAWAT', 'THA', 'Thailand', '2026 World Championships invitation earned', 'invite_earned', true, 304, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'yuxing-sun', 'Yuxing Sun', 'CAN', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 305, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'william-suryajaya', 'William Suryajaya', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 306, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'kazuma-suwa', 'Kazuma Suwa', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 307, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'skyler-sy', 'Skyler Sy', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 308, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'pawe-szczur', 'Paweł Szczur', 'POL', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 309, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'maeda-taiki', 'Maeda Taiki', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 310, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'kibino-takeru', 'Kibino Takeru', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 311, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'okuyama-takuro', 'Okuyama Takuro', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 312, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'kin-chung-tam', 'KIN CHUNG TAM', 'HKG', 'Hong Kong', '2026 World Championships invitation earned', 'invite_earned', true, 313, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'takuto-tanaka', 'Takuto Tanaka', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 314, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'hiroki-tanaka', 'Hiroki Tanaka', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 315, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'frank-tantillo', 'Frank Tantillo', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 316, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'robin-te-laar', 'Robin te Laar', 'DEU', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 317, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'laurent-thoeny', 'Laurent Thoeny', 'CHE', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 318, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'carlos-ivan-tinajar-bernabe', 'Carlos Ivan Tinajar Bernabe', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 319, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'takamatsu-tomoki', 'Takamatsu Tomoki', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 320, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'joeddy-torres-loyola', 'Joeddy Torres Loyola', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 321, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'kurita-toshiki', 'Kurita Toshiki', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 322, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'gerardo-trevino', 'Gerardo Treviño', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 323, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'shota-uchikawa', 'Shota Uchikawa', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 324, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'tomoya-uda', 'Tomoya Uda', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 325, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'keitaro-ukitsu', 'Keitaro Ukitsu', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 326, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'manuel-valenzuela', 'Manuel Valenzuela', 'CHL', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 327, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'angello-valer', 'Angello Valer', 'PER', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 328, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'vicente-verdeguer', 'Vicente Verdeguer', 'ESP', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 329, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'david-vergara', 'David Vergara', 'CHL', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 330, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'martijn-versteeg', 'Martijn Versteeg', 'NLD', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 331, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'victor-javier-vidal-guerrero', 'Victor Javier Vidal Guerrero', 'PER', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 332, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'cedric-voigt', 'Cedric Voigt', 'DEU', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 333, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'john-waggoner', 'John Waggoner', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 334, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'stratten-waldt', 'Stratten Waldt', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 335, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'alice-walker', 'Alice Walker', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 336, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'eric-wang', 'Eric Wang', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 337, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'harry-wang', 'Harry Wang', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 338, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'micha-waszak', 'Michał Waszak', 'POL', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 339, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'junya-watanabe', 'Junya Watanabe', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 340, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'daniel-wegener', 'Daniel Wegener', 'ZAF', 'Middle East & South Africa', '2026 World Championships invitation earned', 'invite_earned', true, 341, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'dominik-wieber', 'Dominik Wieber', 'DEU', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 342, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'daniel-wigert', 'Daniel Wigert', 'SWE', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 343, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'tj-williams', 'Tj Williams', 'NZL', 'Oceania', '2026 World Championships invitation earned', 'invite_earned', true, 344, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'alan-wong', 'Alan Wong', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 345, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'hei-tong-wong', 'HEI TONG WONG', 'HKG', 'Hong Kong', '2026 World Championships invitation earned', 'invite_earned', true, 346, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'ho-kwan-wong', 'HO KWAN WONG', 'HKG', 'Hong Kong', '2026 World Championships invitation earned', 'invite_earned', true, 347, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'kevin-wood', 'Kevin Wood', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 348, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'dean-woodhouse', 'Dean Woodhouse', 'GBR', 'Europe', '2026 World Championships invitation earned', 'invite_earned', true, 349, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'shengda-wu', 'SHENGDA WU', 'TWN', 'Taiwan', '2026 World Championships invitation earned', 'invite_earned', true, 350, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'shuhan-xia', 'Shuhan Xia', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 351, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'shion-yachimori', 'Shion Yachimori', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 352, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'ren-yamada', 'Ren Yamada', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 353, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'takeho-yamagata', 'Takeho Yamagata', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 354, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'kakeru-yamaguchi', 'Kakeru Yamaguchi', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 355, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'hiroki-yamauchi', 'Hiroki Yamauchi', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 356, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'douglas-yang', 'Douglas Yang', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 357, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'hsuan-jui-yang', 'HSUAN-JUI YANG', 'TWN', 'Taiwan', '2026 World Championships invitation earned', 'invite_earned', true, 358, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'umeda-yoshihiro', 'Umeda Yoshihiro', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 359, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'song-youngjune', 'SONG YOUNGJUNE', 'KOR', 'South Korea', '2026 World Championships invitation earned', 'invite_earned', true, 360, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'hyeongjun-yu', 'HYEONGJUN YU', 'KOR', 'South Korea', '2026 World Championships invitation earned', 'invite_earned', true, 361, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'hamada-yu', 'Hamada Yu', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 362, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'brandon-yuan', 'Brandon Yuan', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 363, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'ikegami-yuki', 'Ikegami Yuki', 'JPN', 'Japan', '2026 World Championships invitation earned', 'invite_earned', true, 364, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'david-zavala', 'David Zavala', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 365, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'ernesto-zazueta', 'Ernesto Zazueta', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 366, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'bob-zhang', 'Bob Zhang', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 367, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'matt-zimmerman', 'Matt Zimmerman', 'USA', 'North America', '2026 World Championships invitation earned', 'invite_earned', true, 368, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11'),
  ('2026-pokemon-go', 'carlos-zuniga', 'Carlos Zuñiga', 'MEX', 'Latin America', '2026 World Championships invitation earned', 'invite_earned', true, 369, 'https://worlds.pokemon.com/en-us/about/qualified/', '2026-08-11');

update public.worlds_pick_events
set display_name = '2026 Pokémon GO Worlds Pick 10',
    status = 'open',
    roster_source_url = 'https://worlds.pokemon.com/en-us/about/qualified/',
    roster_checked_at = '2026-08-11',
    updated_at = now()
where id = '2026-pokemon-go';

do $postflight$
begin
  if (select count(*) from public.worlds_pick_competitors where event_id = '2026-pokemon-go') <> 369
     or (select count(distinct slug) from public.worlds_pick_competitors where event_id = '2026-pokemon-go') <> 369
     or (select count(distinct source_order) from public.worlds_pick_competitors where event_id = '2026-pokemon-go') <> 369 then
    raise exception 'The reviewed Pokémon GO pool must contain 369 unique competitors and source orders.';
  end if;

  if exists (
    select 1 from public.worlds_pick_competitors
    where event_id = '2026-pokemon-go'
      and (attendance_status <> 'invite_earned' or not is_selectable or score_points <> 0
        or source_url <> 'https://worlds.pokemon.com/en-us/about/qualified/'
        or source_checked_at <> '2026-08-11')
  ) then
    raise exception 'The Pokémon GO pool contains an unexpected status, score, or source.';
  end if;

  if not exists (
    select 1 from public.worlds_pick_events
    where id = '2026-pokemon-go'
      and status = 'open'
      and roster_source_url = 'https://worlds.pokemon.com/en-us/about/qualified/'
      and roster_checked_at = '2026-08-11'
  ) then
    raise exception 'The 2026 Pokémon GO event did not open on the reviewed roster.';
  end if;

  if exists (select 1 from public.worlds_pick_entries where event_id = '2026-pokemon-go') then
    raise exception 'Opening the Pokémon GO pool must not create prediction entries.';
  end if;

  if exists (
    select 1 from public.worlds_result_sources
    where event_id = '2026-pokemon-go'
      and (enabled or state <> 'disabled' or feed_url is not null or external_event_id is not null)
  ) then
    raise exception 'Opening Pokémon GO Pick 10 must not enable results polling.';
  end if;
end;
$postflight$;

commit;
