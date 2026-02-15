(function () {
  "use strict";

  var TARGET_SUM = 10;
  var MIN_NUM = 1;
  var MAX_NUM = 9;
  var RECORDS_KEY = "tangerineBoxRecords";
  var LANG_KEY = "tentenLang";
  var RECORDS_MAX = 20;
  var DISAPPEAR_TYPES = ["peel", "pop", "smile", "cry"];
  var DISAPPEAR_DURATION_MS = 650;

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
      hintDefault: "귤을 클릭해 선택하세요",
      hintSum: "선택 합: ",
      clearAll: "전체 클리어! 최종 점수: ",
      clearAllSuffix: "점",
      stageClear: "단계 클리어! 다음 단계로...",
      noRecords: "아직 기록이 없습니다.",
      recordStage: "단계 클리어",
      recordDuration: " 소요"
    },
    en: {
      title: "TENTEN - Select numbers that add up to 10",
      gameName: "TENTEN",
      startDesc: "Click tangerines that add up to 10. Clear stages to advance!",
      startBtn: "Start",
      recordsTitle: "Records",
      scoreLabel: "Score:",
      stageLabel: "Stage:",
      hintDefault: "Click tangerines to select",
      hintSum: "Sum: ",
      clearAll: "All clear! Final score: ",
      clearAllSuffix: "",
      stageClear: "Stage clear! Next stage...",
      noRecords: "No records yet.",
      recordStage: "clear",
      recordDuration: ""
    },
    ja: {
      title: "テンテン(TENTEN) - 合計10を選ぼう",
      gameName: "テンテン(TENTEN)",
      startDesc: "合計が10になるみかんをクリックして選んでね。ステージをクリアして次へ進もう！",
      startBtn: "スタート",
      recordsTitle: "記録",
      scoreLabel: "スコア:",
      stageLabel: "ステージ:",
      hintDefault: "みかんをクリックして選択",
      hintSum: "合計: ",
      clearAll: "全クリア！最終スコア: ",
      clearAllSuffix: "点",
      stageClear: "ステージクリア！次へ...",
      noRecords: "記録はまだありません。",
      recordStage: "ステージクリア",
      recordDuration: "所要"
    }
  };

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
    if (sumHintEl) updateSumHint();
    document.querySelectorAll(".lang-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-lang") === currentLang);
    });
    renderRecords();
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
  var recordsListEl = document.getElementById("records-list");
  var gameScreenEl = document.getElementById("game-screen");
  var gameEl = document.getElementById("game");
  var scoreEl = document.getElementById("score");
  var stageEl = document.getElementById("stage");
  var sumHintEl = document.getElementById("sum-hint");
  var resultEl = document.getElementById("result");

  var score = 0;
  var currentLevel = 1;
  var gameStartTime = 0;
  var tangerines = [];
  var selectedTangerines = []; // 클릭으로 선택된 귤 목록

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
      if (tangerines.length === 0) {
        onStageClear();
      }
    }, DISAPPEAR_DURATION_MS);
  }

  function onTangerineClick(tangerineData) {
    if (tangerineData.wrap.classList.contains("disappear")) return;
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
      saveRecord(currentLevel);
      resultEl.textContent = getT("clearAll") + score + getT("clearAllSuffix");
      resultEl.classList.remove("hidden");
      return;
    }
    currentLevel++;
    stageEl.textContent = currentLevel;
    resultEl.textContent = getT("stageClear");
    resultEl.classList.remove("hidden");
    setTimeout(function () {
      resultEl.classList.add("hidden");
      clearAndFillStage();
    }, 1200);
  }

  // --- 기록 (localStorage) ---
  function loadRecords() {
    try {
      var raw = localStorage.getItem(RECORDS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveRecord(reachedStage) {
    var durationSec = Math.floor((Date.now() - gameStartTime) / 1000);
    var now = new Date();
    var record = {
      stage: reachedStage,
      date: now.toISOString(),
      durationSec: durationSec
    };
    var list = loadRecords();
    list.unshift(record);
    list = list.slice(0, RECORDS_MAX);
    try {
      localStorage.setItem(RECORDS_KEY, JSON.stringify(list));
    } catch (e) {}
    renderRecords();
  }

  function formatRecord(r) {
    var d = new Date(r.date);
    var dateStr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    var timeStr = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0");
    var min = Math.floor(r.durationSec / 60);
    var sec = r.durationSec % 60;
    var durationStr = currentLang === "en" ? min + "m " + sec + "s" : (currentLang === "ja" ? min + "分" + sec + "秒" : min + "분 " + sec + "초");
    var part = currentLang === "en" ? "Stage " + r.stage + " " + getT("recordStage") : r.stage + getT("recordStage");
    var suffix = getT("recordDuration");
    return part + " · " + dateStr + " " + timeStr + (suffix ? " · " + durationStr + suffix : " · " + durationStr);
  }

  function renderRecords() {
    var list = loadRecords();
    if (!recordsListEl) return;
    if (list.length === 0) {
      recordsListEl.innerHTML = "<p class=\"records-empty\">" + getT("noRecords") + "</p>";
      return;
    }
    recordsListEl.innerHTML = list.map(function (r) {
      return "<li>" + formatRecord(r) + "</li>";
    }).join("");
  }

  // --- 이벤트: 게임 영역에서 클릭한 요소가 귤이면 토글
  function handleGameAreaClick(e) {
    var wrap = e.target.closest(".tangerine-wrap");
    if (!wrap) return;
    var t = tangerines.find(function (x) { return x.wrap === wrap; });
    if (t) onTangerineClick(t);
  }

  function startGame() {
    startScreenEl.classList.add("hidden");
    gameScreenEl.classList.remove("hidden");
    score = 0;
    currentLevel = 1;
    gameStartTime = Date.now();
    scoreEl.textContent = "0";
    stageEl.textContent = "1";
    resultEl.classList.add("hidden");
    clearAndFillStage();
  }

  function init() {
    setLang(currentLang);
    document.body.addEventListener("click", function (e) {
      var btn = e.target.closest(".lang-btn");
      if (btn && btn.getAttribute("data-lang")) setLang(btn.getAttribute("data-lang"));
    });
    startBtnEl.addEventListener("click", startGame);
    gameEl.addEventListener("click", handleGameAreaClick);
    gameEl.addEventListener("touchend", function (e) {
      e.preventDefault();
      var wrap = e.target.closest(".tangerine-wrap");
      if (wrap) {
        var t = tangerines.find(function (x) { return x.wrap === wrap; });
        if (t) onTangerineClick(t);
      }
    }, { passive: false });
  }

  init();
})();
