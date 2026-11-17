'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from '@/contexts/SessionContext'
import { DuckSvg, MiniDuck } from '@/components/duck/DuckSvg'
import { Button, Card, Pill } from '@/components/ui/kit'
import { buildTrackGeometry, pointAtFraction, pathFractionAt } from '@/lib/track'
import { calculateDuckStats, titleForRank, type Grid, type RaceResult, type RoomState, type Settled, type Template, type Tick } from '@/lib/types'
import { explorerTransactionUrl, shortenAddress } from '@/lib/config'
import type { Hatched } from '@/lib/useRoomLive'
import { sound } from '@/lib/sound'
import { authSocket, getSocket } from '@/http/realtime/socket'

export function Lobby({ room, myAddress, onStart, starting }: { room: RoomState; myAddress: string; onStart: () => void; starting: boolean }) {
  const { parts } = useSession()
  const isHost = room.host === myAddress
  const myPlayer = room.players.find((player) => player.address === myAddress)
  const part = parts.find((candidate) => candidate.typeId === myPlayer?.partTypeId) || null
  const stats = calculateDuckStats((myPlayer?.template as Template | undefined) ?? 'balanced', part)
  const trackTip = room.track.profile.speed >= 0.9 ? 'Fast track: speed wins, weight costs' : 'Twisty: heavy ducks grip better'

  return (
    <div className="anim-enter" style={{ position: 'absolute', inset: 0, padding: '12px 16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pill>{room.code} · {room.track.name}</Pill>
        <span style={{ fontSize: 13, fontWeight: 900 }}>{room.count}/{room.maxDucks}</span>
      </div>
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: '#5B4AB8' }}>YOUR LOADOUT · LOCKED ON CHAIN</div>
        <div style={{ fontSize: 12, fontWeight: 800 }}>{trackTip}</div>
        <div style={{ fontSize: 15, fontWeight: 900 }}>{part ? `${part.name} · ${part.slot}` : 'No part'}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 800 }}>SPD {stats[0]} · WGT {stats[1]} · BST {stats[2]}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#5B4AB8' }}>Fixed when you joined. To race with another part, equip it in your garage before joining a room.</div>
      </Card>
      <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2 }}>IN THE ROOM</div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: 6 }}>
        {room.players.map((player) => (
          <div key={player.address} className="anim-chip" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 6px', background: player.address === myAddress ? '#FFC93C' : '#fff', color: '#1E1446', border: '3px solid #000', borderRadius: 999, fontSize: 13, fontWeight: 800 }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #000', background: player.bodyColor }} />
            {player.name}{player.address === myAddress ? ' (you)' : ''}{player.host ? ' · host' : ''}
          </div>
        ))}
        {room.fillBots && room.count < room.maxDucks && <div style={{ fontSize: 12, fontWeight: 800, padding: '6px 4px' }}>+ {room.maxDucks - room.count} bots at the start</div>}
      </div>
      {isHost ? (
        <Button height={60} fontSize={26} display disabled={starting} onClick={onStart}>START RACE</Button>
      ) : (
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.35)', border: '4px dashed #1E1446', borderRadius: 20, fontSize: 15, fontWeight: 900 }}>
          Waiting for the host<span className="anim-blink">…</span>
        </div>
      )}
    </div>
  )
}

export function Countdown({ secondsLeft, track, laps, name }: { secondsLeft: number; track: string; laps: number; name: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center' }}>
      <Pill bg="#FFC93C" fg="#1E1446" style={{ fontSize: 13 }}>{track.toUpperCase()} · {laps} {laps > 1 ? 'LAPS' : 'LAP'}</Pill>
      <div style={{ height: 190, display: 'flex', alignItems: 'center' }}>
        <div key={secondsLeft} className="anim-pop" style={{ fontFamily: 'var(--font-display)', fontSize: 200, lineHeight: 0.9, color: '#FFC93C', textShadow: '0 10px 0 #836EF9' }}>{secondsLeft > 0 ? secondsLeft : 'WEK!'}</div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#C9B8FF' }}>{name} is on the grid</div>
    </div>
  )
}

