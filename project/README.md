# Rocket League Central

A full-stack video sharing platform for Rocket League clips with Discord OAuth login.

## Quick Start

1. **Clone/Download** project
2. **Setup Discord App** (see Discord Setup)
3. **Copy .env.example to .env** and fill values
4. **Install dependencies**:
   ```
   cd project
   npm install
   ```
5. **Start MongoDB** (local or MongoDB Atlas)
6. **Start backend**:
   ```
   npm run dev
   ```
7. **Start frontend** (in new terminal):
   ```
   cd frontend
   python -m http.server 3000
   ```
8. **Open** http://localhost:3000/Home.html

## Discord Setup (FIX FOR INVALID URL)\n\n1. Go to https://discord.com/developers/applications\n2. Create new application → **Name: RL Central**\n3. OAuth2 → **General**\n4. **Redirects ADD BOTH**:\n   • `http://localhost:5000/auth/discord/callback`\n   • `http://localhost:5000/auth/discord/callback`\n5. **Copy Client ID & Client Secret to .env**\n\n## Quick Start\n\n1. Copy `.env.example` → `.env` **FILL ALL VALUES**\n2. Start **MongoDB** (`mongod` local or Atlas URL)\n3. Backend: `cd project/backend && node server.js`\n4. Frontend: `cd project/frontend && python -m http.server 3000`\n5. Open http://localhost:3000/Home.html\n\n**Guest login works without Discord!**

## MongoDB Setup

- Local: Install MongoDB, run `mongod`
- Atlas: Create free cluster, get connection string

## .env Example

```
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_secret
DISCORD_CALLBACK_URL=http://localhost:5000/auth/discord/callback
SESSION_SECRET=your_session_secret
MONGO_URI=mongodb://localhost:27017/rocketleague
PORT=5000
```

## Features

- Discord OAuth login
- Upload/watch clips
- Profiles, likes, comments
- Trending, search
- Modern dark UI with TailwindCSS

## Folder Structure

```
project/
├── frontend/     # Static HTML/CSS/JS
├── backend/      # Node.js/Express API
├── uploads/      # Videos & thumbnails
├── package.json
└── README.md
```

