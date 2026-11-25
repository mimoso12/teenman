import 'server-only';
import {spotifyGet} from './spotify-server';
import {createArtistsService} from './spotify-artists-service';
export const spotifyArtists=createArtistsService(path=>spotifyGet(path,true,3600));
