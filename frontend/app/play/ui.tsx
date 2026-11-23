'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from '@/contexts/SessionContext'
import { useRoomLive } from '@/lib/useRoomLive'
import { saveDuck } from '@/http/profile/profileApi'
import { startRace } from '@/http/rooms/roomsApi'
import { sound } from '@/lib/sound'
import { randomDuck, type Duck } from '@/lib/types'
import { Header, Toast, SignSheet, LimitSheet, WalletSheet, BottomNav } from '@/components/play/Shell'
import { Splash, Connect, Reconnect, SignInPrompt, JoinTicket, Hatch } from '@/components/play/Onboarding'
import { Home, MyDuck, Garage, CreateRoom, Hosted } from '@/components/play/Profile'
import { Lobby, Countdown, RaceView, RacePanel, PhotoFinish, Result } from '@/components/play/RaceScreens'
import { GridSlot } from '@/components/play/GridSlot'
import { Dots } from '@/components/ui/kit'
import { useWide } from '@/lib/useWide'

type Screen = 'splash' | 'connect' | 'join' | 'hatch' | 'home' | 'myduck' | 'garage' | 'create' | 'hosted' | 'lobby'
type Draft = Pick<Duck, 'name' | 'template' | 'bodyColor' | 'billColor' | 'cosmetics' | 'equippedPartTypeId'>

const draftOf = (duck: Duck | null | undefined): Draft => (duck ? { name: duck.name, template: duck.template, bodyColor: duck.bodyColor, billColor: duck.billColor, cosmetics: duck.cosmetics, equippedPartTypeId: duck.equippedPartTypeId } : randomDuck())

