(() => {
  "use strict";

  const DATA = window.TT_DATA || {
    users: {},
    payment: { entry: 50 }
  };

  const $ = id => document.getElementById(id);

  /*
    Browser session storage.

    The key tells the browser which TikTak account is currently logged in.
    User statistics are also saved locally for this frontend prototype.

    IMPORTANT:
    This is NOT secure authentication for production real-money gaming.
    A real deployment should validate the key on a backend.
  */
  const SESSION_KEY = "tiktak_logged_in_key_v1";

  let user = null;
  let currentKey = null;

  let board = Array(9).fill("");
  let active = false;
  let botThinking = false;
  let roundWinner = null;

  const loginView = $("loginView");
  const registerView = $("registerView");
  const gameView = $("gameView");
  const accountView = $("accountView");

  const boardEl = $("board");
  const statusEl = $("status");
  const menu = $("menu");
  const menuBtn = $("menuBtn");
  const modal = $("modal");

  function money(value) {
    return "₦" + Number(value || 0).toLocaleString("en-NG");
  }

  function show(element) {
    if (element) element.classList.remove("hidden");
  }

  function hide(element) {
    if (element) element.classList.add("hidden");
  }


  /* =========================================================
     ACCOUNT STORAGE
  ========================================================= */

  function accountStorageKey(key) {
    return "tiktak_account_" + key;
  }

  function saveAccount() {
    if (!currentKey || !user) return;

    localStorage.setItem(
      accountStorageKey(currentKey),
      JSON.stringify(user)
    );
  }

  function loadAccount(key) {

    /*
      First check locally saved account information.
    */
    const saved = localStorage.getItem(
      accountStorageKey(key)
    );

    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        /*
          Merge with public demo/operator data where available.
        */
        if (DATA.users[key]) {
          return {
            ...DATA.users[key],
            ...parsed
          };
        }

        return parsed;

      } catch (error) {
        console.warn("Could not read saved TikTak account.");
      }
    }

    /*
      Fall back to operator/demo data.
    */
    return DATA.users[key] || null;
  }


  function saveLoginSession() {

    if (!currentKey) return;

    localStorage.setItem(
      SESSION_KEY,
      currentKey
    );
  }


  function clearLoginSession() {

    localStorage.removeItem(SESSION_KEY);

    currentKey = null;
    user = null;
  }


  /* =========================================================
     LOGIN
  ========================================================= */

  function login() {

    const key = $("keyInput")
      .value
      .trim()
      .toUpperCase();

    if (!key) {

      $("loginMsg").textContent =
        "Please enter your personal key.";

      return;
    }

    const foundUser = loadAccount(key);

    if (!foundUser) {

      $("loginMsg").textContent =
        "Personal key not recognised.";

      return;
    }

    /*
      Successful login.
    */

    user = foundUser;
    currentKey = key;

    saveLoginSession();
    saveAccount();

    $("loginMsg").textContent = "";

    $("playerName").textContent =
      user.name.split(" ")[0];

    updateStats();

    hide(loginView);
    hide(registerView);

    show(gameView);

    /*
      Unlock the three-dot account menu.
    */
    show(menuBtn);

    newChallenge();
  }


  /* =========================================================
     REGISTRATION
  ========================================================= */

  function openRegistration() {

    hide(loginView);
    show(registerView);

    /*
      Close menu if somehow open.
    */
    hide(menu);
  }


  function backToLogin() {

    hide(registerView);
    show(loginView);

    $("loginMsg").textContent = "";
  }


  /* =========================================================
     DEMO LOGIN
  ========================================================= */

  function useDemoKey() {

    $("keyInput").value = "TT-48291";

    login();
  }


  /* =========================================================
     GAME BOARD
  ========================================================= */

  function render() {

    boardEl.innerHTML = "";

    board.forEach((value, index) => {

      const button = document.createElement("button");

      button.className =
        "cell " +
        (value === "X" ? "x " : "") +
        (value === "O" ? "o" : "");

      button.textContent = value;

      button.disabled =
        !!value ||
        !active ||
        botThinking ||
        !!roundWinner;

      button.setAttribute(
        "aria-label",
        `Block ${index + 1}${value ? ": " + value : " empty"}`
      );

      button.addEventListener(
        "click",
        () => playerMove(index)
      );

      boardEl.appendChild(button);

    });
  }


  function lines() {

    return [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6]
    ];

  }


  function winner(b) {

    for (const line of lines()) {

      const [a, c, d] = line;

      if (
        b[a] &&
        b[a] === b[c] &&
        b[a] === b[d]
      ) {

        return {
          mark: b[a],
          line
        };

      }

    }

    return null;
  }


  /* =========================================================
     PERFECT MASTER BOT
  ========================================================= */

  function minimax(
    b,
    maximizing,
    depth = 0
  ) {

    const result = winner(b);

    if (result) {

      return result.mark === "O"
        ? 10 - depth
        : depth - 10;

    }

    if (b.every(Boolean)) {
      return 0;
    }

    const scores = [];

    for (let i = 0; i < 9; i++) {

      if (!b[i]) {

        b[i] =
          maximizing
            ? "O"
            : "X";

        scores.push({
          i,
          score: minimax(
            b,
            !maximizing,
            depth + 1
          )
        });

        b[i] = "";

      }

    }

    return maximizing
      ? Math.max(...scores.map(x => x.score))
      : Math.min(...scores.map(x => x.score));
  }


  function botMove() {

    const moves = [];

    for (let i = 0; i < 9; i++) {

      if (!board[i]) {

        board[i] = "O";

        const score =
          minimax(board, false);

        board[i] = "";

        moves.push({
          i,
          score
        });

      }

    }

    const best =
      Math.max(
        ...moves.map(
          move => move.score
        )
      );

    const candidates =
      moves.filter(
        move => move.score === best
      );

    /*
      Random selection only among equally optimal moves.
      The bot therefore remains perfect while avoiding
      always making exactly the same opening.
    */

    return candidates[
      Math.floor(
        Math.random() * candidates.length
      )
    ].i;
  }


  /* =========================================================
     PLAYER MOVE
  ========================================================= */

  function playerMove(index) {

    if (
      !active ||
      botThinking ||
      board[index] ||
      roundWinner
    ) {
      return;
    }

    board[index] = "X";

    render();

    finishOrContinue("X");

    if (!active || roundWinner) {
      return;
    }

    botThinking = true;

    statusEl.textContent =
      "Master Bot is thinking…";

    render();

    setTimeout(() => {

      if (!active) return;

      const move = botMove();

      board[move] = "O";

      botThinking = false;

      render();

      finishOrContinue("O");

    }, 420);
  }


  /* =========================================================
     ROUND RESULT
  ========================================================= */

  function finishOrContinue(mark) {

    const result = winner(board);

    if (result) {

      roundWinner = result.mark;

      active = false;

      result.line.forEach(index => {

        if (boardEl.children[index]) {

          boardEl.children[index]
            .classList.add("win");

        }

      });

      render();

      endMatch(result.mark);

      return;
    }


    /*
      No winner and board is full:
      automatically wipe and continue.
    */

    if (board.every(Boolean)) {

      statusEl.textContent =
        "Full board — resetting for the next round…";

      setTimeout(() => {

        if (!roundWinner) {

          board = Array(9).fill("");

          statusEl.textContent =
            "Your turn";

          render();

        }

      }, 850);

    } else {

      statusEl.textContent =
        mark === "X"
          ? "Master Bot's turn"
          : "Your turn";

    }
  }


  /* =========================================================
     MATCH RESULT
  ========================================================= */

  function endMatch(mark) {

    user.games++;

    if (mark === "X") {

      user.wins++;

      /*
        Current demo payout.
        Change this value when your final payout rule is decided.
      */
      user.winnings += 100;

      statusEl.textContent =
        "YOU WIN — challenge completed";

      sendGameReport(
        "WIN",
        100
      );

    } else {

      user.losses++;

      statusEl.textContent =
        "MASTER BOT WINS — challenge completed";

      sendGameReport(
        "LOSS",
        0
      );
    }

    saveAccount();

    updateStats();
  }


  /* =========================================================
     GAME REPORT
  ========================================================= */

  function sendGameReport(
    result,
    amount
  ) {

    const gameId =
      "TT-" +
      Date.now()
        .toString(36)
        .toUpperCase();

    const report = {

      gameId,

      player: user.name,

      result,

      stake: 50,

      amount,

      time:
        new Date().toISOString()

    };

    /*
      Frontend prototype only.

      This currently creates the report for later
      backend/email integration.
    */

    console.info(
      "TIKTAK GAME REPORT:",
      report
    );

    if (result === "WIN") {

      $("paymentNotice").textContent =
        `Win recorded (${gameId}). ` +
        `The payout report is ready for manual verification.`;

      show(
        $("paymentNotice")
      );
    }
  }


  /* =========================================================
     STATISTICS
  ========================================================= */

  function updateStats() {

    $("wins").textContent =
      user.wins;

    $("losses").textContent =
      user.losses;

    $("statWins").textContent =
      user.wins;

    $("statLosses").textContent =
      user.losses;

    $("games").textContent =
      user.games;

    $("winnings").textContent =
      money(user.winnings);
  }


  /* =========================================================
     NEW CHALLENGE
  ========================================================= */

  function newChallenge() {

    board = Array(9).fill("");

    active = true;

    botThinking = false;

    roundWinner = null;

    statusEl.textContent =
      "Your turn";

    hide(
      $("paymentNotice")
    );

    render();
  }


  /* =========================================================
     QUIT
  ========================================================= */

  function quitChallenge() {

    if (
      !active ||
      roundWinner
    ) {
      return;
    }

    openModal(

      "Quit challenge?",

      "If you quit an unfinished money challenge, the ₦50 challenge stake is treated as lost according to the challenge rule. Are you sure you want to quit?",

      () => {

        active = false;

        roundWinner = "QUIT";

        user.games++;

        user.losses++;

        saveAccount();

        updateStats();

        statusEl.textContent =
          "Challenge quit — stake recorded as lost.";

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
  ) {

    $("modalTitle").textContent =
      title;

    $("modalText").textContent =
      text;

    modal._confirm =
      confirmFunction;

    show(modal);
  }


  function closeModal() {

    hide(modal);

    modal._confirm = null;
  }


  /* =========================================================
     ACCOUNT MENU
  ========================================================= */

  function account(type) {

    /*
      Extra protection:
      nobody can open account functions
      without a valid logged-in user.
    */

    if (!user || !currentKey) {
      return;
    }

    hide(gameView);

    show(accountView);

    const titles = {

      play: "Play for Money",

      add: "Add Money",

      withdraw: "Withdraw",

      settings: "Settings"

    };

    const title =
      titles[type] || "Account";

    $("accountEyebrow").textContent =
      title.toUpperCase();

    $("accountTitle").textContent =
      title;

    const content =
      $("accountContent");

    content.innerHTML = "";


    /* SETTINGS */

    if (type === "settings") {

      $("accountText").textContent =
        "Your registered TikTak details.";

      const grid =
        document.createElement("div");

      grid.className =
        "account-grid";

      [
        ["Full name", user.name],
        ["Email", user.email],
        ["Gender", user.gender],
        ["Personal Key", "••••••••"]
      ].forEach(([label, value]) => {

        const row =
          document.createElement("div");

        row.className =
          "account-row";

        row.innerHTML = `
          <div>
            <span>${label}</span>
            <b>${value}</b>
          </div>

          <button type="button">
            Edit
          </button>
        `;

        row
          .querySelector("button")
          .addEventListener(
            "click",
            () => {

              alert(
                "Connect this Edit button to the corresponding Tally form."
              );

            }
          );

        grid.appendChild(row);

      });

      content.appendChild(grid);

      return;
    }


    /* PLAY FOR MONEY */

    if (type === "play") {

      $("accountText").textContent =
        "Complete your payout bank-details form before entering a money challenge.";

      content.innerHTML = `

        <div class="account-grid">

          <div class="account-row">

            <div>
              <span>Step 1</span>

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
              <span>Step 2</span>

              <b>
                Pay ${money(DATA.payment.entry)}
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
        () => paymentPage(content);

      return;
    }


    /* ADD MONEY */

    if (type === "add") {

      $("accountText").textContent =
        "Complete Play for Money registration first.";

      content.innerHTML = `

        <div class="notice">

          Payment activation is controlled
          by the Play for Money registration flow.

        </div>

      `;

      return;
    }


    /* WITHDRAW */

    $("accountText").textContent =
      "Withdrawal requests can be reviewed and paid manually.";

    content.innerHTML = `

      <div class="account-row">

        <div>

          <span>
            Available winnings
          </span>

          <b>
            ${money(user.winnings)}
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

  function paymentPage(content) {

    content.innerHTML = `

      <div class="account-grid">

        <div class="account-row">

          <div>
            <span>Bank</span>
            <b>${DATA.payment.bankName}</b>
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
            <span>Account name</span>
            <b>${DATA.payment.accountName}</b>
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
            <span>Account number</span>
            <b>${DATA.payment.accountNumber}</b>
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
        ${money(DATA.payment.entry)}
        and follow the payment-confirmation
        process before starting a money challenge.

      </div>
    `;


    content
      .querySelectorAll("[data-copy]")
      .forEach(button => {

        button.onclick = () => {

          const value =
            button.dataset.copy;

          if (
            navigator.clipboard &&
            navigator.clipboard.writeText
          ) {

            navigator.clipboard
              .writeText(value)
              .then(() => {

                button.textContent =
                  "Copied";

              })
              .catch(() => {

                alert(value);

              });

          } else {

            alert(value);

          }
        };

      });
  }


  /* =========================================================
     RESTORE PREVIOUS LOGIN
  ========================================================= */

  function restoreSession() {

    const savedKey =
      localStorage.getItem(
        SESSION_KEY
      );

    if (!savedKey) {
      return;
    }

    const savedUser =
      loadAccount(savedKey);

    if (!savedUser) {

      clearLoginSession();

      return;
    }

    /*
      Restore the account automatically.
    */

    currentKey = savedKey;

    user = savedUser;

    $("playerName").textContent =
      user.name.split(" ")[0];

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

        if (
          event.key === "Enter"
        ) {

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


  /*
    Three-dot button is only displayed
    after successful login.
  */

  menuBtn.addEventListener(
    "click",
    () => {

      if (!user || !currentKey) {
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

      if (
        action &&
        user &&
        currentKey
      ) {

        hide(menu);

        account(action);

      }

    }
  );


  $("closeAccount")
    .addEventListener(
      "click",
      () => {

        hide(accountView);

        show(gameView);

        updateStats();

      }
    );


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

        if (fn) {
          fn();
        }

        closeModal();

      }
    );


  /*
    Automatically restore account when
    the user comes back to the website.
  */

  restoreSession();

})();
