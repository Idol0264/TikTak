(() => {
  "use strict";

  /* =========================================================
     TIKTAK GAME ENGINE
     Frontend prototype
  ========================================================= */

  const DATA = window.TT_DATA || {
    users: {},
    payment: {
      entry: 50
    }
  };

  const $ = id => document.getElementById(id);

  /* =========================================================
     STORAGE KEYS
  ========================================================= */

  const SESSION_KEY = "tiktak_logged_in_key_v1";

  const ACTIVE_KEY_PREFIX =
    "tiktak_active_challenge_v2_";

  const TABLE_KEY_PREFIX =
    "tiktak_selected_table_v1_";

  /* =========================================================
     CHALLENGE SETTINGS
  ========================================================= */

  const CHALLENGE_ROUNDS = 5;

  /*
    Available challenge tables.

    Maximum = ₦10,000.
  */
  const CHALLENGE_TABLES = [
    500,
    1000,
    1500,
    2000,
    2500,
    3000,
    3500,
    4000,
    4500,
    5000,
    5500,
    6000,
    6500,
    7000,
    7500,
    8000,
    8500,
    9000,
    9500,
    10000
  ];

  /*
    Entry = 10% of selected table.
  */
  const ENTRY_RATE = 0.10;

  /*
    Payout rates.

    3–2 = 40%
    4–1 = 70%
    5–0 = 100%
  */
  const PAYOUT_RATES = {
    3: 0.40,
    4: 0.70,
    5: 1.00
  };

  /* =========================================================
     HIDDEN BOT LEVELS
  =========================================================

     These are NEVER shown as the active difficulty.

     They are the five internal bot levels requested.
  */

  const BOT_LEVELS = [
    "Normal",
    "Advance",
    "Professional",
    "Legend",
    "Grand Master"
  ];

  /* =========================================================
     ACCOUNT
  ========================================================= */

  let user = null;
  let currentKey = null;

  /* =========================================================
     CHALLENGE STATE
  ========================================================= */

  let board = Array(9).fill("");

  let active = false;
  let botThinking = false;
  let roundWinner = null;

  let playerScore = 0;
  let botScore = 0;
  let ties = 0;

  let currentRound = 1;

  let roundHistory = [];

  /*
    Hidden bot sequence.

    Five scored rounds.

    One difficulty may appear twice.
    No difficulty may appear more than twice.
  */
  let botSequence = [];

  /*
    Index of the current scored round
    inside botSequence.
  */
  let botSequenceIndex = 0;

  /*
    The current hidden bot difficulty.
  */
  let currentBotDifficulty = null;

  /*
    Current turn:
    "player"
    "bot"
  */
  let turn = "player";

  /*
    Game phase:

    idle
    draw
    playing
    round-result
    complete
    quit
  */
  let challengePhase = "idle";

  /*
    Selected table.
  */
  let selectedTable = 500;

  /*
    Entry for selected table.
  */
  let selectedEntry = 50;

  /*
    Used to prevent duplicate bot timers.
  */
  let botTimer = null;

  /*
    Used to prevent duplicate draw timers.
  */
  let drawToken = 0;

  /* =========================================================
     DOM
  ========================================================= */

  const loginView = $("loginView");
  const registerView = $("registerView");
  const gameView = $("gameView");
  const accountView = $("accountView");

  const boardEl = $("board");
  const statusEl = $("status");

  const menu = $("menu");
  const menuBtn = $("menuBtn");

  const modal = $("modal");

  const drawPanel = $("drawPanel");
  const roundResultPanel = $("roundResultPanel");

  /* =========================================================
     BASIC HELPERS
  ========================================================= */

  function money(value) {
    return (
      "₦" +
      Number(value || 0).toLocaleString("en-NG")
    );
  }

  function show(element) {
    if (element) {
      element.classList.remove("hidden");
    }
  }

  function hide(element) {
    if (element) {
      element.classList.add("hidden");
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function randomItem(array) {
    if (!array.length) return null;

    return array[
      Math.floor(
        Math.random() * array.length
      )
    ];
  }

  function shuffle(array) {
    const copy = [...array];

    for (
      let i = copy.length - 1;
      i > 0;
      i--
    ) {
      const j = Math.floor(
        Math.random() * (i + 1)
      );

      [
        copy[i],
        copy[j]
      ] = [
        copy[j],
        copy[i]
      ];
    }

    return copy;
  }

  /* =========================================================
     CHALLENGE TABLE
  ========================================================= */

  function calculateEntry(table) {
    return Math.round(
      Number(table) * ENTRY_RATE
    );
  }

  function calculatePayout(table, playerWins, botWins) {
    /*
      Only these final winning scores
      produce a payout.
    */

    if (playerWins !== 3 &&
        playerWins !== 4 &&
        playerWins !== 5) {
      return 0;
    }

    /*
      Make sure the final score is valid.
    */
    if (
      playerWins + botWins !==
      CHALLENGE_ROUNDS
    ) {
      return 0;
    }

    return Math.round(
      Number(table) *
      PAYOUT_RATES[playerWins]
    );
  }

  function getSelectedTableIndex() {
    const index =
      CHALLENGE_TABLES.indexOf(
        selectedTable
      );

    return index >= 0 ? index : 0;
  }

  function selectChallengeTable(
    table,
    allowDuringActive = false
  ) {
    if (
      !allowDuringActive &&
      hasActiveChallenge()
    ) {
      showTemporaryStatus(
        "Finish or quit the current challenge before changing the table."
      );

      return;
    }

    if (
      !CHALLENGE_TABLES.includes(
        Number(table)
      )
    ) {
      return;
    }

    selectedTable = Number(table);

    selectedEntry =
      calculateEntry(
        selectedTable
      );

    saveSelectedTable();

    updateChallengeTableUI();
    updateChallengeUI();
  }

  function changeChallengeTable(direction) {
    if (hasActiveChallenge()) {
      showTemporaryStatus(
        "The challenge table is locked during an active challenge."
      );

      return;
    }

    let index =
      getSelectedTableIndex();

    index += direction;

    if (index < 0) {
      index =
        CHALLENGE_TABLES.length - 1;
    }

    if (
      index >=
      CHALLENGE_TABLES.length
    ) {
      index = 0;
    }

    selectChallengeTable(
      CHALLENGE_TABLES[index]
    );
  }

  function saveSelectedTable() {
    if (!currentKey) return;

    localStorage.setItem(
      TABLE_KEY_PREFIX + currentKey,
      String(selectedTable)
    );
  }

  function loadSelectedTable() {
    if (!currentKey) return;

    const saved =
      Number(
        localStorage.getItem(
          TABLE_KEY_PREFIX + currentKey
        )
      );

    if (
      CHALLENGE_TABLES.includes(saved)
    ) {
      selectedTable = saved;
    } else {
      selectedTable = 500;
    }

    selectedEntry =
      calculateEntry(
        selectedTable
      );
  }

  /* =========================================================
     CREATE CHALLENGE TABLE UI
  ========================================================= */

  function createChallengeTableUI() {
    /*
      Do not duplicate it if already created.
    */

    if (
      document.getElementById(
        "challengeTableArea"
      )
    ) {
      return;
    }

    const hero =
      document.querySelector(
        "#gameView .hero"
      );

    if (!hero) return;

    const area =
      document.createElement("section");

    area.id =
      "challengeTableArea";

    area.className =
      "challenge-table-area";

    area.innerHTML = `
      <div class="challenge-table-head">

        <div>
          <div class="eyebrow">
            CHALLENGE TABLE
          </div>

          <strong>
            Choose your challenge
          </strong>

          <small>
            Tap the table icon to view all tables.
          </small>
        </div>

        <button
          id="tableToggleBtn"
          class="table-toggle-btn"
          type="button"
          aria-label="Open challenge table"
          aria-expanded="false"
        >
          ▦
        </button>

      </div>

      <div
        id="challengeTablePanel"
        class="challenge-table-panel hidden"
      >

        <div class="challenge-picker">

          <button
            id="tablePrevBtn"
            class="challenge-arrow"
            type="button"
            aria-label="Previous challenge table"
          >
            &lt;
          </button>

          <div class="challenge-selected">

            <small>
              SELECTED TABLE
            </small>

            <strong
              id="selectedTableAmount"
            >
              ₦500
            </strong>

            <span
              id="selectedTableEntry"
            >
              Entry ₦50
            </span>

          </div>

          <button
            id="tableNextBtn"
            class="challenge-arrow"
            type="button"
            aria-label="Next challenge table"
          >
            &gt;
          </button>

        </div>

        <div
          id="payoutTable"
          class="payout-table"
        ></div>

      </div>
    `;

    /*
      Place immediately after hero.
    */

    hero.insertAdjacentElement(
      "afterend",
      area
    );

    $("tableToggleBtn")
      .addEventListener(
        "click",
        toggleChallengeTable
      );

    $("tablePrevBtn")
      .addEventListener(
        "click",
        () =>
          changeChallengeTable(-1)
      );

    $("tableNextBtn")
      .addEventListener(
        "click",
        () =>
          changeChallengeTable(1)
      );

    updateChallengeTableUI();
  }

  function toggleChallengeTable() {
    const panel =
      $("challengeTablePanel");

    const button =
      $("tableToggleBtn");

    if (!panel || !button) return;

    const isHidden =
      panel.classList.contains(
        "hidden"
      );

    if (isHidden) {
      show(panel);

      button.setAttribute(
        "aria-expanded",
        "true"
      );
    } else {
      hide(panel);

      button.setAttribute(
        "aria-expanded",
        "false"
      );
    }
  }

  function updateChallengeTableUI() {
    createChallengeTableUI();

    const amountEl =
      $("selectedTableAmount");

    const entryEl =
      $("selectedTableEntry");

    const payoutEl =
      $("payoutTable");

    /*
      Update wallet.
    */

    const wallet =
      document.querySelector(
        ".wallet"
      );

    if (wallet) {
      wallet.innerHTML = `
        <span>
          Challenge Entry
        </span>

        <strong>
          ${money(selectedEntry)}
        </strong>

        <small>
          Table ${money(selectedTable)} /
          5 scored rounds
        </small>
      `;
    }

    if (amountEl) {
      amountEl.textContent =
        money(selectedTable);
    }

    if (entryEl) {
      entryEl.textContent =
        `Entry ${money(selectedEntry)}`;
    }

    if (!payoutEl) return;

    const payout32 =
      Math.round(
        selectedTable * 0.40
      );

    const payout41 =
      Math.round(
        selectedTable * 0.70
      );

    const payout50 =
      Math.round(
        selectedTable * 1.00
      );

    payoutEl.innerHTML = `
      <div class="payout-table-title">
        <span>FINAL SCORE</span>
        <span>PAYOUT</span>
      </div>

      <button
        type="button"
        class="payout-row"
        data-table="${selectedTable}"
      >
        <span>
          3 – 2
        </span>
        <b>
          ${money(payout32)}
        </b>
      </button>

      <button
        type="button"
        class="payout-row"
        data-table="${selectedTable}"
      >
        <span>
          4 – 1
        </span>
        <b>
          ${money(payout41)}
        </b>
      </button>

      <button
        type="button"
        class="payout-row"
        data-table="${selectedTable}"
      >
        <span>
          5 – 0
        </span>
        <b>
          ${money(payout50)}
        </b>
      </button>

      <div class="payout-note">
        Entry: ${money(selectedEntry)}
      </div>
    `;

    /*
      Clicking a payout row selects
      the currently displayed table.

      This also gives the table the
      clickable behaviour requested.
    */

    payoutEl
      .querySelectorAll(
        ".payout-row"
      )
      .forEach(row => {
        row.addEventListener(
          "click",
          () => {
            selectChallengeTable(
              Number(
                row.dataset.table
              )
            );

            showTemporaryStatus(
              `${money(selectedTable)} table selected.`
            );
          }
        );
      });
  }

  /* =========================================================
     ACCOUNT STORAGE
  ========================================================= */

  function accountStorageKey(key) {
    return (
      "tiktak_account_" +
      key
    );
  }

  function activeStorageKey(key) {
    return (
      ACTIVE_KEY_PREFIX +
      key
    );
  }

  function saveAccount() {
    if (
      !currentKey ||
      !user
    ) {
      return;
    }

    localStorage.setItem(
      accountStorageKey(
        currentKey
      ),
      JSON.stringify(user)
    );
  }

  function loadAccount(key) {
    const saved =
      localStorage.getItem(
        accountStorageKey(key)
      );

    if (saved) {
      try {
        const parsed =
          JSON.parse(saved);

        if (DATA.users[key]) {
          return {
            ...DATA.users[key],
            ...parsed
          };
        }

        return parsed;
      } catch (error) {
        console.warn(
          "Could not read saved TikTak account."
        );
      }
    }

    return (
      DATA.users[key] ||
      null
    );
  }

  function saveLoginSession() {
    if (!currentKey) return;

    localStorage.setItem(
      SESSION_KEY,
      currentKey
    );
  }

  function clearLoginSession() {
    localStorage.removeItem(
      SESSION_KEY
    );

    currentKey = null;
    user = null;
  }

  /* =========================================================
     ACTIVE CHALLENGE STORAGE
  ========================================================= */

  function hasActiveChallenge() {
    if (!currentKey) {
      return false;
    }

    const saved =
      localStorage.getItem(
        activeStorageKey(
          currentKey
        )
      );

    if (!saved) {
      return false;
    }

    try {
      const state =
        JSON.parse(saved);

      return (
        state &&
        state.challengePhase !==
          "complete" &&
        state.challengePhase !==
          "quit"
      );
    } catch {
      return false;
    }
  }

  function saveActiveChallenge() {
    if (!currentKey) return;

    /*
      Do not save completed/quit challenges
      as active challenges.
    */

    if (
      challengePhase ===
        "complete" ||
      challengePhase ===
        "quit"
    ) {
      return;
    }

    const state = {
      version: 2,

      selectedTable,
      selectedEntry,

      board: [...board],

      active,
      botThinking,

      roundWinner,

      playerScore,
      botScore,
      ties,

      currentRound,
      roundHistory: [
        ...roundHistory
      ],

      botSequence: [
        ...botSequence
      ],

      botSequenceIndex,
      currentBotDifficulty,

      turn,

      challengePhase,

      savedAt:
        new Date().toISOString()
    };

    localStorage.setItem(
      activeStorageKey(
        currentKey
      ),
      JSON.stringify(state)
    );
  }

  function loadActiveChallenge() {
    if (!currentKey) {
      return null;
    }

    const saved =
      localStorage.getItem(
        activeStorageKey(
          currentKey
        )
      );

    if (!saved) {
      return null;
    }

    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem(
        activeStorageKey(
          currentKey
        )
      );

      return null;
    }
  }

  function clearActiveChallenge() {
    if (!currentKey) return;

    localStorage.removeItem(
      activeStorageKey(
        currentKey
      )
    );
  }

  /* =========================================================
     LOGIN
  ========================================================= */

  function login() {
    const input =
      $("keyInput");

    const key =
      input.value
        .trim()
        .toUpperCase();

    if (!key) {
      $("loginMsg").textContent =
        "Please enter your personal key.";

      return;
    }

    const foundUser =
      loadAccount(key);

    if (!foundUser) {
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

    loadSelectedTable();

    $("loginMsg").textContent =
      "";

    $("playerName").textContent =
      user.name
        .split(" ")[0];

    updateStats();

    hide(loginView);
    hide(registerView);

    show(gameView);
    show(menuBtn);

    createChallengeTableUI();
    updateChallengeTableUI();

    /*
      IMPORTANT:

      If a challenge already exists,
      restore it.

      Do NOT create a new challenge.
    */

    if (hasActiveChallenge()) {
      restoreActiveChallenge();
    } else {
      startFreshChallenge();
    }
  }

  /* =========================================================
     REGISTRATION
  ========================================================= */

  function openRegistration() {
    hide(loginView);
    show(registerView);
    hide(menu);
  }

  function backToLogin() {
    hide(registerView);
    show(loginView);

    $("loginMsg").textContent =
      "";
  }

  function useDemoKey() {
    $("keyInput").value =
      "TT-48291";

    login();
  }

  /* =========================================================
     BOARD
  ========================================================= */

  function render() {
    if (!boardEl) return;

    boardEl.innerHTML =
      "";

    board.forEach(
      (value, index) => {
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
          !!roundWinner ||
          turn !== "player";

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
    for (
      const line of lines()
    ) {
      const [a, c, d] =
        line;

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
     BOT UTILITIES
  ========================================================= */

  function availableMoves(
    state = board
  ) {
    return state
      .map(
        (value, index) =>
          value
            ? null
            : index
      )
      .filter(
        value =>
          value !== null
      );
  }

  function findWinningMove(
    mark,
    state = board
  ) {
    for (
      let i = 0;
      i < 9;
      i++
    ) {
      if (state[i]) {
        continue;
      }

      state[i] = mark;

      const result =
        winner(state);

      state[i] = "";

      if (result) {
        return i;
      }
    }

    return -1;
  }

  function randomAvailable(
    state = board
  ) {
    return randomItem(
      availableMoves(state)
    );
  }

  function oppositeCorner(
    state = board
  ) {
    const pairs = [
      [0, 8],
      [2, 6]
    ];

    for (
      const [a, b] of pairs
    ) {
      if (
        state[a] === "X" &&
        !state[b]
      ) {
        return b;
      }

      if (
        state[b] === "X" &&
        !state[a]
      ) {
        return a;
      }
    }

    return -1;
  }

  /* =========================================================
     MINIMAX
  ========================================================= */

  function minimax(
    state,
    maximizing
  ) {
    const result =
      winner(state);

    if (result) {
      return result.mark === "O"
        ? 10
        : -10;
    }

    if (
      state.every(Boolean)
    ) {
      return 0;
    }

    if (maximizing) {
      let best =
        -Infinity;

      for (
        const move of availableMoves(
          state
        )
      ) {
        state[move] = "O";

        const score =
          minimax(
            state,
            false
          );

        state[move] = "";

        best =
          Math.max(
            best,
            score
          );
      }

      return best;
    }

    let best =
      Infinity;

    for (
      const move of availableMoves(
        state
      )
    ) {
      state[move] = "X";

      const score =
        minimax(
          state,
          true
        );

      state[move] = "";

      best =
        Math.min(
          best,
          score
        );
    }

    return best;
  }

  function perfectMove(
    state = board
  ) {
    let bestScore =
      -Infinity;

    let bestMoves = [];

    for (
      const move of availableMoves(
        state
      )
    ) {
      state[move] = "O";

      const score =
        minimax(
          state,
          false
        );

      state[move] = "";

      if (
        score > bestScore
      ) {
        bestScore =
          score;

        bestMoves = [
          move
        ];
      } else if (
        score === bestScore
      ) {
        bestMoves.push(
          move
        );
      }
    }

    return randomItem(
      bestMoves
    );
  }

  /* =========================================================
     BOT LEVEL: NORMAL
  ========================================================= */

  function normalMove() {
    /*
      Normal is more relaxed.

      It will sometimes miss a block
      and occasionally choose randomly.
    */

    const win =
      findWinningMove("O");

    if (
      win !== -1 &&
      Math.random() < 0.80
    ) {
      return win;
    }

    const block =
      findWinningMove("X");

    if (
      block !== -1 &&
      Math.random() < 0.60
    ) {
      return block;
    }

    const preferred = [
      4,
      0,
      2,
      6,
      8
    ].filter(
      i => !board[i]
    );

    if (
      preferred.length &&
      Math.random() < 0.70
    ) {
      return randomItem(
        preferred
      );
    }

    return randomAvailable();
  }

  /* =========================================================
     BOT LEVEL: ADVANCE
  ========================================================= */

  function advanceMove() {
    const win =
      findWinningMove("O");

    if (win !== -1) {
      return win;
    }

    const block =
      findWinningMove("X");

    if (
      block !== -1 &&
      Math.random() < 0.90
    ) {
      return block;
    }

    if (!board[4]) {
      return 4;
    }

    const opposite =
      oppositeCorner();

    if (
      opposite !== -1 &&
      Math.random() < 0.75
    ) {
      return opposite;
    }

    const corners =
      [0, 2, 6, 8]
        .filter(
          i => !board[i]
        );

    if (corners.length) {
      return randomItem(
        corners
      );
    }

    return randomAvailable();
  }

  /* =========================================================
     BOT LEVEL: PROFESSIONAL
  ========================================================= */

  function professionalMove() {
    const win =
      findWinningMove("O");

    if (win !== -1) {
      return win;
    }

    const block =
      findWinningMove("X");

    if (block !== -1) {
      return block;
    }

    /*
      Try to create a fork.
    */

    const available =
      availableMoves();

    for (
      const move of available
    ) {
      const test =
        [...board];

      test[move] = "O";

      let threats = 0;

      for (
        const next of availableMoves(
          test
        )
      ) {
        test[next] = "O";

        if (
          winner(test)
        ) {
          threats++;
        }

        test[next] = "";
      }

      if (
        threats >= 2
      ) {
        return move;
      }
    }

    if (!board[4]) {
      return 4;
    }

    const corners =
      [0, 2, 6, 8]
        .filter(
          i => !board[i]
        );

    if (corners.length) {
      return randomItem(
        corners
      );
    }

    return randomAvailable();
  }

  /* =========================================================
     BOT LEVEL: LEGEND
  ========================================================= */

  function legendMove() {
    const win =
      findWinningMove("O");

    if (win !== -1) {
      return win;
    }

    const block =
      findWinningMove("X");

    if (block !== -1) {
      return block;
    }

    /*
      Prevent common fork patterns.
    */

    if (
      board[4] === "X"
    ) {
      const corners =
        [0, 2, 6, 8]
          .filter(
            i => !board[i]
          );

      if (corners.length) {
        return randomItem(
          corners
        );
      }
    }

    /*
      Use minimax most of the time,
      with occasional positional choice.
    */

    if (
      Math.random() < 0.88
    ) {
      return perfectMove();
    }

    return professionalMove();
  }

  /* =========================================================
     BOT LEVEL: GRAND MASTER
  ========================================================= */

  function grandMasterMove() {
    /*
      Perfect Tic-Tac-Toe strategy.
    */

    return perfectMove();
  }

  /* =========================================================
     INTERNAL BOT SELECTOR
  ========================================================= */

  function botMove() {
    switch (
      currentBotDifficulty
    ) {
      case "Normal":
        return normalMove();

      case "Advance":
        return advanceMove();

      case "Professional":
        return professionalMove();

      case "Legend":
        return legendMove();

      case "Grand Master":
        return grandMasterMove();

      default:
        return advanceMove();
    }
  }

  /* =========================================================
     BOT LOTTERY SEQUENCE
  ========================================================= */

  function createBotSequence() {
    /*
      Start with every level once.

      Then choose ONE level to appear twice.

      Therefore:
        - every challenge has 5 selections
        - one level can appear twice
        - no level can appear 3 times
    */

    const base =
      shuffle(
        BOT_LEVELS
      );

    const duplicate =
      randomItem(
        BOT_LEVELS
      );

    base.push(
      duplicate
    );

    return shuffle(base);
  }

  /* =========================================================
     PLAYER MOVE
  ========================================================= */

  function playerMove(index) {
    if (
      !active ||
      botThinking ||
      roundWinner ||
      turn !== "player" ||
      board[index]
    ) {
      return;
    }

    board[index] = "X";

    turn = "bot";

    saveActiveChallenge();

    render();

    const finished =
      finishRoundIfNeeded("X");

    if (finished) {
      return;
    }

    botThinking = true;

    statusEl.textContent =
      "BOT is thinking…";

    saveActiveChallenge();

    render();

    clearTimeout(
      botTimer
    );

    botTimer =
      setTimeout(
        () => {
          botTimer = null;

          if (
            !active ||
            challengePhase !==
              "playing"
          ) {
            return;
          }

          const move =
            botMove();

          if (
            move !== null &&
            move !== undefined &&
            move !== -1 &&
            !board[move]
          ) {
            board[move] =
              "O";
          }

          botThinking =
            false;

          turn =
            "player";

          saveActiveChallenge();

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

  function finishRoundIfNeeded(
    mark
  ) {
    const result =
      winner(board);

    if (result) {
      roundWinner =
        result.mark;

      active = false;

      botThinking = false;

      turn =
        "player";

      highlightWinner(
        result.line
      );

      handleRoundWinner(
        result.mark
      );

      return true;
    }

    /*
      Full board = tie.

      Tie does not score.
    */

    if (
      board.every(Boolean)
    ) {
      handleTieRound();

      return true;
    }

    statusEl.textContent =
      mark === "X"
        ? "BOT's turn"
        : "Your turn";

    saveActiveChallenge();

    return false;
  }

  function highlightWinner(
    line
  ) {
    render();

    line.forEach(
      index => {
        if (
          boardEl.children[index]
        ) {
          boardEl.children[index]
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

  async function handleTieRound() {
    active = false;
    botThinking = false;

    ties++;

    challengePhase =
      "round-result";

    updateChallengeUI();

    showRoundResult(
      "TIE",
      "DRAW",
      "No score. The same round will replay.",
      "tie"
    );

    statusEl.textContent =
      "Tie — replaying this round…";

    saveActiveChallenge();

    await sleep(1100);

    if (
      !user ||
      challengePhase ===
        "complete" ||
      challengePhase ===
        "quit"
    ) {
      return;
    }

    board =
      Array(9).fill("");

    active = true;

    botThinking = false;

    roundWinner = null;

    turn =
      "player";

    challengePhase =
      "playing";

    hide(
      roundResultPanel
    );

    statusEl.textContent =
      "Your turn";

    saveActiveChallenge();

    render();
  }

  /* =========================================================
     ROUND WINNER
  ========================================================= */

  async function handleRoundWinner(
    mark
  ) {
    if (mark === "X") {
      playerScore++;
    } else {
      botScore++;
    }

    roundHistory.push({
      round: currentRound,

      winner:
        mark === "X"
          ? "PLAYER"
          : "BOT",

      playerScore,
      botScore,
      ties,

      botLevel:
        currentBotDifficulty
    });

    /*
      Do not display botLevel.
      It is only stored internally.
    */

    updateChallengeUI();

    if (mark === "X") {
      showRoundResult(
        "WIN",
        "YOU WIN",
        `Round ${currentRound} goes to you.`,
        "win"
      );
    } else {
      showRoundResult(
        "LOSS",
        "BOT WINS",
        `Round ${currentRound} goes to BOT.`,
        "loss"
      );
    }

    challengePhase =
      "round-result";

    saveActiveChallenge();

    /*
      IMPORTANT:

      We continue through all 5 scored rounds.

      This makes these final scores possible:

        3–2
        4–1
        5–0
    */

    if (
      playerScore +
      botScore >=
      CHALLENGE_ROUNDS
    ) {
      await sleep(1300);

      endChallenge();

      return;
    }

    await sleep(1300);

    currentRound++;

    botSequenceIndex =
      currentRound - 1;

    currentBotDifficulty =
      botSequence[
        botSequenceIndex
      ];

    board =
      Array(9).fill("");

    roundWinner = null;

    hide(
      roundResultPanel
    );

    startRoundDraw();
  }

  /* =========================================================
     BOT DRAW
  ========================================================= */

  async function startRoundDraw() {
    const thisDraw =
      ++drawToken;

    active = false;

    botThinking = false;

    roundWinner = null;

    turn =
      "player";

    challengePhase =
      "draw";

    board =
      Array(9).fill("");

    /*
      Select the hidden bot level
      for this scored round.

      If already restored from storage,
      keep it.
    */

    if (
      !currentBotDifficulty
    ) {
      currentBotDifficulty =
        botSequence[
          botSequenceIndex
        ];
    }

    saveActiveChallenge();

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

    await sleep(300);

    if (
      thisDraw !== drawToken
    ) {
      return;
    }

    $("drawStage").textContent =
      "Entering the draw…";

    /*
      Lottery animation.

      The actual level names are intentionally
      NOT displayed.

      01–05 represent the hidden bot pool.
    */

    for (
      let cycle = 0;
      cycle < 2;
      cycle++
    ) {
      for (
        let i = 0;
        i < slots.length;
        i++
      ) {
        if (
          thisDraw !== drawToken
        ) {
          return;
        }

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
          110 +
          cycle * 45
        );
      }
    }

    /*
      The selected visual position is
      presentation only.

      The actual hidden difficulty
      has already been selected internally.
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

    if (
      slots[selected]
    ) {
      slots[selected]
        .classList.add(
          "selected"
        );
    }

    $("drawStage").textContent =
      `ROUND ${currentRound} READY`;

    $("drawResult").textContent =
      "BOT READY";

    saveActiveChallenge();

    await sleep(800);

    if (
      thisDraw !== drawToken
    ) {
      return;
    }

    hide(drawPanel);

    active = true;

    botThinking = false;

    roundWinner = null;

    turn =
      "player";

    challengePhase =
      "playing";

    statusEl.textContent =
      "Your turn";

    saveActiveChallenge();

    render();
  }

  /* =========================================================
     START NEW CHALLENGE
  ========================================================= */

  function startFreshChallenge() {
    /*
      Absolutely do not overwrite
      an existing active challenge.
    */

    if (
      hasActiveChallenge()
    ) {
      restoreActiveChallenge();

      return;
    }

    playerScore = 0;
    botScore = 0;
    ties = 0;

    currentRound = 1;

    roundHistory = [];

    board =
      Array(9).fill("");

    active = false;

    botThinking = false;

    roundWinner = null;

    turn =
      "player";

    challengePhase =
      "draw";

    /*
      New hidden bot lottery.
    */

    botSequence =
      createBotSequence();

    botSequenceIndex = 0;

    currentBotDifficulty =
      botSequence[0];

    selectedEntry =
      calculateEntry(
        selectedTable
      );

    hide(
      roundResultPanel
    );

    hide(
      $("paymentNotice")
    );

    updateChallengeUI();

    saveSelectedTable();

    saveActiveChallenge();

    startRoundDraw();
  }

  /*
    Public new-challenge action.

    This NEVER interrupts an active challenge.
  */

  function newChallenge() {
    if (
      hasActiveChallenge()
    ) {
      showTemporaryStatus(
        "A challenge is already in progress. Finish or quit it first."
      );

      return;
    }

    startFreshChallenge();
  }

  /* =========================================================
     RESTORE ACTIVE CHALLENGE
  ========================================================= */

  function restoreActiveChallenge() {
    const state =
      loadActiveChallenge();

    if (!state) {
      startFreshChallenge();

      return;
    }

    selectedTable =
      CHALLENGE_TABLES.includes(
        Number(
          state.selectedTable
        )
      )
        ? Number(
            state.selectedTable
          )
        : 500;

    selectedEntry =
      calculateEntry(
        selectedTable
      );

    board =
      Array.isArray(
        state.board
      )
        ? [
            ...state.board
          ]
        : Array(9).fill("");

    active =
      !!state.active;

    botThinking =
      !!state.botThinking;

    roundWinner =
      state.roundWinner ||
      null;

    playerScore =
      Number(
        state.playerScore || 0
      );

    botScore =
      Number(
        state.botScore || 0
      );

    ties =
      Number(
        state.ties || 0
      );

    currentRound =
      Number(
        state.currentRound || 1
      );

    roundHistory =
      Array.isArray(
        state.roundHistory
      )
        ? [
            ...state.roundHistory
          ]
        : [];

    botSequence =
      Array.isArray(
        state.botSequence
      ) &&
      state.botSequence.length
        ? [
            ...state.botSequence
          ]
        : createBotSequence();

    botSequenceIndex =
      Number(
        state.botSequenceIndex || 0
      );

    currentBotDifficulty =
      state.currentBotDifficulty ||
      botSequence[
        botSequenceIndex
      ];

    turn =
      state.turn === "bot"
        ? "bot"
        : "player";

    challengePhase =
      state.challengePhase ||
      "playing";

    createChallengeTableUI();

    updateChallengeTableUI();
    updateChallengeUI();

    hide(
      roundResultPanel
    );

    /*
      Resume based on the exact
      logical state.
    */

    if (
      challengePhase ===
      "draw"
    ) {
      active = false;

      botThinking = false;

      roundWinner = null;

      startRoundDraw();

      return;
    }

    if (
      challengePhase ===
      "round-result"
    ) {
      /*
        A reload during a result animation
        should not duplicate the round.

        The completed round is already
        stored in the scores.

        Continue to the next round.
      */

      if (
        playerScore +
        botScore >=
        CHALLENGE_ROUNDS
      ) {
        endChallenge();

        return;
      }

      currentRound =
        playerScore +
        botScore +
        1;

      botSequenceIndex =
        currentRound - 1;

      currentBotDifficulty =
        botSequence[
          botSequenceIndex
        ];

      board =
        Array(9).fill("");

      roundWinner = null;

      startRoundDraw();

      return;
    }

    if (
      challengePhase ===
      "playing"
    ) {
      roundWinner = null;

      /*
        If it was the bot's turn when
        the browser was closed/reloaded,
        safely resume the bot move.
      */

      if (
        turn === "bot"
      ) {
        active = true;

        botThinking = true;

        statusEl.textContent =
          "BOT is thinking…";

        saveActiveChallenge();

        render();

        clearTimeout(
          botTimer
        );

        botTimer =
          setTimeout(
            () => {
              botTimer = null;

              if (
                !active ||
                challengePhase !==
                  "playing"
              ) {
                return;
              }

              const move =
                botMove();

              if (
                move !== null &&
                move !== undefined &&
                move !== -1 &&
                !board[move]
              ) {
                board[move] =
                  "O";
              }

              botThinking = false;

              turn =
                "player";

              saveActiveChallenge();

              render();

              finishRoundIfNeeded(
                "O"
              );
            },
            450
          );

        return;
      }

      active = true;

      botThinking = false;

      turn =
        "player";

      statusEl.textContent =
        "Your turn";

      saveActiveChallenge();

      render();

      return;
    }

    /*
      Safety fallback.
    */

    startFreshChallenge();
  }

  /* =========================================================
     CHALLENGE END
  ========================================================= */

  function endChallenge() {
    active = false;

    botThinking = false;

    roundWinner =
      "CHALLENGE_COMPLETE";

    turn =
      "player";

    challengePhase =
      "complete";

    /*
      Final payout.

      Examples for ₦500:

      3–2 = ₦200
      4–1 = ₦350
      5–0 = ₦500
    */

    const won =
      playerScore >
      botScore;

    const payout =
      won
        ? calculatePayout(
            selectedTable,
            playerScore,
            botScore
          )
        : 0;

    if (
      typeof user.games !==
      "number"
    ) {
      user.games = 0;
    }

    if (
      typeof user.wins !==
      "number"
    ) {
      user.wins = 0;
    }

    if (
      typeof user.losses !==
      "number"
    ) {
      user.losses = 0;
    }

    if (
      typeof user.winnings !==
      "number"
    ) {
      user.winnings = 0;
    }

    user.games++;

    if (won) {
      user.wins++;

      user.winnings +=
        payout;
    } else {
      user.losses++;
    }

    saveAccount();

    updateStats();

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

    /*
      The challenge is now finished.

      Therefore it is safe to remove
      the active challenge record.

      Account statistics remain saved.
    */

    clearActiveChallenge();

    render();
  }

  /* =========================================================
     FINAL RESULT
  ========================================================= */

  function showFinalResult(
    won,
    payout
  ) {
    show(
      roundResultPanel
    );

    roundResultPanel
      .classList.remove(
        "loss",
        "tie"
      );

    if (won) {
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
        "Challenge complete — you won.";
    } else {
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
        "Challenge complete — you lost.";
    }

    $("roundNumber")
      .textContent =
      CHALLENGE_ROUNDS;

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
  ) {
    show(
      roundResultPanel
    );

    roundResultPanel
      .classList.remove(
        "loss",
        "tie"
      );

    if (className) {
      roundResultPanel
        .classList.add(
          className
        );
    }

    if (
      type === "WIN"
    ) {
      $("roundResultIcon")
        .textContent =
        "✓";
    } else if (
      type === "LOSS"
    ) {
      $("roundResultIcon")
        .textContent =
        "×";
    } else {
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

  function updateChallengeUI() {
    if (!$("roundNumber")) {
      return;
    }

    $("roundNumber")
      .textContent =
      Math.min(
        currentRound,
        CHALLENGE_ROUNDS
      );

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
      During an active challenge,
      the scorebar shows the current
      challenge score.

      After completion, updateStats()
      restores lifetime statistics.
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

  function updateStats() {
    if (!user) return;

    $("wins")
      .textContent =
      user.wins || 0;

    $("losses")
      .textContent =
      user.losses || 0;

    $("statWins")
      .textContent =
      user.wins || 0;

    $("statLosses")
      .textContent =
      user.losses || 0;

    $("games")
      .textContent =
      user.games || 0;

    $("winnings")
      .textContent =
      money(
        user.winnings || 0
      );
  }

  /* =========================================================
     TEMPORARY STATUS
  ========================================================= */

  let temporaryStatusTimer = null;

  function showTemporaryStatus(
    message
  ) {
    if (!statusEl) return;

    statusEl.textContent =
      message;

    clearTimeout(
      temporaryStatusTimer
    );

    temporaryStatusTimer =
      setTimeout(
        () => {
          if (
            challengePhase ===
            "playing"
          ) {
            statusEl.textContent =
              turn === "bot"
                ? "BOT's turn"
                : "Your turn";
          }
        },
        2200
      );
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

      player:
        user.name,

      email:
        user.email,

      result,

      table:
        selectedTable,

      entry:
        selectedEntry,

      challengeScore:
        `${playerScore}-${botScore}`,

      ties,

      roundHistory:
        [...roundHistory],

      rounds:
        CHALLENGE_ROUNDS,

      payout:
        amount,

      time:
        new Date().toISOString()
    };

    /*
      Frontend prototype.

      You can later send this report
      to your own backend/manual system.
    */

    console.info(
      "TIKTAK CHALLENGE REPORT:",
      report
    );

    if (
      result === "WIN"
    ) {
      $("paymentNotice")
        .textContent =
        `Win recorded (${gameId}). ` +
        `Table: ${money(selectedTable)}. ` +
        `Final score: ${playerScore}-${botScore}. ` +
        `Payout: ${money(amount)}.`;

      show(
        $("paymentNotice")
      );
    }
  }

  /* =========================================================
     QUIT
  ========================================================= */

  function quitChallenge() {
    /*
      Allow quitting from either:
      - draw
      - playing
      - bot thinking

      because the challenge is still unfinished.
    */

    if (
      !hasActiveChallenge()
    ) {
      return;
    }

    openModal(
      "Quit challenge?",
      `If you quit this unfinished ${money(selectedEntry)} challenge, it will be recorded as a loss. Are you sure?`,
      () => {
        clearTimeout(
          botTimer
        );

        botTimer = null;

        drawToken++;

        active = false;

        botThinking = false;

        roundWinner =
          "QUIT";

        turn =
          "player";

        challengePhase =
          "quit";

        if (
          typeof user.games !==
          "number"
        ) {
          user.games = 0;
        }

        if (
          typeof user.losses !==
          "number"
        ) {
          user.losses = 0;
        }

        user.games++;
        user.losses++;

        saveAccount();

        updateStats();

        clearActiveChallenge();

        statusEl.textContent =
          "Challenge quit — recorded as a loss.";

        showRoundResult(
          "LOSS",
          "CHALLENGE QUIT",
          `The unfinished ${money(selectedEntry)} challenge was recorded as a loss.`,
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
  ) {
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

  function closeModal() {
    hide(modal);

    modal._confirm =
      null;
  }

  /* =========================================================
     ACCOUNT MENU
  ========================================================= */

  function account(type) {
    if (
      !user ||
      !currentKey
    ) {
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

    if (
      type === "settings"
    ) {
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
        ([label, value]) => {
          const row =
            document.createElement(
              "div"
            );

          row.className =
            "account-row";

          row.innerHTML = `
            <div>
              <span>${label}</span>
              <b>${value || "—"}</b>
            </div>

            <button
              type="button"
              class="edit-account-btn"
              data-field="${label}"
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

    if (
      type === "play"
    ) {
      $("accountText")
        .textContent =
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
                Pay ${money(selectedEntry)}
                for the selected table
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

        <div class="notice">
          Current challenge table:
          <b>${money(selectedTable)}</b><br>
          Entry:
          <b>${money(selectedEntry)}</b>
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

    if (
      type === "add"
    ) {
      $("accountText")
        .textContent =
        "Complete Play for Money setup first.";

      content.innerHTML = `
        <div class="notice">
          Add Money will become available
          through your payment setup flow.
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
              user.winnings || 0
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

  function paymentPage(
    content
  ) {
    content.innerHTML = `
      <div class="account-grid">

        <div class="account-row">

          <div>
            <span>Bank</span>

            <b>
              ${DATA.payment.bankName || "YOUR BANK"}
            </b>
          </div>

          <button
            type="button"
            data-copy="${DATA.payment.bankName || ""}"
          >
            Copy
          </button>

        </div>

        <div class="account-row">

          <div>
            <span>Account name</span>

            <b>
              ${DATA.payment.accountName || "YOUR ACCOUNT NAME"}
            </b>
          </div>

          <button
            type="button"
            data-copy="${DATA.payment.accountName || ""}"
          >
            Copy
          </button>

        </div>

        <div class="account-row">

          <div>
            <span>Account number</span>

            <b>
              ${DATA.payment.accountNumber || "0000000000"}
            </b>
          </div>

          <button
            type="button"
            data-copy="${DATA.payment.accountNumber || ""}"
          >
            Copy
          </button>

        </div>

      </div>

      <div class="notice">

        Pay exactly
        <b>${money(selectedEntry)}</b>

        for the currently selected
        <b>${money(selectedTable)}</b>
        challenge table.

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
        }
      );
  }

  /* =========================================================
     RESTORE LOGIN
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
      loadAccount(
        savedKey
      );

    if (!savedUser) {
      clearLoginSession();

      return;
    }

    currentKey =
      savedKey;

    user =
      savedUser;

    loadSelectedTable();

    $("playerName")
      .textContent =
      user.name
        .split(" ")[0];

    updateStats();

    hide(loginView);
    hide(registerView);

    show(gameView);
    show(menuBtn);

    createChallengeTableUI();
    updateChallengeTableUI();

    /*
      This is the important part:

      Reloading/reopening does NOT
      start a fresh challenge if one exists.
    */

    if (
      hasActiveChallenge()
    ) {
      restoreActiveChallenge();
    } else {
      startFreshChallenge();
    }
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
          event.key ===
          "Enter"
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

  /*
    New Challenge button.

    It can NEVER interrupt an active challenge.
  */

  $("newGameBtn")
    .addEventListener(
      "click",
      () => {
        if (
          hasActiveChallenge()
        ) {
          openModal(
            "Challenge in progress",
            "You must finish or quit the current challenge before starting a new one.",
            () => {}
          );

          return;
        }

        newChallenge();
      }
    );

  $("quitBtn")
    .addEventListener(
      "click",
      quitChallenge
    );

  /* =========================================================
     THREE-DOT MENU
  ========================================================= */

  menuBtn.addEventListener(
    "click",
    () => {
      if (
        !user ||
        !currentKey
      ) {
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

        updateChallengeTableUI();

        /*
          If the user returns to the game,
          make sure the active challenge
          remains exactly where it was.
        */

        if (
          hasActiveChallenge()
        ) {
          const state =
            loadActiveChallenge();

          if (
            state &&
            state.challengePhase ===
              "playing"
          ) {
            active = true;

            challengePhase =
              "playing";

            render();
          }
        }
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

        if (fn) {
          fn();
        }

        closeModal();
      }
    );

  /* =========================================================
     INITIALISE
  ========================================================= */

  createChallengeTableUI();

  restoreSession();

})();
