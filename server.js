/**
 * LAN CONSOLE CHAT — All-in-One Server
 * HTTPS + WebSocket + WebRTC Signaling
 *
 * RUN:   node server.js
 * SHARE: https://192.168.1.125:8765
 */

const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

const PORT = 8765;
const CERT_FILE = path.join(__dirname, "cert.pem");
const KEY_FILE = path.join(__dirname, "key.pem");

// ── Auto-generate self-signed cert if missing ──
function generateSelfSignedCert() {
  if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) return;
  
  console.log("🔐 Generating self-signed certificate...");
  const cmd = process.platform === "win32" ? "powershell" : "bash";
  const args = process.platform === "win32" 
    ? ["-NoProfile", "-Command", `openssl req -x509 -newkey rsa:2048 -keyout "${KEY_FILE}" -out "${CERT_FILE}" -days 365 -nodes -subj "/CN=localhost"`]
    : ["-c", `openssl req -x509 -newkey rsa:2048 -keyout "${KEY_FILE}" -out "${CERT_FILE}" -days 365 -nodes -subj "/CN=localhost"`];
  
  try {
    spawn(cmd, args, { stdio: "inherit" }).on("close", (code) => {
      if (code === 0) console.log("✅ Certificate created");
      else console.log("⚠️  Certificate generation failed. Using HTTP fallback.");
    });
  } catch(e) {
    console.log("⚠️  OpenSSL not found. Make sure it's installed or certificates are in place.");
  }
}

generateSelfSignedCert();

function getLANIPs() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const list of Object.values(ifaces))
    for (const i of list)
      if (i.family === "IPv4" && !i.internal) ips.push(i.address);
  return ips;
}

// ── HTTPS: serve index.html ──
let httpsServer;
try {
  httpsServer = https.createServer({
    cert: fs.readFileSync(CERT_FILE),
    key: fs.readFileSync(KEY_FILE)
  }, (req, res) => {
    fs.readFile(path.join(__dirname, "index.html"), (err, data) => {
      if (err) { res.writeHead(404); res.end("index.html not found"); return; }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(data);
    });
  });
} catch(e) {
  console.log("⚠️  HTTPS failed, falling back to HTTP");
  httpsServer = http.createServer((req, res) => {
    fs.readFile(path.join(__dirname, "index.html"), (err, data) => {
      if (err) { res.writeHead(404); res.end("index.html not found"); return; }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(data);
    });
  });
}

// ── WebSocket: chat + WebRTC signaling ──
const wss = new WebSocket.Server({ server: httpsServer });

const clients = new Map(); // ws -> { id, username, color }
const COLORS = ["#00ff88","#ff6b6b","#4ecdc4","#ffe66d","#a78bfa","#f97316","#06b6d4","#ec4899","#84cc16","#f59e0b"];
let colorIdx = 0;

// Store messages with reactions and pins
const messages = new Map(); // messageId -> { ...msgData, reactions: Map, pinnedBy: null }
const pinnedMessages = new Set(); // messageIds that are pinned

// ── Group Call Waiting Room ──
// groupCallId -> { hostId, callType, waitingRoom: Map(userId -> {username,color}) }
const activeGroupCalls = new Map();

const broadcast = (data, skip = null) => {
  const msg = JSON.stringify(data);
  let sent = 0;
  for (const [ws] of clients) {
    if (ws !== skip && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
      sent++;
    }
  }
  if (data.type === "MESSAGE" || data.type === "USER_JOINED" || data.type === "USER_LEFT") {
    console.log(`[📤] Broadcast "${data.type}" sent to ${sent}/${clients.size} clients`);
  }
};

const sendTo = (ws, data) =>
  ws && ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(data));

// Send to a specific user by their ID
const sendToId = (targetId, data) => {
  for (const [ws, info] of clients)
    if (info.id === targetId) { sendTo(ws, data); break; }
};

