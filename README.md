# Frontend - Roblox Studio Explorer

Interactive web interface for browsing and editing Roblox game scripts in real-time.

**Live Site:** https://robloxexplorer.vercel.app/  
**Repository:** https://github.com/FadhilAkbarC/roblox-sync-frontend  
**Current Version:** 2.0

## 🚀 Quick Start

```bash
npm install
npm start
# Opens at http://localhost:3000
```

## 📋 Features

- **Real-time Explorer** - Live Roblox game hierarchy
- **Code Editor** - View scripts with syntax highlighting
- **Responsive Design** - Mobile & tablet optimized
- **Live Search** - Quick script search
- **Connection Status** - Real-time server connection indicator
- **Keep-Alive** - Automatic connection health checks (15s)
- **Multi-transport** - WebSocket with HTTP polling fallback

## 🎨 User Interface

### Components

**Connection Status Bar**
- Shows "Connected", "Connecting", "Disconnected"
- Displays loading spinner while connecting
- "Check Connection" button to refresh

**Game Tree View**
- Collapsible hierarchy of game objects
- Chevron icons for expand/collapse
- Default: Children collapsed (performance)
- Click to toggle visibility

**Code Editor**
- Displays selected script content
- Syntax highlighting for Lua code
- Vertical & horizontal scrolling
- Color-coded keywords and APIs

**Statistics Panel**
- Connected clients count
- Total syncs performed
- Server uptime
- Status indicators

### Responsive Breakpoints

```css
Desktop:        1024px+ (full layout)
Tablet:         768px-1023px (compact)
Mobile:         640px-767px (stacked)
Small Mobile:   <640px (optimized)
```

## 🔌 Server Connection

### Configuration

Backend URL is hardcoded in `index.html` at line ~1265:

```javascript
const socket = io('https://roblox-sync-backend-production.up.railway.app/', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});
```

### Local Development

Change to local backend:

```javascript
const socket = io('http://localhost:3001/', {
  // ...
});
```

### Connection Flow

```
1. Page loads → Socket.IO initializes
2. Attempts WebSocket connection
3. Falls back to HTTP polling if needed
4. On connection: Requests initial data
5. Every 15s: Sends keep-alive ping
6. On disconnect: Shows status, retries
7. On reconnect: Re-requests data
```

## 📁 File Structure

```
frontend/
├── index.html              # Single-page application (all-in-one)
├── package.json            # Dependencies & metadata
├── package-lock.json       # Locked versions
├── .git/                   # Git repository
├── vercel.json             # Vercel deployment config
└── node_modules/           # Dependencies (not committed)
```

## 🧩 Code Organization (index.html)

### CSS Section (Lines 1-800)

```css
:root {
  /* Color variables */
  --primary: #3498db;
  --success: #2ecc71;
  --danger: #e74c3c;
  --text: #2c3e50;
  /* ... */
}

/* Responsive Grid Layout */
@media (max-width: 1024px) { /* Tablet */ }
@media (max-width: 768px) { /* Mobile */ }
@media (max-width: 640px) { /* Small Mobile */ }

/* Component Styles */
.connection-status { /* ... */ }
.tree-container { /* ... */ }
.code-editor { /* ... */ }
```

### HTML Structure (Lines 800-1100)

```html
<div class="container">
  <!-- Connection Status -->
  <div class="connection-status">
    <span id="status">Connecting...</span>
    <button id="check-connection">Check Connection</button>
  </div>

  <!-- Main Layout -->
  <div class="main-layout">
    <!-- Tree View -->
    <div class="tree-container">
      <div id="tree"></div>
    </div>

    <!-- Code Editor -->
    <div class="editor-container">
      <div id="code-editor"></div>
    </div>

    <!-- Statistics -->
    <div class="stats-panel">
      <div id="stats"></div>
    </div>
  </div>

  <!-- Loading Overlay -->
  <div id="loading-overlay" class="loading-overlay">
    <div class="spinner"></div>
    <p id="loading-message">Connecting to server...</p>
    <button id="overlay-check-connection">Check Connection</button>
  </div>
</div>
```

### JavaScript Logic (Lines 1100-end)

```javascript
// 1. Connection Management
- Socket.IO initialization
- Event listeners (connect, disconnect, reconnect)
- Keep-alive ping every 15s

// 2. Data Rendering
- buildTreeHTML() - Create tree structure
- renderStats() - Update statistics display
- displayScript() - Show selected script

// 3. User Interactions
- Tree expand/collapse toggle
- Script click selection
- Search/filter functionality

// 4. Syntax Highlighting
- highlightCode() - Lua keyword/API highlighting
- Color mapping for different token types

// 5. Responsive Behavior
- Window resize listener
- Mobile menu toggle
- Adaptive layouts
```

## 🎯 Key Functions

### Building Tree View

```javascript
function buildTreeHTML(hierarchy, level = 0, isExpanded = false) {
  // Recursively builds tree from game hierarchy
  // level 0 (root): expanded
  // level 1+: collapsed (default)
  // Returns HTML string with chevron icons
}
```

**Performance:** Collapsed children reduce DOM size initially

### Code Syntax Highlighting

```javascript
function highlightCode(code) {
  // Pattern matching for:
  // - Lua keywords (if, then, for, while, etc.)
  // - Roblox APIs (game, workspace, Instance, etc.)
  // - Strings (enclosed in quotes)
  // - Comments (-- prefix)
  // - Numbers (hex, decimal, scientific notation)
  
  return highlightedHTML;
}
```

**Supported Languages:** Lua (Roblox-focused)

### Connection Status