export function PlayPage({ entry }: { entry?: 'create' } = {}) {
  const params = useSearchParams()
  const invite = params.get('room')?.toUpperCase() || null
  const session = useSession()
  const wide = useWide()
  const { ready, me, walletState, pay, refresh, say, tracks } = session
  const [screen, setScreen] = useState<Screen>('splash')
  const [code, setCode] = useState<string | null>(invite)
  const [draft, setDraft] = useState<Draft>(() => randomDuck())
  const [busy, setBusy] = useState(false)
  const [walletOpen, setWalletOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const live = useRoomLive(code)
  const room = live.room
  const routed = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const address = me?.address || ''
  const afterLogin: Screen = entry === 'create' && !invite ? 'create' : 'home'
  const inRoom = !!room && !!address && room.players.some((player) => player.address === address)

  useEffect(() => {
    if (!ready || routed.current) return

    if (!me) return setScreen('splash')

    if (invite && room === null && !live.error) return

    routed.current = true
    setDraft(draftOf(me.duck))

    if (invite && room) setScreen(inRoom ? (me.duck ? 'lobby' : 'hatch') : 'join')
    else setScreen(me.duck ? afterLogin : 'hatch')
  }, [ready, me, invite, room, inRoom, live.error, afterLogin])

  useEffect(() => {
    if (screen === 'connect' && me) {
      routed.current = true
      setDraft(draftOf(me.duck))
      if (code && room) setScreen(inRoom ? (me.duck ? 'lobby' : 'hatch') : 'join')
      else setScreen(me.duck ? afterLogin : 'hatch')
    }

    if (me === null && ready && routed.current) {
      routed.current = false
      setScreen('splash')
    }
  }, [me, screen, code, room, inRoom, ready, afterLogin])

  useEffect(() => {
    const keepCreate = entry === 'create' && !code && ['splash', 'connect', 'hatch', 'create'].includes(screen)
    const desiredPath = code && ['join', 'lobby', 'hatch', 'hosted'].includes(screen) ? `/play?room=${code}` : keepCreate ? '/play/create' : '/play'
    if (typeof window !== 'undefined' && window.location.pathname + window.location.search !== desiredPath) window.history.replaceState(null, '', desiredPath)
  }, [code, screen, entry])

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
      const myRank = live.result.ranking.find((row) => row.address === address)?.rank ?? 99
      sound.play(myRank === 1 ? 'fanfare' : 'sting')
      sound.play('crowd')
      refresh()
    }

    prevPhase.current = phase
  }, [phase, live.result, address, refresh])
  useEffect(() => {
    if (live.tick && live.tick.b % 2 === 0) sound.play('splash')
  }, [live.tick])
  useEffect(() => {
    if (live.hatched.some((hatchedDuck) => hatchedDuck.address === address)) {
      sound.play('sparkle')
      refresh()
    }
  }, [live.hatched, address, refresh])

  const updateDraft = useCallback((nextDraft: Draft) => {
    setDraft(nextDraft)

    if (!me?.duck) return

    if (saveTimer.current) clearTimeout(saveTimer.current)

    saveTimer.current = setTimeout(() => {
      saveDuck({ ...nextDraft, name: nextDraft.name.trim() || me.duck!.name }).then(() => refresh()).catch((error) => say(error.message))
    }, 350)
  }, [me, refresh, say])

  const keepDuck = async () => {
    setBusy(true)
    try {
      await saveDuck({ ...draft, name: draft.name.trim() })
      sound.play('quack')
      await refresh()
      say(`${draft.name} is ready to race`)
      setScreen(code && room ? 'lobby' : afterLogin)
    } catch (error) {
      say((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const payJoin = async (roomCode: string) => {
    setBusy(true)
    try {
      const receipt = await pay({ kind: 'join_room', roomCode })

      if (!receipt) return

      if (me?.duck) {
        say(`${me.duck.name} is in the room`)
        setScreen('lobby')
      } else {
        setDraft(randomDuck())
        sound.play('shuffle')
        setScreen('hatch')
      }
    } catch {} finally {
      setBusy(false)
    }
  }

  const openCode = (roomCode: string) => {
    if (!/^WEK-[A-Z0-9]{3,6}$/.test(roomCode)) return say('Room codes look like WEK-7Q2')

    setCode(roomCode)
    setScreen('join')
  }

  const buyPart = async (typeId: number) => {
    setBusy(true)
    try {
      const receipt = await pay({ kind: 'buy_part', partTypeId: typeId })

      if (receipt && 'partTypeId' in receipt) {
        sound.play('sparkle')
        const refreshedMe = await refresh()

        if (refreshedMe?.duck) setDraft(draftOf(refreshedMe.duck))

        say(receipt.equipped ? 'Part equipped on your duck' : 'Part is yours · find it in My Duck')
      }
    } catch {} finally {
      setBusy(false)
    }
  }

  const createRoom = async (form: { name: string; trackId: number; maxDucks: number; fillBots: boolean }) => {
    setBusy(true)
    try {
      const receipt = await pay({ kind: 'create_room', trackId: form.trackId, roomName: form.name, maxDucks: form.maxDucks, fillBots: form.fillBots })

      if (receipt && 'roomCode' in receipt && receipt.roomCode) {
        setCode(receipt.roomCode)
        setScreen('hosted')
      }
    } catch {} finally {
      setBusy(false)
    }
  }

  const start = async () => {
    if (!code) return
    setStarting(true)
    try {
      await startRace(code)
    } catch (error) {
      say((error as Error).message)
    } finally {
      setStarting(false)
    }
  }

  const racing = inRoom && phase !== 'idle' && (screen === 'lobby' || screen === 'garage' || screen === 'myduck' || screen === 'home')
  const dark = racing && (phase === 'countdown' || phase === 'race' || phase === 'photo')
  const leaveRoom = (target: Screen) => {
    setCode(null)
    setScreen(target)
  }
  const homeOrSplash: Screen = me?.duck ? 'home' : 'splash'
  let onBack: (() => void) | undefined

  if (ready && !racing) {
    if (screen === 'connect') onBack = () => setScreen('splash')
    else if (screen === 'join' || screen === 'hatch' || screen === 'hosted' || screen === 'lobby') onBack = () => leaveRoom(homeOrSplash)
    else if (screen === 'myduck' || screen === 'create') onBack = () => setScreen('home')
    else if (screen === 'garage') onBack = () => setScreen('myduck')
  }

  const navScreen = !racing && me?.duck && (screen === 'home' || screen === 'myduck' || screen === 'garage') ? (screen as 'home' | 'myduck' | 'garage') : null

  let body: React.ReactNode = null

  if (!ready) body = <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Dots /></div>
  else if (racing && live.grid && phase === 'countdown') {
    const myIndex = live.grid.entrants.findIndex((entrant) => entrant.address === address)

    body = myIndex >= 0 ? <GridSlot entrants={live.grid.entrants} myIndex={myIndex} countdown={live.countdown} code={room!.code} /> : <Countdown secondsLeft={live.countdown} track={room!.track.name} laps={room!.track.laps} name={draft.name} />
  }
  else if (racing && live.grid && phase === 'race') body = <RaceView room={room!} grid={live.grid} tick={live.tick} myAddress={address} gap={live.blockGap} wide={wide} />
  else if (racing && phase === 'photo') body = <PhotoFinish />
  else if (racing && phase === 'result' && live.result) body = <Result result={live.result} settled={live.settled} hatched={live.hatched} myAddress={address} duckName={me?.duck?.name || draft.name} trackName={room!.track.name} onHome={() => { live.reset(); leaveRoom('home') }} onNewRoom={() => { live.reset(); leaveRoom('create') }} />
  else if (walletState === 'reconnect') body = <Reconnect />
  else if (walletState === 'needsSignIn') body = <SignInPrompt />
  else if (screen === 'splash') body = <Splash invite={invite ? room : null} onStart={() => setScreen('connect')} />
  else if (screen === 'connect') body = <Connect />
  else if (screen === 'join' && room) body = <JoinTicket room={room} hasDuck={!!me?.duck} duckName={me?.duck?.name || ''} busy={busy} onPay={() => payJoin(room.code)} />
  else if (screen === 'join' && live.error) body = <Missing text={live.error} onBack={() => { setCode(null); setScreen(me?.duck ? 'home' : 'hatch') }} />
  else if (screen === 'hatch') body = <Hatch draft={draft} setDraft={setDraft} onShuffle={() => { setDraft(randomDuck()); sound.play('shuffle') }} onKeep={keepDuck} inRoom={!!(code && inRoom)} roomCode={code} busy={busy} />
  else if (screen === 'home' && me?.duck) body = <Home duck={me.duck} onOpenDuck={() => setScreen('myduck')} onJoinCode={openCode} onHost={() => setScreen('create')} />
  else if (screen === 'myduck') body = <MyDuck draft={draft} onChange={updateDraft} onGarage={() => setScreen('garage')} />
  else if (screen === 'garage') body = <Garage draft={draft} busy={busy} onBuy={(part) => buyPart(part.typeId)} onEquip={(partTypeId) => { updateDraft({ ...draft, equippedPartTypeId: partTypeId }); say('Equipped for your next room') }} />
  else if (screen === 'create') body = tracks.length ? <CreateRoom busy={busy} onCreate={createRoom} /> : <Dots />
  else if (screen === 'hosted' && room) body = <Hosted code={room.code} name={room.name} summary={`${room.track.name} · ${room.maxDucks} ducks · bots ${room.fillBots ? 'on' : 'off'}`} onLobby={() => setScreen('lobby')} />
  else if (screen === 'lobby' && room) body = <Lobby room={room} myAddress={address} onStart={start} starting={starting} />
  else body = <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Dots /></div>

  const showSide = wide && !!me?.duck && walletState !== 'reconnect' && walletState !== 'needsSignIn' && !['splash', 'connect'].includes(screen)
  const racePanel = wide && racing && !!live.grid && (phase === 'race' || phase === 'photo')
  const columns = [showSide ? '240px' : '', 'minmax(0, 1fr)', racePanel ? '400px' : ''].filter(Boolean).join(' ')

  if (wide) {
    return (
      <main onPointerDown={() => sound.unlock()} style={{ position: 'relative', height: '100dvh', display: 'grid', gridTemplateColumns: columns, gridTemplateRows: '72px minmax(0, 1fr)', background: '#120B2E', color: '#fff', overflow: 'hidden' }}>
        <Header dark onWallet={() => setWalletOpen(true)} onBack={onBack} wide roomCode={room?.code ?? code} />
        {showSide && <BottomNav side locked={racing} current={navScreen} navigate={(target) => setScreen(target)} />}
        <div style={{ position: 'relative', minWidth: 0, minHeight: 0, display: 'flex', justifyContent: 'center', background: dark ? '#1E1446' : '#836EF9', color: dark ? '#fff' : '#1E1446' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: racing && phase === 'race' ? 'none' : 640, height: '100%' }}>{body}</div>
        </div>
        {racePanel && live.grid && <RacePanel grid={live.grid} tick={live.tick} myAddress={address} />}
        <Toast />
        <SignSheet />
        <LimitSheet />
        <WalletSheet open={walletOpen} onClose={() => setWalletOpen(false)} />
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', justifyContent: 'center', background: '#120B2E' }}>
      <div onPointerDown={() => sound.unlock()} style={{ position: 'relative', width: '100%', maxWidth: 440, height: '100dvh', maxHeight: 932, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: dark ? '#1E1446' : '#836EF9', color: dark ? '#fff' : '#1E1446' }}>
        <Header dark={dark} onWallet={() => setWalletOpen(true)} onBack={onBack} />
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>{body}</div>
        {navScreen && <BottomNav current={navScreen} navigate={(target) => setScreen(target)} />}
        <Toast />
        <SignSheet />
        <LimitSheet />
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
