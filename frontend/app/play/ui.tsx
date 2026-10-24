'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from '@/contexts/SessionContext'
import { useRoomLive } from '@/lib/useRoomLive'
import { saveDuck } from '@/http/profile/profileApi'
import { setLoadout, startRace } from '@/http/rooms/roomsApi'
import { sound } from '@/lib/sound'
import { randomDuck, type Duck } from '@/lib/types'
import { Header, Toast, SignSheet, WalletSheet, BottomNav } from '@/components/play/Shell'
import { Splash, Connect, JoinTicket, Hatch } from '@/components/play/Onboarding'
import { Home, MyDuck, Garage, CreateRoom, Hosted } from '@/components/play/Profile'
import { Lobby, Countdown, RaceView, PhotoFinish, Result } from '@/components/play/RaceScreens'
import { Dots } from '@/components/ui/kit'

type Screen = 'splash' | 'connect' | 'join' | 'hatch' | 'home' | 'myduck' | 'garage' | 'create' | 'hosted' | 'lobby'
type Draft = Pick<Duck, 'name' | 'template' | 'bodyColor' | 'billColor' | 'cosmetics' | 'equippedPartTypeId'>

const draftOf = (d: Duck | null | undefined): Draft => (d ? { name: d.name, template: d.template, bodyColor: d.bodyColor, billColor: d.billColor, cosmetics: d.cosmetics, equippedPartTypeId: d.equippedPartTypeId } : randomDuck())

