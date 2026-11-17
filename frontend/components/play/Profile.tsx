'use client'

import { useState } from 'react'
import { useSession } from '@/contexts/SessionContext'
import { DuckSvg } from '@/components/duck/DuckSvg'
import { Button, Card, Kicker, Title, TrackThumb } from '@/components/ui/kit'
import { buildTrackGeometry } from '@/lib/track'
import { BILL_COLORS, BODY_COLORS, TEMPLATES, statDots, randomName, signedNumber, calculateDuckStats, type Duck, type Part, type Template, type Track } from '@/lib/types'
import { explorerTransactionUrl } from '@/lib/config'

type Draft = Pick<Duck, 'name' | 'template' | 'bodyColor' | 'billColor' | 'cosmetics' | 'equippedPartTypeId'>

const fitLine = (part: Part, tracks: Track[]) => tracks.filter((track) => track.status === 'active').map((track) => `${track.name.split(' ')[0]} ${statDots(part.fit[track.slug] || 1)}`).join('  ·  ')
const partEffects = (part: Part) => `SPD ${signedNumber(part.speed)}  WGT ${signedNumber(part.weight)}  BST ${signedNumber(part.boost)}`

export function Home({ duck, onOpenDuck, onJoinCode, onHost }: { duck: Duck; onOpenDuck: () => void; onJoinCode: (roomCode: string) => void; onHost: () => void }) {
  const { me } = useSession()
  const [code, setCode] = useState('')

  return (
    <div className="anim-enter" style={{ position: 'absolute', inset: 0, padding: '12px 16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button type="button" className="dw-btn" onClick={onOpenDuck} aria-label="Open My Duck" style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#fff', border: '4px solid #000', borderRadius: 22, boxShadow: '0 5px 0 #000', padding: '10px 12px', textAlign: 'left' }}>
        <div className="anim-bob" style={{ animationDuration: '1.4s' }}>
          <DuckSvg template={duck.template} bodyColor={duck.bodyColor} billColor={duck.billColor} cosmetics={duck.cosmetics} partTypeId={duck.equippedPartTypeId} width={110} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, color: '#1E1446' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, lineHeight: 1 }}>{duck.name}</div>
          <div style={{ fontSize: 12, fontWeight: 800 }}>{TEMPLATES[duck.template].name} · {duck.races ? `${duck.races} race${duck.races > 1 ? 's' : ''}` : 'no races yet'}</div>
          <div style={{ alignSelf: 'flex-start', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 900, background: duck.status === 'hatched' ? '#B8F35A' : '#E6E0FF' }}>
            {duck.status === 'hatched' ? 'HATCHED' : 'EGG · hatches after your first race'}
          </div>
        </div>
      </button>
      <div style={{ display: 'flex', gap: 8 }}>
        {[['USDC', me ? (Number(me.usdc) / 1e6).toFixed(2) : '0.00'], ['PARTS', String(me?.parts.length || 0)], ['TITLES', String(me?.titles.length || 0)]].map(([label, value]) => (
          <div key={label} style={{ flex: 1, background: '#1E1446', color: '#fff', border: '3px solid #000', borderRadius: 16, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, color: '#C9B8FF' }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{value}</div>
          </div>
        ))}
      </div>
      <form onSubmit={(event) => { event.preventDefault(); if (code.trim()) onJoinCode(code.trim().toUpperCase()) }} style={{ display: 'flex', gap: 8 }}>
        <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 900, letterSpacing: 1 }}>
          ROOM CODE
          <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="WEK-7Q2" style={{ height: 48, boxSizing: 'border-box', padding: '0 12px', border: '4px solid #000', borderRadius: 14, fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: '#1E1446', background: '#fff' }} />
        </label>
        <Button type="submit" tone="white" height={48} fontSize={16} style={{ alignSelf: 'flex-end', boxShadow: '0 4px 0 #000' }}>Join</Button>
      </form>
      {me && me.titles.length > 0 && (
        <Card style={{ padding: '8px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: '#5B4AB8' }}>LATEST TITLE · SOULBOUND</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>{me.titles[0].title}</div>
        </Card>
      )}
      <div style={{ flex: 1 }} />
      <Button tone="ink" height={54} fontSize={17} shadow={false} onClick={onHost}>Host a room · 1 USDC</Button>
    </div>
  )
}

