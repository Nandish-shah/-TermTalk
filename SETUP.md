## 🔐 HTTPS Certificate Setup Required

**WebRTC (camera/microphone) requires HTTPS.** The server has been updated to use HTTPS automatically.

### Quick Start (One-Time Setup)

**Option 1: Automatic Setup (Recommended)**

```bash
cd d:\Lan-chat
npm install
node generate-cert.js
node server.js
```

**Option 2: Using npm script**

```bash
npm install
npm run setup
npm start
```

---

## What Changed?

✅ **server.js** — Now runs on HTTPS (not HTTP)  
✅ **index.html** — Updated to use WebSocket Secure (wss://)  
✅ **Error handling** — Better messages if camera/mic access fails  
✅ **Auto-certificate generation** — Will create self-signed cert on first run

---

## Certificate Details

- **Generated automatically** on first run
- **Self-signed certificate** (browser will show warning, but it's safe on LAN)
- **Valid for 365 days**
- **Files:** `cert.pem`, `key.pem` (auto-generated in the project folder)

---

## If Certificate Generation Fails

**Windows users without OpenSSL:**

1. Install OpenSSL: https://slproweb.com/products/Win32OpenSSL.html
2. Or install the certificate generator module: `npm install -g openssl`
3. Then run `node generate-cert.js`

---

## Connecting

After starting the server, connect via HTTPS:

```
https://192.168.1.125:8765
```

⚠️ Browser will show certificate warning (normal for self-signed certs) — click **"Proceed Anyway"**

---

## Troubleshooting

### "Could not access camera/mic" error?

1. ✅ Check you're using **https://** (not http://)
2. ✅ Grant camera/mic permissions in browser
3. ✅ Ensure camera/mic aren't in use by another app
4. ✅ Refresh the page (Ctrl+R)

### Certificate still missing after setup?

- Ensure OpenSSL is installed and accessible from command line
- Test: `openssl version` in terminal
- Or manually place `cert.pem` and `key.pem` in the project folder

---

✨ **That's it!** Video & audio calls should now work perfectly on your LAN.
