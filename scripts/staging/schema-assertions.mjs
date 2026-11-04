// Post-migration assertions. `q(sql)` returns rows and rejects with a SQLSTATE in
// `.code`, so the same checks run on staging and on a disposable database.
// Privileges are asked about each role by name, or exercised under SET ROLE: the
// privileged connection's own access proves nothing about visitors.
export const VISITORS = ["anon", "authenticated"];
const PRIVATE_TABLES = ["admin_users", "inquiries"];
const HIDDEN_COLUMNS = { products: ["cost_price"], media: ["uploaded_by"] };
const WRITE_PRIVS = ["INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"];

export const CATALOG_QUERIES = {
  columns: `select table_name t, column_name c, data_type d, udt_name u, is_nullable n, column_default df from information_schema.columns where table_schema='public' order by 1,2`,
  constraints: `select conrelid::regclass::text t, conname n, contype::text k, pg_get_constraintdef(c.oid) def from pg_constraint c join pg_namespace ns on ns.oid=c.connamespace where ns.nspname='public' and contype<>'n' order by 1,2`,
  indexes: `select tablename t, indexname n, indexdef d from pg_indexes where schemaname='public' order by 1,2`,
  functions: `select proname n, pg_get_functiondef(p.oid) d from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' order by 1`,
  triggers: `select c.relname t, tg.tgname n, pg_get_triggerdef(tg.oid) d from pg_trigger tg join pg_class c on c.oid=tg.tgrelid join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and not tg.tgisinternal order by 1,2`,
  sequences: `select sequencename n, data_type::text d from pg_sequences where schemaname='public' order by 1`,
  policies: `select tablename t, policyname n, permissive p, roles::text r, cmd c, qual q, with_check w from pg_policies where schemaname='public' order by 1,2`,
  rls: `select c.relname t, c.relrowsecurity r from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relkind='r' order by 1`,
  enums: `select t.typname n, string_agg(e.enumlabel, ',' order by e.enumsortorder) v from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace ns on ns.oid=t.typnamespace where ns.nspname='public' group by 1 order by 1`,
  grants: `select table_name t, grantee g, string_agg(privilege_type, ',' order by privilege_type) p from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role') group by 1,2 order by 1,2`,
};

const canon = (rows) => rows.map((r) => JSON.stringify(r).replace(/\\r\\n/g, "\\n")).sort();

/** Compares each catalogue area with the recorded production fingerprint. Names and definitions only. */
export async function compareCatalog(q, recorded) {
  const out = {};
  for (const [area, sql] of Object.entries(CATALOG_QUERIES)) {
    const a = canon(recorded[area]), b = canon(await q(sql));
    out[area] = { production: a.length, target: b.length, onlyProduction: a.filter((x) => !b.includes(x)), onlyTarget: b.filter((x) => !a.includes(x)) };
  }
  return out;
}

