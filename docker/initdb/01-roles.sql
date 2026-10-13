-- Brief 3.1.4: the two application database roles. Table-level grants
-- (prisma/grants.sql) are added once the schema exists (milestone 2).
create role hub_owner with login password 'hub_owner' createdb;
create role hub_app with login password 'hub_app';

alter database customer_hub owner to hub_owner;
grant all on schema public to hub_owner;
grant usage on schema public to hub_app;
