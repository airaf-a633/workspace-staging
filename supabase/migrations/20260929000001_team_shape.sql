-- Optional answer to "What does your team look like?" at sign-up. Only adjusts the setup
-- checklist and suggestions; it never limits features. Owners can change it later.
alter table public.workspaces
  add column team_shape text check (team_shape in ('solo', 'small', 'split', 'delivery'));
