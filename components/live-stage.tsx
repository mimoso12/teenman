'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import {LiveKitRoom, RoomAudioRenderer, ParticipantTile, VideoTrack, TrackToggle, StartAudio, useTracks, useConnectionState, useParticipants, useParticipantInfo, isTrackReference, type TrackReferenceOrPlaceholder} from '@livekit/components-react';
import {ConnectionState, Track} from 'livekit-client';
import {Radio, LogOut, Mic, Camera, MonitorUp} from 'lucide-react';
import {profileImage} from '../lib/profile';
type Session = {token: string; serverUrl: string};
function StageTile({track}: {track: TrackReferenceOrPlaceholder}) {
  const {name, metadata} = useParticipantInfo({participant: track.participant});
  let avatar: string | null = null;
  try {avatar = profileImage(JSON.parse(metadata || '{}').avatar);} catch { /* Optional profile metadata. */ }
  const label = name || 'Membro Teenman';
  return <ParticipantTile trackRef={track} className={track.source === Track.Source.ScreenShare ? 'live-tile live-screen' : 'live-tile'}>
    {isTrackReference(track) && <VideoTrack trackRef={track}/>}
    <div className="lk-participant-placeholder"><span className="live-avatar">{label.slice(0, 1).toUpperCase()}{avatar && <img src={avatar} alt="" onError={event => {event.currentTarget.style.display = 'none';}}/>}</span></div>
    <div className="live-tile-name">{track.source === Track.Source.ScreenShare && <MonitorUp size={14}/>}<span>{label}{track.participant.isLocal ? ' · Você' : ''}</span></div>
  </ParticipantTile>;
}
function StageContent({onError, onLeave}: {onError: (message: string) => void; onLeave: () => void}) {
  const state = useConnectionState(), participants = useParticipants();
  const connected = state === ConnectionState.Connected;
  const tracks = useTracks([{source: Track.Source.Camera, withPlaceholder: true}, {source: Track.Source.ScreenShare, withPlaceholder: false}], {onlySubscribed: false});
  const screenSupported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia);
  return <>
    <div className="live-status" role="status"><span className={connected ? 'live-dot connected' : 'live-dot'}/>{connected ? `Ao vivo · ${participants.length} ${participants.length === 1 ? 'participante' : 'participantes'}` : state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting ? 'Reconectando ao palco…' : 'Conectando ao palco…'}</div>
    <div className="live-grid">{tracks.map(track => <StageTile key={track.participant.identity + ':' + track.source} track={track}/>)}</div>
    <RoomAudioRenderer/>
    <StartAudio label="Ativar áudio da transmissão"/>
    <div className="live-controls" role="group" aria-label="Controles da transmissão">
      <fieldset className="live-media-controls" disabled={!connected}><legend className="sr-only">Dispositivos de áudio e vídeo</legend>
      <TrackToggle source={Track.Source.Microphone} showIcon={false} disabled={!connected} onDeviceError={() => onError('Não foi possível ativar o microfone. Confira a permissão e o dispositivo.')}><Mic size={17}/>Microfone</TrackToggle>
      <TrackToggle source={Track.Source.Camera} showIcon={false} disabled={!connected} onDeviceError={() => onError('Não foi possível ativar a câmera. Confira a permissão e o dispositivo.')}><Camera size={17}/>Câmera</TrackToggle>
      {screenSupported ? <TrackToggle source={Track.Source.ScreenShare} showIcon={false} disabled={!connected} onDeviceError={() => onError('O compartilhamento não foi iniciado. Escolha uma tela ou janela e tente novamente.')}><MonitorUp size={17}/>Compartilhar Tela</TrackToggle> : <small>Compartilhamento de tela indisponível neste navegador.</small>}
      </fieldset>
      <button className="lk-disconnect-button" onClick={onLeave}><LogOut size={17}/>Sair da Transmissão</button>
    </div>
  </>;
}
export default function LiveStage({roomId}: {roomId: string}) {
  const [session, setSession] = useState<Session | null>(null), [joining, setJoining] = useState(false), [error, setError] = useState('');
  const request = useRef<AbortController | null>(null), mounted = useRef(true);
  const connectionError = useCallback(() => setError('Não foi possível conectar ao palco. Confira sua conexão e tente novamente.'), []);
  const mediaError = useCallback(() => setError('Não foi possível acessar o dispositivo. Confira as permissões do navegador.'), []);
  const disconnected = useCallback(() => {if (mounted.current) {setSession(null); setError('Você saiu da transmissão. O chat continua disponível.');}}, []);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false; request.current?.abort();};}, []);
  async function join() {
    if (joining || session) return;
    if (!window.isSecureContext || !('RTCPeerConnection' in window)) {setError('Abra o Teenman em HTTPS num navegador compatível para participar do palco.'); return;}
    setJoining(true); setError('');
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/livekit/token', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({roomId}), signal: controller.signal, cache: 'no-store'});
      const result = await response.json();
      if (!response.ok || !result.token || !result.serverUrl) throw new Error(result.error || 'Não foi possível entrar na transmissão.');
      if (mounted.current) setSession(result);
    } catch (error) {if (mounted.current) setError(error instanceof Error && error.name !== 'AbortError' ? error.message : 'A conexão demorou a responder. Tente novamente.');}
    finally {clearTimeout(timeout); if (mounted.current) setJoining(false);}
  }
  return <section className="live-stage" aria-label="Palco ao vivo"><header><div><h2><Radio size={19}/>Palco ao vivo</h2><p>Entre para ouvir. Ative seu microfone, câmera ou tela quando quiser.</p></div>{!session && <button className="pill outline" disabled={joining} onClick={() => void join()}>{joining ? 'Conectando…' : '🎙️ Entrar na Transmissão / Palco Ao Vivo'}</button>}</header>
    {error && <p className="live-error" role="status">{error}</p>}
    {session && <LiveKitRoom serverUrl={session.serverUrl || process.env.NEXT_PUBLIC_LIVEKIT_URL} token={session.token} connect={true} audio={false} video={false} screen={false} options={{adaptiveStream: true, dynacast: true}} data-lk-theme="default" onError={connectionError} onMediaDeviceFailure={mediaError} onDisconnected={disconnected}>
      <StageContent onError={setError} onLeave={disconnected}/>
    </LiveKitRoom>}
  </section>;
}
