'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from '@/contexts/SessionContext'
import { DuckSvg, MiniDuck } from '@/components/duck/DuckSvg'
import { Btn, Card, Pill } from '@/components/ui/kit'
import { buildTrack, pointAt, uOf } from '@/lib/track'
import { dots, statsOf, titleFor, type Grid, type RaceResult, type RoomState, type Settled, type Tick } from '@/lib/types'
import { txUrl, short } from '@/lib/config'
import type { Hatched } from '@/lib/useRoomLive'
import { sound } from '@/lib/sound'
import { authSocket, getSocket } from '@/http/realtime/socket'

export function Lobby({ room, me, loadout, onLoadout, onGarage, onStart, starting }: { room: RoomState; me: string; loadout: number | null; onLoadout: (p: number | null) => void; onGarage: () => void; onStart: () => void; starting: boolean }) {
  const { parts, me: profile } = useSession()
  const isHost = room.host === me
  const owned = parts.filter((p) => profile?.parts.includes(p.typeId))
  const myPlayer = room.players.find((p) => p.address === me)
  const part = parts.find((p) => p.typeId === loadout) || null
  const st = statsOf((myPlayer?.template as any) || 'balanced', part)
  const tip = room.track.slug === 'alpine-ring' ? 'Long straights: speed wins, weight costs' : 'Twisty: heavy ducks grip better'
  return (
    <div className="anim-enter" style={{ position: 'absolute', inset: 0, padding: '12px 16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pill>{room.code} · {room.track.name}</Pill>
        <span style={{ fontSize: 13, fontWeight: 900 }}>{room.count}/{room.maxDucks}</span>
      </div>
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: '#5B4AB8' }}>LOADOUT FOR {room.track.name.toUpperCase()}</div>
        <div style={{ fontSize: 12, fontWeight: 800 }}>{tip}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[{ label: 'No part', id: null as number | null }, ...owned.map((p) => ({ label: `${p.name} ${dots(p.fit[room.track.slug] || 1)}`, id: p.typeId as number | null }))].map((o) => (
            <button key={String(o.id)} type="button" className="dw-btn" aria-pressed={loadout === o.id} onClick={() => onLoadout(o.id)} style={{ padding: '6px 10px', border: '3px solid #000', borderRadius: 12, fontSize: 13, fontWeight: 900, color: '#1E1446', background: loadout === o.id ? '#FFC93C' : '#F1EDFF' }}>{o.label}</button>
          ))}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 800 }}>SPD {st[0]} · WGT {st[1]} · BST {st[2]}</div>
        <button type="button" onClick={onGarage} style={{ alignSelf: 'flex-start', height: 26, background: 'none', border: 'none', color: '#1E1446', fontSize: 12, fontWeight: 800, textDecoration: 'underline', padding: 0 }}>Get more parts in the garage</button>
      </Card>
      <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2 }}>IN THE ROOM</div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: 6 }}>
        {room.players.map((p) => (
          <div key={p.address} className="anim-chip" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 6px', background: p.address === me ? '#FFC93C' : '#fff', color: '#1E1446', border: '3px solid #000', borderRadius: 999, fontSize: 13, fontWeight: 800 }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #000', background: p.bodyColor }} />
            {p.name}{p.address === me ? ' (you)' : ''}{p.host ? ' · host' : ''}
          </div>
        ))}
        {room.fillBots && room.count < room.maxDucks && <div style={{ fontSize: 12, fontWeight: 800, padding: '6px 4px' }}>+ {room.maxDucks - room.count} bots at the start</div>}
      </div>
      {isHost ? (
        <Btn h={60} size={26} display disabled={starting} onClick={onStart}>START RACE</Btn>
      ) : (
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.35)', border: '4px dashed #1E1446', borderRadius: 20, fontSize: 15, fontWeight: 900 }}>
          Waiting for the host<span className="anim-blink">…</span>
        </div>
      )}
    </div>
  )
}

export function Countdown({ n, track, laps, name }: { n: number; track: string; laps: number; name: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center' }}>
      <Pill bg="#FFC93C" fg="#1E1446" style={{ fontSize: 13 }}>{track.toUpperCase()} · {laps} {laps > 1 ? 'LAPS' : 'LAP'}</Pill>
      <div style={{ height: 190, display: 'flex', alignItems: 'center' }}>
        <div key={n} className="anim-pop" style={{ fontFamily: 'var(--font-display)', fontSize: 200, lineHeight: 0.9, color: '#FFC93C', textShadow: '0 10px 0 #836EF9' }}>{n > 0 ? n : 'WEK!'}</div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#C9B8FF' }}>{name} is on the grid</div>
    </div>
  )
}

