export class PublicSourceError extends Error{constructor(public status=503){super('Fonte temporariamente indisponível');}}
export function createPublicSourceClient(fetcher:typeof fetch=fetch,now=Date.now){
 const cache=new Map<string,{value:any;expires:number}>(),pending=new Map<string,Promise<any>>(),failures=new Map<string,number>();
 async function get(url:string,seconds:number,format:'json'|'text'='json'):Promise<any>{
  const key=format+url,hit=cache.get(key);if(hit&&hit.expires>now())return hit.value;if((failures.get(key)||0)>now())throw new PublicSourceError();if(pending.has(key))return pending.get(key);
  const task=(async()=>{try{const response=await fetcher(url,{headers:{Accept:format==='json'?'application/json':'application/rss+xml, application/xml, text/xml','User-Agent':'Teenman/0.1 (culture and information reader)'},next:{revalidate:seconds},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new PublicSourceError(response.status);if(Number(response.headers.get('content-length'))>2000000)throw new PublicSourceError();const body=await response.text();if(body.length>2000000)throw new PublicSourceError();const value=format==='json'?JSON.parse(body):body;if(cache.size>=120)cache.delete(cache.keys().next().value!);cache.set(key,{value,expires:now()+seconds*1000});failures.delete(key);return value;}catch(error){if(failures.size>=120)failures.delete(failures.keys().next().value!);failures.set(key,now()+Math.min(seconds,300)*1000);if(error instanceof PublicSourceError)throw error;throw new PublicSourceError();}})();pending.set(key,task);try{return await task;}finally{pending.delete(key);}
 }
 return {get};
}
