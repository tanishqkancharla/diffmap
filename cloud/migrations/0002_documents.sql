-- A shared link. Its versions appear only once `latest_version` is set, so an
-- upload that never finishes stays invisible.
create table "document" (
  "id" text not null primary key,
  "owner_id" text not null references "user" ("id") on delete cascade,
  "title" text not null,
  "latest_version" integer,
  "created_at" integer not null,
  "stopped_at" integer,
  "removed_at" integer,
  "removed_reason" text
);

create index "document_owner_idx" on "document" ("owner_id");

create table "document_version" (
  "document_id" text not null references "document" ("id") on delete cascade,
  "n" integer not null,
  "manifest_hash" text not null,
  "bytes" integer not null,
  "published_by" text not null references "user" ("id"),
  "created_at" integer not null,
  primary key ("document_id", "n")
);
