# TikTak — Challenge Arena

Frontend prototype for a premium TikTak/Tic-Tac-Toe money-challenge interface.

## Included
- Personal-key login demo
- Premium responsive gaming UI
- Player vs Master Bot
- Perfect-play Minimax bot
- Win/loss/game statistics
- Quit confirmation warning
- Quit records the unfinished challenge as a loss in the demo state
- Automatic board reset when all nine cells are filled without a winner
- Three-dot account menu
- Play for Money / Add Money / Withdraw / Settings interface
- Tally/payment placeholders
- Game-report payload prepared in JavaScript

## Important
This repository is intentionally frontend-only. The demo data in `data.js` is not secure and must not contain real customer information, bank information, balances, or personal keys.

A real deployment involving money should add a secure backend for:
- authentication
- player records
- authoritative game results
- payment verification
- withdrawals
- audit logs
- email delivery

Automatic email cannot be performed safely by browser-only JavaScript. `sendWinReport()` currently prepares a report and logs it to the console; connect it to a server/email service later.

Also obtain appropriate legal/regulatory advice before operating a real-money game in your jurisdiction.
