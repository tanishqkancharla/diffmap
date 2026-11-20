-- The accounts that may share while sharing is internal, by verified email.
-- `npm run cloud:publishers` manages it.
create table "publisher" (
  "email" text not null primary key,
  "added_at" integer not null
);

insert into "publisher" ("email", "added_at")
values ('tanishqkancharla3@gmail.com', 1795118400000);
