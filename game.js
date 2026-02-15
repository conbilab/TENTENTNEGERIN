(function () {
  "use strict";

  var TARGET_SUM = 10;
  var MIN_NUM = 1;
  var MAX_NUM = 9;
  var RECORDS_KEY = "tangerineBoxRecords";
  var LANG_KEY = "tentenLang";
  var SOUND_KEY = "tentenSound";
  var VOLUME_KEY = "tentenVolume";
  var RECORDS_MAX = 10;
  var DISAPPEAR_TYPES = ["peel", "pop", "smile", "cry"];
  var DISAPPEAR_DURATION_MS = 650;

  /** 게임 플레이 제한 시간(초), 귤 클리어 시 보너스 시간 */
  var INITIAL_TIME_SEC = 100;
  var BONUS_SEC_PER_CLEAR = 1;

  // --- 사운드: 효과음(Web Audio API) + BGM(sounds 폴더 파일) ---
  var audioCtx = null;
  /** BGM·효과음 켜기 여부 (localStorage 반영, 기본 ON) */
  var soundEnabled = (function () {
    try {
      var v = localStorage.getItem(SOUND_KEY);
      return v !== "0";
    } catch (e) {
      return true;
    }
  })();

  /** 볼륨 0~1 (localStorage 반영, 기본 50%) */
  var soundVolume = (function () {
    try {
      var v = localStorage.getItem(VOLUME_KEY);
      if (v != null && v !== "") {
        var n = parseInt(v, 10);
        if (!isNaN(n) && n >= 0 && n <= 100) return n / 100;
      }
    } catch (e) {}
    return 0.5;
  })();

  /** sounds 폴더 BGM 파일 경로 (시작/게임/기록 화면) */
  var BGM_START = "sounds/bgm_start.mp3";
  var BGM_GAME = "sounds/bgm_game.mp3";
  var BGM_RECORDS = "sounds/bgm_records.mp3";

  /** 화면별 BGM Audio 인스턴스 (루프 재생) */
  var bgmStartEl = null;
  var bgmGameEl = null;
  var bgmRecordsEl = null;
  var currentBgmEl = null;

  function getAudioContext() {
    if (audioCtx) return audioCtx;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
  }

  /** 귀여운 클릭 효과음 (두 음 짧게, 볼륨 반영) */
  function playClickSound() {
    if (!soundEnabled) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    try {
      var now = ctx.currentTime;
      var g = ctx.createGain();
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.1 * soundVolume, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      [523.25, 659.25].forEach(function (freq, i) {
        var o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = freq;
        o.connect(g);
        o.start(now + i * 0.03);
        o.stop(now + 0.08 + i * 0.03);
      });
    } catch (e) {}
  }

  /** 귤 클리어 시 귀여운 성공음 (도미솔 짧게, 볼륨 반영) */
  function playClearSound() {
    if (!soundEnabled) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    try {
      var now = ctx.currentTime;
      var g = ctx.createGain();
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.15 * soundVolume, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      [523.25, 659.25, 783.99].forEach(function (freq, i) {
        var o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = freq;
        o.connect(g);
        o.start(now + i * 0.06);
        o.stop(now + 0.28);
      });
    } catch (e) {}
  }

  /** BGM 전부 정지 (파일 BGM용) */
  function stopBGM() {
    [bgmStartEl, bgmGameEl, bgmRecordsEl].forEach(function (el) {
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
    });
    currentBgmEl = null;
  }

  /** BGM Audio에 현재 볼륨 적용 (켜짐 시에만 볼륨, 꺼짐 시 0) */
  function applyVolumeToAllBgm() {
    var vol = soundEnabled ? soundVolume : 0;
    [bgmStartEl, bgmGameEl, bgmRecordsEl].forEach(function (el) {
      if (el) el.volume = vol;
    });
  }

  /** 화면별 BGM Audio 생성 (최초 1회, 루프·볼륨 설정) */
  function getBgmAudio(src, storeRef) {
    if (storeRef) {
      storeRef.volume = soundEnabled ? soundVolume : 0;
      return storeRef;
    }
    try {
      var a = new Audio(src);
      a.loop = true;
      a.volume = soundEnabled ? soundVolume : 0;
      if (src === BGM_START) bgmStartEl = a;
      else if (src === BGM_GAME) bgmGameEl = a;
      else if (src === BGM_RECORDS) bgmRecordsEl = a;
      return a;
    } catch (e) {
      return null;
    }
  }

  /** BGM 1: 시작 화면 - sounds/bgm_start.mp3 */
  function startScreenBGM() {
    if (!soundEnabled) return;
    stopBGM();
    var el = getBgmAudio(BGM_START, bgmStartEl);
    if (el) {
      currentBgmEl = el;
      el.play().catch(function () {});
    }
  }

  /** BGM 2: 게임 화면 - sounds/bgm_game.mp3 */
  function gamePlayBGM() {
    if (!soundEnabled) return;
    stopBGM();
    var el = getBgmAudio(BGM_GAME, bgmGameEl);
    if (el) {
      currentBgmEl = el;
      el.play().catch(function () {});
    }
  }

  /** BGM 3: 기록 화면 - sounds/bgm_records.mp3 */
  function recordsScreenBGM() {
    if (!soundEnabled) return;
    stopBGM();
    var el = getBgmAudio(BGM_RECORDS, bgmRecordsEl);
    if (el) {
      currentBgmEl = el;
      el.play().catch(function () {});
    }
  }

  /**
   * 비자 발급이 가능하고 유니코드 국기 이모지를 쓸 수 있는 나라 (ISO 3166-1 alpha-2)
   * 국기 이모지: 두 글자 코드 → Regional Indicator Symbol 조합
   */
  var COUNTRY_LIST = [
    { code: "KR", name: "Korea" },
    { code: "US", name: "United States" },
    { code: "JP", name: "Japan" },
    { code: "GB", name: "United Kingdom" },
    { code: "DE", name: "Germany" },
    { code: "FR", name: "France" },
    { code: "CA", name: "Canada" },
    { code: "AU", name: "Australia" },
    { code: "CN", name: "China" },
    { code: "TW", name: "Taiwan" },
    { code: "HK", name: "Hong Kong" },
    { code: "SG", name: "Singapore" },
    { code: "MY", name: "Malaysia" },
    { code: "TH", name: "Thailand" },
    { code: "VN", name: "Vietnam" },
    { code: "PH", name: "Philippines" },
    { code: "ID", name: "Indonesia" },
    { code: "IN", name: "India" },
    { code: "AE", name: "UAE" },
    { code: "SA", name: "Saudi Arabia" },
    { code: "TR", name: "Turkey" },
    { code: "IT", name: "Italy" },
    { code: "ES", name: "Spain" },
    { code: "NL", name: "Netherlands" },
    { code: "SE", name: "Sweden" },
    { code: "NO", name: "Norway" },
    { code: "CH", name: "Switzerland" },
    { code: "AT", name: "Austria" },
    { code: "BE", name: "Belgium" },
    { code: "PL", name: "Poland" },
    { code: "PT", name: "Portugal" },
    { code: "RU", name: "Russia" },
    { code: "BR", name: "Brazil" },
    { code: "MX", name: "Mexico" },
    { code: "AR", name: "Argentina" },
    { code: "CL", name: "Chile" },
    { code: "CO", name: "Colombia" },
    { code: "ZA", name: "South Africa" },
    { code: "EG", name: "Egypt" },
    { code: "NZ", name: "New Zealand" },
    { code: "GR", name: "Greece" },
    { code: "CZ", name: "Czech Republic" },
    { code: "HU", name: "Hungary" },
    { code: "IE", name: "Ireland" },
    { code: "FI", name: "Finland" },
    { code: "DK", name: "Denmark" },
    { code: "IL", name: "Israel" },
    { code: "RO", name: "Romania" },
    { code: "BG", name: "Bulgaria" }
  ];

  // 다국어 문구 (한국어 / 영어 / 일본어)
  var translations = {
    ko: {
      title: "텐텐(TENTEN) - 합이 10이 되게 선택하세요",
      gameName: "텐텐(TENTEN)",
      startDesc: "합이 10이 되는 귤을 클릭해서 선택하세요. 단계를 클리어하면 다음 단계로!",
      startBtn: "시작하기",
      recordsTitle: "기록",
      scoreLabel: "점수:",
      stageLabel: "단계:",
      timeLabel: "시간:",
      timeUnit: "초",
      hintDefault: "귤을 클릭해 선택하세요",
      hintSum: "선택 합: ",
      clearAll: "전체 클리어! 최종 점수: ",
      clearAllSuffix: "점",
      stageClear: "단계 클리어! 다음 단계로...",
      noRecords: "아직 기록이 없습니다.",
      recordStage: "단계 클리어",
      recordDuration: " 소요",
      gameOverTimeUp: "시간 종료!",
      gameOverStageScore: "{{stage}}단계 클리어 · 귤 {{score}}개 까기",
      fullClearResult: "전체 클리어! {{stage}}단계 · 귤 {{score}}개 까기",
      saveRecordBtn: "기록 저장하기",
      playAgainBtn: "다시 하기",
      recordSaved: "저장했어요!",
      recordStageShort: "단계",
      recordScoreShort: "귤",
      nameLabel: "이름",
      countryLabel: "나라",
      submitSave: "저장",
      namePlaceholder: "이름 또는 닉네임",
      nameRequired: "이름을 입력해 주세요.",
      rankingTitle: "기록 확인",
      finalRecordsTitle: "최종 기록",
      recordsEmpty: "비어있음",
      backToStartBtn: "처음으로",
      showRecordsBtn: "기록 보기",
      soundOnTitle: "소리 켜기",
      soundOffTitle: "소리 끄기",
      volumeLabel: "볼륨"
    },
    en: {
      title: "TENTEN - Select numbers that add up to 10",
      gameName: "TENTEN",
      startDesc: "Click tangerines that add up to 10. Clear stages to advance!",
      startBtn: "Start",
      recordsTitle: "Records",
      scoreLabel: "Score:",
      stageLabel: "Stage:",
      timeLabel: "Time:",
      timeUnit: "s",
      hintDefault: "Click tangerines to select",
      hintSum: "Sum: ",
      clearAll: "All clear! Final score: ",
      clearAllSuffix: "",
      stageClear: "Stage clear! Next stage...",
      noRecords: "No records yet.",
      recordStage: "clear",
      recordDuration: "",
      gameOverTimeUp: "Time's up!",
      gameOverStageScore: "Stage {{stage}} clear · {{score}} tangerines",
      fullClearResult: "All clear! Stage {{stage}} · {{score}} tangerines",
      saveRecordBtn: "Save record",
      playAgainBtn: "Play again",
      recordSaved: "Saved!",
      recordStageShort: "Stage",
      recordScoreShort: "tangerines",
      nameLabel: "Name",
      countryLabel: "Country",
      submitSave: "Save",
      namePlaceholder: "Name or nickname",
      nameRequired: "Please enter your name.",
      rankingTitle: "Records",
      finalRecordsTitle: "Final Records",
      recordsEmpty: "No records",
      backToStartBtn: "Back to start",
      showRecordsBtn: "View records",
      soundOnTitle: "Turn sound on",
      soundOffTitle: "Mute sound",
      volumeLabel: "Volume"
    },
    ja: {
      title: "テンテン(TENTEN) - 合計10を選ぼう",
      gameName: "テンテン(TENTEN)",
      startDesc: "合計が10になるみかんをクリックして選んでね。ステージをクリアして次へ進もう！",
      startBtn: "スタート",
      recordsTitle: "記録",
      scoreLabel: "スコア:",
      stageLabel: "ステージ:",
      timeLabel: "時間:",
      timeUnit: "秒",
      hintDefault: "みかんをクリックして選択",
      hintSum: "合計: ",
      clearAll: "全クリア！最終スコア: ",
      clearAllSuffix: "点",
      stageClear: "ステージクリア！次へ...",
      noRecords: "記録はまだありません。",
      recordStage: "ステージクリア",
      recordDuration: "所要",
      gameOverTimeUp: "時間切れ！",
      gameOverStageScore: "{{stage}}ステージクリア · みかん{{score}}個",
      fullClearResult: "全クリア！{{stage}}ステージ · みかん{{score}}個",
      saveRecordBtn: "記録を保存",
      playAgainBtn: "もう一度",
      recordSaved: "保存したよ！",
      recordStageShort: "ステージ",
      recordScoreShort: "みかん",
      nameLabel: "名前",
      countryLabel: "国",
      submitSave: "保存",
      namePlaceholder: "名前またはニックネーム",
      nameRequired: "名前を入力してください。",
      rankingTitle: "記録確認",
      finalRecordsTitle: "最終記録",
      recordsEmpty: "記録がありません",
      backToStartBtn: "最初へ",
      showRecordsBtn: "記録を見る",
      soundOnTitle: "音をつける",
      soundOffTitle: "音を消す",
      volumeLabel: "音量"
    }
  };

  /** ISO 3166-1 alpha-2 두 글자 코드 → 국기 이모지 (Regional Indicator) */
  function getFlagEmoji(code) {
    if (!code || code.length !== 2) return "";
    var c = (code || "").toUpperCase();
    return String.fromCodePoint(
      0x1F1E6 - 65 + c.charCodeAt(0),
      0x1F1E6 - 65 + c.charCodeAt(1)
    );
  }

  var currentLang = (function () {
    try {
      var saved = localStorage.getItem(LANG_KEY);
      return saved && translations[saved] ? saved : "ko";
    } catch (e) {
      return "ko";
    }
  })();

  function getT(key) {
    return (translations[currentLang] && translations[currentLang][key]) || translations.ko[key] || key;
  }

  /** 스피커 토글 버튼 아이콘·툴팁 갱신 (소리 켜짐: 🔊 / 꺼짐: 🔇) */
  function updateSoundToggleIcon() {
    var btn = document.getElementById("sound-toggle-btn");
    if (!btn) return;
    btn.textContent = soundEnabled ? "🔊" : "🔇";
    var label = soundEnabled ? getT("soundOffTitle") : getT("soundOnTitle");
    btn.title = label;
    btn.setAttribute("aria-label", label);
  }

  /** 언어 변경 시 DOM·문구 적용 및 localStorage 저장 */
  function setLang(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (e) {}
    document.documentElement.lang = lang === "ja" ? "ja" : lang === "en" ? "en" : "ko";
    document.title = getT("title");
    applyLang();
  }

  /** 화면에 보이는 모든 i18n 텍스트 갱신 */
  function applyLang() {
    var g = getT;
    var el = function (id) { return document.getElementById(id); };
    if (el("i18n-gameName")) el("i18n-gameName").textContent = g("gameName");
    if (el("i18n-gameName-header")) el("i18n-gameName-header").textContent = g("gameName");
    if (el("i18n-startDesc")) el("i18n-startDesc").textContent = g("startDesc");
    if (el("start-btn")) el("start-btn").textContent = g("startBtn");
    if (el("i18n-recordsTitle")) el("i18n-recordsTitle").textContent = g("recordsTitle");
    if (el("i18n-scoreLabel")) el("i18n-scoreLabel").textContent = g("scoreLabel");
    if (el("i18n-stageLabel")) el("i18n-stageLabel").textContent = g("stageLabel");
    if (el("i18n-timeLabel")) el("i18n-timeLabel").textContent = g("timeLabel");
    if (el("i18n-rankingTitle")) el("i18n-rankingTitle").textContent = g("rankingTitle");
    if (el("i18n-finalRecordsTitle")) el("i18n-finalRecordsTitle").textContent = g("finalRecordsTitle");
    if (el("show-records-btn")) el("show-records-btn").textContent = g("showRecordsBtn");
    if (el("back-from-records-btn")) el("back-from-records-btn").textContent = g("backToStartBtn");
    if (el("back-to-start-btn")) el("back-to-start-btn").textContent = g("backToStartBtn");
    if (el("game-back-to-start-btn")) el("game-back-to-start-btn").textContent = g("backToStartBtn");
    updateSoundToggleIcon();
    if (el("sound-volume-label")) el("sound-volume-label").textContent = g("volumeLabel");
    if (el("i18n-nameLabel")) el("i18n-nameLabel").textContent = g("nameLabel");
    if (el("i18n-countryLabel")) el("i18n-countryLabel").textContent = g("countryLabel");
    if (el("save-record-btn")) el("save-record-btn").textContent = g("submitSave");
    if (el("play-again-btn")) el("play-again-btn").textContent = g("playAgainBtn");
    if (el("record-name")) el("record-name").placeholder = g("namePlaceholder");
    if (sumHintEl) updateSumHint();
    document.querySelectorAll(".lang-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-lang") === currentLang);
    });
    fillCountrySelect();
    if (recordsScreenEl && !recordsScreenEl.classList.contains("hidden")) renderFinalRecords();
  }

  // 단계별 귤 개수 (난이도)
  function getTangerineCountForLevel(level) {
    var table = {
      1: 2,
      2: 4,
      3: 7,
      4: 8,
      5: 16,
      6: 24,
      7: 40,
      8: 60,
      9: 80,
      10: 120
    };
    return table[level] || 120;
  }

  // 5단계부터는 3개·4개 조합만 사용 (쌍으로 10 만들기 불가)
  var MIN_GROUP_LEVEL = 5;

  var PAIRS = [[1, 9], [2, 8], [3, 7], [4, 6], [5, 5]];
  var TRIPLES = [[1, 2, 7], [1, 3, 6], [1, 4, 5], [2, 3, 5]];
  var QUADS = [[1, 2, 3, 4]]; // 합 10인 4개 조합

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  /**
   * 3·4개 이상 조합만 사용 (쌍 X). count는 3과 4의 합으로만 구성 가능해야 함.
   */
  function createSolvableNumbersOnlyTriplesAndQuads(count) {
    var list = [];
    var remaining = count;
    while (remaining > 0) {
      if (remaining % 3 === 0 && remaining >= 3) {
        list = list.concat(TRIPLES[Math.floor(Math.random() * TRIPLES.length)]);
        remaining -= 3;
      } else if (remaining >= 4) {
        list = list.concat(QUADS[0].slice());
        remaining -= 4;
      } else {
        break;
      }
    }
    return shuffle(list);
  }

  /**
   * 1~4단계: 쌍+세 개 조합 허용. 5단계~: 3·4개 조합만.
   */
  function createSolvableNumbers(count, level) {
    if (level >= MIN_GROUP_LEVEL) {
      return createSolvableNumbersOnlyTriplesAndQuads(count);
    }
    var list = [];
    var remaining = count;
    while (remaining >= 3) {
      if (remaining === 3) {
        var triple = TRIPLES[Math.floor(Math.random() * TRIPLES.length)];
        list = list.concat(triple);
        remaining -= 3;
      } else {
        var pair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
        list = list.concat(pair);
        remaining -= 2;
      }
    }
    if (remaining === 2) {
      var p = PAIRS[Math.floor(Math.random() * PAIRS.length)];
      list = list.concat(p);
    }
    return shuffle(list);
  }

  // --- DOM ---
  var startScreenEl = document.getElementById("start-screen");
  var startBtnEl = document.getElementById("start-btn");
  var showRecordsBtnEl = document.getElementById("show-records-btn");
  var recordsScreenEl = document.getElementById("records-screen");
  var finalRecordsListEl = document.getElementById("final-records-list");
  var finalRecordsEmptyEl = document.getElementById("final-records-empty");
  var backFromRecordsBtnEl = document.getElementById("back-from-records-btn");
  var backToStartBtnEl = document.getElementById("back-to-start-btn");
  var gameScreenEl = document.getElementById("game-screen");
  var gameEl = document.getElementById("game");
  var scoreEl = document.getElementById("score");
  var stageEl = document.getElementById("stage");
  var sumHintEl = document.getElementById("sum-hint");
  var resultEl = document.getElementById("result");
  var timerSecEl = document.getElementById("timer-sec");
  var timerBarFillEl = document.getElementById("timer-bar-fill");
  var gameOverEl = document.getElementById("game-over");
  var gameOverMessageEl = document.getElementById("game-over-message");
  var recordFormEl = document.getElementById("record-form");
  var recordNameEl = document.getElementById("record-name");
  var recordCountryEl = document.getElementById("record-country");
  var recordSavedMsgEl = document.getElementById("record-saved-msg");
  var saveRecordBtnEl = document.getElementById("save-record-btn");
  var playAgainBtnEl = document.getElementById("play-again-btn");

  var score = 0;
  var currentLevel = 1;
  var gameStartTime = 0;
  var tangerines = [];
  var selectedTangerines = []; // 클릭으로 선택된 귤 목록
  /** 남은 시간(초), 타이머 interval ID, 게임오버 여부 */
  var timeRemainingSec = INITIAL_TIME_SEC;
  var timerIntervalId = null;
  var gameOver = false;

  /** 타이머 숫자 + 오른쪽 바(그래프) 갱신. 100% = 초기 시간, 보너스 시 100% 초과 가능 */
  function updateTimerDisplay() {
    var sec = Math.max(0, timeRemainingSec);
    if (timerSecEl) timerSecEl.textContent = sec;
    if (timerBarFillEl) {
      var pct = Math.min(100, (sec / INITIAL_TIME_SEC) * 100);
      timerBarFillEl.style.height = pct + "%";
    }
  }

  /** 1초마다 호출: 시간 감소, 0이면 게임 종료 */
  function tickTimer() {
    timeRemainingSec--;
    updateTimerDisplay();
    if (timeRemainingSec <= 0) {
      if (timerIntervalId) {
        clearInterval(timerIntervalId);
        timerIntervalId = null;
      }
      endGame(false);
    }
  }

  /**
   * 게임 종료 처리. 시간 종료 또는 전체 클리어 시 결과 패널 표시.
   * @param {boolean} isFullClear - true면 전체 클리어(10단계)로 종료
   */
  function endGame(isFullClear) {
    if (gameOver) return;
    gameOver = true;
    stopBGM();
    if (timerIntervalId) {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
    if (resultEl) resultEl.classList.add("hidden");
    var msg = isFullClear
      ? getT("fullClearResult").replace("{{stage}}", currentLevel).replace("{{score}}", score)
      : getT("gameOverTimeUp") + " " + getT("gameOverStageScore").replace("{{stage}}", currentLevel).replace("{{score}}", score);
    if (gameOverMessageEl) gameOverMessageEl.textContent = msg;
    if (gameOverEl) gameOverEl.classList.remove("hidden");
    if (recordFormEl) recordFormEl.classList.remove("hidden");
    if (recordSavedMsgEl) recordSavedMsgEl.classList.add("hidden");
    if (recordNameEl) recordNameEl.value = "";
    if (recordCountryEl) recordCountryEl.selectedIndex = 0;
    if (saveRecordBtnEl) {
      saveRecordBtnEl.disabled = false;
      saveRecordBtnEl.textContent = getT("submitSave");
    }
  }

  /**
   * 귤 개수에 맞춰 직사각형 그리드(열·행) 계산. 셀은 정사각형에 가깝게 맞춤.
   */
  function getGridLayout(count) {
    var rect = gameEl.getBoundingClientRect();
    var w = Math.max(rect.width, 320);
    var h = Math.max(rect.height, 240);
    var cols = Math.max(1, Math.ceil(Math.sqrt(count)));
    var rows = Math.ceil(count / cols);
    var cellW = w / cols;
    var cellH = h / rows;
    var cellSize = Math.min(cellW, cellH, 56);
    cellW = cellSize;
    cellH = cellSize;
    var paddingX = (w - cols * cellW) / 2 + cellW / 2;
    var paddingY = (h - rows * cellH) / 2 + cellH / 2;
    return { cols: cols, rows: rows, cellW: cellW, cellH: cellH, paddingX: paddingX, paddingY: paddingY };
  }

  /**
   * 귤 클릭 시 사라지는 연출 타입 하나 랜덤 선택 (껍질/터짐/웃음/울음)
   */
  function getRandomDisappearType() {
    return DISAPPEAR_TYPES[Math.floor(Math.random() * DISAPPEAR_TYPES.length)];
  }

  function createTangerineAt(num, grid, index) {
    var cols = grid.cols;
    var row = Math.floor(index / cols);
    var col = index % cols;
    var x = grid.paddingX + col * grid.cellW;
    var y = grid.paddingY + row * grid.cellH;

    var wrap = document.createElement("div");
    wrap.className = "tangerine-wrap";
    wrap.style.left = x + "px";
    wrap.style.top = y + "px";

    var el = document.createElement("div");
    el.className = "tangerine";
    el.textContent = num;
    el.dataset.num = String(num);
    wrap.appendChild(el);

    // 껍질 연출용 (나중에 애니메이션에서 사용)
    var peel = document.createElement("div");
    peel.className = "tangerine-peel";
    peel.setAttribute("aria-hidden", "true");
    wrap.appendChild(peel);

    gameEl.appendChild(wrap);
    var data = { wrap: wrap, el: el, peel: peel, num: num, x: x, y: y };
    tangerines.push(data);
    return data;
  }

  function clearAndFillStage() {
    tangerines.forEach(function (t) {
      if (t.wrap.parentNode) t.wrap.remove();
    });
    tangerines = [];
    selectedTangerines = [];
    updateSumHint();

    var count = getTangerineCountForLevel(currentLevel);
    var grid = getGridLayout(count);
    var numbers = createSolvableNumbers(count, currentLevel);
    for (var i = 0; i < numbers.length; i++) {
      createTangerineAt(numbers[i], grid, i);
    }
  }

  function sumOf(list) {
    return list.reduce(function (acc, t) { return acc + t.num; }, 0);
  }

  function updateSumHint() {
    var sum = sumOf(selectedTangerines);
    sumHintEl.textContent = sum > 0 ? getT("hintSum") + sum + (sum === TARGET_SUM ? " ✓" : "") : getT("hintDefault");
  }

  /**
   * 선택된 귤들을 재미있는 연출과 함께 제거 (껍질/터짐/웃음/울음 중 랜덤)
   * 합이 10이 된 직후 선택을 바로 비워서 터치/클릭 중복 시 사라지지 않는 오류 방지
   */
  function collectWithAnimation(toRemove) {
    if (toRemove.length === 0) return;
    playClearSound();
    var type = getRandomDisappearType();
    toRemove.forEach(function (t) {
      t.wrap.classList.remove("selected");
      t.wrap.classList.add("disappear", "disappear-" + type);
      if (type === "smile") t.el.textContent = "😄";
      if (type === "cry") t.el.textContent = "😢";
    });
    selectedTangerines = [];
    updateSumHint();

    setTimeout(function () {
      toRemove.forEach(function (t) {
        tangerines = tangerines.filter(function (x) { return x !== t; });
        if (t.wrap.parentNode) t.wrap.remove();
      });
      score += toRemove.length;
      scoreEl.textContent = score;
      /** 귤 클리어 시 1초 보너스 */
      if (!gameOver) {
        timeRemainingSec += BONUS_SEC_PER_CLEAR;
        updateTimerDisplay();
      }
      if (tangerines.length === 0 && !gameOver) {
        onStageClear();
      }
    }, DISAPPEAR_DURATION_MS);
  }

  function onTangerineClick(tangerineData) {
    if (gameOver) return;
    if (tangerineData.wrap.classList.contains("disappear")) return;
    playClickSound();
    var idx = selectedTangerines.indexOf(tangerineData);
    if (idx >= 0) {
      selectedTangerines.splice(idx, 1);
      tangerineData.wrap.classList.remove("selected");
    } else {
      selectedTangerines.push(tangerineData);
      tangerineData.wrap.classList.add("selected");
    }
    updateSumHint();

    var sum = sumOf(selectedTangerines);
    if (sum === TARGET_SUM) {
      var toRemove = selectedTangerines.slice();
      collectWithAnimation(toRemove);
    }
  }

  function onStageClear() {
    var maxLevel = 10;
    if (currentLevel >= maxLevel) {
      endGame(true);
      return;
    }
    currentLevel++;
    stageEl.textContent = currentLevel;
    resultEl.textContent = getT("stageClear");
    resultEl.classList.remove("hidden");
    setTimeout(function () {
      if (gameOver) return;
      resultEl.classList.add("hidden");
      clearAndFillStage();
    }, 1200);
  }

  // --- 기록 (localStorage), 최대 10명, 점수 순 랭킹 ---
  function loadRecords() {
    try {
      var raw = localStorage.getItem(RECORDS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * 기록 저장 (이름·국가·단계·점수). 점수 높은 순으로 정렬 후 상위 10명만 유지.
   */
  function saveRecord(reachedStage, scoreValue, name, countryCode) {
    var now = new Date();
    var record = {
      stage: reachedStage,
      score: scoreValue,
      date: now.toISOString(),
      name: (name || "").trim() || "-",
      countryCode: countryCode || ""
    };
    var list = loadRecords();
    list.push(record);
    list.sort(function (a, b) {
      var sa = a.score != null ? a.score : 0;
      var sb = b.score != null ? b.score : 0;
      return sb - sa;
    });
    list = list.slice(0, RECORDS_MAX);
    try {
      localStorage.setItem(RECORDS_KEY, JSON.stringify(list));
    } catch (e) {}
    // 기록 화면은 goToRecordsScreen()에서 renderFinalRecords()로 갱신
  }

  /** 게임오버 화면에서 폼 제출 시: 이름·국가 검증 후 저장 → 최종 기록 화면으로 이동 */
  function saveCurrentRecord(e) {
    if (e) e.preventDefault();
    var name = (recordNameEl && recordNameEl.value) ? recordNameEl.value.trim() : "";
    var countryCode = (recordCountryEl && recordCountryEl.value) ? recordCountryEl.value : "";
    if (!name) {
      alert(getT("nameRequired"));
      if (recordNameEl) recordNameEl.focus();
      return;
    }
    saveRecord(currentLevel, score, name, countryCode);
    if (recordFormEl) recordFormEl.classList.add("hidden");
    if (recordSavedMsgEl) {
      recordSavedMsgEl.textContent = getT("recordSaved");
      recordSavedMsgEl.classList.remove("hidden");
    }
    if (saveRecordBtnEl) saveRecordBtnEl.disabled = true;
    // 저장 후 반드시 최종 기록 화면으로 이동 (다음 틱에서 실행해 오류 시에도 전환 보장)
    setTimeout(function () {
      goToRecordsScreen();
    }, 0);
  }

  function formatRecord(r, rank) {
    var d = new Date(r.date);
    var dateStr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    var timeStr = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0");
    var flag = r.countryCode ? getFlagEmoji(r.countryCode) + " " : "";
    var name = (r.name && r.name !== "-") ? r.name : "-";
    if (r.score != null) {
      var stagePart = currentLang === "en" ? getT("recordStageShort") + " " + r.stage : r.stage + getT("recordStageShort");
      var scorePart = currentLang === "en" ? r.score + " " + getT("recordScoreShort") : (currentLang === "ja" ? getT("recordScoreShort") + r.score + "個" : getT("recordScoreShort") + " " + r.score + "개");
      var rankStr = rank != null ? rank + ". " : "";
      return rankStr + flag + name + " · " + stagePart + " · " + scorePart + " · " + dateStr + " " + timeStr;
    }
    var min = Math.floor((r.durationSec || 0) / 60);
    var sec = (r.durationSec || 0) % 60;
    var durationStr = currentLang === "en" ? min + "m " + sec + "s" : (currentLang === "ja" ? min + "分" + sec + "秒" : min + "분 " + sec + "초");
    var part = currentLang === "en" ? "Stage " + r.stage + " " + getT("recordStage") : r.stage + getT("recordStage");
    var suffix = getT("recordDuration");
    return part + " · " + dateStr + " " + timeStr + (suffix ? " · " + durationStr + suffix : " · " + durationStr);
  }

  /** 최종 기록 페이지용: 1~3등 금·은·동 메달, 4~10등 이름+귤 개수, 비어있으면 비어있음 표시 */
  function renderFinalRecords() {
    if (!finalRecordsListEl || !finalRecordsEmptyEl) return;
    var list = loadRecords().slice().sort(function (a, b) {
      var sa = a.score != null ? a.score : 0;
      var sb = b.score != null ? b.score : 0;
      return sb - sa;
    });
    if (list.length === 0) {
      finalRecordsListEl.innerHTML = "";
      finalRecordsListEl.classList.add("hidden");
      finalRecordsEmptyEl.textContent = getT("recordsEmpty");
      finalRecordsEmptyEl.classList.remove("hidden");
      return;
    }
    finalRecordsEmptyEl.classList.add("hidden");
    finalRecordsListEl.classList.remove("hidden");
    var medals = ["🥇", "🥈", "🥉"]; // 올림픽 금·은·동 메달
    finalRecordsListEl.innerHTML = list.slice(0, 10).map(function (r, i) {
      var rank = i + 1;
      var name = (r.name && r.name !== "-") ? r.name : "-";
      var flag = r.countryCode ? getFlagEmoji(r.countryCode) + " " : "";
      var stagePart = currentLang === "en" ? getT("recordStageShort") + " " + r.stage : r.stage + getT("recordStageShort");
      var scorePart = currentLang === "en" ? r.score + " " + getT("recordScoreShort") : (currentLang === "ja" ? getT("recordScoreShort") + r.score + "個" : getT("recordScoreShort") + " " + r.score + "개");
      if (rank <= 3) {
        return "<li class=\"final-rank-item final-rank-medal\">" + medals[rank - 1] + " " + flag + name + " · " + stagePart + " · " + scorePart + "</li>";
      }
      return "<li class=\"final-rank-item final-rank-name\">" + rank + ". " + flag + name + " · " + scorePart + "</li>";
    }).join("");
  }

  /** 처음 화면(시작 화면)으로 이동 */
  function goToStartScreen() {
    stopBGM();
    gameScreenEl.classList.add("hidden");
    recordsScreenEl.classList.add("hidden");
    startScreenEl.classList.remove("hidden");
    startScreenBGM();
  }

  /** 최종 기록 페이지로 이동 */
  function goToRecordsScreen() {
    stopBGM();
    startScreenEl.classList.add("hidden");
    gameScreenEl.classList.add("hidden");
    recordsScreenEl.classList.remove("hidden");
    renderFinalRecords();
    recordsScreenBGM();
  }

  /** 나라 선택 셀렉트에 옵션 채우기 (국기 이모지 + 영문 이름) */
  function fillCountrySelect() {
    if (!recordCountryEl) return;
    recordCountryEl.innerHTML = "";
    var opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "- " + getT("countryLabel") + " -";
    recordCountryEl.appendChild(opt0);
    COUNTRY_LIST.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.code;
      opt.textContent = getFlagEmoji(c.code) + " " + c.name;
      recordCountryEl.appendChild(opt);
    });
  }

  /** 모바일 터치 시 touchend + click 둘 다 발생하는 것 방지 (같은 귤 연타 무시) */
  var lastTangerineTap = { wrap: null, time: 0 };
  var TAP_DEBOUNCE_MS = 400;

  function handleTangerineTap(wrap) {
    if (!wrap) return;
    var now = Date.now();
    if (lastTangerineTap.wrap === wrap && now - lastTangerineTap.time < TAP_DEBOUNCE_MS) return;
    lastTangerineTap.wrap = wrap;
    lastTangerineTap.time = now;
    var t = tangerines.find(function (x) { return x.wrap === wrap; });
    if (t) onTangerineClick(t);
  }

  /** 게임 영역 클릭: 귤이면 선택 토글 */
  function handleGameAreaClick(e) {
    var wrap = e.target.closest(".tangerine-wrap");
    if (!wrap) return;
    handleTangerineTap(wrap);
  }

  function startGame() {
    startScreenEl.classList.add("hidden");
    gameScreenEl.classList.remove("hidden");
    score = 0;
    currentLevel = 1;
    gameStartTime = Date.now();
    gameOver = false;
    timeRemainingSec = INITIAL_TIME_SEC;
    if (timerIntervalId) {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
    timerIntervalId = setInterval(tickTimer, 1000);
    scoreEl.textContent = "0";
    stageEl.textContent = "1";
    updateTimerDisplay();
    resultEl.classList.add("hidden");
    if (gameOverEl) gameOverEl.classList.add("hidden");
    gamePlayBGM();
    clearAndFillStage();
  }

  function init() {
    setLang(currentLang);
    document.body.addEventListener("click", function (e) {
      var btn = e.target.closest(".lang-btn");
      if (btn && btn.getAttribute("data-lang")) setLang(btn.getAttribute("data-lang"));
    });
    startBtnEl.addEventListener("click", startGame);
    var gameBackToStartBtnEl = document.getElementById("game-back-to-start-btn");
    if (gameBackToStartBtnEl) gameBackToStartBtnEl.addEventListener("click", goToStartScreen);
    if (showRecordsBtnEl) showRecordsBtnEl.addEventListener("click", goToRecordsScreen);
    if (backFromRecordsBtnEl) backFromRecordsBtnEl.addEventListener("click", goToStartScreen);
    if (backToStartBtnEl) backToStartBtnEl.addEventListener("click", goToStartScreen);
    var soundToggleBtnEl = document.getElementById("sound-toggle-btn");
    var soundVolumeEl = document.getElementById("sound-volume");
    if (soundVolumeEl) {
      soundVolumeEl.value = Math.round(soundVolume * 100);
      soundVolumeEl.addEventListener("input", function () {
        var pct = parseInt(this.value, 10);
        if (!isNaN(pct) && pct >= 0 && pct <= 100) {
          soundVolume = pct / 100;
          try {
            localStorage.setItem(VOLUME_KEY, String(pct));
          } catch (e) {}
          applyVolumeToAllBgm();
        }
      });
    }
    if (soundToggleBtnEl) {
      updateSoundToggleIcon();
      soundToggleBtnEl.addEventListener("click", function () {
        soundEnabled = !soundEnabled;
        try {
          localStorage.setItem(SOUND_KEY, soundEnabled ? "1" : "0");
        } catch (e) {}
        updateSoundToggleIcon();
        if (!soundEnabled) {
          stopBGM();
        } else {
          applyVolumeToAllBgm();
          if (startScreenEl && !startScreenEl.classList.contains("hidden")) startScreenBGM();
          else if (gameScreenEl && !gameScreenEl.classList.contains("hidden")) gamePlayBGM();
          else if (recordsScreenEl && !recordsScreenEl.classList.contains("hidden")) recordsScreenBGM();
        }
      });
    }
    fillCountrySelect();
    if (recordFormEl) recordFormEl.addEventListener("submit", saveCurrentRecord);
    // 이름 입력: 모든 언어·숫자·기호 허용 (제한 없음)
    if (playAgainBtnEl) playAgainBtnEl.addEventListener("click", startGame);
    gameEl.addEventListener("click", handleGameAreaClick);
    gameEl.addEventListener("touchend", function (e) {
      var wrap = e.target.closest(".tangerine-wrap");
      if (wrap) {
        e.preventDefault();
        handleTangerineTap(wrap);
      }
    }, { passive: false });
  }

  init();
})();
