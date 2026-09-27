-- Smoke test: proves pgTAP runs locally and in CI. Permission tests arrive in M1.
begin;
select plan(1);
select ok(true, 'pgTAP is available');
select * from finish();
rollback;
