import {collectionResponse} from '../../../../../lib/spotify-collection-route';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){return collectionResponse(request,params,'album');}
