'use client'

import { useState } from 'react'
import { useSession } from '@/contexts/SessionContext'
import { DuckSvg } from '@/components/duck/DuckSvg'
import { Btn, Card, Kicker, Title, TrackThumb } from '@/components/ui/kit'
import { buildTrack } from '@/lib/track'
import { BILL_COLORS, BODY_COLORS, TEMPLATES, dots, randomName, sgn, statsOf, type Duck, type Part, type Template, type Track } from '@/lib/types'
import { txUrl } from '@/lib/config'

type Draft = Pick<Duck, 'name' | 'template' | 'bodyColor' | 'billColor' | 'cosmetics' | 'equippedPartTypeId'>

const fitLine = (p: Part, tracks: Track[]) => tracks.filter((t) => t.status === 'active').map((t) => `${t.name.split(' ')[0]} ${dots(p.fit[t.slug] || 1)}`).join('  ·  ')
const fx = (p: Part) => `SPD ${sgn(p.speed)}  WGT ${sgn(p.weight)}  BST ${sgn(p.boost)}`

export function Home({ duck, onOpenDuck, onJoinCode, onHost }: { duck: Duck; onOpenDuck: () => void; onJoinCode: (c: string) => void; onHost: () => void }) {
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
            {duck.status === 'hatched' ? `DUCK NFT #${duck.tokenId}` : duck.status === 'hatching' ? 'HATCHING…' : 'EGG · hatches into an NFT after your first race'}
          </div>
        </div>
      </button>
      <div style={{ display: 'flex', gap: 8 }}>
        {[['USDC', me ? (Number(me.usdc) / 1e6).toFixed(2) : '0.00'], ['PARTS', String(me?.parts.length || 0)], ['TITLES', String(me?.titles.length || 0)]].map(([k, v]) => (
          <div key={k} style={{ flex: 1, background: '#1E1446', color: '#fff', border: '3px solid #000', borderRadius: 16, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, color: '#C9B8FF' }}>{k}</div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{v}</div>
          </div>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) onJoinCode(code.trim().toUpperCase()) }} style={{ display: 'flex', gap: 8 }}>
        <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 900, letterSpacing: 1 }}>
          ROOM CODE
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WEK-7Q2" style={{ height: 48, boxSizing: 'border-box', padding: '0 12px', border: '4px solid #000', borderRadius: 14, fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: '#1E1446', background: '#fff' }} />
        </label>
        <Btn type="submit" tone="white" h={48} size={16} style={{ alignSelf: 'flex-end', boxShadow: '0 4px 0 #000' }}>Join</Btn>
      </form>
      {me && me.titles.length > 0 && (
        <Card style={{ padding: '8px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: '#5B4AB8' }}>LATEST TITLE · SOULBOUND</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>{me.titles[0].title}</div>
        </Card>
      )}
      <div style={{ flex: 1 }} />
      <Btn tone="ink" h={54} size={17} shadow={false} onClick={onHost}>Host a room · 1 USDC</Btn>
    </div>
  )
}

