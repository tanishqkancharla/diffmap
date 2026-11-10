# Sessions in Postgres

## Problem overview

Sessions live in the API's memory, so a deploy signs every user out.

## Solution overview

Store sessions in Postgres. [Phase 1](01-sessions-table.md) adds the table, and [Phase 2](02-write-through.md) writes every new session to it.

## Goals

- A deploy keeps users signed in.

## Non-goals

- Moving other caches.