export function PlayPage() {
  const router = useRouter()
  const params = useSearchParams()
  const invite = params.get('room')?.toUpperCase() || null
  const session = useSession()
  const { ready, me, pay, refresh, say, tracks } = session
  const [screen, setScreen] = useState<Screen>('splash')
  const [code, setCode] = useState<string | null>(invite)
  const [draft, setDraft] = useState<Draft>(() => randomDuck())
  const [busy, setBusy] = useState(false)
  const [walletOpen, setWalletOpen] = useState(false)
  const [garageFromLobby, setGarageFromLobby] = useState(false)
  const [loadout, setLoadoutState] = useState<number | null>(null)
  const [starting, setStarting] = useState(false)
  const live = useRoomLive(code)
  const room = live.room
  const routed = useRef(false)
  const saveT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const address = me?.address || ''
  const inRoom = !!room && !!address && room.players.some((p) => p.address === address)

  // First routing once the session is known
  useEffect(() => {
    if (!ready || routed.current) return
    if (!me) return setScreen('splash')
    if (invite && room === null && !live.error) return // wait for the room
    routed.current = true
    setDraft(draftOf(me.duck))
    setLoadoutState(me.duck?.equippedPartTypeId ?? null)
    if (invite && room) setScreen(inRoom ? (me.duck ? 'lobby' : 'hatch') : 'join')
    else setScreen(me.duck ? 'home' : 'hatch')
  }, [ready, me, invite, room, inRoom, live.error])

  // After connecting (sign-in finished) continue the flow
  useEffect(() => {
    if (screen === 'connect' && me) {
      routed.current = true
      setDraft(draftOf(me.duck))
      setLoadoutState(me.duck?.equippedPartTypeId ?? null)
      if (code && room) setScreen(inRoom ? (me.duck ? 'lobby' : 'hatch') : 'join')
      else setScreen(me.duck ? 'home' : 'hatch')
    }
    if (me === null && ready && routed.current) {
      routed.current = false
      setScreen('splash')
    }
  }, [me, screen, code, room, inRoom, ready])

  // Keep the URL shareable
  useEffect(() => {
    const want = code && ['join', 'lobby', 'hatch', 'hosted'].includes(screen) ? `/play?room=${code}` : '/play'
    if (typeof window !== 'undefined' && window.location.pathname + window.location.search !== want) router.replace(want, { scroll: false })
  }, [code, screen, router])

  // Sound: music per screen, stings per phase
  const phase = live.phase
  useEffect(() => {
    sound.music(phase === 'race' ? 'race' : phase === 'idle' && me ? 'lobby' : null)
  }, [phase, me])
  useEffect(() => {
    if (phase === 'countdown') sound.play(live.countdown > 0 ? 'beep' : 'go')
  }, [phase, live.countdown])
  const prevPhase = useRef(phase)
  useEffect(() => {
    if (prevPhase.current === 'countdown' && phase === 'race') sound.play('go')
    if (phase === 'photo') sound.play('shutter')
    if (phase === 'result' && live.result) {
      const r = live.result.ranking.find((x) => x.address === address)?.rank ?? 99
      sound.play(r === 1 ? 'fanfare' : 'sting')
      sound.play('crowd')
      refresh()
    }
    prevPhase.current = phase
  }, [phase, live.result, address, refresh])
  useEffect(() => {
    if (live.tick && live.tick.b % 2 === 0) sound.play('splash')
  }, [live.tick])
  useEffect(() => {
    if (live.hatched.some((h) => h.address === address)) {
      sound.play('sparkle')
      refresh()
    }
  }, [live.hatched, address, refresh])

  const updateDraft = useCallback((d: Draft) => {
    setDraft(d)
    if (!me?.duck) return
    if (saveT.current) clearTimeout(saveT.current)
    saveT.current = setTimeout(() => {
      saveDuck({ ...d, name: d.name.trim() || me.duck!.name }).then(() => refresh()).catch((e) => say(e.message))
    }, 350)
  }, [me, refresh, say])

  const keepDuck = async () => {
    setBusy(true)
    try {
      await saveDuck({ ...draft, name: draft.name.trim() })
      sound.play('quack')
      await refresh()
      say(`${draft.name} is ready to race`)
      setScreen(code && room ? 'lobby' : 'home')
    } catch (e) {
      say((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const payJoin = async (c: string) => {
    setBusy(true)
    try {
      const r = await pay({ kind: 'join_room', roomCode: c })
      if (!r) return
      if (me?.duck) {
        say(`${me.duck.name} is in the room`)
        setScreen('lobby')
      } else {
        setDraft(randomDuck())
        sound.play('shuffle')
        setScreen('hatch')
      }
    } catch {
      /* toast shown */
    } finally {
      setBusy(false)
    }
  }

  const openCode = (c: string) => {
    if (!/^WEK-[A-Z0-9]{3,6}$/.test(c)) return say('Room codes look like WEK-7Q2')
    setCode(c)
    setScreen('join')
  }

  const buyPart = async (typeId: number) => {
    setBusy(true)
    try {
      const r = await pay({ kind: 'buy_part', partTypeId: typeId })
      if (r && 'partTypeId' in r) {
        sound.play('sparkle')
        const m = await refresh()
        if (m?.duck) setDraft(draftOf(m.duck))
        if (garageFromLobby) {
          setLoadoutState(typeId)
          if (code) setLoadout(code, typeId).catch(() => undefined)
        }
        say(r.equipped ? 'Part equipped on your duck' : 'Part is yours · find it in My Duck')
      }
    } catch {
      /* toast shown */
    } finally {
      setBusy(false)
    }
  }

  const createRoom = async (f: { name: string; trackId: number; maxDucks: number; fillBots: boolean }) => {
    setBusy(true)
    try {
      const r = await pay({ kind: 'create_room', trackId: f.trackId, roomName: f.name, maxDucks: f.maxDucks, fillBots: f.fillBots })
      if (r && 'roomCode' in r && r.roomCode) {
        setCode(r.roomCode)
        setScreen('hosted')
      }
    } catch {
      /* toast shown */
    } finally {
      setBusy(false)
    }
  }

  const changeLoadout = (p: number | null) => {
    setLoadoutState(p)
    if (code) setLoadout(code, p).catch((e) => say(e.message))
  }

  const start = async () => {
    if (!code) return
    setStarting(true)
    try {
      await startRace(code)
    } catch (e) {
      say((e as Error).message)
    } finally {
      setStarting(false)
    }
  }

  // Race phases take over the phone while you are in the room
  const racing = inRoom && phase !== 'idle' && (screen === 'lobby' || screen === 'garage' || screen === 'myduck' || screen === 'home')
  const dark = racing && (phase === 'countdown' || phase === 'race' || phase === 'photo')
  // Back action (plan §6.1). None on the root screens and none while a race runs; Result has its own Home / Create new room.
  const leaveRoom = (to: Screen) => { setCode(null); setScreen(to) }
  const homeOrSplash: Screen = me?.duck ? 'home' : 'splash'
  let onBack: (() => void) | undefined
  if (ready && !racing) {
    if (screen === 'connect') onBack = () => setScreen('splash')
    else if (screen === 'join' || screen === 'hatch' || screen === 'hosted' || screen === 'lobby') onBack = () => leaveRoom(homeOrSplash)
    else if (screen === 'myduck' || screen === 'create') onBack = () => setScreen('home')
    else if (screen === 'garage') onBack = () => setScreen(garageFromLobby ? 'lobby' : 'myduck')
  }

  const navScreen = !racing && me?.duck && (screen === 'home' || screen === 'myduck' || (screen === 'garage' && !garageFromLobby)) ? (screen as 'home' | 'myduck' | 'garage') : null

  let body: React.ReactNode = null
  if (!ready) body = <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Dots /></div>
  else if (racing && live.grid && phase === 'countdown') body = <Countdown n={live.countdown} track={room!.track.name} laps={room!.track.laps} name={draft.name} />
  else if (racing && live.grid && phase === 'race') body = <RaceView room={room!} grid={live.grid} tick={live.tick} me={address} gap={live.blockGap} />
  else if (racing && phase === 'photo') body = <PhotoFinish />
  else if (racing && phase === 'result' && live.result) body = <Result result={live.result} settled={live.settled} hatched={live.hatched} me={address} duckName={me?.duck?.name || draft.name} trackName={room!.track.name} onHome={() => { live.reset(); leaveRoom('home') }} onNewRoom={() => { live.reset(); leaveRoom('create') }} />
  else if (screen === 'splash') body = <Splash invite={invite ? room : null} onStart={() => setScreen('connect')} />
  else if (screen === 'connect') body = <Connect />
  else if (screen === 'join' && room) body = <JoinTicket room={room} hasDuck={!!me?.duck} duckName={me?.duck?.name || ''} busy={busy} onPay={() => payJoin(room.code)} />
  else if (screen === 'join' && live.error) body = <Missing text={live.error} onBack={() => { setCode(null); setScreen(me?.duck ? 'home' : 'hatch') }} />
  else if (screen === 'hatch') body = <Hatch draft={draft} setDraft={setDraft} onShuffle={() => { setDraft(randomDuck()); sound.play('shuffle') }} onKeep={keepDuck} inRoom={!!(code && inRoom)} roomCode={code} busy={busy} />
  else if (screen === 'home' && me?.duck) body = <Home duck={me.duck} onOpenDuck={() => setScreen('myduck')} onJoinCode={openCode} onHost={() => setScreen('create')} />
  else if (screen === 'myduck') body = <MyDuck draft={draft} onChange={updateDraft} onGarage={() => { setGarageFromLobby(false); setScreen('garage') }} />
  else if (screen === 'garage') body = <Garage draft={draft} busy={busy} fromLobby={garageFromLobby} onBack={() => setScreen('lobby')} onBuy={(p) => buyPart(p.typeId)} onEquip={(id) => { updateDraft({ ...draft, equippedPartTypeId: id }); if (garageFromLobby) changeLoadout(id); say('Equipped') }} />
  else if (screen === 'create') body = tracks.length ? <CreateRoom busy={busy} onCreate={createRoom} /> : <Dots />
  else if (screen === 'hosted' && room) body = <Hosted code={room.code} name={room.name} summary={`${room.track.name} · ${room.maxDucks} ducks · bots ${room.fillBots ? 'on' : 'off'}`} onLobby={() => setScreen('lobby')} />
  else if (screen === 'lobby' && room) body = <Lobby room={room} me={address} loadout={loadout} onLoadout={changeLoadout} onGarage={() => { setGarageFromLobby(true); setScreen('garage') }} onStart={start} starting={starting} />
  else body = <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Dots /></div>

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', justifyContent: 'center', background: '#120B2E' }}>
      <div onPointerDown={() => sound.unlock()} style={{ position: 'relative', width: '100%', maxWidth: 440, height: '100dvh', maxHeight: 932, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: dark ? '#1E1446' : '#836EF9', color: dark ? '#fff' : '#1E1446' }}>
        <Header dark={dark} onWallet={() => setWalletOpen(true)} onBack={onBack} />
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>{body}</div>
        {navScreen && <BottomNav cur={navScreen} go={(s) => { setGarageFromLobby(false); setScreen(s) }} />}
        <Toast />
        <SignSheet />
        <WalletSheet open={walletOpen} onClose={() => setWalletOpen(false)} />
      </div>
    </main>
  )
}

function Missing({ text, onBack }: { text: string; onBack: () => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 32 }}>{text}</div>
      <button type="button" className="dw-btn" onClick={onBack} style={{ height: 50, padding: '0 18px', background: '#fff', border: '4px solid #000', borderRadius: 16, fontWeight: 900 }}>Back</button>
    </div>
  )
}
