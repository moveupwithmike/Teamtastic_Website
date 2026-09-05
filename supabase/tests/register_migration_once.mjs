#!/usr/bin/env node
// MANUAL-OPS ONLY — DO NOT RUN AUTOMATICALLY, DO NOT ADD TO CI.
// This tool exists because migration 20260825120000 (launch_certification_policy_v62)
// was applied to production outside the `supabase` CLI and needed its ledger row
// reconciled exactly once. It writes directly into the PRODUCTION migration ledger
// via the Management API, bypassing `supabase migration` entirely.
//
// Guardrails (enforced below):
//   1. Refuses to run in CI or without REGISTER_MIGRATION_MANUAL_OPS=1.
//   2. Derives the ledger version from the migration FILENAME timestamp — you can
//      never silently register a version that does not match the file you are
//      registering.
//   3. Still refuses to write if the version is already registered (existing path).
// Using this for any other migration requires a human operator, a reviewed reason,
// and an updated header comment. Prefer `supabase db push` / the CLI for everything
// else.
import fs from "node:fs";

if (process.env.CI) {
  throw new Error("register_migration_once is manual-ops only and refuses to run in CI.");
}
if (process.env.REGISTER_MIGRATION_MANUAL_OPS !== "1") {
  throw new Error(
    "Manual ops confirmation required: set REGISTER_MIGRATION_MANUAL_OPS=1 to run.",
  );
}

const token = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF = "cutcpkegxwhnafrvfbcd";

const migrationFile = "supabase/migrations/20260825120000_launch_certification_policy_v62.sql";
const version = migrationFile.match(/(\d{14})_/)?.[1];
if (!version || !/^\d{14}$/.test(version)) {
  throw new Error(`Could not derive a 14-digit ledger version from filename: ${migrationFile}`);
}
const name = migrationFile.match(/_\d{14}_([^/]+)\.sql$/)?.[1] || migrationFile;

const query = async (sql) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const t = await r.text();
  if (r.status >= 300) throw new Error(`${r.status} ${t.slice(0, 500)}`);
  return JSON.parse(t);
};

const already = await query(
  "select version, name from supabase_migrations.schema_migrations where version = '" + version + "'",
);
if (already.length > 0) {
  console.log("already registered:", JSON.stringify(already));
  process.exit(0);
}

const statements = fs.readFileSync(migrationFile, "utf8");
if (statements.includes("$mig$")) throw new Error("unexpected delimiter collision");

await query(`
insert into supabase_migrations.schema_migrations(version, name, statements)
values ('${version}', '${name}', array[$mig$${statements}$mig$::text])
`);

console.log(JSON.stringify(await query(
  "select version, name from supabase_migrations.schema_migrations order by version desc limit 3",
), null, 1));