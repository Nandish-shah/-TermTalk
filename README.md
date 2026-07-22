# LAN//CHAT — Console

Real-time office chat that runs entirely on your local network.
Console/terminal aesthetic. No internet required. No accounts.

---

## 🚀 Quick Start

### 1. Install Node.js (if not already installed)
Download from https://nodejs.org (v16 or newer)

### 2. Install dependencies
```bash
npm install
```

### 3. Start the server (ONE person does this — the "host")
```bash
node server.js
```
The server will print your LAN IP(s), for example:
```
  ws://192.168.1.10:8765
```

### 4. Share the files with your team
Give everyone `index.html` (just the single file, no server needed on their end).
OR serve it:
```bash
npx serve .
# then share: http://192.168.1.10:3000
```

### 5. Everyone opens index.html in their browser
- Enter the host's LAN IP (e.g. `192.168.1.10`)
- Enter a username
- Click CONNECT

---

## ✅ Features
- Real-time text chat (WebSocket over TCP)
- Each user gets a unique color identity
- "X joined / left" system messages
- Typing indicator
- Send images (JPG/PNG/GIF/WEBP) up to 10MB
- Send PDFs up to 10MB
- Image lightbox preview
- Online user list in sidebar
- Username saved in localStorage

## 🔧 Technical Stack
| Layer       | Technology                    |
|-------------|-------------------------------|
| Transport   | TCP (WebSocket protocol)      |
| Server      | Node.js + `ws` library        |
| Client      | Vanilla HTML/CSS/JS           |
| File xfer   | Base64 over WebSocket         |

## ⚠️ Requirements
- All users must be on the **same WiFi/LAN network**
- Server machine's firewall must allow port **8765**
- Node.js v16+

## 🔒 Firewall Note (Windows)
If others can't connect, allow port 8765:
```
Windows Defender Firewall → Allow an app → 
New Rule → Port → TCP → 8765 → Allow
```
On Linux/Mac, usually no action needed.