export function MyDuck({ draft, onChange, onGarage }: { draft: Draft; onChange: (draft: Draft) => void; onGarage: () => void }) {
  const { me, parts, tracks } = useSession()
  const [tab, setTab] = useState<'parts' | 'body' | 'color' | 'style' | 'name'>('parts')
  const equippedPart = parts.find((candidate) => candidate.typeId === draft.equippedPartTypeId) || null
  const stats = calculateDuckStats(draft.template, equippedPart)
  const owned = parts.filter((candidate) => me?.parts.includes(candidate.typeId))
  const duck = me?.duck
  const tabs: [typeof tab, string][] = [['parts', 'Parts'], ['body', 'Body'], ['color', 'Color'], ['style', 'Style'], ['name', 'Name']]

  return (
    <div className="anim-enter" style={{ position: 'absolute', inset: 0, padding: '8px 14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ position: 'relative', height: 186, flex: 'none', background: '#1E1446', border: '4px solid #000', borderRadius: 24, overflow: 'hidden' }}>
        <div className="water" aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 50 }} />
        <div className="anim-bob" style={{ position: 'absolute', left: '50%', top: 26, width: 210, marginLeft: -105 }}>
          <DuckSvg template={draft.template} bodyColor={draft.bodyColor} billColor={draft.billColor} cosmetics={draft.cosmetics} partTypeId={draft.equippedPartTypeId} width={210} label="Your duck with equipped part" />
        </div>
        <div style={{ position: 'absolute', left: 12, top: 10, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          <span style={{ padding: '3px 10px', borderRadius: 999, background: '#FFC93C', border: '3px solid #000', color: '#1E1446', fontFamily: 'var(--font-display)', fontSize: 18 }}>{draft.name}</span>
          <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 900, color: '#1E1446', background: duck?.status === 'hatched' ? '#B8F35A' : '#E6E0FF' }}>{duck?.status === 'hatched' ? 'HATCHED' : 'EGG · hatches after 1st race'}</span>
        </div>
        <div style={{ position: 'absolute', right: 12, top: 10, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, color: '#C9B8FF', textAlign: 'right', whiteSpace: 'pre-line' }}>{`SPD ${stats[0]}\nWGT ${stats[1]}\nBST ${stats[2]}`}</div>
        <span style={{ position: 'absolute', left: 12, bottom: 8, padding: '3px 10px', borderRadius: 999, background: '#fff', border: '3px solid #000', color: '#1E1446', fontSize: 12, fontWeight: 900 }}>Equipped · {equippedPart ? equippedPart.name : 'no part'}</span>
      </div>
      <Card style={{ flex: 'none', padding: '7px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, color: '#5B4AB8' }}>COLLECTIBLES</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 900 }}>
          <span style={{ flex: 1 }}>Part licenses · {me?.licenses?.length ?? me?.parts.length ?? 0}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#5B4AB8' }}>one per part, yours to keep</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800 }}>
          <span style={{ flex: 1 }}>Titles · {me?.titles.length ?? 0}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#5B4AB8' }}>{me?.titles[0]?.title ?? 'soulbound, won only'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800 }}>
          <span style={{ flex: 1 }}>Part licenses · {me?.parts.length ?? 0}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#5B4AB8' }}>ERC-721</span>
        </div>
      </Card>
      <div role="tablist" style={{ display: 'flex', gap: 4, flex: 'none' }}>
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className="dw-btn" onClick={() => setTab(id)} style={{ flex: 1, height: 38, padding: 0, border: '3px solid #000', borderRadius: 12, fontSize: 13, fontWeight: 900, color: '#1E1446', background: tab === id ? '#FFC93C' : '#fff' }}>{label}</button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 4 }}>
        {tab === 'parts' && (
          <>
            <div style={{ fontSize: 12, fontWeight: 800 }}>Your part licenses. Equipped = default for every race; swap per track in the lobby.</div>
            {owned.map((part) => {
              const on = draft.equippedPartTypeId === part.typeId
              return (
                <div key={part.typeId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: on ? '#FFC93C' : '#fff', color: '#1E1446', border: '4px solid #000', borderRadius: 16, boxShadow: `0 ${on ? 5 : 2}px 0 #000` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{part.name}</span><span style={{ padding: '1px 6px', border: '2px solid #000', borderRadius: 999, fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}>{part.slot}</span></div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800 }}>{partEffects(part)}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#5B4AB8' }}>{fitLine(part, tracks)}</div>
                  </div>
                  <Button tone={on ? 'white' : 'lime'} height={40} fontSize={13} shadow={false} ariaPressed={on} onClick={() => onChange({ ...draft, equippedPartTypeId: on ? null : part.typeId })} style={{ border: '3px solid #000', padding: '0 12px' }}>{on ? 'Unequip' : 'Equip'}</Button>
                </div>
              )
            })}
            {owned.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 12px', border: '4px dashed #1E1446', borderRadius: 18, textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>No parts yet</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Parts change speed, weight and boost. Each one shines on a different track.</div>
              </div>
            )}
            <Button tone="ink" height={46} fontSize={15} shadow={false} onClick={onGarage} style={{ border: '3px solid #000' }}>Get parts in the Garage</Button>
          </>
        )}
        {tab === 'body' && (Object.keys(TEMPLATES) as Template[]).map((id) => {
          const template = TEMPLATES[id]
          const on = draft.template === id
          return (
            <button key={id} type="button" className="dw-btn" aria-pressed={on} onClick={() => onChange({ ...draft, template: id })} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px', border: '4px solid #000', borderRadius: 18, color: '#1E1446', textAlign: 'left', background: on ? '#FFC93C' : '#fff', boxShadow: `0 ${on ? 6 : 3}px 0 #000` }}>
              <div style={{ flex: 1 }}><div style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1 }}>{template.name}</div><div style={{ fontSize: 12, fontWeight: 700 }}>{template.tag}</div></div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 800 }}>SPD {template.st[0]} WGT {template.st[1]} BST {template.st[2]}</div>
            </button>
          )
        })}
        {tab === 'color' && (
          <>
            <Swatches title="BODY" list={BODY_COLORS} value={draft.bodyColor} pick={(color) => onChange({ ...draft, bodyColor: color })} />
            <Swatches title="BILL" list={BILL_COLORS} value={draft.billColor} pick={(color) => onChange({ ...draft, billColor: color })} />
          </>
        )}
        {tab === 'style' && (
          <>
            {([['hat', 'Party hat'], ['shades', 'Shades'], ['scarf', 'Scarf']] as const).map(([cosmeticKey, label]) => {
              const on = draft.cosmetics[cosmeticKey]

              return (
                <button key={cosmeticKey} type="button" className="dw-btn" aria-pressed={on} onClick={() => onChange({ ...draft, cosmetics: { ...draft.cosmetics, [cosmeticKey]: !on } })} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 12, border: '4px solid #000', borderRadius: 18, color: '#1E1446', textAlign: 'left', background: on ? '#FFC93C' : '#fff', boxShadow: `0 ${on ? 6 : 3}px 0 #000` }}>
                  <span style={{ flex: 1, fontSize: 17, fontWeight: 900 }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 800 }}>{on ? 'ON' : 'OFF'}</span>
                </button>
              )
            })}
            <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'center' }}>Style is free and never changes stats.</div>
          </>
        )}
        {tab === 'name' && (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>
              DUCK NAME · shown on every big screen
              <input value={draft.name} maxLength={14} onChange={(event) => onChange({ ...draft, name: event.target.value.slice(0, 14) })} style={{ height: 54, boxSizing: 'border-box', padding: '0 14px', border: '4px solid #000', borderRadius: 16, fontSize: 20, fontWeight: 900, color: '#1E1446', background: '#fff' }} />
            </label>
            <Button tone="white" height={46} fontSize={15} shadow={false} onClick={() => onChange({ ...draft, name: randomName() })} style={{ border: '3px solid #000' }}>Random name</Button>
            {[['Races', duck?.races ?? 0], ['Best finish', duck?.bestRank ? `#${duck.bestRank}` : '–'], ['Titles (soulbound)', me?.titles.length ?? 0]].map(([label, value]) => (
              <div key={String(label)} style={{ background: '#1E1446', color: '#fff', border: '3px solid #000', borderRadius: 14, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800 }}><span>{label}</span><span>{value}</span></div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function Swatches({ title, list, value, pick }: { title: string; list: [string, string][]; value: string; pick: (color: string) => void }) {
  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
        {list.map(([color, label]) => {
          const on = value.toUpperCase() === color.toUpperCase()

          return <button key={color} type="button" onClick={() => pick(color)} aria-label={label} aria-pressed={on} style={{ height: 44, borderRadius: 12, background: color, border: on ? '4px solid #000' : '3px solid #000', boxShadow: on ? '0 0 0 3px #fff, 0 0 0 6px #000' : 'none' }} />
        })}
      </div>
    </>
  )
}

export function Garage({ draft, onEquip, onBuy, busy }: { draft: Draft; onEquip: (typeId: number) => void; onBuy: (part: Part) => void; busy: boolean }) {
  const { me, parts, tracks } = useSession()
  return (
    <div className="anim-enter" style={{ position: 'absolute', inset: 0, padding: '12px 16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Kicker>GARAGE · SHOP</Kicker>
      <Title size={32}>Parts for {draft.name}</Title>
      <div style={{ fontSize: 13, fontWeight: 700 }}>Each part is a license NFT you keep. No part wins on every track. Owned parts live in My Duck.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', minHeight: 0 }}>
        {parts.map((part) => {
          const own = me?.parts.includes(part.typeId)
          const on = draft.equippedPartTypeId === part.typeId

          return (
            <div key={part.typeId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#fff', color: '#1E1446', border: '4px solid #000', borderRadius: 18 }}>
              <div style={{ width: 64, flex: 'none' }}>
                <DuckSvg template="balanced" bodyColor={draft.bodyColor} billColor={draft.billColor} partTypeId={part.typeId} width={64} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontFamily: 'var(--font-display)', fontSize: 19 }}>{part.name}</span><span style={{ padding: '1px 6px', border: '2px solid #000', borderRadius: 999, fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}>{part.slot}</span></div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800 }}>{partEffects(part)}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#5B4AB8' }}>{fitLine(part, tracks)}</div>
              </div>
              {own ? (
                <Button tone={on ? 'yellow' : 'lime'} height={42} fontSize={12} shadow={false} onClick={() => onEquip(part.typeId)} style={{ border: '3px solid #000', padding: '0 10px' }}>{on ? 'EQUIPPED' : 'Equip'}</Button>
              ) : (
                <Button height={42} fontSize={14} disabled={busy} onClick={() => onBuy(part)} style={{ border: '3px solid #000', boxShadow: '0 4px 0 #000', padding: '0 12px' }}>{(Number(part.price) / 1e6).toFixed(0)} USDC</Button>
              )}
            </div>
          )
        })}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '4px dashed #1E1446', borderRadius: 18, color: '#1E1446' }}>
          <div style={{ flex: 1 }}><div style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Creator parts</div><div style={{ fontSize: 12, fontWeight: 700 }}>Design parts, sell them as NFTs, keep 95%.</div></div>
          <span style={{ padding: '6px 10px', borderRadius: 10, background: '#1E1446', color: '#fff', fontSize: 11, fontWeight: 900 }}>COMING SOON</span>
        </div>
      </div>
      <div style={{ flex: 1 }} />
    </div>
  )
}

export function CreateRoom({ onCreate, busy }: { onCreate: (room: { name: string; trackId: number; maxDucks: number; fillBots: boolean }) => void; busy: boolean }) {
  const { tracks } = useSession()
  const active = tracks.filter((track) => track.status === 'active' && track.id !== null)
  const [name, setName] = useState('GIK UGM Main Stage')
  const [trackId, setTrackId] = useState<number>(active.find((track) => track.slug === 'merapi-ring')?.id ?? active[0]?.id ?? 2)
  const [slots, setSlots] = useState(50)
  const [bots, setBots] = useState(true)
  const selectedTrack = active.find((track) => track.id === trackId)

  return (
    <div className="anim-enter" style={{ position: 'absolute', inset: 0, padding: '12px 16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Kicker>HOST A ROOM</Kicker>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 900, letterSpacing: 1 }}>
        ROOM NAME
        <input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} style={{ height: 46, boxSizing: 'border-box', padding: '0 12px', border: '4px solid #000', borderRadius: 14, fontSize: 16, fontWeight: 800, color: '#1E1446', background: '#fff' }} />
      </label>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1 }}>PICK A TRACK</div>
      {active.map((track) => {
        const on = track.id === trackId
        const geometry = buildTrackGeometry(track.path, track.closed, track.laps)

        return (
          <button key={track.slug} type="button" className="dw-btn" aria-pressed={on} onClick={() => setTrackId(track.id!)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', border: '4px solid #000', borderRadius: 18, color: '#1E1446', textAlign: 'left', background: on ? '#FFC93C' : '#fff', boxShadow: `0 ${on ? 5 : 2}px 0 #000` }}>
            <TrackThumb pathData={geometry.d} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, lineHeight: 1 }}>{track.name}</div>
              <div style={{ fontSize: 11, fontWeight: 800 }}>{(track.lengthM / 1000).toFixed(1)} km · {track.turns} turns · {track.laps} {track.laps > 1 ? 'laps' : 'lap'} · ~{Math.round((track.profile.lapTicks * track.laps * 0.3) / 1)} s</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#5B4AB8' }}>{track.description.split('.')[0]}</div>
            </div>
          </button>
        )
      })}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '4px dashed #1E1446', borderRadius: 18, color: '#1E1446' }}>
        <div style={{ width: 92, height: 52, flex: 'none', borderRadius: 10, border: '2px dashed #1E1446', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900 }}>+</div>
        <div style={{ flex: 1 }}><div style={{ fontFamily: 'var(--font-display)', fontSize: 20, lineHeight: 1 }}>Custom track</div><div style={{ fontSize: 11, fontWeight: 700 }}>Build & rent out tracks · creator keeps 50%</div></div>
        <span style={{ padding: '4px 8px', borderRadius: 8, background: '#1E1446', color: '#fff', fontSize: 10, fontWeight: 900 }}>SOON</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[20, 50, 100, 200].map((slotCount) => (
          <button key={slotCount} type="button" className="dw-btn" aria-pressed={slots === slotCount} onClick={() => setSlots(slotCount)} style={{ flex: 1, height: 40, border: '3px solid #000', borderRadius: 12, fontSize: 14, fontWeight: 900, color: '#1E1446', background: slots === slotCount ? '#FFC93C' : '#fff' }}>{slotCount} ducks</button>
        ))}
      </div>
      <button type="button" className="dw-btn" aria-pressed={bots} onClick={() => setBots(!bots)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fff', color: '#1E1446', border: '3px solid #000', borderRadius: 14, textAlign: 'left' }}>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 900 }}>Fill empty slots with bots</span>
        <span style={{ width: 50, height: 28, borderRadius: 999, border: '3px solid #000', background: bots ? '#FFC93C' : '#C9B8FF', position: 'relative' }}><span style={{ position: 'absolute', top: 2, left: bots ? 24 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', border: '2px solid #000', transition: 'left .15s' }} /></span>
      </button>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 900 }}><span>Track rent · {selectedTrack?.name}</span><span>{selectedTrack ? (Number(selectedTrack.rentPrice) / 1e6).toFixed(2) : '1.00'} USDC</span></div>
      <Button height={58} disabled={busy || !name.trim() || !selectedTrack} onClick={() => onCreate({ name: name.trim(), trackId, maxDucks: slots, fillBots: bots })}>Create room · {selectedTrack ? (Number(selectedTrack.rentPrice) / 1e6).toFixed(0) : 1} USDC</Button>
    </div>
  )
}

