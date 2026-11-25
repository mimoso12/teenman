import 'server-only';
import {spotifyGet} from './spotify-server';
import {createCollectionsService} from './spotify-collections-service';
export const spotifyCollections=createCollectionsService(path=>spotifyGet(path,true,3600));