export function RaceView({ room, grid, tick, myAddress, gap, wide }: { room: RoomState; grid: Grid; tick: Tick | null; myAddress: string; gap: number | null; wide?: boolean }) {
  const { say } = useSession()
  const [pops, setPops] = useState<{ id: number; x: number }[]>([])
  const geometry = useMemo(() => buildTrackGeometry(room.track.path, room.track.closed, room.track.laps), [room.track])
  const progresses = tick?.p || grid.entrants.map(() => 0)
  const order = useMemo(() => progresses.map((value, index) => ({ index, value })).sort((first, second) => second.value - first.value), [progresses])
  const myIndex = grid.entrants.findIndex((entrant) => entrant.address === myAddress)
  const myRank = order.findIndex((entry) => entry.index === myIndex) + 1

  useEffect(() => { authSocket() }, [])

  const lead = order[0]
  const myProgress = myIndex >= 0 ? progresses[myIndex] / 10000 : 0
  const lapNow = Math.min(geometry.laps, Math.floor(Math.min(myProgress, 0.9999) * geometry.laps) + 1)
  const sector = Math.min(3, Math.floor(((myProgress * geometry.laps) % 1) * 3) + 1)
  const minimapPoint = (value: number) => { const point = pointAtFraction(geometry, pathFractionAt(geometry, value / 10000)); return { x: Math.round(point.x), y: Math.round(point.y) } }
  const myEntrant = grid.entrants[myIndex]
  const myCheerEnergy = myIndex >= 0 ? Math.max(0, Math.min(100, tick?.en?.[myIndex] ?? 0)) : 0
  const nearbyDucks = order.filter((entry) => entry.index !== myIndex).map((entry) => ({ ...entry, offsetX: ((entry.value - (progresses[myIndex] || 0)) / 10000) * 2600 * geometry.laps })).filter((entry) => Math.abs(entry.offsetX) < 260).slice(0, 8)
  const windowStart = Math.max(0, Math.min(myRank - 2, order.length - 3))
  const nearbyRows = order.slice(windowStart, windowStart + 3)

  return (
    <div style={{ position: 'absolute', inset: 0, padding: '8px 16px calc(10px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pill bg="#FFC93C" fg="#1E1446" style={{ maxWidth: '54%', minWidth: 0 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>LAP {lapNow}/{geometry.laps} · {room.track.name}</span></Pill>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#C9B8FF', whiteSpace: 'nowrap', flex: 'none' }}>BLOCK #{tick?.b?.toLocaleString('en-US') ?? '…'}{gap ? <span className="dw-narrow-hide"> · {gap}ms</span> : null}</span>
      </div>
      <div style={{ position: 'relative', height: wide ? 'min(52dvh, 460px)' : 'clamp(136px, 26dvh, 240px)', flex: 'none', border: '4px solid #000', borderRadius: 22, overflow: 'hidden', background: '#836EF9' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0) 0 120px, rgba(255,255,255,0.18) 120px 124px, rgba(255,255,255,0) 124px 160px)', animation: 'dwWater .5s linear infinite' }} />
        <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 24, background: '#2A1D5E', borderBottom: '4px solid #000' }} />
        <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 24, background: '#2A1D5E', borderTop: '4px solid #000' }} />
        <div style={{ position: 'absolute', left: 10, top: 3, fontSize: 11, fontWeight: 900, color: '#C9B8FF' }}>FOLLOW CAM · SECTOR {sector}</div>
        {nearbyDucks.map((entry) => {
          const entrant = grid.entrants[entry.index]
          const lane = (entry.index * 53) % 5
          const rank = order.findIndex((other) => other.index === entry.index) + 1
          return (
            <div key={entry.index} style={{ position: 'absolute', left: Math.round(160 + entry.offsetX), top: `${15 + lane * 14}%`, width: 58, transition: 'left .3s linear', zIndex: lane }}>
              <div className="anim-bob-fast" style={{ animationDelay: `${((entry.index * 37) % 45) / 100}s` }}><MiniDuck color={entrant.color} width={58} /></div>
              <div style={{ position: 'absolute', left: 0, top: -16, padding: '1px 6px', borderRadius: 999, fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap', color: '#1E1446', background: rank === 1 ? '#FFC93C' : '#fff' }}>#{rank} {entrant.name}</div>
            </div>
          )
        })}
        {myEntrant && (
          <div className="anim-bob-fast" style={{ position: 'absolute', left: 150, top: '30%', width: 100, zIndex: 50 }}>
            <DuckSvg template={myEntrant.template} bodyColor={myEntrant.bodyColor} billColor={myEntrant.billColor} cosmetics={myEntrant.cosmetics} partTypeId={myEntrant.partTypeId} partSlot={myEntrant.partSlot} partColor={myEntrant.partColor} width={100} label="Your duck" />
            <div style={{ position: 'absolute', left: 6, top: -16, padding: '1px 8px', border: '2px solid #000', borderRadius: 999, background: '#FFC93C', color: '#1E1446', fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap' }}>YOU · #{myRank || '–'}</div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ width: 'clamp(104px, 42vw, 160px)', height: 'clamp(70px, 11dvh, 90px)', flex: 'none', background: '#2A1D5E', border: '4px solid #000', borderRadius: 18, padding: 4 }}>
          <svg viewBox="-60 40 1800 960" width="100%" height="100%" role="img" aria-label="Minimap">
            <path d={geometry.d} fill="none" stroke="#836EF9" strokeWidth="60" strokeLinecap="round" strokeLinejoin="round" />
            {lead && <circle cx={minimapPoint(lead.value).x} cy={minimapPoint(lead.value).y} r="40" fill="#fff" stroke="#000" strokeWidth="10" />}
            {myIndex >= 0 && <circle cx={minimapPoint(progresses[myIndex]).x} cy={minimapPoint(progresses[myIndex]).y} r="56" fill="#FFC93C" stroke="#000" strokeWidth="12" />}
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(42px, 14vw, 60px)', lineHeight: 0.9, color: '#FFC93C', textShadow: '0 5px 0 #836EF9' }}>#{myRank || '–'}</span>
            <span style={{ fontSize: 14, fontWeight: 900 }}>of {grid.entrants.length}</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#C9B8FF', lineHeight: 1.15 }}>{myRank === 1 ? 'Leading the race' : lead && myIndex >= 0 ? `Behind the leader by ${((lead.value - progresses[myIndex]) / 100).toFixed(1)}` : ''}</div>
        </div>
      </div>
      {!wide && <div className="race-near" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {nearbyRows.map((entry) => {
          const position = order.indexOf(entry) + 1
          const entrant = grid.entrants[entry.index]
          const mine = entry.index === myIndex
          return (
            <div key={entry.index} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 12, background: mine ? '#FFC93C' : 'transparent', color: mine ? '#1E1446' : '#fff' }}>
              <div style={{ width: 40, fontFamily: 'var(--font-display)', fontSize: 18 }}>#{position}</div>
              <span style={{ width: 14, height: 14, borderRadius: '50%', border: '3px solid #000', background: entrant.color }} />
              <div style={{ flex: 1, fontSize: 14, fontWeight: 800 }}>{entrant.name}{mine ? ' (you)' : ''}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{position === 1 ? 'LEAD' : '+' + ((lead.value - entry.value) / 100).toFixed(1)}</div>
            </div>
          )
        })}
      </div>}
      {!wide && <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="cheer-lane" style={{ position: 'relative', height: 40, overflow: 'hidden' }} aria-hidden>
          {pops.map((pop) => <span key={pop.id} style={{ position: 'absolute', left: pop.x, top: 4, animation: 'dwTapLane 1s ease-out forwards', fontFamily: 'var(--font-display)', fontSize: 26, color: '#FFC93C', WebkitTextStroke: '5px #000', paintOrder: 'stroke fill' }}>+1</span>)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, whiteSpace: 'nowrap', fontSize: 12, fontWeight: 900, letterSpacing: 2 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>TAP TO BOOST</span>
          <span style={{ flex: 'none', fontVariantNumeric: 'tabular-nums', color: myCheerEnergy > 0 ? '#B8F35A' : '#C9B8FF' }}>BOOST +{Math.round((myCheerEnergy * (grid.cheerPct ?? 0)) / 100)}%</span>
        </div>
        <div aria-label={`Cheer energy ${myCheerEnergy} percent`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={myCheerEnergy} style={{ height: 12, background: '#2A1D5E', border: '3px solid #000', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${myCheerEnergy}%`, height: '100%', background: myCheerEnergy > 66 ? '#B8F35A' : '#FFC93C', transition: 'width .25s linear' }} />
        </div>
        <div style={{ paddingBottom: 6 }}>
          <Button height={62} fontSize={28} display onClick={() => { sound.play('cheer'); getSocket().emit('race:cheer'); const id = Date.now(); setPops((list) => [...list.slice(-4), { id, x: 10 + Math.round(Math.random() * 160) }]); if (pops.length > 30) say('Your duck hears you!') }} style={{ width: '100%' }}>CHEER</Button>
        </div>
      </div>}
    </div>
  )
}

export function RacePanel({ grid, tick, myAddress }: { grid: Grid; tick: Tick | null; myAddress: string }) {
  const { say } = useSession()
  const progresses = tick?.p || grid.entrants.map(() => 0)
  const order = useMemo(() => progresses.map((value, index) => ({ index, value })).sort((first, second) => second.value - first.value), [progresses])
  const myIndex = grid.entrants.findIndex((entrant) => entrant.address === myAddress)
  const myRank = order.findIndex((entry) => entry.index === myIndex) + 1
  const mine = grid.entrants[myIndex]
  const energy = myIndex >= 0 ? Math.max(0, Math.min(100, tick?.en?.[myIndex] ?? 0)) : 0
  useEffect(() => { authSocket() }, [])

  const cheer = () => { sound.play('cheer'); getSocket().emit('race:cheer') }
  const cheerRef = useRef(cheer)

  useEffect(() => { cheerRef.current = cheer })

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return

      const target = event.target as HTMLElement | null
      const targetHandlesSpace = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.isContentEditable)
      if (targetHandlesSpace) return

      event.preventDefault()
      cheerRef.current()
    }
    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <aside aria-label="Your race" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20, height: '100%', boxSizing: 'border-box', background: '#1E1446', borderLeft: '4px solid #000' }}>
      {mine && (
        <div style={{ background: '#fff', color: '#1E1446', border: '4px solid #000', borderRadius: 22, boxShadow: '0 6px 0 #000', padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <DuckSvg template={mine.template} bodyColor={mine.bodyColor} billColor={mine.billColor} cosmetics={mine.cosmetics} partTypeId={mine.partTypeId} partSlot={mine.partSlot} partColor={mine.partColor} width={84} label="Your duck" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mine.name}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#5B4AB8' }}>{mine.template}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, color: '#5B4AB8' }}>RANK</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, lineHeight: 1 }}>P{myRank || '–'}</div>
          </div>
        </div>
      )}
      <div style={{ background: '#120B2E', border: '4px solid #000', borderRadius: 22, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2, color: '#C9B8FF' }}>TOP 5</div>
        {order.slice(0, 5).map((entry, position) => (
          <div key={entry.index} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 900 }}>
            <span style={{ width: 28, fontFamily: 'var(--font-display)', fontSize: 20, color: '#FFC93C' }}>{position + 1}</span>
            <span style={{ width: 18, height: 18, borderRadius: '50%', border: '3px solid #000', background: grid.entrants[entry.index]?.color }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{grid.entrants[entry.index]?.name}{entry.index === myIndex ? ' (you)' : ''}</span>
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, color: '#C9B8FF' }}>
        <span>TAP TO BOOST · or press Space</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', color: energy > 0 ? '#B8F35A' : '#C9B8FF' }}>BOOST +{Math.round((energy * (grid.cheerPct ?? 0)) / 100)}%</span>
      </div>
      <div role="meter" aria-label={`Cheer energy ${energy} percent`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={energy} style={{ height: 12, background: '#2A1D5E', border: '3px solid #000', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${energy}%`, height: '100%', background: energy > 66 ? '#B8F35A' : '#FFC93C', transition: 'width .25s linear' }} />
      </div>
      <button type="button" className="dw-btn" onClick={() => { cheer(); if (myIndex < 0) say('Spectators cannot cheer') }} style={{ height: 120, background: '#FFC93C', color: '#1E1446', border: '5px solid #000', borderRadius: 30, boxShadow: '0 9px 0 #000', fontFamily: 'var(--font-display)', fontSize: 52 }}>CHEER</button>
    </aside>
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

export function Result({ result, settled, hatched, myAddress, duckName, trackName, onHome, onNewRoom }: { result: RaceResult; settled: Settled | null; hatched: Hatched[]; myAddress: string; duckName: string; trackName: string; onHome: () => void; onNewRoom: () => void }) {
  const row = result.ranking.find((entry) => entry.address === myAddress)
  const rank = row?.rank ?? 0
  const myHatch = hatched.find((hatch) => hatch.address === myAddress)

  return (
    <div className="anim-enter" style={{ position: 'absolute', inset: 0, padding: '8px 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 900 }}>{duckName} finished</div>
        <div className="anim-pop stroke-title" style={{ animationDelay: '.15s', fontFamily: 'var(--font-display)', fontSize: 92, lineHeight: 0.95, color: '#fff', WebkitTextStroke: '8px #000', textShadow: '0 7px 0 #000' }}>#{rank || '–'}</div>
        <div style={{ fontSize: 14, fontWeight: 800 }}>of {result.field} on {trackName}</div>
        <div style={{ marginTop: 6, padding: '8px 14px', background: '#FFC93C', border: '4px solid #000', borderRadius: 16, boxShadow: '0 5px 0 #000', animation: 'dwStamp .6s cubic-bezier(.2,.9,.3,1) .6s both', fontFamily: 'var(--font-display)', fontSize: 24, color: '#1E1446' }}>{titleForRank(rank || 99)}</div>
      </div>
      {rank > 0 && rank <= 3 && (
        <div style={{ animation: 'dwSlideR .55s cubic-bezier(.2,.9,.3,1.15) 1s both', display: 'flex', alignItems: 'center', gap: 10, background: '#fff', color: '#1E1446', border: '4px solid #000', borderRadius: 18, padding: '10px 12px' }}>
          <svg viewBox="0 0 100 110" width="40" height="44" style={{ animation: 'dwSpin 3s linear infinite' }} aria-hidden><polygon points="50,4 94,28 94,80 50,106 6,80 6,28" fill="#FFC93C" stroke="#000" strokeWidth="6" /><polygon points="50,22 78,38 78,72 50,88 22,72 22,38" fill="#836EF9" stroke="#000" strokeWidth="4" /></svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: '#5B4AB8' }}>TITLE · SOULBOUND · <span className={settled ? 'anim-pop' : 'anim-blink'} style={{ display: 'inline-block' }}>{settled?.ok ? 'MINTED' : settled ? 'FAILED' : 'MINTING…'}</span></div>
            <div style={{ fontSize: 14, fontWeight: 900 }}>Added to {duckName}’s profile</div>
            {settled?.tx && <a href={explorerTransactionUrl(settled.tx)} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#5B4AB8' }}>{shortenAddress(settled.tx)}</a>}
          </div>
        </div>
      )}
      {myHatch && (
        <div style={{ animation: 'dwSlideR .55s cubic-bezier(.2,.9,.3,1.15) .2s both', background: '#1E1446', color: '#fff', border: '4px solid #000', borderRadius: 18, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: '#FFC93C' }}>FIRST RACE DONE · EGG HATCHED</div>
          <div style={{ fontSize: 14, fontWeight: 900 }}>{duckName} is a full duck now</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#E6E0FF' }}>Your duck lives in your profile. Podium finishes earn soulbound titles.</div>
        </div>
      )}
      <Card style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {result.ranking.slice(0, 3).map((entry) => (
          <div key={entry.rank} style={{ display: 'flex', gap: 8, fontSize: 13, fontWeight: 800 }}><span style={{ width: 26 }}>#{entry.rank}</span><span style={{ flex: 1 }}>{entry.name}{entry.address === myAddress ? ' (you)' : ''}</span>{!entry.human && <span style={{ fontSize: 11, color: '#5B4AB8' }}>bot</span>}</div>
        ))}
      </Card>
      <div style={{ flex: 1 }} />
      <Button height={56} fontSize={17} onClick={onNewRoom}>Create new room</Button>
      <Button tone="white" height={48} fontSize={15} shadow={false} onClick={onHome}>Home</Button>
    </div>
  )
}
