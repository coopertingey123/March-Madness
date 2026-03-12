# March Madness Spread Wheel

Spin a wheel to assign Vegas spreads to 10 players each round. Each player gets 3 spreads per round (3 loops × 10 players). Track who covers and crown a winner.

## What it does

- **Players** – Add up to 10 players; order = wheel order (spin 1 → player 1, etc.).
- **Rounds** – Create a round and paste spreads (e.g. `Montana +16.5`, `Kansas -12.5`), one per line.
- **Wheel** – Pick a round, spin the wheel. Each spin assigns one spread to the next player and removes it from the wheel. After 30 spins (or when the round runs out of spreads), the round is complete.
- **Scoreboard** – See total points. Enter game results as **underdog score − favorite score**; the app marks covers and adds +1 for hits.

## Setup

1. **Create a Firebase project** at [console.firebase.google.com](https://console.firebase.google.com).
2. **Enable Firestore** (Database → Create database, start in test mode or set rules).
3. **Register a web app** in Project settings and copy the config object.
4. **Create `.env`** in the project root (see `.env.example`):

   ```
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

5. **Set your Firebase project** for CLI:

   ```bash
   npx firebase use your-firebase-project-id
   ```

   Or edit `.firebaserc` and set `"default"` to your project ID.

6. **Install and run**:

   ```bash
   npm install
   npm run dev
   ```

7. **Deploy** (hosting + Firestore rules and indexes):

   ```bash
   npm run build
   firebase deploy
   ```

   Your app will be at `https://your-project-id.web.app` (or the custom URL you set).

## Spread result rule

- **Result** = underdog score − favorite score.
- **Underdog spread** (e.g. Montana +16.5): covers when result > −16.5 (Montana loses by less than 16.5 or wins).
- **Favorite spread** (e.g. Kansas −12.5): covers when result < 12.5 (Kansas wins by more than 12.5).

Enter the single number “result” per game; the app computes cover and updates scores.

## Tech

- React 18, Vite, TypeScript
- Firebase Firestore (data), Firebase Hosting (app)
