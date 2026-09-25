(() => {

  "use strict";


  /* =========================================================
     DATA
  ========================================================= */

  const DATA = window.TT_DATA || {
    users: {},
    payment: {
      entry: 50
    }
  };


  const $ = id =>
    document.getElementById(id);


  const SESSION_KEY =
    "tiktak_logged_in_key_v1";


  const CHALLENGE_ROUNDS = 5;


  const CHALLENGE_ENTRY = 50;


  /*
    Current payout rule:

    3 wins = ₦100
    4 wins = ₦100
    5 wins = ₦100

    2 or fewer = ₦0
  */

  const PAYOUTS = {
    3: 100,
    4: 100,
    5: 100
  };


  let user = null;

  let currentKey = null;


  /* =========================================================
     GAME STATE
  ========================================================= */

  let board =
    Array(9).fill("");


  let active = false;


  let botThinking = false;


  let roundWinner = null;


  /*
    Challenge score.

    playerScore = scored wins by player
    botScore    = scored wins by bot
    ties        = ties that caused replay
  */

  let playerScore = 0;

  let botScore = 0;

  let ties = 0;


  let currentRound = 1;

  let roundHistory = [];


  /*
    Internal bot behaviour.

    IMPORTANT:

    These values are NEVER shown to the player.

    They are randomly selected for the challenge.

    The game board itself determines the result.
  */

  let botMode = "A";



  /* =========================================================
     DOM
  ========================================================= */

  const loginView =
    $("loginView");

  const registerView =
    $("registerView");

  const gameView =
    $("gameView");

  const accountView =
    $("accountView");


  const boardEl =
    $("board");

  const statusEl =
    $("status");

  const menu =
    $("menu");

  const menuBtn =
    $("menuBtn");

  const modal =
    $("modal");


  const drawPanel =
    $("drawPanel");

  const roundResultPanel =
    $("roundResultPanel");



  /* =========================================================
     HELPERS
  ========================================================= */

  function money(value){

    return "₦" +
      Number(value || 0)
        .toLocaleString("en-NG");

  }


  function show(element){

    if(element){

      element.classList.remove(
        "hidden"
      );

    }

  }


  function hide(element){

    if(element){

      element.classList.add(
        "hidden"
      );

    }

  }


  function sleep(ms){

    return new Promise(
      resolve =>
        setTimeout(resolve, ms)
    );

  }



  /* =========================================================
     ACCOUNT STORAGE
  ========================================================= */

  function accountStorageKey(key){

    return (
      "tiktak_account_" +
      key
    );

  }


  function saveAccount(){

    if(
      !currentKey ||
      !user
    ){

      return;

    }


    localStorage.setItem(

      accountStorageKey(
        currentKey
      ),

      JSON.stringify(user)

    );

  }


  function loadAccount(key){

    const saved =
      localStorage.getItem(
        accountStorageKey(key)
      );


    if(saved){

      try{

        const parsed =
          JSON.parse(saved);


        if(DATA.users[key]){

          return {
            ...DATA.users[key],
            ...parsed
          };

        }


        return parsed;

      }catch(error){

        console.warn(
          "Could not read saved TikTak account."
        );

      }

    }


    return DATA.users[key] || null;

  }


  function saveLoginSession(){

    if(!currentKey){

      return;

    }


    localStorage.setItem(
      SESSION_KEY,
      currentKey
    );

  }


  function clearLoginSession(){

    localStorage.removeItem(
      SESSION_KEY
    );


    currentKey = null;

    user = null;

  }



  /* =========================================================
     LOGIN
  ========================================================= */

  function login(){

    const input =
      $("keyInput");


    const key =
      input.value
        .trim()
        .toUpperCase();


    if(!key){

      $("loginMsg").textContent =
        "Please enter your personal key.";

      return;

    }


    const foundUser =
      loadAccount(key);


    if(!foundUser){

      $("loginMsg").textContent =
        "Personal key not recognised.";

      return;

    }


    user =
      foundUser;


    currentKey =
      key;


    saveLoginSession();

    saveAccount();


    $("loginMsg").textContent =
      "";


    $("playerName").textContent =
      user.name
        .split(" ")[0];


    updateStats();


    hide(loginView);

    hide(registerView);

    show(gameView);


    /*
      The menu becomes available
      only after valid login.
    */

    show(menuBtn);


    newChallenge();

  }



  /* =========================================================
     REGISTRATION
  ========================================================= */

  function openRegistration(){

    hide(loginView);

    show(registerView);

    hide(menu);

  }


  function backToLogin(){

    hide(registerView);

    show(loginView);

    $("loginMsg").textContent =
      "";

  }


  function useDemoKey(){

    $("keyInput").value =
      "TT-48291";

    login();

  }



  /* =========================================================
     BOARD
  ========================================================= */

  function render(){

    boardEl.innerHTML =
      "";


    board.forEach(
      (value,index) => {

        const button =
          document.createElement(
            "button"
          );


        button.className =
          "cell " +

          (
            value === "X"
              ? "x "
              : ""
          ) +

          (
            value === "O"
              ? "o"
              : ""
          );


        button.textContent =
          value;


        button.disabled =
          !!value ||
          !active ||
          botThinking ||
          !!roundWinner;


        button.setAttribute(
          "aria-label",

          `Block ${index + 1}${
            value
              ? ": " + value
              : " empty"
          }`
        );


        button.addEventListener(
          "click",

          () =>
            playerMove(index)
        );


        boardEl.appendChild(
          button
        );

      }
    );

  }



  /* =========================================================
     WINNING LINES
  ========================================================= */

  function lines(){

    return [

      [0,1,2],

      [3,4,5],

      [6,7,8],

      [0,3,6],

      [1,4,7],

      [2,5,8],

      [0,4,8],

      [2,4,6]

    ];

  }


  function winner(b){

    for(
      const line of lines()
    ){

      const [
        a,
        c,
        d
      ] = line;


      if(
        b[a] &&
        b[a] === b[c] &&
        b[a] === b[d]
      ){

        return {
          mark:b[a],
          line
        };

      }

    }


    return null;

  }



  /* =========================================================
     INTERNAL BOT BEHAVIOUR A
  ========================================================= */

  function smartMove(){

    /*
      This bot looks for:

      1. Winning move
      2. Blocking move
      3. Centre
      4. Corners
      5. Random available space
    */


    const win =
      findWinningMove("O");


    if(win !== -1){

      return win;

    }


    const block =
      findWinningMove("X");


    if(block !== -1){

      return block;

    }


    if(!board[4]){

      return 4;

    }


    const corners =
      [0,2,6,8]
        .filter(
          i => !board[i]
        );


    if(corners.length){

      return randomItem(
        corners
      );

    }


    return randomAvailable();

  }



  /* =========================================================
     INTERNAL BOT BEHAVIOUR B
  ========================================================= */

  function relaxedMove(){

    /*
      This behaviour still plays legally,
      but makes more natural/random choices.

      The player never sees this internal name.
    */


    const win =
      findWinningMove("O");


    /*
      The bot still takes an immediate
      winning opportunity.
    */

    if(
      win !== -1 &&
      Math.random() < .75
    ){

      return win;

    }


    const block =
      findWinningMove("X");


    /*
      Sometimes it notices a threat,
      sometimes it doesn't.
    */

    if(
      block !== -1 &&
      Math.random() < .65
    ){

      return block;

    }


    const preferred =
      [
        4,
        0,
        2,
        6,
        8
      ];


    const available =
      preferred.filter(
        i => !board[i]
      );


    if(
      available.length &&
      Math.random() < .75
    ){

      return randomItem(
        available
      );

    }


    return randomAvailable();

  }



  /* =========================================================
     BOT MOVE SELECTOR
  ========================================================= */

  function botMove(){

    /*
      Internal selection only.

      Never display botMode to player.
    */

    if(botMode === "A"){

      return smartMove();

    }


    return relaxedMove();

  }



  /* =========================================================
     MOVE HELPERS
  ========================================================= */

  function randomItem(array){

    return array[
      Math.floor(
        Math.random() *
        array.length
      )
    ];

  }


  function randomAvailable(){

    const available =
      board
        .map(
          (value,index) =>
            value
              ? null
              : index
        )
        .filter(
          value =>
            value !== null
        );


    if(!available.length){

      return -1;

    }


    return randomItem(
      available
    );

  }


  function findWinningMove(mark){

    for(
      let i = 0;
      i < 9;
      i++
    ){

      if(board[i]){

        continue;

      }


      board[i] =
        mark;


      const result =
        winner(board);


      board[i] =
        "";


      if(result){

        return i;

      }

    }


    return -1;

  }



  /* =========================================================
     PLAYER MOVE
  ========================================================= */

  function playerMove(index){

    if(
      !active ||
      botThinking ||
      board[index] ||
      roundWinner
    ){

      return;

    }


    board[index] =
      "X";


    render();


    const finished =
      finishRoundIfNeeded("X");


    if(finished){

      return;

    }


    botThinking =
      true;


    statusEl.textContent =
      "BOT is thinking…";


    render();


    setTimeout(

      () => {

        if(!active){

          return;

        }


        const move =
          botMove();


        if(move !== -1){

          board[move] =
            "O";

        }


        botThinking =
          false;


        render();


        finishRoundIfNeeded(
          "O"
        );

      },

      420

    );

  }



  /* =========================================================
     ROUND LOGIC
  ========================================================= */

  function finishRoundIfNeeded(mark){

    const result =
      winner(board);


    /*
      Somebody won.
    */

    if(result){

      roundWinner =
        result.mark;


      active =
        false;


      highlightWinner(
        result.line
      );


      render();


      handleRoundWinner(
        result.mark
      );


      return true;

    }


    /*
      Board full = TIE.

      IMPORTANT:

      This does NOT increase
      playerScore or botScore.

      The same round is replayed.
    */

    if(
      board.every(Boolean)
    ){

      handleTieRound();

      return true;

    }


    statusEl.textContent =
      mark === "X"
        ? "BOT's turn"
        : "Your turn";


    return false;

  }



  function highlightWinner(line){

    /*
      render first so the cells exist.
    */

    render();


    line.forEach(
      index => {

        if(
          boardEl.children[index]
        ){

          boardEl
            .children[index]
            .classList.add(
              "win"
            );

        }

      }
    );

  }



  /* =========================================================
     TIE
  ========================================================= */

  async function handleTieRound(){

    active =
      false;


    ties++;


    updateChallengeUI();


    showRoundResult(
      "TIE",
      "DRAW",
      "No score. Replaying the same round.",
      "tie"
    );


    statusEl.textContent =
      "Tie — replaying this round…";


    await sleep(1100);


    if(
      !user ||
      roundWinner
    ){

      return;

    }


    board =
      Array(9).fill("");


    active =
      true;


    botThinking =
      false;


    hide(roundResultPanel);


    statusEl.textContent =
      "Your turn";


    render();

  }



  /* =========================================================
     ROUND WINNER
  ========================================================= */

  async function handleRoundWinner(mark){

    if(mark === "X"){

      playerScore++;

    }else{

      botScore++;

    }


    /*
      Save this completed round immediately.

      This is done BEFORE the challenge can end,
      so the 5th/final round is also recorded.
    */

    roundHistory.push({

      round: currentRound,

      winner:
        mark === "X"
          ? "PLAYER"
          : "BOT",

      playerScore,

      botScore,

      ties

    });


    updateChallengeUI();


    if(mark === "X"){

      showRoundResult(

        "WIN",

        "YOU WIN",

        `Round ${currentRound} goes to you.`,

        "win"

      );

    }else{

      showRoundResult(

        "LOSS",

        "BOT WINS",

        `Round ${currentRound} goes to BOT.`,

        "loss"

      );

    }


    /*
      If the challenge already has
      enough scored rounds, finish it.
    */

    if(
      playerScore >= 3 ||
      botScore >= 3
    ){

      await sleep(1300);

      endChallenge();

      return;

    }


    /*
      Otherwise move to the next
      scored round.
    */

    await sleep(1300);


    currentRound++;


    hide(roundResultPanel);


    startRoundDraw();

  }



  /* =========================================================
     CHALLENGE DRAW
  ========================================================= */

  async function startRoundDraw(){

    active =
      false;


    botThinking =
      false;


    roundWinner =
      null;


    board =
      Array(9).fill("");


    render();


    show(drawPanel);


    $("drawResult").textContent =
      "DRAW READY";


    $("drawStage").textContent =
      `Preparing Round ${currentRound}...`;


    const slots =
      Array.from(
        document.querySelectorAll(
          ".draw-slot"
        )
      );


    slots.forEach(
      slot =>
        slot.classList.remove(
          "active",
          "selected"
        )
    );


    /*
      Randomly select internal
      bot behaviour.

      It is deliberately NOT shown.
    */

    botMode =
      Math.random() < .5
        ? "A"
        : "B";


    /*
      Lottery-style visual sequence.

      This is presentation only.
      It does NOT decide the winner.
    */

    await sleep(400);


    $("drawStage").textContent =
      "Entering the draw…";


    for(
      let cycle = 0;
      cycle < 2;
      cycle++
    ){

      for(
        let i = 0;
        i < slots.length;
        i++
      ){

        slots.forEach(
          slot =>
            slot.classList.remove(
              "active"
            )
        );


        slots[i].classList.add(
          "active"
        );


        $("drawResult").textContent =
          `DRAW ${i + 1}`;


        await sleep(
          120 + cycle * 45
        );

      }

    }


    /*
      Presentation randomly stops
      on one of the five positions.
    */

    const selected =
      Math.floor(
        Math.random() *
        slots.length
      );


    slots.forEach(
      slot =>
        slot.classList.remove(
          "active"
        )
    );


    slots[selected].classList.add(
      "selected"
    );


    $("drawStage").textContent =
      `ROUND ${currentRound} READY`;


    $("drawResult").textContent =
      "BOT READY";


    await sleep(800);


    hide(drawPanel);


    active =
      true;


    statusEl.textContent =
      "Your turn";


    render();

  }



  /* =========================================================
     NEW CHALLENGE
  ========================================================= */

  function newChallenge(){

    /*
      Reset the entire challenge.
    */

    playerScore = 0;

    botScore = 0;

    ties = 0;

    currentRound = 1;


    board =
      Array(9).fill("");


    active =
      false;


    botThinking =
      false;


    roundWinner =
      null;


    hide(roundResultPanel);


    hide(
      $("paymentNotice")
    );


    updateChallengeUI();


    startRoundDraw();

  }



  /* =========================================================
     CHALLENGE END
  ========================================================= */

  function endChallenge(){

    active =
      false;


    botThinking =
      false;


    roundWinner =
      "CHALLENGE_COMPLETE";


    const won =
      playerScore >= 3;


    const payout =
      won
        ? PAYOUTS[playerScore] || 100
        : 0;


    user.games++;


    if(won){

      user.wins++;

      user.winnings +=
        payout;

    }else{

      user.losses++;

    }


    saveAccount();


    updateStats();


    /*
      Final result presentation.
    */

    showFinalResult(
      won,
      payout
    );


    sendGameReport(
      won
        ? "WIN"
        : "LOSS",
      payout
    );


    render();

  }



  /* =========================================================
     FINAL RESULT
  ========================================================= */

  function showFinalResult(
    won,
    payout
  ){

    show(
      roundResultPanel
    );


    roundResultPanel
      .classList.remove(
        "loss",
        "tie"
      );


    if(won){

      $("roundResultIcon")
        .textContent =
        "₦";


      $("roundResultTitle")
        .textContent =
        "CHALLENGE WON";


      $("roundResultText")
        .textContent =
        `Final score ${playerScore}–${botScore}. Payout: ${money(payout)}.`;


      $("roundResultEyebrow")
        .textContent =
        "FINAL RESULT";


      statusEl.textContent =
        "Challenge won.";

    }else{

      roundResultPanel
        .classList.add(
          "loss"
        );


      $("roundResultIcon")
        .textContent =
        "×";


      $("roundResultTitle")
        .textContent =
        "CHALLENGE LOST";


      $("roundResultText")
        .textContent =
        `Final score ${playerScore}–${botScore}. Payout: ${money(0)}.`;


      $("roundResultEyebrow")
        .textContent =
        "FINAL RESULT";


      statusEl.textContent =
        "Challenge lost.";

    }


    $("roundNumber")
      .textContent =
      "5";


    $("challengeWins")
      .textContent =
      playerScore;


    $("challengeLosses")
      .textContent =
      botScore;


    $("challengeTies")
      .textContent =
      ties;

  }



  /* =========================================================
     ROUND RESULT DISPLAY
  ========================================================= */

  function showRoundResult(
    type,
    title,
    text,
    className
  ){

    show(
      roundResultPanel
    );


    roundResultPanel
      .classList.remove(
        "loss",
        "tie"
      );


    if(className){

      roundResultPanel
        .classList.add(
          className
        );

    }


    if(type === "WIN"){

      $("roundResultIcon")
        .textContent =
        "✓";

    }else if(type === "LOSS"){

      $("roundResultIcon")
        .textContent =
        "×";

    }else{

      $("roundResultIcon")
        .textContent =
        "＝";

    }


    $("roundResultEyebrow")
      .textContent =
      `ROUND ${currentRound} RESULT`;


    $("roundResultTitle")
      .textContent =
      title;


    $("roundResultText")
      .textContent =
      text;

  }



  /* =========================================================
     CHALLENGE UI
  ========================================================= */

  function updateChallengeUI(){

    $("roundNumber")
      .textContent =
      currentRound;


    $("challengeWins")
      .textContent =
      playerScore;


    $("challengeLosses")
      .textContent =
      botScore;


    $("challengeTies")
      .textContent =
      ties;


    /*
      Top game score also follows
      the current challenge score.
    */

    $("wins")
      .textContent =
      playerScore;


    $("losses")
      .textContent =
      botScore;

  }



  /* =========================================================
     PLAYER STATISTICS
  ========================================================= */

  function updateStats(){

    $("wins")
      .textContent =
      user.wins;


    $("losses")
      .textContent =
      user.losses;


    $("statWins")
      .textContent =
      user.wins;


    $("statLosses")
      .textContent =
      user.losses;


    $("games")
      .textContent =
      user.games;


    $("winnings")
      .textContent =
      money(
        user.winnings
      );

  }



  /* =========================================================
     GAME REPORT
  ========================================================= */

  function sendGameReport(
    result,
    amount
  ){

    const gameId =
      "TT-" +
      Date.now()
        .toString(36)
        .toUpperCase();


    const report = {

      gameId,

      player:
        user.name,

      email:
        user.email,

      result,

      challengeScore:
        `${playerScore}-${botScore}`,

      ties,

      rounds:
        CHALLENGE_ROUNDS,

      stake:
        CHALLENGE_ENTRY,

      amount,

      time:
        new Date().toISOString()

    };


    /*
      Frontend prototype.

      Later this object can be
      sent to your backend/email system.
    */

    console.info(
      "TIKTAK CHALLENGE REPORT:",
      report
    );


    if(result === "WIN"){

      $("paymentNotice")
        .textContent =
        `Win recorded (${gameId}). ` +
        `Payout: ${money(amount)}. ` +
        `Report prepared for verification.`;


      show(
        $("paymentNotice")
      );

    }

  }



  /* =========================================================
     QUIT
  ========================================================= */

  function quitChallenge(){

    if(
      !active ||
      roundWinner
    ){

      return;

    }


    openModal(

      "Quit challenge?",

      "If you quit an unfinished ₦50 challenge, the challenge is recorded as a loss. Are you sure you want to quit?",

      () => {

        active =
          false;


        roundWinner =
          "QUIT";


        user.games++;


        user.losses++;


        saveAccount();


        updateStats();


        statusEl.textContent =
          "Challenge quit — stake recorded as lost.";


        showRoundResult(

          "LOSS",

          "CHALLENGE QUIT",

          "The unfinished ₦50 challenge was recorded as a loss.",

          "loss"

        );


        render();

      }

    );

  }



  /* =========================================================
     MODAL
  ========================================================= */

  function openModal(
    title,
    text,
    confirmFunction
  ){

    $("modalTitle")
      .textContent =
      title;


    $("modalText")
      .textContent =
      text;


    modal._confirm =
      confirmFunction;


    show(modal);

  }


  function closeModal(){

    hide(modal);

    modal._confirm =
      null;

  }



  /* =========================================================
     ACCOUNT MENU
  ========================================================= */

  function account(type){

    if(
      !user ||
      !currentKey
    ){

      return;

    }


    hide(gameView);

    show(accountView);


    const titles = {

      play:
        "Play for Money",

      add:
        "Add Money",

      withdraw:
        "Withdraw",

      settings:
        "Settings"

    };


    const title =
      titles[type] ||
      "Account";


    $("accountEyebrow")
      .textContent =
      title.toUpperCase();


    $("accountTitle")
      .textContent =
      title;


    const content =
      $("accountContent");


    content.innerHTML =
      "";



    /* =====================================================
       SETTINGS
    ====================================================== */

    if(type === "settings"){

      $("accountText")
        .textContent =
        "Your registered TikTak details.";


      const grid =
        document.createElement(
          "div"
        );


      grid.className =
        "account-grid";


      [

        [
          "Full name",
          user.name
        ],

        [
          "Email",
          user.email
        ],

        [
          "Gender",
          user.gender
        ],

        [
          "Personal Key",
          "••••••••"
        ]

      ].forEach(
        ([label,value]) => {

          const row =
            document.createElement(
              "div"
            );


          row.className =
            "account-row";


          row.innerHTML = `

            <div>

              <span>
                ${label}
              </span>

              <b>
                ${value}
              </b>

            </div>

            <button
              type="button"
            >
              Edit
            </button>

          `;


          row
            .querySelector(
              "button"
            )
            .addEventListener(
              "click",
              () => {

                alert(
                  "Connect this Edit button to the corresponding Tally form."
                );

              }
            );


          grid.appendChild(
            row
          );

        }
      );


      content.appendChild(
        grid
      );


      return;

    }



    /* =====================================================
       PLAY FOR MONEY
    ====================================================== */

    if(type === "play"){

      $("accountText")
        .textContent =
        "Complete your payout bank-details form before entering a money challenge.";


      content.innerHTML = `

        <div class="account-grid">

          <div class="account-row">

            <div>

              <span>
                Step 1
              </span>

              <b>
                Complete payout bank details
              </b>

            </div>

            <button
              type="button"
              id="tallyBtn"
            >
              Open Form
            </button>

          </div>


          <div class="account-row">

            <div>

              <span>
                Step 2
              </span>

              <b>
                Pay ${money(
                  DATA.payment.entry
                )}
                to the challenge account
              </b>

            </div>

            <button
              type="button"
              id="payBtn"
            >
              View Payment
            </button>

          </div>

        </div>

      `;


      $("tallyBtn").onclick =
        () => {

          alert(
            "Replace this with your Tally payout-bank-details form URL."
          );

        };


      $("payBtn").onclick =
        () =>
          paymentPage(
            content
          );


      return;

    }



    /* =====================================================
       ADD MONEY
    ====================================================== */

    if(type === "add"){

      $("accountText")
        .textContent =
        "Complete Play for Money setup first.";


      content.innerHTML = `

        <div class="notice">

          Add Money will become available
          through the payment setup flow.

        </div>

      `;


      return;

    }



    /* =====================================================
       WITHDRAW
    ====================================================== */

    $("accountText")
      .textContent =
      "Withdrawal requests can be reviewed and paid manually.";


    content.innerHTML = `

      <div class="account-row">

        <div>

          <span>
            Available winnings
          </span>

          <b>
            ${money(
              user.winnings
            )}
          </b>

        </div>

        <button
          type="button"
          id="withdrawBtn"
        >
          Request
        </button>

      </div>

    `;


    $("withdrawBtn").onclick =
      () => {

        alert(
          "Connect this button to your withdrawal Tally form."
        );

      };

  }



  /* =========================================================
     PAYMENT PAGE
  ========================================================= */

  function paymentPage(content){

    content.innerHTML = `

      <div class="account-grid">

        <div class="account-row">

          <div>

            <span>
              Bank
            </span>

            <b>
              ${DATA.payment.bankName}
            </b>

          </div>

          <button
            type="button"
            data-copy="${DATA.payment.bankName}"
          >
            Copy
          </button>

        </div>


        <div class="account-row">

          <div>

            <span>
              Account name
            </span>

            <b>
              ${DATA.payment.accountName}
            </b>

          </div>

          <button
            type="button"
            data-copy="${DATA.payment.accountName}"
          >
            Copy
          </button>

        </div>


        <div class="account-row">

          <div>

            <span>
              Account number
            </span>

            <b>
              ${DATA.payment.accountNumber}
            </b>

          </div>

          <button
            type="button"
            data-copy="${DATA.payment.accountNumber}"
          >
            Copy
          </button>

        </div>

      </div>


      <div class="notice">

        Pay exactly
        ${money(
          DATA.payment.entry
        )}

        and follow the payment-confirmation
        process before starting a money challenge.

      </div>

    `;


    content
      .querySelectorAll(
        "[data-copy]"
      )
      .forEach(
        button => {

          button.onclick =
            () => {

              const value =
                button.dataset.copy;


              if(
                navigator.clipboard &&
                navigator.clipboard.writeText
              ){

                navigator.clipboard
                  .writeText(value)
                  .then(
                    () => {

                      button.textContent =
                        "Copied";

                    }
                  )
                  .catch(
                    () => {

                      alert(value);

                    }
                  );

              }else{

                alert(value);

              }

            };

        }
      );

  }



  /* =========================================================
     RESTORE LOGIN
  ========================================================= */

  function restoreSession(){

    const savedKey =
      localStorage.getItem(
        SESSION_KEY
      );


    if(!savedKey){

      return;

    }


    const savedUser =
      loadAccount(
        savedKey
      );


    if(!savedUser){

      clearLoginSession();

      return;

    }


    currentKey =
      savedKey;


    user =
      savedUser;


    $("playerName")
      .textContent =
      user.name
        .split(" ")[0];


    updateStats();


    hide(loginView);

    hide(registerView);

    show(gameView);

    show(menuBtn);


    newChallenge();

  }



  /* =========================================================
     BUTTON EVENTS
  ========================================================= */

  $("loginBtn")
    .addEventListener(
      "click",
      login
    );


  $("keyInput")
    .addEventListener(
      "keydown",
      event => {

        if(
          event.key === "Enter"
        ){

          login();

        }

      }
    );


  $("registerBtn")
    .addEventListener(
      "click",
      openRegistration
    );


  $("backLoginBtn")
    .addEventListener(
      "click",
      backToLogin
    );


  $("demoBtn")
    .addEventListener(
      "click",
      useDemoKey
    );


  $("newGameBtn")
    .addEventListener(
      "click",
      newChallenge
    );


  $("quitBtn")
    .addEventListener(
      "click",
      quitChallenge
    );



  /* =========================================================
     THREE DOT MENU SECURITY
  ========================================================= */

  menuBtn.addEventListener(
    "click",
    () => {

      /*
        Extra protection:
        menu cannot open without
        valid account session.
      */

      if(
        !user ||
        !currentKey
      ){

        hide(menu);

        return;

      }


      menu.classList.toggle(
        "hidden"
      );

    }
  );


  menu.addEventListener(
    "click",
    event => {

      const action =
        event.target.dataset.action;


      if(
        action &&
        user &&
        currentKey
      ){

        hide(menu);

        account(action);

      }

    }
  );



  /* =========================================================
     CLOSE ACCOUNT
  ========================================================= */

  $("closeAccount")
    .addEventListener(
      "click",
      () => {

        hide(accountView);

        show(gameView);

        updateStats();

      }
    );



  /* =========================================================
     MODAL EVENTS
  ========================================================= */

  $("modalClose")
    .addEventListener(
      "click",
      closeModal
    );


  $("modalCancel")
    .addEventListener(
      "click",
      closeModal
    );


  $("modalConfirm")
    .addEventListener(
      "click",
      () => {

        const fn =
          modal._confirm;


        if(fn){

          fn();

        }


        closeModal();

      }
    );



  /* =========================================================
     START
  ========================================================= */

  restoreSession();


})();
