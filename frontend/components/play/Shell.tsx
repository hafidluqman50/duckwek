'use client'

import { useState } from 'react'
import { useWide } from '@/lib/useWide'
import { useSession } from '@/contexts/SessionContext'
import { sound } from '@/lib/sound'
import { shortenAddress, explorerTransactionUrl, formatUsdc, isValidSessionTerms, DEFAULT_SESSION_TERMS, type SessionTerms } from '@/lib/config'
import { Button } from '@/components/ui/kit'
import { LimitPicker } from '@/components/play/Onboarding'

export function SoundButton({ dark }: { dark?: boolean }) {
  const [, forceRender] = useState(0)
  const on = sound.sfxOn || sound.musicOn

  return (
    <button
      type="button"
      className="dw-btn"
      aria-label={on ? 'Mute sound' : 'Turn sound on'}
      aria-pressed={on}
      onClick={() => {
        const next = !on

        if (sound.sfxOn !== next) sound.toggleSfx()

        if (sound.musicOn !== next) sound.toggleMusic()

        sound.unlock()
        forceRender((renderCount) => renderCount + 1)
      }}
      style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: dark ? '#2A1D5E' : '#fff', border: '3px solid #000', borderRadius: '50%', boxShadow: '0 4px 0 #000', padding: 0 }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <path d="M3 9 H7 L12 5 V19 L7 15 H3 Z" fill={dark ? '#fff' : '#1E1446'} stroke="#000" strokeWidth="1.5" strokeLinejoin="round" />
        {on ? <path d="M15.5 8.5 Q18 12 15.5 15.5 M18 6 Q22 12 18 18" fill="none" stroke={dark ? '#fff' : '#1E1446'} strokeWidth="2.2" strokeLinecap="round" /> : <path d="M15 8 L21 16 M21 8 L15 16" stroke="#F25F5C" strokeWidth="2.6" strokeLinecap="round" />}
      </svg>
    </button>
  )
}

export function BackButton({ onBack, dark }: { onBack: () => void; dark?: boolean }) {
  return (
    <button
      type="button"
      className="dw-btn"
      aria-label="Back"
      onClick={onBack}
      style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: dark ? '#2A1D5E' : '#fff', border: '3px solid #000', borderRadius: '50%', boxShadow: '0 4px 0 #000', padding: 0 }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <path d="M15 5 L8 12 L15 19" fill="none" stroke={dark ? '#fff' : '#1E1446'} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

export function Header({ dark, onWallet, onBack, wide, roomCode }: { dark?: boolean; onWallet: () => void; onBack?: () => void; wide?: boolean; roomCode?: string | null }) {
  const { me, walletState, walletAddress, openWalletModal, signOut } = useSession()

  return (
    <div style={wide ? { flex: 'none', gridColumn: '1 / -1', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: '#1E1446', borderBottom: '4px solid #000' } : { flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {onBack && <BackButton onBack={onBack} dark={dark} />}
        <div className="stroke-sm" style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: '#FFC93C' }}>DUCKWEK</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: wide ? 10 : 8 }}>
        {wide && roomCode && <span style={{ padding: '6px 14px', border: '3px solid #000', borderRadius: 999, background: '#FFC93C', color: '#1E1446', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{roomCode}</span>}
        <SoundButton dark={dark} />
        {walletState === 'none' && <HeaderButton dark={dark} label="Connect wallet" onClick={openWalletModal} />}
        {walletState === 'reconnect' && <HeaderButton dark={dark} label="Reconnect" onClick={openWalletModal} />}
        {walletState === 'needsSignIn' && walletAddress && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 800, color: dark ? '#C9B8FF' : '#1E1446' }}>{shortenAddress(walletAddress)}</span>}
        {walletState === 'needsSignIn' && <HeaderButton dark={dark} label="Disconnect" onClick={signOut} />}
        {me && (
          <button type="button" className="dw-btn" onClick={onWallet} aria-label="Open wallet" style={{ height: 40, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px 0 6px', background: '#1E1446', color: '#fff', border: '3px solid #000', borderRadius: 999, boxShadow: '0 4px 0 #000' }}>
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: me.duck?.bodyColor || '#FFC93C', border: '2px solid #000' }} />
            <span style={{ fontSize: 14, fontWeight: 900, color: '#FFC93C', whiteSpace: 'nowrap' }}>{formatUsdc(me.usdc)} USDC</span>
          </button>
        )}
      </div>
    </div>
  )
}