/** Catalogue privilege assertions for every visitor role. Returns failures and a summary. */
export async function assertPrivileges(q) {
  const failures = [];
  const tables = (await q(`select c.relname t from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by 1`)).map((r) => r.t);
  const columns = await q(`select table_name t, column_name c from information_schema.columns where table_schema='public' order by 1,2`);
  const sequences = (await q(`select sequencename n from pg_sequences where schemaname='public'`)).map((r) => r.n);
  const functions = (await q(`select p.oid::regprocedure::text f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`)).map((r) => r.f);
  const summary = { tables: tables.length, columns: columns.length, sequences: sequences.length, functions: functions.length, tableSelect: {}, columnSelectOnly: {} };

  for (const role of VISITORS) {
    summary.tableSelect[role] = [];
    summary.columnSelectOnly[role] = [];
    for (const t of tables) {
      const [row] = await q(`select ${[...WRITE_PRIVS, "SELECT"].map((p) => `has_table_privilege('${role}','public.${t}','${p}') "${p}"`).join(",")}, has_any_column_privilege('${role}','public.${t}','SELECT') anycol`);
      for (const p of WRITE_PRIVS) if (row[p]) failures.push(`${role} holds ${p} on ${t}`);
      if (row.SELECT) summary.tableSelect[role].push(t);
      else if (row.anycol) summary.columnSelectOnly[role].push(t);
      if (PRIVATE_TABLES.includes(t) && (row.SELECT || row.anycol)) failures.push(`${role} can read private table ${t}`);
      if (HIDDEN_COLUMNS[t] && row.SELECT) failures.push(`${role} has table-wide SELECT on ${t}, which exposes its hidden columns`);
    }
    for (const { t, c } of columns) {
      const [row] = await q(`select has_column_privilege('${role}','public.${t}','${c}','SELECT') s, has_column_privilege('${role}','public.${t}','${c}','INSERT') i, has_column_privilege('${role}','public.${t}','${c}','UPDATE') u, has_column_privilege('${role}','public.${t}','${c}','REFERENCES') r`);
      if (row.i || row.u || row.r) failures.push(`${role} holds a write privilege on ${t}.${c}`);
      if (HIDDEN_COLUMNS[t]?.includes(c) && row.s) failures.push(`${role} can read hidden column ${t}.${c}`);
      if (HIDDEN_COLUMNS[t] && !HIDDEN_COLUMNS[t].includes(c) && !row.s) failures.push(`${role} lost public column ${t}.${c}`);
    }
    for (const s of sequences) {
      const [row] = await q(`select has_sequence_privilege('${role}','public.${s}','USAGE') u, has_sequence_privilege('${role}','public.${s}','SELECT') s, has_sequence_privilege('${role}','public.${s}','UPDATE') w`);
      if (row.u || row.s || row.w) failures.push(`${role} holds a privilege on sequence ${s}`);
    }
    for (const f of functions) {
      const [row] = await q(`select has_function_privilege('${role}','${f}','EXECUTE') x`);
      if (row.x) failures.push(`${role} can execute ${f}`);
    }
    const [schema] = await q(`select has_schema_privilege('${role}','public','CREATE') c, has_schema_privilege('${role}','public','USAGE') u, coalesce(has_schema_privilege('${role}',to_regnamespace('drizzle')::oid,'USAGE'),false) d`);
    if (schema.c) failures.push(`${role} can create objects in public`);
    if (schema.d) failures.push(`${role} can reach the migration ledger schema`);
  }
  return { failures, summary };
}

/** Read-only behaviour under each visitor role. Assumes empty tables, returns no rows. */
export async function assertRoleReads(q) {
  const failures = [];
  const denied = [`select * from public.admin_users limit 0`, `select id from public.admin_users limit 0`, `select * from public.inquiries limit 0`, `select id from public.inquiries limit 0`, `select cost_price from public.products limit 0`, `select * from public.products limit 0`, `select uploaded_by from public.media limit 0`, `select * from public.media limit 0`];
  for (const role of VISITORS) {
    for (const sql of denied) {
      try {
        await q(`begin read only`);
        await q(`set local role ${role}`);
        await q(sql);
        failures.push(`${role} was allowed: ${sql}`);
      } catch (e) {
        if (e.code !== "42501") failures.push(`${role} got ${e.code} instead of 42501: ${sql}`);
      } finally { await q(`rollback`); }
    }
    try {
      await q(`begin read only`);
      await q(`set local role ${role}`);
      await q(`select id, status from public.products limit 0`);
    } catch (e) { failures.push(`${role} could not read public product columns (${e.code})`); } finally { await q(`rollback`); }
  }
  return failures;
}

/** Default privileges for objects postgres creates in public. Reported as rows, with the visitor result. */
export async function defaultPrivileges(q) {
  const rows = await q(`select pg_get_userbyid(d.defaclrole) owner, d.defaclobjtype "type", d.defaclacl::text acl from pg_default_acl d join pg_namespace n on n.oid=d.defaclnamespace where n.nspname='public' order by 1,2`);
  const failures = rows.filter((r) => r.owner === "postgres" && (r.type === "r" || r.type === "S") && /\b(anon|authenticated)=/.test(r.acl)).map((r) => `future ${r.type} objects from postgres are still granted to visitors`);
  return { rows, failures };
}

/**
 * Effective MAINTAIN for visitors. has_table_privilege already follows PUBLIC and
 * inherited roles; the direct PUBLIC grants and role memberships are reported too,
 * and LOCK TABLE exercises it, since that mode needs MAINTAIN or a write privilege.
 */
