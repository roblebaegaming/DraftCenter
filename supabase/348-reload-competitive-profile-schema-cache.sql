-- Make the competitive profile RPCs visible to the production PostgREST API
-- after migrations 344-347 create the functions and import their reviewed data.

notify pgrst, 'reload schema';
