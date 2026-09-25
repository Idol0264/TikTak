(() => {
  "use strict";
  const DATA = window.TT_DATA || {users:{},payment:{entry:50}};
  const $ = id => document.getElementById(id);
  let user = null, board = Array(9).fill(""), active = false, botThinking = false, roundWinner = null;

  const loginView=$("loginView"), gameView=$("gameView"), accountView=$("accountView");
  const boardEl=$("board"), statusEl=$("status"), menu=$("menu"), modal=$("modal");

  function money(n){ return "₦" + Number(n||0).toLocaleString("en-NG"); }
  function show(el){el.classList.remove("hidden")} function hide(el){el.classList.add("hidden")}

  function login(){
    const key=$("keyInput").value.trim().toUpperCase();
    user=DATA.users[key];
    if(!user){$("loginMsg").textContent="Personal key not recognised.";return}
    $("loginMsg").textContent="";
    $("playerName").textContent=user.name.split(" ")[0];
    $("wins").textContent=user.wins;$("losses").textContent=user.losses;
    $("statWins").textContent=user.wins;$("statLosses").textContent=user.losses;
    $("games").textContent=user.games;$("winnings").textContent=money(user.winnings);
    hide(loginView);show(gameView);newChallenge();
  }

  function render(){
    boardEl.innerHTML="";
    board.forEach((v,i)=>{
      const b=document.createElement("button"); b.className="cell "+(v==="X"?"x ":"")+(v==="O"?"o":"");
      b.textContent=v; b.disabled=!!v||!active||botThinking||!!roundWinner;
      b.setAttribute("aria-label",`Block ${i+1}${v?": "+v:" empty"}`);
      b.addEventListener("click",()=>playerMove(i)); boardEl.appendChild(b);
    });
  }

  function lines(){return [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]}
  function winner(b){
    for(const line of lines()){const [a,c,d]=line;if(b[a]&&b[a]===b[c]&&b[a]===b[d])return {mark:b[a],line}}
    return null;
  }

  // Perfect-play Minimax bot for standard 3x3 Tic-Tac-Toe.
  function minimax(b, maximizing, depth=0){
    const w=winner(b); if(w)return w.mark==="O"?10-depth:depth-10;
    if(b.every(Boolean))return 0;
    const scores=[];
    for(let i=0;i<9;i++)if(!b[i]){
      b[i]=maximizing?"O":"X";
      scores.push({i,score:minimax(b,!maximizing,depth+1)});
      b[i]="";
    }
    return maximizing?Math.max(...scores.map(x=>x.score)):Math.min(...scores.map(x=>x.score));
  }
  function botMove(){
    const moves=[];
    for(let i=0;i<9;i++)if(!board[i]){
      board[i]="O"; const score=minimax(board,false); board[i]="";
      moves.push({i,score});
    }
    const best=Math.max(...moves.map(m=>m.score));
    const candidates=moves.filter(m=>m.score===best);
    return candidates[Math.floor(Math.random()*candidates.length)].i;
  }

  function playerMove(i){
    if(!active||botThinking||board[i]||roundWinner)return;
    board[i]="X"; render(); finishOrContinue("X");
    if(!active||roundWinner)return;
    botThinking=true; statusEl.textContent="Master Bot is thinking…"; render();
    setTimeout(()=>{if(!active)return;const m=botMove();board[m]="O";botThinking=false;render();finishOrContinue("O");},420);
  }

  function finishOrContinue(mark){
    const w=winner(board);
    if(w){roundWinner=w.mark;active=false;w.line.forEach(i=>boardEl.children[i].classList.add("win"));render();endMatch(w.mark);return}
    if(board.every(Boolean)){
      statusEl.textContent="Full board — resetting for the next round…";
      setTimeout(()=>{if(!roundWinner){board=Array(9).fill("");statusEl.textContent="Your turn";render()}},850);
    } else statusEl.textContent=mark==="X"?"Master Bot's turn":"Your turn";
  }

  function endMatch(mark){
    user.games++;
    if(mark==="X"){user.wins++;user.winnings+=100;statusEl.textContent="YOU WIN — challenge completed";sendWinReport("WIN",100);}
    else {user.losses++;statusEl.textContent="MASTER BOT WINS — challenge completed";sendWinReport("LOSS",0);}
    updateStats();
  }

  function sendWinReport(result, amount){
    // Frontend-only notification hook. A real automatic email requires a server/email service.
    const id="TT-"+Date.now().toString(36).toUpperCase();
    const report={gameId:id,player:user.name,result,stake:50,amount,time:new Date().toISOString()};
    console.info("GAME REPORT — connect this payload to your email service/backend:",report);
    if(result==="WIN"){
      $("paymentNotice").textContent=`Win recorded (${id}). The payout report is ready for manual verification.`;
      show($("paymentNotice"));
    }
  }

  function updateStats(){
    $("wins").textContent=user.wins;$("losses").textContent=user.losses;$("statWins").textContent=user.wins;$("statLosses").textContent=user.losses;$("games").textContent=user.games;$("winnings").textContent=money(user.winnings);
  }

  function newChallenge(){board=Array(9).fill("");active=true;botThinking=false;roundWinner=null;statusEl.textContent="Your turn";hide($("paymentNotice"));render()}
  function quitChallenge(){
    if(!active||roundWinner)return;
    openModal("Quit challenge?","If you quit an unfinished money challenge, the ₦50 challenge stake is treated as lost according to the challenge rule. Are you sure you want to quit?",()=>{
      active=false;roundWinner="QUIT";user.games++;user.losses++;updateStats();statusEl.textContent="Challenge quit — stake recorded as lost.";render();
    });
  }

  function openModal(title,text,confirm){$("modalTitle").textContent=title;$("modalText").textContent=text;modal._confirm=confirm;show(modal)}
  function closeModal(){hide(modal);modal._confirm=null}

  function account(type){
    hide(gameView);show(accountView);
    const title={play:"Play for Money",add:"Add Money",withdraw:"Withdraw",settings:"Settings"}[type]||"Account";
    $("accountEyebrow").textContent=title.toUpperCase();$("accountTitle").textContent=title;
    const c=$("accountContent");c.innerHTML="";
    if(type==="settings"){
      $("accountText").textContent="Your registered details. Edit requests open the appropriate Tally form.";
      const grid=document.createElement("div");grid.className="account-grid";
      [["Full name",user.name],["Email",user.email],["Gender",user.gender],["Personal Key","Hidden for security"]].forEach(([k,v])=>{
        const row=document.createElement("div");row.className="account-row";row.innerHTML=`<div><span>${k}</span><b>${v}</b></div><button type="button">Edit</button>`;
        row.querySelector("button").addEventListener("click",()=>alert("Connect this button to the corresponding Tally edit form URL."));
        grid.appendChild(row);
      });c.appendChild(grid);
    } else if(type==="play"){
      $("accountText").textContent="Complete your payout bank-details form before entering a money challenge.";
      c.innerHTML=`<div class="account-grid"><div class="account-row"><div><span>Step 1</span><b>Complete payout bank details</b></div><button type="button" id="tallyBtn">Open Form</button></div><div class="account-row"><div><span>Step 2</span><b>Pay ${money(DATA.payment.entry)} to the challenge account</b></div><button type="button" id="payBtn">View Payment</button></div></div>`;
      $("tallyBtn").onclick=()=>alert("Replace this with your Tally bank-details form URL.");
      $("payBtn").onclick=()=>paymentPage(c);
    } else if(type==="add"){
      $("accountText").textContent="Complete Play for Money registration first. This page can then display the same payment details.";
      c.innerHTML=`<div class="notice">Payment activation is controlled by the Play for Money registration flow.</div>`;
    } else {
      $("accountText").textContent="Withdrawal requests can be reviewed and paid manually by the operator.";
      c.innerHTML=`<div class="account-row"><div><span>Available winnings</span><b>${money(user.winnings)}</b></div><button type="button" id="withdrawBtn">Request</button></div>`;
      $("withdrawBtn").onclick=()=>alert("Connect this to your withdrawal-request Tally form.");
    }
  }
  function paymentPage(c){
    c.innerHTML=`<div class="account-grid"><div class="account-row"><div><span>Bank</span><b>${DATA.payment.bankName}</b></div><button type="button" data-copy="${DATA.payment.bankName}">Copy</button></div><div class="account-row"><div><span>Account name</span><b>${DATA.payment.accountName}</b></div><button type="button" data-copy="${DATA.payment.accountName}">Copy</button></div><div class="account-row"><div><span>Account number</span><b>${DATA.payment.accountNumber}</b></div><button type="button" data-copy="${DATA.payment.accountNumber}">Copy</button></div></div><div class="notice">Pay exactly ${money(DATA.payment.entry)} and follow your operator's payment-confirmation process before starting a money challenge.</div>`;
    c.querySelectorAll("[data-copy]").forEach(btn=>btn.onclick=()=>navigator.clipboard?.writeText(btn.dataset.copy).then(()=>btn.textContent="Copied").catch(()=>alert(btn.dataset.copy)));
  }

  $("loginBtn").addEventListener("click",login);$("keyInput").addEventListener("keydown",e=>{if(e.key==="Enter")login()});
  $("newGameBtn").addEventListener("click",newChallenge);$("quitBtn").addEventListener("click",quitChallenge);
  $("menuBtn").addEventListener("click",()=>menu.classList.toggle("hidden"));
  menu.addEventListener("click",e=>{const action=e.target.dataset.action;if(action){hide(menu);account(action)}});
  $("closeAccount").addEventListener("click",()=>{hide(accountView);show(gameView);updateStats()});
  $("modalClose").addEventListener("click",closeModal);$("modalCancel").addEventListener("click",closeModal);$("modalConfirm").addEventListener("click",()=>{const fn=modal._confirm;if(fn)fn();closeModal()});
})();
