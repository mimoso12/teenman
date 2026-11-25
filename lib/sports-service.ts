import {sportEvent,sportTeam,type SportEvent,type SportTeam} from './culture';
import {createPublicSourceClient,PublicSourceError} from './public-source-client';
export function createSportsService(fetcher:typeof fetch=fetch){
 const client=createPublicSourceClient(fetcher),base='https://www.thesportsdb.com/api/v1/json/123/';
 async function get(query='',teamId=''){
  if(query&&!teamId){const data=await client.get(base+'searchteams.php?'+new URLSearchParams({t:query}),1800);if(data.teams!==null&&!Array.isArray(data.teams))throw new PublicSourceError();return {teams:(data.teams||[]).map(sportTeam).filter(Boolean) as SportTeam[],past:[] as SportEvent[],next:[] as SportEvent[],unavailable:[] as string[]};}
  const [past,next]=await Promise.allSettled([client.get(base+(teamId?'eventslast.php':'eventspastleague.php')+'?id='+(teamId||'4351'),1800),client.get(base+(teamId?'eventsnext.php':'eventsnextleague.php')+'?id='+(teamId||'4351'),1800)]);
  function events(result:PromiseSettledResult<any>){if(result.status==='rejected')return null;if(result.value.events!==null&&!Array.isArray(result.value.events)&&!Array.isArray(result.value.results))return null;return (result.value.events||result.value.results||[]).map(sportEvent).filter(Boolean) as SportEvent[];}
  const recent=events(past),upcoming=events(next);return {teams:[] as SportTeam[],past:recent||[],next:upcoming||[],unavailable:[...(recent===null?['Resultados recentes']:[]),...(upcoming===null?['Próximos jogos']:[])]};
 }
 return {get};
}
export const sportsService=createSportsService();
