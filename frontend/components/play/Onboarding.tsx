'use client'

import { useState } from 'react'
import { useSession } from '@/contexts/SessionContext'
import { DuckSvg } from '@/components/duck/DuckSvg'
import { Btn, Card, Dots, Kicker, Title, TrackThumb } from '@/components/ui/kit'
import { buildTrack } from '@/lib/track'
import { TEMPLATES, randomName, type Duck, type RoomState } from '@/lib/types'
import { sound } from '@/lib/sound'

export function Splash({ invite, onStart }: { invite: RoomState | null; onStart: () => void }) {
  return (
    <div className="anim-enter" style={{ position: 'absolute', inset: 0, padding: '14px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {invite && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#1E1446', color: '#fff', border: '3px solid #000', borderRadius: 16 }}>
          <span style={{ padding: '4px 8px', borderRadius: 8, background: '#FFC93C', color: '#1E1446', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>{invite.code}</span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 800 }}>You scanned into <b>{invite.name}</b> · {invite.track.name}</span>
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 240, height: 150 }}>
          <div className="anim-bob" style={{ position: 'absolute', left: 0, top: 30, animationDuration: '1.1s' }}>
            <DuckSvg template="sprint" bodyColor="#FFC93C" billColor="#FF9F1C" cosmetics={{ hat: true, shades: false, scarf: false }} partTypeId={1} width={150} />
          </div>
          <div className="anim-bob" style={{ position: 'absolute', right: 0, top: 0, animationDuration: '1.3s', animationDelay: '.3s' }}>
            <DuckSvg template="balanced" bodyColor="#4ED1C5" billColor="#FFC93C" cosmetics={{ hat: false, shades: true, scarf: false }} width={110} />
          </div>
        </div>
        <Title size={40}>{invite ? `Race in ${invite.name}` : 'Race your duck on Monad'}</Title>
        <div style={{ fontSize: 15, fontWeight: 700, maxWidth: 310 }}>
          {invite ? `${invite.code} · ${invite.track.name} · hosted by ${invite.hostName}` : 'Live duck races where every block is a step. Join a room with a code.'}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'rgba(255,255,255,0.35)', border: '3px solid #1E1446', borderRadius: 16, padding: '10px 12px', fontSize: 13, fontWeight: 800 }}>
        <div>1 · Connect a wallet or use Face ID</div>
        <div>{invite ? '2 · Join the room · 0.10 USDC ticket' : '2 · Join a room with a code, or host one'}</div>
        <div>3 · Meet your duck, then race</div>
      </div>
      <Btn h={64} size={20} onClick={() => { sound.unlock(); onStart() }}>Connect to play</Btn>
      <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700 }}>Free sign-in · 5 test USDC on us · never need MON</div>
    </div>
  )
}