```javascript
socket.on('connect', () => {
  updateStatus('Connected ✓', 'connected');
  requestUpdate();
});

socket.on('disconnect', () => {
  updateStatus('Disconnected (reconnecting...)', 'disconnected');
});
```

## 📊 Statistics Display

Shows real-time metrics:

```json
{
  "clients_connected": 1,
  "total_syncs": 42,
  "server_uptime": "1h 30m",
  "last_update": "just now",
  "status": "✓ Connected"
}
```

## 🛠️ Development

### Local Setup

```bash
cd frontend
npm install
npm start
```

### Changing Backend URL

Edit `index.html` line ~1265:

```javascript
const socket = io('YOUR_BACKEND_URL_HERE', {
  // ...
});
```

### Adding Custom Styles

Edit CSS variables in `<style>` section:

```css
:root {
  --primary: #your-color;
  --success: #your-color;
  /* ... */
}
```

### Modifying Tree Icons

Search for chevron characters (`▼` and `▶`) and replace:

```javascript
// Currently:
expanded = '▼ '    // Black down triangle
collapsed = '▶ '   // Black right triangle

// Alternative:
expanded = '⌄ '    // Down arrow
collapsed = '› '   // Right arrow
```

## 🎨 Customization

### Colors

Edit CSS variables at line ~5:

```css
:root {
  --primary: #3498db;      /* Blue buttons */
  --success: #2ecc71;      /* Green status */
  --danger: #e74c3c;       /* Red errors */
  --text: #2c3e50;         /* Dark text */
  --bg: #ecf0f1;           /* Light background */
  --surface: #ffffff;      /* Card background */
}
```

### Fonts

Change in CSS:

```css
body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.code-editor {
  font-family: 'Courier New', monospace;
}
```

### Breakpoints

Mobile breakpoints (currently):

```css
1024px - Desktop/Tablet split
768px  - Tablet/Mobile split
640px  - Large/Small mobile split
```

Modify media queries to adjust.

## 📱 Mobile Optimization

### Touch Interactions

- Tap tree item to expand/collapse
- Tap script to view
- Swipe to navigate panels (if future feature added)

### Responsive Layout

- **Desktop:** Side-by-side (tree | editor | stats)
- **Tablet:** Stacked with smaller fonts
- **Mobile:** Single column, full width

### Performance

- Minimal animations on mobile
- Collapsed tree by default (fewer DOM elements)
- Lazy rendering for large hierarchies
- CSS `will-change` for scroll optimization

## 🚀 Deployment (Vercel)

### Prerequisites

1. GitHub account
2. Vercel account (https://vercel.com)
3. Connected GitHub repository

### Setup Steps

1. **Connect Repository**
   - Go to Vercel dashboard
   - Click "New Project"
   - Import `roblox-sync-frontend` repository

2. **Build Settings** (usually automatic)
   - Framework: None (static site)
   - Build command: (leave blank)
   - Output directory: . (root)

3. **Auto-Deploy**
   - Vercel automatically deploys on master branch push
   - Check deployment logs in dashboard

4. **Get Live URL**
   ```
   https://robloxexplorer.vercel.app/
   ```

### Verify Deployment

Visit https://robloxexplorer.vercel.app/ in browser

## 🔍 Debugging

### Browser DevTools

**Console:**
```javascript
// See connection status
console.log(socket.connected);

// Check server URL
console.log(socket.io.uri);

// Enable Socket.IO debug
localStorage.debug = 'socket.io-client:*';
location.reload();
```

**Network Tab:**
- Check WebSocket connection (`ws://` or `wss://`)
- Fall back to polling (`XHR` requests)
- Look for any failed requests

**Application Tab:**
- Check localStorage for debug settings
- Inspect DOM for tree structure

### Common Issues

**"Connecting to server" stuck:**
1. Check browser console for errors
2. Check backend is running (`/health` endpoint)
3. Verify correct backend URL in code
4. Try hard refresh (Ctrl+Shift+R)

**No scripts shown:**
1. Roblox Studio plugin must be running
2. Game must be loaded in Studio
3. Check backend `/api/current` endpoint

**Mobile layout broken:**
1. Check viewport meta tag exists
2. Verify CSS media queries
3. Test with browser dev tools device emulation

## 📊 Performance Tips

- Tree starts collapsed (reduces initial DOM)
- Code editor scrolling uses `will-change` optimization
- Syntax highlighting is debounced
- Images/assets are minimal (single page = fast)
- No external framework dependencies

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | Feb 8, 2026 | Mobile optimization, improved UX |
| 1.5 | Feb 7, 2026 | Enhanced syntax highlighting |
| 1.0 | Feb 6, 2026 | Initial release |

## 🎓 Learning Resources

- **Socket.IO Client:** https://socket.io/docs/v4/client-api/
- **Roblox API:** https://developer.roblox.com/
- **Lua:** https://www.lua.org/manual/5.1/

## 📚 Related Documentation

- [Main README](./README.md) - Project overview
- [Development Guide](./DEVELOPMENT.md) - Full setup guide
- [Architecture](./ARCHITECTURE.md) - Technical design

## 🤝 Contributing

1. Clone repository
2. Create feature branch
3. Make changes in `index.html`
4. Test locally
5. Commit with descriptive message
6. Push to master branch
7. Vercel auto-deploys

## 📞 Support

**Issues & Questions:** Open issue on [GitHub](https://github.com/FadhilAkbarC/roblox-sync-frontend/issues)

---

**Maintained by:** [@FadhilAkbarC](https://github.com/FadhilAkbarC)
