import { Disc3 } from 'lucide-react';
export default function Vinyl({ cover, name, playing }: { cover: string | null; name: string; playing: boolean }) {
  return <div className={`turntable${playing ? ' spinning' : ''}`} role="img" aria-label={`Disco de vinil${name ? `: ${name}` : ''}${playing ? ', tocando' : ', parado'}`}>
    <div className="vinyl-platter"><div className="vinyl-record animate-spin"><div className="record-label">{cover ? <img src={cover} alt="" referrerPolicy="no-referrer"/> : <Disc3 size={34}/>}</div><span className="record-hole"/></div><div className="record-shine"/></div>
    <div className="tonearm"><span className="tonearm-pivot"/><span className="tonearm-shaft"/><span className="tonearm-head"/></div>
    <span className="turntable-brand">TEENMAN · SIDE A</span><span className={`turntable-led${playing ? ' on' : ''}`}/>
  </div>;
}
