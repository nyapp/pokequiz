const DATA_PATH = "./data/pokemon-national-main.json";
let pokemonData = [];

const questionText = document.getElementById("questionText");
const answerForm = document.getElementById("answerForm");
const answerInput = document.getElementById("answerInput");
const submitButton = document.getElementById("submitButton");
const resultArea = document.getElementById("resultArea");
const nextButton = document.getElementById("nextButton");
const scoreText = document.getElementById("scoreText");
const appStatus = document.getElementById("appStatus");

const MAX_TYPES_PER_QUESTION = 3;
let currentQuestion = null;
let correctCount = 0;
let totalCount = 0;
let isAnswered = false;

function getKatakana(char) {
  const code = char.charCodeAt(0);
  if (code >= 0x3041 && code <= 0x3096) {
    return String.fromCharCode(code + 0x60);
  }
  return char;
}

function normalizeName(name) {
  return name
    .trim()
    .replace(/\s+/g, "")
    .split("")
    .map(getKatakana)
    .join("");
}

function shuffle(array) {
  const list = [...array];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function allTypes() {
  return [...new Set(pokemonData.flatMap((pokemon) => pokemon.types))];
}

function pickTypes() {
  const types = allTypes();
  const shuffled = shuffle(types);
  const maxLength = Math.min(MAX_TYPES_PER_QUESTION, shuffled.length);
  const typeLength = Math.floor(Math.random() * maxLength) + 1;
  return shuffled.slice(0, typeLength);
}

function hasAllTypes(pokemon, targetTypes) {
  if (targetTypes.length === 1) {
    return pokemon.types.length === 1 && pokemon.types[0] === targetTypes[0];
  }
  return targetTypes.every((type) => pokemon.types.includes(type));
}

function buildQuestionText(types) {
  const wrapped = types.map((type) => `「${type}」`).join("、");
  return `${wrapped}のタイプを同時に持つポケモンは？`;
}

function buildQuestion() {
  let targetTypes = [];
  let answers = [];
  let tries = 0;

  while (answers.length === 0 && tries < 30) {
    targetTypes = pickTypes();
    answers = pokemonData.filter((pokemon) => hasAllTypes(pokemon, targetTypes));
    tries += 1;
  }

  if (answers.length === 0) {
    targetTypes = ["ノーマル", "ひこう"];
    answers = pokemonData.filter((pokemon) => hasAllTypes(pokemon, targetTypes));
  }

  return {
    types: targetTypes,
    answers,
    answerSet: new Set(answers.map((pokemon) => normalizeName(pokemon.name))),
  };
}

function setResult(message, isCorrect) {
  resultArea.textContent = message;
  resultArea.className = isCorrect ? "result-area result-ok" : "result-area result-ng";
}

function renderScore() {
  scoreText.textContent = `${correctCount} / ${totalCount} 問 正解`;
}

function renderQuestion() {
  if (pokemonData.length === 0) {
    return;
  }
  currentQuestion = buildQuestion();
  isAnswered = false;
  questionText.textContent = buildQuestionText(currentQuestion.types);
  answerInput.value = "";
  answerInput.disabled = false;
  submitButton.disabled = false;
  answerInput.focus();
  nextButton.disabled = true;
  resultArea.textContent = "";
  resultArea.className = "result-area";
}

function setAppStatus(message, isError = false) {
  appStatus.textContent = message;
  appStatus.classList.toggle("is-error", isError);
}

function setControlsEnabled(enabled) {
  answerInput.disabled = !enabled;
  submitButton.disabled = !enabled;
  nextButton.disabled = !enabled;
}

function sanitizeLoadedData(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  const uniqueByName = new Map();
  for (const entry of raw) {
    if (!entry || typeof entry.name !== "string" || !Array.isArray(entry.types)) {
      continue;
    }
    const name = entry.name.trim();
    const types = entry.types.filter((type) => typeof type === "string" && type.trim()).map((type) => type.trim());
    if (!name || types.length === 0) {
      continue;
    }
    if (!uniqueByName.has(name)) {
      uniqueByName.set(name, { name, types: [...new Set(types)] });
    }
  }
  return [...uniqueByName.values()];
}

async function loadPokemonData() {
  try {
    const response = await fetch(DATA_PATH);
    if (!response.ok) {
      throw new Error(`failed to load data: ${response.status}`);
    }
    const raw = await response.json();
    const sanitized = sanitizeLoadedData(raw);
    if (sanitized.length > 0) {
      return sanitized;
    }
  } catch (_error) {
    // file:// 直開きなど fetch が失敗する環境向けにフォールバックする。
  }

  const raw = window.POKEMON_DATA_FALLBACK;
  const sanitized = sanitizeLoadedData(raw);
  if (sanitized.length === 0) {
    throw new Error("loaded data is empty");
  }
  return sanitized;
}

async function initializeApp() {
  setControlsEnabled(false);
  setAppStatus("図鑑データを読み込み中です...");
  try {
    pokemonData = await loadPokemonData();
    setAppStatus(`図鑑データ ${pokemonData.length} 匹を読み込みました。`);
    renderQuestion();
  } catch (error) {
    setAppStatus("図鑑データの読み込みに失敗しました。ページを再読み込みしてください。", true);
    setControlsEnabled(false);
    questionText.textContent = "データ読み込み失敗";
    resultArea.textContent = "";
  }
}

function judge(answer) {
  const normalized = normalizeName(answer);
  if (!normalized) {
    setResult("名前を入力してください。", false);
    return;
  }

  totalCount += 1;
  const isCorrect = currentQuestion.answerSet.has(normalized);
  if (isCorrect) {
    correctCount += 1;
    setResult("正解です！", true);
  } else {
    const examples = currentQuestion.answers.slice(0, 3).map((pokemon) => pokemon.name).join("、");
    setResult(`不正解です。正解例: ${examples}`, false);
  }

  renderScore();
  isAnswered = true;
  answerInput.disabled = true;
  submitButton.disabled = true;
  nextButton.disabled = false;
}

answerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!currentQuestion) {
    return;
  }
  if (isAnswered) {
    return;
  }
  judge(answerInput.value);
});

nextButton.addEventListener("click", () => {
  renderQuestion();
});

initializeApp();