export function Hosted({ code, name, summary, onLobby }: { code: string; name: string; summary: string; onLobby: () => void }) {
  const stage = typeof window !== 'undefined' ? `${window.location.origin}/stage/${code}` : `/stage/${code}`

  return (
    <div className="anim-enter" style={{ position: 'absolute', inset: 0, padding: '14px 20px 22px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center' }}>
      <span style={{ padding: '6px 12px', borderRadius: 999, background: '#1E1446', color: '#fff', fontSize: 12, fontWeight: 900, letterSpacing: 2 }}>ROOM CREATED · YOU HOST</span>
      <Title size={30}>{name}</Title>
      <div className="anim-pop" style={{ background: '#fff', border: '4px solid #000', borderRadius: 22, boxShadow: '0 6px 0 #000', padding: '12px 22px' }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2, color: '#5B4AB8' }}>ROOM CODE</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 38, fontWeight: 700, color: '#1E1446', letterSpacing: 3 }}>{code}</div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 800 }}>{summary}</div>
      <Card tone="ink" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2, color: '#C9B8FF' }}>OPEN ON THE PROJECTOR</div>
        <a href={stage} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#FFC93C', wordBreak: 'break-all' }}>{stage}</a>
      </Card>
      <div style={{ flex: 1 }} />
      <Button height={60} onClick={onLobby} style={{ width: '100%' }}>Go to lobby · race too</Button>
    </div>
  )
}
