import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('Postgres: inscrições privadas, claims só no servidor, deduplicação e retry limitado', async () => {
  const db = new PGlite();
  const owner = '10000000-0000-4000-8000-000000000001', other = '10000000-0000-4000-8000-000000000002', notification = '20000000-0000-4000-8000-000000000001';
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
    create table notifications(id uuid primary key,user_id uuid,actor_id uuid,is_read boolean default false,created_at timestamptz default now());insert into auth.users values('${owner}'),('${other}');insert into notifications(id,user_id,actor_id) values('${notification}','${owner}','${other}');`);
    const sql = readFileSync(new URL('../supabase/push-subscriptions.sql', import.meta.url), 'utf8'); await db.exec(sql);
    await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);insert into push_subscriptions(user_id,endpoint,p256dh,auth) values('${owner}','https://fcm.googleapis.com/a','B${'a'.repeat(86)}','${'a'.repeat(22)}');`);
    const device = (await db.query<{id: string}>('select id from push_subscriptions')).rows[0].id;
    await assert.rejects(() => db.exec(`select claim_push_delivery('${notification}','${device}')`), /permission denied/i);
    await db.exec(`select set_config('request.jwt.claim.sub','${other}',false);`);
    assert.equal((await db.query('select * from push_subscriptions')).rows.length, 0);
    await assert.rejects(() => db.exec(`insert into push_subscriptions(user_id,endpoint,p256dh,auth) values('${owner}','https://fcm.googleapis.com/forged','B${'a'.repeat(86)}','${'a'.repeat(22)}')`), /row-level security/i);
    await assert.rejects(() => db.exec(`select * from push_deliveries`), /permission denied/i);
    await db.exec('reset role;set role service_role;');
    const claim = async () => (await db.query<{claimed: boolean}>(`select claim_push_delivery('${notification}','${device}') as claimed`)).rows[0].claimed;
    assert.equal(await claim(), true); assert.equal(await claim(), false);
    await db.exec(`update push_deliveries set status='failed',claimed_at=now()-interval '3 minutes'`); assert.equal(await claim(), true);
    await db.exec(`update push_deliveries set status='failed',claimed_at=now()-interval '3 minutes'`); assert.equal(await claim(), true);
    await db.exec(`update push_deliveries set status='failed',claimed_at=now()-interval '3 minutes'`); assert.equal(await claim(), false);
    await db.exec(`update push_deliveries set status='sent',attempts=1`); assert.equal(await claim(), false);
    await db.exec(`reset role;delete from push_deliveries;update notifications set is_read=true;set role service_role`); assert.equal(await claim(), false);
    await db.exec(`reset role;update notifications set is_read=false,created_at=now()-interval '2 hours';set role service_role`); assert.equal(await claim(), false);
    await db.exec('reset role;'); await db.exec(sql); await db.exec('set role anon;');
    await assert.rejects(() => db.exec('select * from push_subscriptions'), /permission denied/i);
  } finally {await db.close();}
});
