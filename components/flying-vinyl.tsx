'use client';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Grip, X } from 'lucide-react';
type Point = { x: number; y: number };
const size = 72;
function clampPoint(point: Point): Point { return { x: Math.max(8, Math.min(window.innerWidth - size - 8, point.x)), y: Math.max(8, Math.min(window.innerHeight - size - 8, point.y)) }; }
export default function FlyingVinyl({ children, playing, cover, trackName, openSignal=0 }: { children: ReactNode; playing: boolean; cover: string | null; trackName: string; openSignal?:number }) {
  const [point, setPoint] = useState<Point | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const drag = useRef<{ pointer: number; start: Point; origin: Point; moved: boolean } | null>(null);
  const current = useRef<Point>({ x: 0, y: 0 });
  const suppressClick = useRef(false);
  const frame = useRef(0);
  useEffect(()=>{if(openSignal>0)setOpen(true);},[openSignal]);
  useEffect(() => { if (open) setHasOpened(true); }, [open]);
  useEffect(() => {
    let initial = { x: window.innerWidth - size - 24, y: window.innerHeight - size - 24 };
    try { const saved = JSON.parse(localStorage.getItem('teenman-vinyl-position') || 'null'); if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) initial = saved; } catch { /* Default dock position. */ }
    function resize() { current.current = clampPoint(current.current); setPoint(current.current); setViewport({ width: window.innerWidth, height: window.innerHeight }); }
    current.current = clampPoint(initial); resize();
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(frame.current); window.removeEventListener('resize', resize); };
  }, []);
  function persist() { try { localStorage.setItem('teenman-vinyl-position', JSON.stringify(current.current)); } catch { /* Position persistence is optional. */ } }
  function start(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    drag.current = { pointer: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: current.current, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const state = drag.current; if (!state || state.pointer !== event.pointerId) return;
    const dx = event.clientX - state.start.x, dy = event.clientY - state.start.y;
    if (Math.hypot(dx, dy) > 5) state.moved = true;
    if (!state.moved) return;
    current.current = clampPoint({ x: state.origin.x + dx, y: state.origin.y + dy });
    cancelAnimationFrame(frame.current); frame.current = requestAnimationFrame(() => setPoint(current.current));
  }
  function end() { if (!drag.current) return; suppressClick.current = drag.current.moved; drag.current = null; persist(); }
  if (!point) return null;
  const panelWidth = Math.min(370, viewport.width - 24);
  const panelLeft = Math.max(12, Math.min(viewport.width - panelWidth - 12, point.x + size - panelWidth)) - point.x;
  const above = point.y > viewport.height / 2;
  const space = above ? point.y - 28 : viewport.height - point.y - size - 28;
  const style: CSSProperties = { transform: `translate3d(${point.x}px,${point.y}px,0)` };
  const panelStyle: CSSProperties = { width: panelWidth, left: panelLeft, maxHeight: Math.max(160, space), ...(above ? { bottom: size + 12 } : { top: size + 12 }) };
  return createPortal(<div className="flying-vinyl" style={style}>
    <section className="flying-vinyl-panel" hidden={!open} style={panelStyle} aria-label="Painel do disco voador"><div className="flying-panel-header"><span><Grip size={14}/> Seu disco voador</span><button aria-label="Fechar disco voador" onClick={() => setOpen(false)}><X size={18}/></button></div>{(open || hasOpened) && children}</section>
    <button className="flying-vinyl-launcher" aria-label={open ? 'Fechar disco voador' : 'Abrir disco voador'} aria-expanded={open} title="Clique para abrir. Arraste ou use as setas para mover." onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={() => { drag.current = null; suppressClick.current = true; }} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } setOpen(value => !value); }} onKeyDown={event => {
      const directions: Record<string, Point> = { ArrowLeft: { x: -20, y: 0 }, ArrowRight: { x: 20, y: 0 }, ArrowUp: { x: 0, y: -20 }, ArrowDown: { x: 0, y: 20 } };
      const direction = directions[event.key];
      if (direction) { event.preventDefault(); current.current = clampPoint({ x: current.current.x + direction.x, y: current.current.y + direction.y }); setPoint(current.current); persist(); }
      if (event.key === 'Escape') setOpen(false);
    }}><span className={`flying-mini-record${playing ? ' is-playing' : ''}`}>{cover && <img src={cover} alt=""/>}<i/></span><span className="sr-only">{trackName || 'Escolher música'}. Arraste ou use as setas para mover.</span>{playing && <span className="flying-playing-light"/>}</button>
  </div>, document.body);
}
