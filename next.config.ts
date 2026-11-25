import type {NextConfig} from 'next';
const config:NextConfig={images:{remotePatterns:[{protocol:'https',hostname:'image.tmdb.org',port:'',pathname:'/t/p/**',search:''}]}};
export default config;
