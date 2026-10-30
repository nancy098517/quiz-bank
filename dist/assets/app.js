const REQUIRED_HEADERS = ["科目", "項次", "題目", "選項1", "選項2", "選項3", "選項4", "答案"];
const OPTION_LABELS = ["A", "B", "C", "D", "E"];
const STORAGE_KEY = "quiz-bank-data-v1";

const demoRows = [
  {
    科目: "示範科目", 項次: "1", 題目: "這個網站最多支援幾個選項？",
    選項1: "三個", 選項2: "四個", 選項3: "五個", 選項4: "六個", 選項5: "七個",
    答案: "3", 答案說明: "題庫欄位預留選項1至選項5，因此支援五選一。"
  },
  {
    科目: "示範科目", 項次: "2", 題目: "只有四個選項時，選項5應如何處理？",
    選項1: "填入0", 選項2: "保持空白", 選項3: "刪除題目", 選項4: "重複選項4", 選項5: "",
    答案: "2", 答案說明: "選項5留白後，網站會自動顯示四個選項。"
  },
  {
    科目: "示範科目", 項次: "3", 題目: "練習模式會在什麼時候顯示答案？",
    選項1: "選完答案後", 選項2: "隔天", 選項3: "關閉網頁後", 選項4: "不會顯示", 選項5: "",
    答案: "1", 答案說明: "練習模式會在選擇答案後立即顯示正確答案及答案說明。"
  }
];

const state = {
  questions: [],
  quizQuestions: [],
  currentIndex: 0,
  answers: [],
  mode: "practice",
  subject: "",
};

const $ = (id) => document.getElementById(id);
const elements = {
  setupView: $("setupView"), quizView: $("quizView"), resultView: $("resultView"),
  subjectSelect: $("subjectSelect"), questionCount: $("questionCount"), startQuizButton: $("startQuizButton"),
  questionBankBadge: $("questionBankBadge"), libraryEmpty: $("libraryEmpty"), librarySummary: $("librarySummary"),
  importDialog: $("importDialog"), fileInput: $("fileInput"), dropZone: $("dropZone"), importMessage: $("importMessage"),
  quizSubjectLabel: $("quizSubjectLabel"), quizProgressLabel: $("quizProgressLabel"), progressBar: $("progressBar"),
  liveScore: $("liveScore"), questionItemLabel: $("questionItemLabel"), questionModeLabel: $("questionModeLabel"),
  questionText: $("questionText"), optionsList: $("optionsList"), explanationBox: $("explanationBox"),
  answerStatus: $("answerStatus"), correctAnswerText: $("correctAnswerText"), answerExplanation: $("answerExplanation"),
  previousButton: $("previousButton"), nextButton: $("nextButton"), resultScore: $("resultScore"),
  resultSummary: $("resultSummary"), wrongAnswerList: $("wrongAnswerList"), retryWrongButton: $("retryWrongButton"),
};

function normalizeQuestion(row, index) {
  const subject = String(row["科目"] ?? "").trim();
  const item = String(row["項次"] ?? index + 1).trim();
  const text = String(row["題目"] ?? "").trim();
  const options = [1, 2, 3, 4, 5]
    .map((number) => String(row[`選項${number}`] ?? "").trim())
    .filter(Boolean);
  const answerIndex = resolveAnswerIndex(row["答案"], options);
  const explanation = String(row["答案說明"] ?? "").trim();

  if (!subject || !text || options.length < 2 || answerIndex < 0 || answerIndex >= options.length) {
    throw new Error(`第 ${index + 2} 列資料不完整，請檢查科目、題目、選項與答案。`);
  }
  return { id: `${subject}-${item}-${index}`, subject, item, text, options, answerIndex, explanation };
}

function resolveAnswerIndex(answer, options) {
  const raw = String(answer ?? "").trim();
  if (/^[1-5]$/.test(raw)) return Number(raw) - 1;
  const letterIndex = OPTION_LABELS.indexOf(raw.toUpperCase());
  if (letterIndex >= 0) return letterIndex;
  return options.findIndex((option) => option === raw);
}

function loadRows(rows, persist = true) {
  if (!Array.isArray(rows) || !rows.length) throw new Error("題庫檔內沒有可使用的題目。");
  const questions = rows.map(normalizeQuestion);
  state.questions = questions;
  if (persist) localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
  refreshLibrary();
  showImportMessage(`已成功匯入 ${questions.length} 題。`);
}

