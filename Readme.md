# Tab Rot

- Tabs you ignore slowly decay. Click them and they heal. That's it.

Tab Rot is a Chrome extension that makes tab neglect visible. The longer you leave a tab alone, the more it fades through soft visual stages. When you come back, it gently restores itself.

---

## Features

- **5 decay stages** — Fresh → Peach → Dusty Rose → Lavender (grainy) → Ash Gray
- **Healing animation** — smooth restoration when you click back
- **Survives restarts** — state stored by URL, so tabs stay decayed even after closing Chrome
- **Customizable** — change when decay starts (5 min to 1 week) and speed (0.5x to 4x)
- **Whitelist/Blacklist** — domains you want to protect or ignore
- **Non-invasive** — uses CSS filters + overlay, never touches page content

---

## How it works
- base = thresholdMinutes × speed
- elapsed = time since last visit (in minutes)
- stage = min(4, floor(elapsed / base))


Default settings (1 day threshold, 1x speed):

| Time since visit | Stage | What you see |
|------------------|-------|--------------|
| < 1 day | 0 | Fresh, normal |
| 1-2 days | 1 | Peach, slightly faded |
| 2-3 days | 2 | Dusty rose, softer |
| 3-4 days | 3 | Lavender + grain |
| > 4 days | 4 | Ash gray + slight blur |


---

## Author
Pramis Kunwar
