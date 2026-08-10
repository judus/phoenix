# 0001: Use SQLite for local persistence

Status: accepted

Date: 2026-08-10

## Decision

PHOENIX uses SQLite as its default database and keeps access behind the server-side `Database` contract.

The initial driver is Node's built-in `node:sqlite` module. This avoids an additional native dependency and keeps Linux and eventual Windows installations on the same storage engine. The application enables foreign keys and write-ahead logging for file-backed databases.

## Why SQLite

PHOENIX is a local, single-user application. Its durable data—configuration, conversations, memories, quests, indexed journal projections, and runtime metadata—fits a transactional embedded database better than a separately managed database server.

SQLite provides:

- one portable database file;
- transactions, constraints, and indexes;
- mature backup and inspection tooling;
- no database daemon, account, port, or installer;
- enough concurrency for PHOENIX's local workload.

## Driver maturity

The installed Node 24.14 runtime still labels `node:sqlite` experimental. Node 24.15 promotes it to release-candidate stability. PHOENIX deliberately contains the driver inside `SqliteDatabase`, so a Node API change or a future driver replacement does not affect application services.

Upgrade the development runtime within the Node 24 line when practical. Reconsider the driver before native packaging, but do not replace SQLite without a demonstrated requirement.

## Reconsider this decision if

- PHOENIX becomes a multi-user network service;
- multiple independent processes must write concurrently;
- data must be shared between machines through a central server; or
- measured workloads exceed SQLite's practical limits.

