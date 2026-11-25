import {createTmdbService} from '../../../lib/tmdb-service';
import {createTmdbHandler} from '../../../lib/tmdb-http';
const service=createTmdbService({key:()=>process.env.TMDB_API_KEY});
export const GET=createTmdbHandler((query,page,filter)=>service.get(query,page,filter));