export function RaceView({ room, grid, tick, me, gap }: { room: RoomState; grid: Grid; tick: Tick | null; me: string; gap: number | null }) {
  const { say } = useSession()
  const [pops, setPops] = useState<{ id: number; x: number }[]>([])
  const geo = useMemo(() => buildTrack(room.track.path, room.track.closed, room.track.laps), [room.track])
  const p = tick?.p || grid.entrants.map(() => 0)
  const order = useMemo(() => p.map((v, i) => ({ i, v })).sort((a, b) => b.v - a.v), [p])
  const myIdx = grid.entrants.findIndex((e) => e.address === me)
  const myRank = order.findIndex((o) => o.i === myIdx) + 1
  useEffect(() => { authSocket() }, [])
  const lead = order[0]
  const meP = myIdx >= 0 ? p[myIdx] / 10000 : 0
  const lapNow = Math.min(geo.laps, Math.floor(Math.min(meP, 0.9999) * geo.laps) + 1)
  const sector = Math.min(3, Math.floor(((meP * geo.laps) % 1) * 3) + 1)
  const mm = (v: number) => { const q = pointAt(geo, uOf(geo, v / 10000)); return { x: Math.round(q.x), y: Math.round(q.y) } }
  const me_ = grid.entrants[myIdx]
  const energy = myIdx >= 0 ? Math.max(0, Math.min(100, tick?.en?.[myIdx] ?? 0)) : 0 // the server's cheer energy of my duck
  const cam = order.filter((o) => o.i !== myIdx).map((o) => ({ ...o, dx: ((o.v - (p[myIdx] || 0)) / 10000) * 2600 * geo.laps })).filter((o) => Math.abs(o.dx) < 260).slice(0, 8)
  const from = Math.max(0, Math.min(myRank - 2, order.length - 3))
  const near = order.slice(from, from + 3)
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '8px 16px calc(10px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pill bg="#FFC93C" fg="#1E1446" style={{ maxWidth: '54%', minWidth: 0 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>LAP {lapNow}/{geo.laps} · {room.track.name}</span></Pill>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#C9B8FF', whiteSpace: 'nowrap', flex: 'none' }}>BLOCK #{tick?.b?.toLocaleString('en-US') ?? '…'}{gap ? <span className="dw-narrow-hide"> · {gap}ms</span> : null}</span>
      </div>
      <div style={{ position: 'relative', height: 'clamp(136px, 26dvh, 240px)', flex: 'none', border: '4px solid #000', borderRadius: 22, overflow: 'hidden', background: '#836EF9' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0) 0 120px, rgba(255,255,255,0.18) 120px 124px, rgba(255,255,255,0) 124px 160px)', animation: 'dwWater .5s linear infinite' }} />
        <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 24, background: '#2A1D5E', borderBottom: '4px solid #000' }} />
        <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 24, background: '#2A1D5E', borderTop: '4px solid #000' }} />
        <div style={{ position: 'absolute', left: 10, top: 3, fontSize: 11, fontWeight: 900, color: '#C9B8FF' }}>FOLLOW CAM · SECTOR {sector}</div>
        {cam.map((o) => {
          const e = grid.entrants[o.i]
          const lane = (o.i * 53) % 5
          const rank = order.findIndex((x) => x.i === o.i) + 1
          return (
            <div key={o.i} style={{ position: 'absolute', left: Math.round(160 + o.dx), top: `${15 + lane * 14}%`, width: 58, transition: 'left .3s linear', zIndex: lane }}>
              <div className="anim-bob-fast" style={{ animationDelay: `${((o.i * 37) % 45) / 100}s` }}><MiniDuck color={e.color} width={58} /></div>
              <div style={{ position: 'absolute', left: 0, top: -16, padding: '1px 6px', borderRadius: 999, fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap', color: '#1E1446', background: rank === 1 ? '#FFC93C' : '#fff' }}>#{rank} {e.name}</div>
            </div>
          )
        })}
        {me_ && (
          <div className="anim-bob-fast" style={{ position: 'absolute', left: 150, top: '30%', width: 100, zIndex: 50 }}>
            <DuckSvg template={me_.template} bodyColor={me_.bodyColor} billColor={me_.billColor} cosmetics={me_.cosmetics} partTypeId={me_.partTypeId} width={100} label="Your duck" />
            <div style={{ position: 'absolute', left: 6, top: -16, padding: '1px 8px', border: '2px solid #000', borderRadius: 999, background: '#FFC93C', color: '#1E1446', fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap' }}>YOU · #{myRank || '–'}</div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ width: 'clamp(104px, 42vw, 160px)', height: 'clamp(70px, 11dvh, 90px)', flex: 'none', background: '#2A1D5E', border: '4px solid #000', borderRadius: 18, padding: 4 }}>
          <svg viewBox="-60 40 1800 960" width="100%" height="100%" role="img" aria-label="Minimap">
            <path d={geo.d} fill="none" stroke="#836EF9" strokeWidth="60" strokeLinecap="round" strokeLinejoin="round" />
            {lead && <circle cx={mm(lead.v).x} cy={mm(lead.v).y} r="40" fill="#fff" stroke="#000" strokeWidth="10" />}
            {myIdx >= 0 && <circle cx={mm(p[myIdx]).x} cy={mm(p[myIdx]).y} r="56" fill="#FFC93C" stroke="#000" strokeWidth="12" />}
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(42px, 14vw, 60px)', lineHeight: 0.9, color: '#FFC93C', textShadow: '0 5px 0 #836EF9' }}>#{myRank || '–'}</span>
            <span style={{ fontSize: 14, fontWeight: 900 }}>of {grid.entrants.length}</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#C9B8FF', lineHeight: 1.15 }}>{myRank === 1 ? 'Leading the race' : lead && myIdx >= 0 ? `Behind the leader by ${((lead.v - p[myIdx]) / 100).toFixed(1)}` : ''}</div>
        </div>
      </div>
      <div className="race-near" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {near.map((o) => {
          const r = order.indexOf(o) + 1
          const e = grid.entrants[o.i]
          const mine = o.i === myIdx
          return (
            <div key={o.i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 12, background: mine ? '#FFC93C' : 'transparent', color: mine ? '#1E1446' : '#fff' }}>
              <div style={{ width: 40, fontFamily: 'var(--font-display)', fontSize: 18 }}>#{r}</div>
              <span style={{ width: 14, height: 14, borderRadius: '50%', border: '3px solid #000', background: e.color }} />
              <div style={{ flex: 1, fontSize: 14, fontWeight: 800 }}>{e.name}{mine ? ' (you)' : ''}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r === 1 ? 'LEAD' : '+' + ((lead.v - o.v) / 100).toFixed(1)}</div>
            </div>
          )
        })}
      </div>
      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="cheer-lane" style={{ position: 'relative', height: 40, overflow: 'hidden' }} aria-hidden>
          {pops.map((c) => <span key={c.id} style={{ position: 'absolute', left: c.x, top: 4, animation: 'dwTapLane 1s ease-out forwards', fontFamily: 'var(--font-display)', fontSize: 26, color: '#FFC93C', WebkitTextStroke: '5px #000', paintOrder: 'stroke fill' }}>+1</span>)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, whiteSpace: 'nowrap', fontSize: 12, fontWeight: 900, letterSpacing: 2 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>TAP TO BOOST</span>
          <span style={{ flex: 'none', fontVariantNumeric: 'tabular-nums', color: energy > 0 ? '#B8F35A' : '#C9B8FF' }}>BOOST +{Math.round((energy * (grid.cheerPct ?? 0)) / 100)}%</span>
        </div>
        <div aria-label={`Cheer energy ${energy} percent`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={energy} style={{ height: 12, background: '#2A1D5E', border: '3px solid #000', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${energy}%`, height: '100%', background: energy > 66 ? '#B8F35A' : '#FFC93C', transition: 'width .25s linear' }} />
        </div>
        <div style={{ paddingBottom: 6 }}>
          <Btn h={62} size={28} display onClick={() => { sound.play('cheer'); getSocket().emit('race:cheer'); const id = Date.now(); setPops((l) => [...l.slice(-4), { id, x: 10 + Math.round(Math.random() * 160) }]); if (pops.length > 30) say('Your duck hears you!') }} style={{ width: '100%' }}>CHEER</Btn>
        </div>
      </div>
    </div>
  )
}

export function PhotoFinish() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: '#fff', animation: 'dwFlash .5s ease-out both' }} />
      <div className="anim-pop" style={{ fontFamily: 'var(--font-display)', fontSize: 50, color: '#FFC93C' }}>PHOTO FINISH</div>
      <div style={{ fontSize: 17, fontWeight: 800 }}>Settling results on Monad…</div>
    </div>
  )
}

export function Result({ result, settled, hatched, me, duckName, trackName, onHome, onNewRoom }: { result: RaceResult; settled: Settled | null; hatched: Hatched[]; me: string; duckName: string; trackName: string; onHome: () => void; onNewRoom: () => void }) {
  const row = result.ranking.find((r) => r.address === me)
  const rank = row?.rank ?? 0
  const myHatch = hatched.find((h) => h.address === me)
  return (
    <div className="anim-enter" style={{ position: 'absolute', inset: 0, padding: '8px 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 900 }}>{duckName} finished</div>
        <div className="anim-pop stroke-title" style={{ animationDelay: '.15s', fontFamily: 'var(--font-display)', fontSize: 92, lineHeight: 0.95, color: '#fff', WebkitTextStroke: '8px #000', textShadow: '0 7px 0 #000' }}>#{rank || '–'}</div>
        <div style={{ fontSize: 14, fontWeight: 800 }}>of {result.field} on {trackName}</div>
        <div style={{ marginTop: 6, padding: '8px 14px', background: '#FFC93C', border: '4px solid #000', borderRadius: 16, boxShadow: '0 5px 0 #000', animation: 'dwStamp .6s cubic-bezier(.2,.9,.3,1) .6s both', fontFamily: 'var(--font-display)', fontSize: 24, color: '#1E1446' }}>{titleFor(rank || 99)}</div>
      </div>
      {rank > 0 && rank <= 3 && (
        <div style={{ animation: 'dwSlideR .55s cubic-bezier(.2,.9,.3,1.15) 1s both', display: 'flex', alignItems: 'center', gap: 10, background: '#fff', color: '#1E1446', border: '4px solid #000', borderRadius: 18, padding: '10px 12px' }}>
          <svg viewBox="0 0 100 110" width="40" height="44" style={{ animation: 'dwSpin 3s linear infinite' }} aria-hidden><polygon points="50,4 94,28 94,80 50,106 6,80 6,28" fill="#FFC93C" stroke="#000" strokeWidth="6" /><polygon points="50,22 78,38 78,72 50,88 22,72 22,38" fill="#836EF9" stroke="#000" strokeWidth="4" /></svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: '#5B4AB8' }}>TITLE · SOULBOUND · <span className={settled ? 'anim-pop' : 'anim-blink'} style={{ display: 'inline-block' }}>{settled?.ok ? 'MINTED' : settled ? 'FAILED' : 'MINTING…'}</span></div>
            <div style={{ fontSize: 14, fontWeight: 900 }}>Added to {duckName}’s profile</div>
            {settled?.tx && <a href={txUrl(settled.tx)} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#5B4AB8' }}>{short(settled.tx)}</a>}
          </div>
        </div>
      )}
      {myHatch && (
        <div style={{ animation: 'dwSlideR .55s cubic-bezier(.2,.9,.3,1.15) .2s both', background: '#1E1446', color: '#fff', border: '4px solid #000', borderRadius: 18, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: '#FFC93C' }}>FIRST RACE DONE · DUCK HATCHED</div>
          <div style={{ fontSize: 14, fontWeight: 900 }}>{duckName} is now NFT #{myHatch.tokenId} in your wallet</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#E6E0FF' }}>One per wallet · tradeable · 5% royalty to you</div>
          <a href={txUrl(myHatch.tx)} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#FFC93C' }}>{short(myHatch.tx)}</a>
        </div>
      )}
      <Card style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {result.ranking.slice(0, 3).map((r) => (
          <div key={r.rank} style={{ display: 'flex', gap: 8, fontSize: 13, fontWeight: 800 }}><span style={{ width: 26 }}>#{r.rank}</span><span style={{ flex: 1 }}>{r.name}{r.address === me ? ' (you)' : ''}</span>{!r.human && <span style={{ fontSize: 11, color: '#5B4AB8' }}>bot</span>}</div>
        ))}
      </Card>
      <div style={{ flex: 1 }} />
      <Btn h={56} size={17} onClick={onNewRoom}>Create new room</Btn>
      <Btn tone="white" h={48} size={15} shadow={false} onClick={onHome}>Home</Btn>
    </div>
  )
}
