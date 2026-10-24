'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Page() {
  const [code, setCode] = useState('')
  const router = useRouter()
  return (
    <main style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1E1446' }}>
      <form onSubmit={(e) => { e.preventDefault(); if (code) router.push(`/stage/${code.toUpperCase()}`) }} style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
        <div className="stroke-title" style={{ fontFamily: 'var(--font-display)', fontSize: 64, color: '#FFC93C' }}>DUCKWEK STAGE</div>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WEK-7Q2" aria-label="Room code" style={{ height: 70, width: 320, textAlign: 'center', border: '5px solid #000', borderRadius: 20, fontFamily: 'var(--font-mono)', fontSize: 34, fontWeight: 700 }} />
        <button type="submit" className="dw-btn" style={{ height: 64, padding: '0 30px', background: '#FFC93C', border: '5px solid #000', borderRadius: 20, boxShadow: '0 6px 0 #000', fontSize: 24, fontWeight: 900 }}>Open projector</button>
      </form>
    </main>
  )
}
