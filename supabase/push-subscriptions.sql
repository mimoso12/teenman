-- Execute depois de notifications.sql no projeto covuebkkltmteqtopppa.
begin;
create table if not exists public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique check(length(endpoint)<=2048 and endpoint like 'https://%'),
 p256dh text not null check(length(p256dh) between 87 and 88),
 auth text not null check(length(auth) between 22 and 24),
 created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_owner on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public,anon,authenticated;
grant select,delete on public.push_subscriptions to authenticated;
grant insert(user_id,endpoint,p256dh,auth),update(user_id,endpoint,p256dh,auth) on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
drop policy if exists push_own_select on public.push_subscriptions;
drop policy if exists push_own_insert on public.push_subscriptions;
drop policy if exists push_own_update on public.push_subscriptions;
drop policy if exists push_own_delete on public.push_subscriptions;
create policy push_own_select on public.push_subscriptions for select to authenticated using((select auth.uid())=user_id);
create policy push_own_insert on public.push_subscriptions for insert to authenticated with check((select auth.uid())=user_id);
create policy push_own_update on public.push_subscriptions for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy push_own_delete on public.push_subscriptions for delete to authenticated using((select auth.uid())=user_id);

create table if not exists public.push_deliveries (
 notification_id uuid not null references public.notifications(id) on delete cascade,
 subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
 status text not null default 'sending' check(status in ('sending','sent','failed')),
 attempts integer not null default 1,
 claimed_at timestamptz not null default now(),
 primary key(notification_id,subscription_id)
);
alter table public.push_deliveries enable row level security;
revoke all on public.push_deliveries from public,anon,authenticated;
grant all on public.push_deliveries to service_role;
grant select on public.notifications to service_role;

-- Atomic per-device claim: webhook and browser may race without double delivery.
create or replace function public.claim_push_delivery(notification uuid,subscription uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare claimed boolean;
begin
 insert into public.push_deliveries(notification_id,subscription_id)
 select n.id,s.id from public.notifications n join public.push_subscriptions s on s.user_id=n.user_id
 where n.id=notification and s.id=subscription and n.actor_id<>n.user_id and n.is_read=false
 and n.created_at>now()-interval '1 hour'
 on conflict(notification_id,subscription_id) do update
 set status='sending',attempts=public.push_deliveries.attempts+1,claimed_at=now()
 where public.push_deliveries.status<>'sent' and public.push_deliveries.attempts<3
 and public.push_deliveries.claimed_at<now()-interval '2 minutes'
 returning true into claimed;
 return coalesce(claimed,false);
end $$;
revoke all on function public.claim_push_delivery(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_push_delivery(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
