import {deflateSync} from 'node:zlib';
import {mkdirSync,writeFileSync} from 'node:fs';
const root=new URL('../public/',import.meta.url);mkdirSync(root,{recursive:true});
// Same outlined T as the navigation logo, centered inside the maskable safe zone.
const points=[[3,3],[29,3],[26,10],[19,10],[19,33],[13,33],[13,10],[6,10],[3,3]];
function distance(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);}
function crc32(buffer){let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([length,name,data,crc]);}
for(const [size,name] of [[192,'icon-192.png'],[512,'icon-512.png'],[180,'apple-touch-icon.png']]){
 const raw=Buffer.alloc(size*(1+size*4)),scale=size*.54/32;
 for(let y=0;y<size;y++){const row=y*(1+size*4);for(let x=0;x<size;x++){let coverage=0;for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++){const px=(x+(sx+.5)/4-size/2)/scale+16,py=(y+(sy+.5)/4-size/2)/scale+18;if(points.some((a,i)=>i<points.length-1&&distance(px,py,a,points[i+1])<=1))coverage++;}const at=row+1+x*4,value=Math.round(coverage/16*255);raw[at]=raw[at+1]=raw[at+2]=value;raw[at+3]=255;}}
 const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
 writeFileSync(new URL(name,root),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
 console.log(`${name}: ${size}x${size}`);
}