function HeaderButton({ label, onClick, dark }: { label: string; onClick: () => void; dark?: boolean }) {
  return (
    <button type="button" className="dw-btn" onClick={onClick} style={{ height: 40, padding: '0 14px', display: 'flex', alignItems: 'center', background: dark ? '#2A1D5E' : '#fff', color: dark ? '#FFC93C' : '#1E1446', border: '3px solid #000', borderRadius: 999, fontSize: 14, fontWeight: 900, whiteSpace: 'nowrap' }}>{label}</button>
  )
}

export function Toast() {
  const { toast } = useSession()
  if (!toast) return null

  return (
    <div role="status" className="anim-drop" style={{ position: 'absolute', left: 16, right: 16, top: 66, zIndex: 80, padding: '12px 14px', background: '#fff', color: '#1E1446', border: '4px solid #000', borderRadius: 16, boxShadow: '0 6px 0 #000', fontSize: 15, fontWeight: 900, textAlign: 'center' }}>
      {toast}
    </div>
  )
}

export function SignSheet() {
  const { sheet, confirmSheet, cancelSheet } = useSession()
  const wide = useWide()

  if (!sheet) return null

  return (
    <div className="anim-fade" style={{ position: 'absolute', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', justifyContent: wide ? 'center' : 'flex-end', alignItems: wide ? 'center' : 'stretch' }}>
      <div role="dialog" aria-label="Signature request" className="anim-sheet" style={{ background: '#15102E', color: '#fff', ...(wide ? { border: '4px solid #000', borderRadius: 26, width: 440, maxWidth: '90vw' } : { borderTop: '4px solid #000', borderRadius: '26px 26px 0 0' }), padding: '18px 18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, border: '3px solid #000', background: '#FFC93C', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1E1446', fontWeight: 900 }}>{sheet.walletLabel.charAt(0)}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>Signature request</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#C9B8FF' }}>{sheet.walletLabel} · no gas, no MON</div>
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, lineHeight: 1.05 }}>{sheet.title}</div>
        <div style={{ background: '#221A47', borderRadius: 16, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13, fontWeight: 700 }}>
          {sheet.rows.map((row) => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ color: '#C9B8FF' }}>{row.label}</span>
              <span style={{ textAlign: 'right' }}>{row.value}</span>
            </div>
          ))}
        </div>
        {sheet.status === 'review' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <Button tone="deep" height={54} fontSize={16} shadow={false} onClick={cancelSheet} style={{ flex: 1, border: '3px solid #000' }}>Cancel</Button>
            <Button height={54} fontSize={17} onClick={() => { sound.play('tap'); confirmSheet() }} style={{ flex: 2, border: '3px solid #000' }}>Sign</Button>
          </div>
        )}
        {sheet.status === 'pending' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="anim-blink" style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900 }}>{sheet.pendingLabel}</div>
            <Button tone="deep" height={48} fontSize={15} shadow={false} onClick={cancelSheet} style={{ border: '3px solid #000' }}>Cancel</Button>
          </div>
        )}
        {sheet.status === 'done' && (
          <div className="anim-pop" style={{ textAlign: 'center', padding: '6px 0' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#B8F35A' }}>{sheet.doneLabel}</div>
            {sheet.tx && <a href={explorerTransactionUrl(sheet.tx)} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#FFC93C' }}>{shortenAddress(sheet.tx)} · view</a>}
          </div>
        )}
      </div>
    </div>
  )
}

function LimitSheetContent() {
  const { me, closeLimitSheet, changeLimit } = useSession()
  const wide = useWide()
  const [terms, setTerms] = useState<SessionTerms>(me?.session ? { ...DEFAULT_SESSION_TERMS, limit: BigInt(me.session.limit) } : DEFAULT_SESSION_TERMS)

  return (
    <div className="anim-fade" style={{ position: 'absolute', inset: 0, zIndex: 88, background: 'rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', justifyContent: wide ? 'center' : 'flex-end', alignItems: wide ? 'center' : 'stretch' }} onClick={closeLimitSheet}>
      <div role="dialog" aria-label="Change spending limit" className="anim-sheet" onClick={(event) => event.stopPropagation()} style={{ background: '#fff', color: '#1E1446', ...(wide ? { border: '4px solid #000', borderRadius: 26, width: 440, maxWidth: '90vw' } : { borderTop: '4px solid #000', borderRadius: '26px 26px 0 0' }), padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, lineHeight: 1.05 }}>Change spending limit</div>
        {me?.session && <div style={{ fontSize: 13, fontWeight: 800 }}>Used {formatUsdc(me.session.spent)} of {formatUsdc(me.session.limit)} USDC in this session.</div>}
        <LimitPicker terms={terms} onChange={setTerms} />
        <div style={{ fontSize: 12, fontWeight: 700 }}>You sign once. The new limit replaces the old one: it is the amount you can spend from now on, and the session time counts from now.</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button tone="deep" height={54} fontSize={16} shadow={false} onClick={closeLimitSheet} style={{ flex: 1, border: '3px solid #000' }}>Cancel</Button>
          <Button height={54} fontSize={17} disabled={!isValidSessionTerms(terms)} onClick={() => changeLimit(terms)} style={{ flex: 2, border: '3px solid #000' }}>Sign new limit</Button>
        </div>
      </div>
    </div>
  )
}

export function LimitSheet() {
  const { limitSheetOpen, me } = useSession()

  if (!limitSheetOpen || !me) return null

  return <LimitSheetContent />
}

export function WalletSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, signerKind, signerLabel, withdraw, signOut, openLimitSheet } = useSession()
  const wide = useWide()

  if (!open || !me) return null

  return (
    <div className="anim-fade" style={{ position: 'absolute', inset: 0, zIndex: 85, background: 'rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', justifyContent: wide ? 'center' : 'flex-end', alignItems: wide ? 'center' : 'stretch' }} onClick={onClose}>
      <div role="dialog" aria-label="Your wallet" className="anim-sheet" onClick={(event) => event.stopPropagation()} style={{ background: '#fff', color: '#1E1446', ...(wide ? { border: '4px solid #000', borderRadius: 26, width: 440, maxWidth: '90vw' } : { borderTop: '4px solid #000', borderRadius: '26px 26px 0 0' }), padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2, color: '#5B4AB8' }}>{(signerLabel || 'WALLET').toUpperCase()} · MONAD</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ width: 36, height: 36, border: '3px solid #000', borderRadius: '50%', background: '#fff', fontSize: 18, fontWeight: 900 }}>×</button>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, wordBreak: 'break-all' }}>{me.address}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, border: '3px solid #000', borderRadius: 14, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, color: '#5B4AB8' }}>WALLET</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 30 }}>{formatUsdc(me.usdc)}</div>
            <div style={{ fontSize: 11, fontWeight: 800 }}>USDC</div>
          </div>
          <div style={{ flex: 1, border: '3px solid #000', borderRadius: 14, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, color: '#5B4AB8' }}>EARNINGS</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 30 }}>{formatUsdc(me.earnings)}</div>
            <div style={{ fontSize: 11, fontWeight: 800 }}>from your parts & tracks</div>
          </div>
        </div>
        {me.session && (
          <div style={{ border: '3px solid #000', borderRadius: 14, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, color: '#5B4AB8' }}>SPENDING LIMIT</div>
              <div style={{ fontSize: 16, fontWeight: 900 }}>{formatUsdc(me.session.spent)} of {formatUsdc(me.session.limit)} USDC used</div>
              <div style={{ fontSize: 11, fontWeight: 800 }}>Ends {new Date(Number(me.session.deadline) * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <Button height={40} fontSize={13} onClick={() => { onClose(); openLimitSheet() }} style={{ border: '3px solid #000', boxShadow: '0 3px 0 #000', paddingInline: 12 }}>Change limit</Button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button height={44} fontSize={14} disabled={Number(me.earnings) <= 0} onClick={() => { onClose(); withdraw() }} style={{ flex: 1, border: '3px solid #000', boxShadow: '0 4px 0 #000' }}>Withdraw earnings</Button>
        </div>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2 }}>ACTIVITY</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflow: 'auto' }}>
          {me.activity.length === 0 && <div style={{ fontSize: 13, fontWeight: 700, color: '#5B4AB8' }}>Nothing yet.</div>}
          {me.activity.map((entry, index) => (
            <a key={index} href={explorerTransactionUrl(entry.tx)} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '3px solid #000', borderRadius: 14, color: '#1E1446', textDecoration: 'none' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 900 }}>{entry.label}{entry.status === 'failed' ? ' · failed' : ''}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#5B4AB8' }}>{shortenAddress(entry.tx)}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 900, color: entry.kind === 'withdraw' ? '#2E7D32' : '#1E1446' }}>{entry.kind === 'withdraw' ? '+' : '−'}{formatUsdc(entry.amount)} USDC</div>
            </a>
          ))}
        </div>
        <button type="button" onClick={() => { onClose(); signOut() }} style={{ height: 32, background: 'none', border: 'none', color: '#1E1446', fontSize: 13, fontWeight: 800, textDecoration: 'underline' }}>{signerKind === 'wallet' ? 'Disconnect wallet' : 'Sign out'}</button>
      </div>
    </div>
  )
}