const getUsers = () =>
  Array.from(clients.values()).map(({ id, username, color }) => ({ id, username, color }));

wss.on("connection", (ws) => {
  const clientId = uuidv4();

  ws.on("message", (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    const sender = clients.get(ws);

    switch (msg.type) {

      case "JOIN": {
        const username = (msg.username || "anon").replace(/[^a-zA-Z0-9_\-\.]/g,"").slice(0,20) || "anon";
        const color = COLORS[colorIdx++ % COLORS.length];
        clients.set(ws, { id: clientId, username, color });
        sendTo(ws, { type:"WELCOME", id:clientId, username, color, onlineUsers:getUsers() });
        broadcast({ type:"USER_JOINED", id:clientId, username, color, timestamp:Date.now(), onlineUsers:getUsers() }, ws);
        console.log(`[+] ${username} — ${clients.size} online`);
        break;
      }

      case "MESSAGE": {
        if (!sender) return;
        const text = (msg.text || "").slice(0, 4000); if (!text.trim()) return;
        const msgId = uuidv4();
        const msgObj = { type:"MESSAGE", id:msgId, from:sender.id, username:sender.username, color:sender.color, text, timestamp:Date.now(), reactions: {} };
        
        // Extract mentions (@username) and notify mentioned users
        const mentions = text.match(/@[\w\-\.]+/g) || [];
        const mentionedUsernames = mentions.map(m => m.slice(1));
        msgObj.mentions = mentionedUsernames;
        
        // Send mention notifications
        mentionedUsernames.forEach(mentionedName => {
          for (const [ws, info] of clients) {
            if (info.username.toLowerCase() === mentionedName.toLowerCase()) {
              sendTo(ws, { 
                type: "MENTION_NOTIFY", 
                from: sender.id,
                fromUsername: sender.username,
                fromColor: sender.color,
                text: text.slice(0, 100),
                messageId: msgId
              });
              console.log(`[🔔] ${mentionedName} was mentioned by ${sender.username}`);
            }
          }
        });
        
        messages.set(msgId, msgObj);
        console.log(`[💬] ${sender.username}: ${text} (mentions: ${mentionedUsernames.join(',')}) → broadcasting to ${clients.size} clients`);
        broadcast(msgObj);
        break;
      }

      case "FILE": {
        if (!sender) return;
        if (!msg.data || msg.size > 10*1024*1024) { sendTo(ws, { type:"ERROR", text:"Max 10MB" }); return; }
        const ok = ["application/pdf","image/jpeg","image/png","image/gif","image/webp"];
        if (!ok.includes(msg.mimeType)) { sendTo(ws, { type:"ERROR", text:"PDF/images only" }); return; }
        broadcast({ type:"FILE", id:uuidv4(), from:sender.id, username:sender.username, color:sender.color, fileName:msg.fileName, mimeType:msg.mimeType, size:msg.size, data:msg.data, timestamp:Date.now() });
        break;
      }

      case "TYPING": {
        if (sender) broadcast({ type:"TYPING", username:sender.username, color:sender.color }, ws);
        break;
      }
      case "STOP_TYPING": {
        if (sender) broadcast({ type:"STOP_TYPING", username:sender.username }, ws);
        break;
      }

      // ── WebRTC Signaling — relay to specific peer ──
      // CALL_OFFER: caller → callee
      case "CALL_OFFER":
        if (sender) {
          console.log(`[📹] ${sender.username} calling ${msg.targetId}`);
          sendToId(msg.targetId, {
            type: "CALL_OFFER",
            from: sender.id,
            fromUsername: sender.username,
            fromColor: sender.color,
            offer: msg.offer,
            callType: msg.callType || "video", // "video" or "audio"
          });
        }
        break;

      // CALL_ANSWER: callee → caller
      case "CALL_ANSWER":
        if (sender) {
          sendToId(msg.targetId, {
            type: "CALL_ANSWER",
            from: sender.id,
            answer: msg.answer,
          });
        }
        break;

      // ICE_CANDIDATE: exchange ICE candidates between peers
      case "ICE_CANDIDATE":
        if (sender) {
          sendToId(msg.targetId, {
            type: "ICE_CANDIDATE",
            from: sender.id,
            candidate: msg.candidate,
          });
        }
        break;

      // CALL_REJECT / CALL_END
      case "CALL_REJECT":
      case "CALL_END":
        if (sender) {
          sendToId(msg.targetId, { type: msg.type, from: sender.id, fromUsername: sender.username });
        }
        break;

      // MESSAGE_REACTION: add/remove emoji reaction
      case "MESSAGE_REACTION":
        if (sender && messages.has(msg.messageId)) {
          const stored = messages.get(msg.messageId);
          if (!stored.reactions) stored.reactions = {};
          const key = `${msg.emoji}|${sender.id}`;
          if (msg.add) {
            stored.reactions[key] = { emoji: msg.emoji, userId: sender.id, username: sender.username };
          } else {
            delete stored.reactions[key];
          }
          broadcast({ type: "MESSAGE_REACTION_UPDATE", messageId: msg.messageId, reactions: stored.reactions });
        }
        break;

      // PIN_MESSAGE / UNPIN_MESSAGE
      case "PIN_MESSAGE":
        if (sender && messages.has(msg.messageId)) {
          pinnedMessages.add(msg.messageId);
          broadcast({ type: "PIN_UPDATE", messageId: msg.messageId, pinned: true });
        }
        break;

      case "UNPIN_MESSAGE":
        if (sender && messages.has(msg.messageId)) {
          pinnedMessages.delete(msg.messageId);
          broadcast({ type: "PIN_UPDATE", messageId: msg.messageId, pinned: false });
        }
        break;

      // ── Group Calls ──
      case "GROUP_CALL_INIT": {
        if (sender) {
          const gcId = uuidv4();
          // Register this group call with host info
          activeGroupCalls.set(gcId, {
            hostId: sender.id,
            callType: msg.callType,
            waitingRoom: new Map()
          });
          console.log(`[📹] ${sender.username} initiated group ${msg.callType} call [${gcId.slice(0,8)}]`);
          const invite = {
            type: "GROUP_CALL_INIT",
            groupCallId: gcId,
            from: sender.id,
            fromUsername: sender.username,
            color: sender.color,
            callType: msg.callType
          };
          const targetIds = Array.isArray(msg.targetIds) ? msg.targetIds : null;
          if (targetIds && targetIds.length) {
            targetIds.forEach(tid => sendToId(tid, invite));
          } else {
            broadcast(invite, ws);
          }
        }
        break;
      }

      // ── Waiting Room: user knocks to join ──
      case "GROUP_CALL_KNOCK": {
        if (sender && msg.groupCallId) {
          const gc = activeGroupCalls.get(msg.groupCallId);
          if (!gc) { sendTo(ws, { type:"ERROR", text:"Group call not found." }); break; }
          // Add to waiting room
          gc.waitingRoom.set(sender.id, { username: sender.username, color: sender.color });
          console.log(`[🚪] ${sender.username} is knocking on group call [${msg.groupCallId.slice(0,8)}]`);
          // Notify the HOST about the knock
          sendToId(gc.hostId, {
            type: "GROUP_CALL_KNOCK",
            groupCallId: msg.groupCallId,
            from: sender.id,
            fromUsername: sender.username,
            fromColor: sender.color
          });
          // Tell the knocker they are waiting
          sendTo(ws, { type: "GROUP_CALL_WAITING", groupCallId: msg.groupCallId, hostUsername: "" });
        }
        break;
      }

      // ── Host admits a user from waiting room ──
      case "GROUP_CALL_ADMIT": {
        if (sender && msg.groupCallId && msg.targetId) {
          const gc = activeGroupCalls.get(msg.groupCallId);
          if (!gc || gc.hostId !== sender.id) break;
          gc.waitingRoom.delete(msg.targetId);
          console.log(`[✅] ${sender.username} admitted ${msg.targetId} to group call`);
          // Tell admitted user they can join
          sendToId(msg.targetId, {
            type: "GROUP_CALL_ADMITTED",
            groupCallId: msg.groupCallId,
            callType: gc.callType,
            hostUsername: sender.username
          });
        }
        break;
      }

      // ── Host denies a user from waiting room ──
      case "GROUP_CALL_DENY": {
        if (sender && msg.groupCallId && msg.targetId) {
          const gc = activeGroupCalls.get(msg.groupCallId);
          if (!gc || gc.hostId !== sender.id) break;
          gc.waitingRoom.delete(msg.targetId);
          console.log(`[❌] ${sender.username} denied ${msg.targetId} from group call`);
          // Tell denied user
          sendToId(msg.targetId, {
            type: "GROUP_CALL_DENIED",
            groupCallId: msg.groupCallId,
            hostUsername: sender.username
          });
        }
        break;
      }

      case "GROUP_CALL_JOIN":
        if (sender) {
          console.log(`[+] ${sender.username} joined group call`);
          broadcast({
            type: "GROUP_CALL_MEMBER_JOINED",
            from: sender.id,
            fromUsername: sender.username,
            color: sender.color,
            callType: msg.callType
          });
        }
        break;

      case "GROUP_CALL_OFFER":
        if (sender) {
          sendToId(msg.targetId, {
            type: "GROUP_CALL_OFFER",
            from: sender.id,
            fromUsername: sender.username,
            fromColor: sender.color,
            offer: msg.offer
          });
        }
        break;

      case "GROUP_CALL_ANSWER":
        if (sender) {
          sendToId(msg.targetId, {
            type: "GROUP_CALL_ANSWER",
            from: sender.id,
            answer: msg.answer
          });
        }
        break;

      case "GROUP_ICE_CANDIDATE":
        if (sender) {
          sendToId(msg.targetId, {
            type: "GROUP_ICE_CANDIDATE",
            from: sender.id,
            candidate: msg.candidate
          });
        }
        break;

      case "GROUP_CALL_END":
        if (sender) {
          console.log(`[-] ${sender.username} ended group call`);
          // Clean up any active group calls hosted by this user
          for (const [gcId, gc] of activeGroupCalls) {
            if (gc.hostId === sender.id) {
              activeGroupCalls.delete(gcId);
              console.log(`[🗑] Removed group call room [${gcId.slice(0,8)}]`);
            }
          }
          broadcast({
            type: "GROUP_CALL_MEMBER_LEFT",
            from: sender.id,
            fromUsername: sender.username
          });
        }
        break;
    }
  });

  ws.on("close", () => {
    const u = clients.get(ws);
    if (u) {
      clients.delete(ws);
      broadcast({ type:"USER_LEFT", id:u.id, username:u.username, color:u.color, timestamp:Date.now(), onlineUsers:getUsers() });
      console.log(`[-] ${u.username} — ${clients.size} online`);
    }
  });

  ws.on("error", (e) => console.error("err:", e.message));
});

httpsServer.listen(PORT, "0.0.0.0", () => {
  const ips = getLANIPs();
  console.log(`
╔══════════════════════════════════════════╗
║     LAN CONSOLE CHAT — RUNNING ✅        ║
╠══════════════════════════════════════════╣
║  Share with ANYONE on same WiFi:         ║
${ips.map(ip => `║  👉  https://${ip}:${PORT}  `.padEnd(44)+"║").join("\n")}
╠══════════════════════════════════════════╣
║  ✅ Chat  ✅ Files  ✅ Video/Audio Calls  ║
╚══════════════════════════════════════════╝
`);
});