export async function assertMaintain(q) {
  const failures = [];
  const tables = (await q(`select c.relname t from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') order by 1`)).map((r) => r.t);
  const memberships = await q(`select r.rolname visitor, g.rolname member_of, m.inherit_option inherits from pg_auth_members m join pg_roles r on r.oid=m.member join pg_roles g on g.oid=m.roleid where r.rolname in ('anon','authenticated') order by 1,2`);
  const [pub] = await q(`select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(c.relacl) a where n.nspname='public' and a.grantee=0 and a.privilege_type='MAINTAIN'`);
  if (pub.n) failures.push(`PUBLIC holds MAINTAIN on ${pub.n} public tables`);
  let effective = 0, refusedLocks = 0;
  for (const role of VISITORS) {
    for (const t of tables) {
      const [row] = await q(`select has_table_privilege('${role}','public.${t}','MAINTAIN') m`);
      if (row.m) { effective++; failures.push(`${role} effectively holds MAINTAIN on ${t}`); }
      try {
        await q(`begin read only`);
        await q(`set local role ${role}`);
        await q(`lock table public.${t} in row exclusive mode nowait`);
        failures.push(`${role} was allowed LOCK TABLE on ${t}`);
      } catch (e) {
        if (e.code === "42501") refusedLocks++;
        else failures.push(`${role} got ${e.code} instead of 42501 locking ${t}`);
      } finally { await q(`rollback`); }
    }
  }
  return { failures, tables: tables.length, effective, publicGrants: pub.n, refusedLocks, memberships };
}

/** Row counts only. All must be zero until data loading is authorised. */
export async function contentCounts(q) {
  const tables = (await q(`select c.relname t from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') order by 1`)).map((r) => r.t);
  let applicationRows = 0;
  for (const t of tables) applicationRows += (await q(`select count(*)::int n from public."${t}"`))[0].n;
  const [managed] = await q(`select (select count(*)::int from auth.users) "authUsers", (select count(*)::int from auth.identities) "authIdentities", (select count(*)::int from auth.mfa_factors) "mfaFactors", (select count(*)::int from storage.buckets) buckets, (select count(*)::int from storage.objects) objects`);
  return { applicationRows, ...managed };
}

/** Every grant, owner and RLS flag in scope, as comparable strings. Metadata only. */
export async function permissionSnapshot(q) {
  const who = (col) => `case ${col} when 0 then 'PUBLIC' else pg_get_userbyid(${col}) end`;
  const row = (kind, name) => `'${kind} '||${name}||' '||pg_get_userbyid(a.grantor)||' > '||${who("a.grantee")}||' '||a.privilege_type||' '||a.is_grantable`;
  const queries = [
    `select ${row("object", "c.relname")} s from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(coalesce(c.relacl, acldefault((case when c.relkind='S' then 's' else 'r' end)::"char", c.relowner))) a where n.nspname='public'`,
    `select ${row("column", "(c.relname||'.'||t.attname)")} s from pg_attribute t join pg_class c on c.oid=t.attrelid join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(t.attacl) a where n.nspname='public' and t.attnum>0 and not t.attisdropped`,
    `select ${row("function", "p.oid::regprocedure::text")} s from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl, acldefault('f'::"char", p.proowner))) a where n.nspname='public'`,
    `select ${row("schema", "n.nspname")} s from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl, acldefault('n'::"char", n.nspowner))) a where n.nspname in ('public','drizzle')`,
    `select ${row("default", "(pg_get_userbyid(d.defaclrole)||'/'||coalesce(n.nspname,'(all)')||'/'||d.defaclobjtype::text)")} s from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace cross join lateral aclexplode(d.defaclacl) a`,
    `select 'owner '||c.relname||' '||pg_get_userbyid(c.relowner)||' rls='||c.relrowsecurity||' force='||c.relforcerowsecurity s from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'`,
    `select 'policy '||tablename||' '||policyname||' '||permissive||' '||roles::text||' '||cmd||' '||coalesce(qual,'')||' '||coalesce(with_check,'') s from pg_policies where schemaname='public'`,
    `select 'member '||r.rolname||' of '||g.rolname s from pg_auth_members m join pg_roles r on r.oid=m.member join pg_roles g on g.oid=m.roleid where r.rolname in ('anon','authenticated','service_role')`,
  ];
  const out = [];
  for (const sql of queries) for (const r of await q(sql)) out.push(r.s);
  return out.sort();
}

/** Ledger rows must equal the journal: same hash, same timestamp, same order. */
export async function assertLedger(q, entries) {
  const rows = await q(`select hash, created_at from drizzle.__drizzle_migrations order by id`);
  const failures = [];
  if (rows.length !== entries.length) failures.push(`ledger has ${rows.length} rows, journal has ${entries.length}`);
  entries.forEach((e, i) => {
    if (rows[i]?.hash !== e.hash) failures.push(`ledger hash differs for ${e.tag}`);
    if (String(rows[i]?.created_at) !== String(e.when)) failures.push(`ledger timestamp differs for ${e.tag}`);
  });
  return { rows: rows.length, failures };
}
