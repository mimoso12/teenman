import 'server-only';
import {spotifyGet} from './spotify-server';
import {createSpotifyCatalog} from './spotify-catalog-service';
export const spotifyCatalog=createSpotifyCatalog(spotifyGet);