export function Connect() {
  const { connectWallet, connectPasskey, connecting } = useSession()
  return (
    <div className="anim-enter" style={{ position: 'absolute', inset: 0, padding: '18px 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Kicker>STEP 1 · CONNECT</Kicker>
      <Title>Connect to play</Title>
      <div style={{ fontSize: 14, fontWeight: 700 }}>Your duck, parts and titles live in this wallet on Monad. Already raced? Your duck comes right back.</div>
      <Btn tone="white" h={60} size={18} onClick={connectWallet} style={{ justifyContent: 'flex-start' }}>
        <span style={{ display: 'flex', gap: 4 }}>
          {[['M', '#FF9F1C'], ['R', '#7CC6FE'], ['O', '#fff'], ['W', '#C9B8FF']].map(([i, c]) => (
            <span key={i} style={{ width: 26, height: 26, borderRadius: 8, border: '3px solid #000', background: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{i}</span>
          ))}
        </span>
        <span style={{ flex: 1, textAlign: 'left', marginLeft: 6 }}>Connect a wallet</span>
      </Btn>
      <div style={{ fontSize: 12, fontWeight: 700, marginTop: -4 }}>MetaMask, Rabby, OKX Wallet or WalletConnect</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, fontWeight: 900, letterSpacing: 2 }}>
        <span style={{ flex: 1, height: 3, background: '#1E1446' }} />NO WALLET?<span style={{ flex: 1, height: 3, background: '#1E1446' }} />
      </div>
      <Btn h={60} size={18} onClick={() => connectPasskey()}>Use Face ID / fingerprint</Btn>
      <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'center' }}>Creates a wallet from a passkey on this phone. No seed phrase.</div>
      {connecting && (
        <div className="anim-fade" style={{ position: 'absolute', inset: 0, background: 'rgba(30,20,70,0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: '#fff' }}>
          <Dots />
          <div style={{ fontSize: 18, fontWeight: 900 }}>{connecting === 'Passkey' ? 'Creating your passkey wallet…' : `Connecting ${connecting}…`}</div>
        </div>
      )}
    </div>
  )
}

export function JoinTicket({ room, hasDuck, duckName, onPay, busy }: { room: RoomState; hasDuck: boolean; duckName: string; onPay: () => void; busy: boolean }) {
  const geo = buildTrack(room.track.path, room.track.closed, room.track.laps)
  return (
    <div className="anim-enter" style={{ position: 'absolute', inset: 0, padding: '14px 18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Kicker>STEP 2 · JOIN · {room.code}</Kicker>
      <Title size={32}>{room.name}</Title>
      <div style={{ background: '#1E1446', border: '4px solid #000', borderRadius: 20, padding: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
        <TrackThumb d={geo.d} w={130} h={72} />
        <div style={{ color: '#fff' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>{room.track.name}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#C9B8FF' }}>{(room.track.lengthM / 1000).toFixed(1)} km · {room.track.turns} turns · {room.track.laps} {room.track.laps > 1 ? 'laps' : 'lap'}</div>
        </div>
      </div>
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, fontWeight: 800 }}>
        <Row k="Host" v={room.hostName} />
        <Row k="Racers" v={`${room.count} / ${room.maxDucks}`} />
        <Row k="Your duck" v={hasDuck ? duckName : 'You meet it next'} />
        <div style={{ height: 2, background: '#E6E0FF' }} />
        <Row k="Race ticket" v="0.10 USDC" big />
        <div style={{ fontSize: 11, fontWeight: 700 }}>Valid for every race in this room. No prize pool — titles are won, never bought.</div>
      </Card>
      <div style={{ flex: 1 }} />
      <Btn h={60} onClick={onPay} disabled={busy}>Join · 0.10 USDC</Btn>
    </div>
  )
}

const Row = ({ k, v, big }: { k: string; v: string; big?: boolean }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: big ? 16 : undefined, fontWeight: big ? 900 : undefined }}>
    <span>{k}</span>
    <span>{v}</span>
  </div>
)

type Draft = Pick<Duck, 'name' | 'template' | 'bodyColor' | 'billColor' | 'cosmetics' | 'equippedPartTypeId'>

export function Hatch({ draft, setDraft, onShuffle, onKeep, inRoom, roomCode, busy }: { draft: Draft; setDraft: (d: Draft) => void; onShuffle: () => void; onKeep: () => void; inRoom: boolean; roomCode: string | null; busy: boolean }) {
  const st = TEMPLATES[draft.template].st
  const [rip, setRip] = useState(0)
  return (
    <div className="anim-enter" style={{ position: 'absolute', inset: 0, padding: '8px 16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Kicker>{inRoom ? `YOU’RE IN ${roomCode} · LAST STEP` : 'YOUR PROFILE'}</Kicker>
      <Title>Meet your duck</Title>
      <div style={{ position: 'relative', height: 230, flex: 'none', background: '#1E1446', border: '4px solid #000', borderRadius: 24, overflow: 'hidden' }}>
        <div className="water" aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 60 }} />
        <div key={rip} aria-hidden style={{ position: 'absolute', left: '50%', top: '50%', width: 260, height: 260, margin: '-150px 0 0 -130px', borderRadius: '50%', border: '6px solid #FFC93C', animation: 'dwRipple 1.2s ease-out both' }} />
        <div key={'d' + rip} className="anim-pop" style={{ position: 'absolute', left: '50%', top: 24, width: 240, marginLeft: -120 }}>
          <div className="anim-bob">
            <DuckSvg {...draft} width={240} label="Your duck" />
          </div>
        </div>
        <span style={{ position: 'absolute', left: 12, top: 10, padding: '4px 10px', borderRadius: 999, background: '#FFC93C', border: '3px solid #000', color: '#1E1446', fontSize: 13, fontWeight: 900 }}>{TEMPLATES[draft.template].name}</span>
        <div style={{ position: 'absolute', right: 12, top: 10, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, color: '#C9B8FF', textAlign: 'right', whiteSpace: 'pre-line' }}>{`SPD ${st[0]}\nWGT ${st[1]}\nBST ${st[2]}`}</div>
      </div>
      <Btn tone="white" h={50} size={17} onClick={() => { onShuffle(); setRip((r) => r + 1) }} style={{ boxShadow: '0 4px 0 #000' }}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><rect x="3" y="3" width="18" height="18" rx="4" fill="#FFC93C" stroke="#000" strokeWidth="2" /><circle cx="8" cy="8" r="1.8" /><circle cx="16" cy="16" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="16" cy="8" r="1.8" /><circle cx="8" cy="16" r="1.8" /></svg>
        Shuffle duck
      </Btn>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 900, letterSpacing: 1 }}>
          NAME · shown on the big screen
          <input value={draft.name} maxLength={14} onChange={(e) => setDraft({ ...draft, name: e.target.value.slice(0, 14) })} style={{ height: 50, boxSizing: 'border-box', padding: '0 12px', border: '4px solid #000', borderRadius: 14, fontSize: 18, fontWeight: 900, color: '#1E1446', background: '#fff' }} />
        </label>
        <Btn tone="white" h={50} size={14} shadow={false} onClick={() => setDraft({ ...draft, name: randomName() })} ariaLabel="Random name">Random</Btn>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'center' }}>Colors, style and parts: change anytime in My Duck. It hatches into an NFT after your first race.</div>
      <div style={{ flex: 1 }} />
      <Btn h={62} onClick={onKeep} disabled={busy || !draft.name.trim()}>{inRoom ? 'Keep this duck · to the lobby' : 'Keep this duck'}</Btn>
    </div>
  )
}
