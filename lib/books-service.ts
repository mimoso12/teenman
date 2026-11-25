import {googleBook,libraryBook,plain,type Book} from './culture';
import {createPublicSourceClient,PublicSourceError} from './public-source-client';
export function createBooksService(fetcher:typeof fetch=fetch,now=Date.now){
 const client=createPublicSourceClient(fetcher,now);let googleCooldown=0;
 async function list(query='subject:fiction'){
  if(now()>=googleCooldown){try{const data=await client.get('https://www.googleapis.com/books/v1/volumes?'+new URLSearchParams({q:query||'subject:fiction',langRestrict:'pt',maxResults:'18'}),3600);if(data.error||(!Array.isArray(data.items)&&data.totalItems!==0))throw new PublicSourceError();return {results:(data.items||[]).map(googleBook).filter(Boolean) as Book[],source:'Google Books',notice:'',unavailable:[]};}catch(error){googleCooldown=now()+(error instanceof PublicSourceError&&error.status===429?300000:60000);}}
  const data=await client.get('https://openlibrary.org/search.json?'+new URLSearchParams({q:`(${query||'subject:fiction'}) language:por`,lang:'pt',limit:'18',fields:'key,title,author_name,first_publish_year,cover_i,editions,editions.key,editions.title,editions.publisher,editions.publish_date,editions.number_of_pages,editions.cover_i'}),3600);if(!Array.isArray(data.docs))throw new PublicSourceError();
  return {results:data.docs.map(libraryBook).filter(Boolean) as Book[],source:'Open Library',notice:'Google Books indisponível. Exibindo obras com edições em português da Open Library; títulos e metadados podem variar entre edições.',unavailable:['Google Books']};
 }
 async function description(id:string){if(!/^OL\d+W$/.test(id))throw new PublicSourceError(400);const data=await client.get(`https://openlibrary.org/works/${id}.json`,3600);return {description:plain(typeof data.description==='string'?data.description:data.description?.value)};}
 return {list,description};
}
export const booksService=createBooksService();
