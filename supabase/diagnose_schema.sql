-- Paste into the Supabase SQL editor and run. Read-only.
-- Shows which project/database the editor is on and whether 0003 has applied.
select
  current_database()                                   as database,
  current_user                                         as role,
  (select string_agg(column_name, ', ' order by ordinal_position)
     from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles') as profiles_columns,
  exists (select 1 from information_schema.tables
           where table_schema = 'public' and table_name = 'orient_checks')
                                                       as has_orient_checks;