export function MyDuck({ draft, onChange, onGarage }: { draft: Draft; onChange: (d: Draft) => void; onGarage: () => void }) {
  const { me, parts, tracks } = useSession()
  const [tab, setTab] = useState<'parts' | 'body' | 'color' | 'style' | 'name'>('parts')
  const eqPart = parts.find((p) => p.typeId === draft.equippedPartTypeId) || null
  const st = statsOf(draft.template, eqPart)
  const owned = parts.filter((p) => me?.parts.includes(p.typeId))
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
          <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 900, color: '#1E1446', background: duck?.status === 'hatched' ? '#B8F35A' : '#E6E0FF' }}>{duck?.status === 'hatched' ? `DUCK NFT #${duck.tokenId}` : 'EGG · NFT after 1st race'}</span>
        </div>
        <div style={{ position: 'absolute', right: 12, top: 10, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, color: '#C9B8FF', textAlign: 'right', whiteSpace: 'pre-line' }}>{`SPD ${st[0]}\nWGT ${st[1]}\nBST ${st[2]}`}</div>
        <span style={{ position: 'absolute', left: 12, bottom: 8, padding: '3px 10px', borderRadius: 999, background: '#fff', border: '3px solid #000', color: '#1E1446', fontSize: 12, fontWeight: 900 }}>Equipped · {eqPart ? eqPart.name : 'no part'}</span>
      </div>
      <Card style={{ flex: 'none', padding: '7px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, color: '#5B4AB8' }}>COLLECTIBLES</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 900 }}>
          <span style={{ flex: 1 }}>{duck?.tokenId ? `Duck NFT #${duck.tokenId}` : duck?.status === 'hatching' ? 'Duck NFT · minting…' : 'Duck NFT · egg'}</span>
          {duck?.hatchTx && <a href={txUrl(duck.hatchTx)} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 800, color: '#5B4AB8' }}>tx ↗</a>}
          {!duck?.tokenId && !duck?.hatchTx && <span style={{ fontSize: 10, fontWeight: 700, color: '#5B4AB8' }}>after 1st paid race</span>}
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
            {owned.map((p) => {
              const on = draft.equippedPartTypeId === p.typeId
              return (
                <div key={p.typeId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: on ? '#FFC93C' : '#fff', color: '#1E1446', border: '4px solid #000', borderRadius: 16, boxShadow: `0 ${on ? 5 : 2}px 0 #000` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{p.name}</span><span style={{ padding: '1px 6px', border: '2px solid #000', borderRadius: 999, fontSize: 10, fontWeight: 900 }}>{p.rarity}</span></div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800 }}>{fx(p)}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#5B4AB8' }}>{fitLine(p, tracks)}</div>
                  </div>
                  <Btn tone={on ? 'white' : 'lime'} h={40} size={13} shadow={false} ariaPressed={on} onClick={() => onChange({ ...draft, equippedPartTypeId: on ? null : p.typeId })} style={{ border: '3px solid #000', padding: '0 12px' }}>{on ? 'Unequip' : 'Equip'}</Btn>
                </div>
              )
            })}
            {owned.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 12px', border: '4px dashed #1E1446', borderRadius: 18, textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>No parts yet</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Parts change speed, weight and boost. Each one shines on a different track.</div>
              </div>
            )}
            <Btn tone="ink" h={46} size={15} shadow={false} onClick={onGarage} style={{ border: '3px solid #000' }}>Get parts in the Garage</Btn>
          </>
        )}
        {tab === 'body' && (Object.keys(TEMPLATES) as Template[]).map((id) => {
          const t = TEMPLATES[id], on = draft.template === id
          return (
            <button key={id} type="button" className="dw-btn" aria-pressed={on} onClick={() => onChange({ ...draft, template: id })} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px', border: '4px solid #000', borderRadius: 18, color: '#1E1446', textAlign: 'left', background: on ? '#FFC93C' : '#fff', boxShadow: `0 ${on ? 6 : 3}px 0 #000` }}>
              <div style={{ flex: 1 }}><div style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1 }}>{t.name}</div><div style={{ fontSize: 12, fontWeight: 700 }}>{t.tag}</div></div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 800 }}>SPD {t.st[0]} WGT {t.st[1]} BST {t.st[2]}</div>
            </button>
          )
        })}
        {tab === 'color' && (
          <>
            <Swatches title="BODY" list={BODY_COLORS} value={draft.bodyColor} pick={(c) => onChange({ ...draft, bodyColor: c })} />
            <Swatches title="BILL" list={BILL_COLORS} value={draft.billColor} pick={(c) => onChange({ ...draft, billColor: c })} />
          </>
        )}
        {tab === 'style' && (
          <>
            {([['hat', 'Party hat'], ['shades', 'Shades'], ['scarf', 'Scarf']] as const).map(([k, label]) => {
              const on = draft.cosmetics[k]
              return (
                <button key={k} type="button" className="dw-btn" aria-pressed={on} onClick={() => onChange({ ...draft, cosmetics: { ...draft.cosmetics, [k]: !on } })} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 12, border: '4px solid #000', borderRadius: 18, color: '#1E1446', textAlign: 'left', background: on ? '#FFC93C' : '#fff', boxShadow: `0 ${on ? 6 : 3}px 0 #000` }}>
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
              <input value={draft.name} maxLength={14} onChange={(e) => onChange({ ...draft, name: e.target.value.slice(0, 14) })} style={{ height: 54, boxSizing: 'border-box', padding: '0 14px', border: '4px solid #000', borderRadius: 16, fontSize: 20, fontWeight: 900, color: '#1E1446', background: '#fff' }} />
            </label>
            <Btn tone="white" h={46} size={15} shadow={false} onClick={() => onChange({ ...draft, name: randomName() })} style={{ border: '3px solid #000' }}>Random name</Btn>
            {[['Races', duck?.races ?? 0], ['Best finish', duck?.bestRank ? `#${duck.bestRank}` : '–'], ['Titles (soulbound)', me?.titles.length ?? 0]].map(([k, v]) => (
              <div key={String(k)} style={{ background: '#1E1446', color: '#fff', border: '3px solid #000', borderRadius: 14, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800 }}><span>{k}</span><span>{v}</span></div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function Swatches({ title, list, value, pick }: { title: string; list: [string, string][]; value: string; pick: (c: string) => void }) {
  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
        {list.map(([c, label]) => {
          const on = value.toUpperCase() === c.toUpperCase()
          return <button key={c} type="button" onClick={() => pick(c)} aria-label={label} aria-pressed={on} style={{ height: 44, borderRadius: 12, background: c, border: on ? '4px solid #000' : '3px solid #000', boxShadow: on ? '0 0 0 3px #fff, 0 0 0 6px #000' : 'none' }} />
        })}
      </div>
    </>
  )
}

export function Garage({ draft, onEquip, onBuy, fromLobby, onBack, busy }: { draft: Draft; onEquip: (typeId: number) => void; onBuy: (p: Part) => void; fromLobby: boolean; onBack: () => void; busy: boolean }) {
  const { me, parts, tracks } = useSession()
  return (
    <div className="anim-enter" style={{ position: 'absolute', inset: 0, padding: '12px 16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Kicker>GARAGE · SHOP</Kicker>
      <Title size={32}>Parts for {draft.name}</Title>
      <div style={{ fontSize: 13, fontWeight: 700 }}>Each part is a license NFT you keep. No part wins on every track. Owned parts live in My Duck.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', minHeight: 0 }}>
        {parts.map((p) => {
          const own = me?.parts.includes(p.typeId)
          const on = draft.equippedPartTypeId === p.typeId
          return (
            <div key={p.typeId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#fff', color: '#1E1446', border: '4px solid #000', borderRadius: 18 }}>
              <div style={{ width: 64, flex: 'none' }}>
                <DuckSvg template="balanced" bodyColor={draft.bodyColor} billColor={draft.billColor} partTypeId={p.typeId} width={64} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontFamily: 'var(--font-display)', fontSize: 19 }}>{p.name}</span><span style={{ padding: '1px 6px', border: '2px solid #000', borderRadius: 999, fontSize: 10, fontWeight: 900 }}>{p.rarity}</span></div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800 }}>{fx(p)}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#5B4AB8' }}>{fitLine(p, tracks)}</div>
              </div>
              {own ? (
                <Btn tone={on ? 'yellow' : 'lime'} h={42} size={12} shadow={false} onClick={() => onEquip(p.typeId)} style={{ border: '3px solid #000', padding: '0 10px' }}>{on ? 'EQUIPPED' : 'Equip'}</Btn>
              ) : (
                <Btn h={42} size={14} disabled={busy} onClick={() => onBuy(p)} style={{ border: '3px solid #000', boxShadow: '0 4px 0 #000', padding: '0 12px' }}>{(Number(p.price) / 1e6).toFixed(0)} USDC</Btn>
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
      {fromLobby && <Btn tone="white" h={54} size={17} shadow={false} onClick={onBack}>Back to lobby</Btn>}
    </div>
  )
}

export function CreateRoom({ onCreate, busy }: { onCreate: (f: { name: string; trackId: number; maxDucks: number; fillBots: boolean }) => void; busy: boolean }) {
  const { tracks } = useSession()
  const active = tracks.filter((t) => t.status === 'active' && t.id !== null)
  const [name, setName] = useState('GIK UGM Main Stage')
  const [trackId, setTrackId] = useState<number>(active.find((t) => t.slug === 'alpine-ring')?.id ?? active[0]?.id ?? 2)
  const [slots, setSlots] = useState(50)
  const [bots, setBots] = useState(true)
  const sel = active.find((t) => t.id === trackId)
  return (
    <div className="anim-enter" style={{ position: 'absolute', inset: 0, padding: '12px 16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Kicker>HOST A ROOM</Kicker>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 900, letterSpacing: 1 }}>
        ROOM NAME
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} style={{ height: 46, boxSizing: 'border-box', padding: '0 12px', border: '4px solid #000', borderRadius: 14, fontSize: 16, fontWeight: 800, color: '#1E1446', background: '#fff' }} />
      </label>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1 }}>PICK A TRACK</div>
      {active.map((t) => {
        const on = t.id === trackId
        const geo = buildTrack(t.path, t.closed, t.laps)
        return (
          <button key={t.slug} type="button" className="dw-btn" aria-pressed={on} onClick={() => setTrackId(t.id!)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', border: '4px solid #000', borderRadius: 18, color: '#1E1446', textAlign: 'left', background: on ? '#FFC93C' : '#fff', boxShadow: `0 ${on ? 5 : 2}px 0 #000` }}>
            <TrackThumb d={geo.d} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, lineHeight: 1 }}>{t.name}</div>
              <div style={{ fontSize: 11, fontWeight: 800 }}>{(t.lengthM / 1000).toFixed(1)} km · {t.turns} turns · {t.laps} {t.laps > 1 ? 'laps' : 'lap'} · ~{Math.round((t.profile.lapTicks * t.laps * 0.3) / 1)} s</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#5B4AB8' }}>{t.description.split('.')[0]}</div>
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
        {[20, 50, 100, 200].map((v) => (
          <button key={v} type="button" className="dw-btn" aria-pressed={slots === v} onClick={() => setSlots(v)} style={{ flex: 1, height: 40, border: '3px solid #000', borderRadius: 12, fontSize: 14, fontWeight: 900, color: '#1E1446', background: slots === v ? '#FFC93C' : '#fff' }}>{v} ducks</button>
        ))}
      </div>
      <button type="button" className="dw-btn" aria-pressed={bots} onClick={() => setBots(!bots)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fff', color: '#1E1446', border: '3px solid #000', borderRadius: 14, textAlign: 'left' }}>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 900 }}>Fill empty slots with bots</span>
        <span style={{ width: 50, height: 28, borderRadius: 999, border: '3px solid #000', background: bots ? '#FFC93C' : '#C9B8FF', position: 'relative' }}><span style={{ position: 'absolute', top: 2, left: bots ? 24 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', border: '2px solid #000', transition: 'left .15s' }} /></span>
      </button>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 900 }}><span>Track rent · {sel?.name}</span><span>{sel ? (Number(sel.rentPrice) / 1e6).toFixed(2) : '1.00'} USDC</span></div>
      <Btn h={58} disabled={busy || !name.trim() || !sel} onClick={() => onCreate({ name: name.trim(), trackId, maxDucks: slots, fillBots: bots })}>Create room · {sel ? (Number(sel.rentPrice) / 1e6).toFixed(0) : 1} USDC</Btn>
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
      <Btn h={60} onClick={onLobby} style={{ width: '100%' }}>Go to lobby · race too</Btn>
    </div>
  )
}
