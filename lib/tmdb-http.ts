import type {TmdbPage,SearchFilter} from './tmdb';
export function createTmdbHandler(get:(query:string,page:number,filter:SearchFilter)=>Promise<TmdbPage>){
  return async function GET(request:Request){
    let query='',page=1;
    try{
      const url=new URL(request.url);
      query=url.searchParams.get('query')?.trim()||'';
      page=Number(url.searchParams.get('page')||'1');
      const filter=url.searchParams.get('filter')||'all';
      if(!['all','movie','person'].includes(filter)||query.length>120||!Number.isInteger(page)||page<1||page>500){
        return Response.json({results:[],items:[],error:'Busca inválida.'},{status:400,headers:{'Cache-Control':'no-store'}});
      }
      const data=await get(query,page,filter as SearchFilter);
      return Response.json({...data,results:[...data.items,...(data.people||[])]},{headers:{'Cache-Control':'public, max-age=60, s-maxage=3600'}});
    }catch{
      // Falhas externas não quebram a página e não expõem URLs ou credenciais.
      return Response.json({results:[],items:[],people:[],query,page:Number.isInteger(page)&&page>0?page:1,totalPages:1,unavailable:true,error:'O catálogo está temporariamente indisponível. Tente novamente.'},{status:200,headers:{'Cache-Control':'no-store'}});
    }
  };
}
