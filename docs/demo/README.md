# DuckWek demo video

| File | Format | Use |
|---|---|---|
| `duckwek-demo-vertical.mp4` | 1080×1920, 37.3 s, 30 fps, AAC audio | Instagram Reels, TikTok, X, LinkedIn |
| `duckwek-demo.mp4` | 1920×1080, 37.3 s, 30 fps, AAC audio | X, LinkedIn, README |
| `duckwek-demo-poster.png` | 1080×1920 | Thumbnail |

Both cuts carry the same baked music track. X and LinkedIn do not support adding audio in the composer, so the track is part of the file; Reels can still replace it with a native audio if desired.

**Music:** “Fluffing a Duck” by Kevin MacLeod (incompetech.com), licensed under Creative Commons BY. The credit is in the outro and must stay with the video.

## Storyboard

| Time | Scene |
|---|---|
| 0:00–0:08 | Phone: splash, Connect to play, Face ID / fingerprint, the one signature sheet, Sign |
| 0:08–0:13 | Phone: join the room, 0.10 USDC ticket |
| 0:13–0:18 | Phone: meet the duck, keep it, lobby |
| 0:18–0:24 | Phone: race, tap CHEER |
| 0:24–0:28 | Stage: the same race, pack per block, photo finish, winner |
| 0:28–0:33 | Phone: rank, soulbound title, duck hatched |
| 0:33–0:37 | Outro: no bet, only a ticket; "your duck is waiting"; duckwek-app.vercel.app |

The phone segment is the real app captured with Playwright at 390×844 and the device/passkey wallet. The stage segment is the same room on `/stage/WEK-6BG`; the phone result is from that race.

The source capture used Chrome CDP screencast for both the phone and the stage, aligned by event timestamps, and ffmpeg for the cuts, 0.8-second crossfades, captions and audio mix.