export function BottomNav({ current, navigate, side, locked }: { current: 'home' | 'myduck' | 'garage' | null; navigate: (target: 'home' | 'myduck' | 'garage') => void; side?: boolean; locked?: boolean }) {
  const items: [string, string, 'home' | 'myduck' | 'garage'][] = [['Home', 'rooms', 'home'], ['My Duck', 'parts & look', 'myduck'], ['Garage', 'shop', 'garage']]
  return (
    <nav aria-label="Main" style={side ? { display: 'flex', flexDirection: 'column', gap: 10, padding: '20px 16px', background: '#1E1446', borderRight: '4px solid #000', boxSizing: 'border-box' } : { flex: 'none', display: 'flex', gap: 6, padding: '8px 12px 14px', background: '#1E1446', borderTop: '4px solid #000' }}>
      {items.map(([label, subtitle, screenId]) => {
        const on = current === screenId

        return (
          <button key={screenId} type="button" className="dw-btn" disabled={locked} onClick={() => navigate(screenId)} aria-current={on ? 'page' : undefined} style={side ? { height: 64, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: '0 16px', gap: 2, background: on ? '#FFC93C' : '#2A1D5E', color: on ? '#1E1446' : '#fff', border: '3px solid #000', borderRadius: 16, boxShadow: on ? '0 4px 0 #000' : 'none' } : { flex: 1, height: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, background: on ? '#FFC93C' : '#2A1D5E', color: on ? '#1E1446' : '#fff', border: '3px solid #000', borderRadius: 14 }}>
            <span style={{ fontSize: side ? 17 : 15, fontWeight: 900, lineHeight: 1 }}>{label}</span>
            <span style={{ fontSize: side ? 12 : 10, fontWeight: 800, lineHeight: 1, opacity: 0.8 }}>{subtitle}</span>
          </button>
        )
      })}
      {side && <div style={{ flex: 1 }} />}
      {side && locked && <div style={{ fontSize: 12, fontWeight: 800, color: '#C9B8FF', lineHeight: 1.4 }}>Nav is locked while a race runs.</div>}
    </nav>
  )
}