function refreshLibrary() {
  const groups = Object.groupBy
    ? Object.groupBy(state.questions, (question) => question.subject)
    : state.questions.reduce((result, question) => {
        (result[question.subject] ||= []).push(question);
        return result;
      }, {});
  const subjects = Object.keys(groups);
  const hasQuestions = subjects.length > 0;

  elements.libraryEmpty.hidden = hasQuestions;
  elements.librarySummary.hidden = !hasQuestions;
  elements.subjectSelect.disabled = !hasQuestions;
  elements.questionCount.disabled = !hasQuestions;
  elements.startQuizButton.disabled = !hasQuestions;

  if (!hasQuestions) return;
  elements.questionBankBadge.textContent = `${state.questions.length} 題可使用`;
  elements.questionBankBadge.classList.add("ready");
  elements.subjectSelect.innerHTML = subjects
    .map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}（${groups[subject].length}題）</option>`)
    .join("");
  elements.librarySummary.innerHTML = subjects
    .map((subject) => `<div class="subject-summary"><strong>${escapeHtml(subject)}</strong><span>${groups[subject].length} 題｜四選一與五選一自動判斷</span></div>`)
    .join("");
  updateCountLimit();
}

function updateCountLimit() {
  const available = state.questions.filter((question) => question.subject === elements.subjectSelect.value).length;
  elements.questionCount.max = String(available);
  if (Number(elements.questionCount.value) > available) elements.questionCount.value = String(available);
}

async function handleFile(file) {
  if (!file) return;
  showImportMessage("正在讀取題庫…");
  try {
    const extension = file.name.split(".").pop().toLowerCase();
    let rows;
    if (extension === "json") {
      rows = JSON.parse(await file.text());
    } else if (extension === "csv") {
      rows = parseCsv(await file.text());
    } else if (["xlsx", "xls"].includes(extension)) {
      if (!window.XLSX) throw new Error("Excel讀取元件尚未載入，請確認網路連線後再試一次，或改用CSV。");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    } else {
      throw new Error("不支援這個檔案格式。請使用 Excel、CSV 或 JSON。 ");
    }
    validateHeaders(rows);
    loadRows(rows);
  } catch (error) {
    showImportMessage(error.message, true);
  } finally {
    elements.fileInput.value = "";
  }
}

function validateHeaders(rows) {
  if (!rows.length) throw new Error("題庫檔沒有資料。");
  const headers = Object.keys(rows[0]);
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`缺少欄位：${missing.join("、")}`);
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row);
  const headers = rows.shift()?.map((header) => header.replace(/^\uFEFF/, "").trim()) ?? [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function startQuiz(customQuestions = null) {
  state.mode = document.querySelector('input[name="quizMode"]:checked').value;
  state.subject = elements.subjectSelect.value;
  const pool = customQuestions || state.questions.filter((question) => question.subject === state.subject);
  const requestedCount = Math.max(1, Math.min(Number(elements.questionCount.value) || 1, pool.length));
  state.quizQuestions = shuffle([...pool]).slice(0, customQuestions ? pool.length : requestedCount);
  state.currentIndex = 0;
  state.answers = Array(state.quizQuestions.length).fill(null);
  showView("quiz");
  renderQuestion();
}

function renderQuestion() {
  const question = state.quizQuestions[state.currentIndex];
  const answer = state.answers[state.currentIndex];
  const answered = answer !== null;
  const reveal = state.mode === "practice" && answered;

  elements.quizSubjectLabel.textContent = question.subject;
  elements.quizProgressLabel.textContent = `第 ${state.currentIndex + 1} / ${state.quizQuestions.length} 題`;
  elements.progressBar.style.width = `${((state.currentIndex + 1) / state.quizQuestions.length) * 100}%`;
  elements.liveScore.textContent = String(countCorrect());
  elements.questionItemLabel.textContent = `項次 ${question.item}`;
  elements.questionModeLabel.textContent = state.mode === "practice" ? "練習模式" : "測驗模式";
  elements.questionText.textContent = question.text;
  elements.optionsList.innerHTML = "";

  question.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-button";
    if (answer === index) button.classList.add("selected");
    if (reveal && index === question.answerIndex) button.classList.add("correct");
    if (reveal && answer === index && index !== question.answerIndex) button.classList.add("incorrect");
    button.disabled = reveal;
    button.innerHTML = `<span class="option-key">${OPTION_LABELS[index]}</span><span>${escapeHtml(option)}</span>`;
    button.addEventListener("click", () => chooseAnswer(index));
    elements.optionsList.appendChild(button);
  });

  elements.previousButton.disabled = state.currentIndex === 0;
  elements.nextButton.disabled = !answered;
  elements.nextButton.textContent = state.currentIndex === state.quizQuestions.length - 1 ? "完成測驗" : "下一題";
  elements.explanationBox.hidden = !reveal;
  if (reveal) showExplanation(question, answer);
}

function chooseAnswer(index) {
  if (state.mode === "practice" && state.answers[state.currentIndex] !== null) return;
  state.answers[state.currentIndex] = index;
  renderQuestion();
}

function showExplanation(question, selectedIndex) {
  const correct = selectedIndex === question.answerIndex;
  elements.answerStatus.textContent = correct ? "答對了" : "這題答錯了";
  elements.answerStatus.classList.toggle("incorrect", !correct);
  elements.correctAnswerText.textContent = `${OPTION_LABELS[question.answerIndex]}．${question.options[question.answerIndex]}`;
  elements.answerExplanation.textContent = question.explanation || "這題目前沒有答案說明。";
}

function nextQuestion() {
  if (state.answers[state.currentIndex] === null) return;
  if (state.currentIndex === state.quizQuestions.length - 1) showResults();
  else { state.currentIndex += 1; renderQuestion(); window.scrollTo({ top: 0, behavior: "smooth" }); }
}

function showResults() {
  const correct = countCorrect();
  const total = state.quizQuestions.length;
  const score = Math.round((correct / total) * 100);
  elements.resultScore.textContent = String(score);
  elements.resultSummary.textContent = `答對 ${correct} 題，共 ${total} 題。`;
  const wrongQuestions = state.quizQuestions.filter((question, index) => state.answers[index] !== question.answerIndex);
  elements.retryWrongButton.hidden = wrongQuestions.length === 0;
  elements.retryWrongButton.dataset.ids = JSON.stringify(wrongQuestions.map((question) => question.id));
  elements.wrongAnswerList.innerHTML = wrongQuestions.length
    ? `<h2>錯題複習</h2>${wrongQuestions.map((question) => {
        const selectedIndex = state.answers[state.quizQuestions.indexOf(question)];
        return `<div class="wrong-item"><strong>項次 ${escapeHtml(question.item)}｜${escapeHtml(question.text)}</strong><p>你的答案：${selectedIndex === null ? "未作答" : `${OPTION_LABELS[selectedIndex]}．${escapeHtml(question.options[selectedIndex])}`}</p><p>正確答案：${OPTION_LABELS[question.answerIndex]}．${escapeHtml(question.options[question.answerIndex])}</p><p>${escapeHtml(question.explanation || "目前沒有答案說明。")}</p></div>`;
      }).join("")}`
    : "<p>全部答對，沒有錯題。</p>";
  showView("result");
}

function countCorrect() {
  return state.answers.filter((answer, index) => answer === state.quizQuestions[index]?.answerIndex).length;
}

function showView(name) {
  elements.setupView.hidden = name !== "setup";
  elements.quizView.hidden = name !== "quiz";
  elements.resultView.hidden = name !== "result";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function showImportMessage(message, error = false) {
  elements.importMessage.textContent = message;
  elements.importMessage.classList.toggle("error", error);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function openImportDialog() {
  showImportMessage("");
  elements.importDialog.showModal();
}

$("openImportButton").addEventListener("click", openImportDialog);
$("emptyImportButton").addEventListener("click", openImportDialog);
elements.fileInput.addEventListener("change", (event) => handleFile(event.target.files[0]));
elements.dropZone.addEventListener("dragover", (event) => { event.preventDefault(); elements.dropZone.classList.add("dragging"); });
elements.dropZone.addEventListener("dragleave", () => elements.dropZone.classList.remove("dragging"));
elements.dropZone.addEventListener("drop", (event) => {
  event.preventDefault(); elements.dropZone.classList.remove("dragging"); handleFile(event.dataTransfer.files[0]);
});
$("loadDemoButton").addEventListener("click", () => loadRows(demoRows, false));
elements.subjectSelect.addEventListener("change", updateCountLimit);
elements.startQuizButton.addEventListener("click", () => startQuiz());
elements.previousButton.addEventListener("click", () => { if (state.currentIndex > 0) { state.currentIndex -= 1; renderQuestion(); } });
elements.nextButton.addEventListener("click", nextQuestion);
$("exitQuizButton").addEventListener("click", () => showView("setup"));
$("backToSetupButton").addEventListener("click", () => showView("setup"));
elements.retryWrongButton.addEventListener("click", () => {
  const ids = JSON.parse(elements.retryWrongButton.dataset.ids || "[]");
  startQuiz(state.quizQuestions.filter((question) => ids.includes(question.id)));
});

document.querySelectorAll('input[name="quizMode"]').forEach((input) => {
  input.addEventListener("change", () => document.querySelectorAll(".mode-option").forEach((label) => label.classList.toggle("is-selected", label.contains(input) && input.checked)));
});

document.querySelectorAll(".quick-counts button").forEach((button) => {
  button.addEventListener("click", () => {
    const available = state.questions.filter((question) => question.subject === elements.subjectSelect.value).length;
    elements.questionCount.value = button.dataset.count === "all" ? String(available) : String(Math.min(Number(button.dataset.count), available || Number(button.dataset.count)));
    document.querySelectorAll(".quick-counts button").forEach((item) => item.classList.toggle("is-active", item === button));
  });
});

try {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (Array.isArray(stored) && stored.length) { state.questions = stored; refreshLibrary(); }
} catch { localStorage.removeItem(STORAGE_KEY); }
