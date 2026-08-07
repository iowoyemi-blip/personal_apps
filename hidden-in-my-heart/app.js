const STORAGE_KEY = "isaac.hiddenInMyHeart.backup.v1";
const EXPORT_VERSION = 1;
const CATEGORY_COLORS = ["#7a2e2e", "#5a6b48", "#9c6b2e", "#405767", "#654869", "#a84c3e", "#4a6b5a", "#8a6d2e"];

const seedData = {
  app: "hidden-in-my-heart",
  version: 1,
  exported: new Date().toISOString(),
  categories: [
    { id: "seed-comfort", name: "Comfort" },
    { id: "seed-gospel", name: "The Gospel" }
  ],
  verses: [
    {
      id: "seed-ps23",
      reference: "Psalm 23:1",
      text: "The LORD is my shepherd; I shall not want.",
      translation: "KJV",
      testimony: "",
      journalEntries: [],
      cats: ["seed-comfort"],
      added: 2
    },
    {
      id: "seed-rom1",
      reference: "Romans 1:16",
      text: "For I am not ashamed of the gospel of Christ: for it is the power of God unto salvation to every one that believeth; to the Jew first, and also to the Greek.",
      translation: "KJV",
      testimony: "",
      journalEntries: [],
      cats: ["seed-gospel"],
      added: 1
    }
  ]
};

let state = loadState();
let route = "library";
let libraryMode = "scripture";
let selectedCategory = "all";
let searchText = "";
let practiceCategory = "all";
let practiceDeck = [];
let practiceIndex = 0;
let practiceRevealed = false;
let practiceHint = false;
let editingVerseId = null;
let currentJournalVerseId = null;
let editingCategoryId = null;
let toastTimer = null;

const view = document.getElementById("view");
const verseCount = document.getElementById("verseCount");
const categoryCount = document.getElementById("categoryCount");
const journalCount = document.getElementById("journalCount");
const toast = document.getElementById("toast");

const verseDialog = document.getElementById("verseDialog");
const verseForm = document.getElementById("verseForm");
const verseDialogTitle = document.getElementById("verseDialogTitle");
const referenceInput = document.getElementById("referenceInput");
const textInput = document.getElementById("textInput");
const translationInput = document.getElementById("translationInput");
const journalInput = document.getElementById("journalInput");
const categoryChecks = document.getElementById("categoryChecks");
const newCategoryInput = document.getElementById("newCategoryInput");
const verseError = document.getElementById("verseError");

const journalDialog = document.getElementById("journalDialog");
const journalTitle = document.getElementById("journalTitle");
const journalVerseText = document.getElementById("journalVerseText");
const journalNewInput = document.getElementById("journalNewInput");
const journalEntries = document.getElementById("journalEntries");

const categoryDialog = document.getElementById("categoryDialog");
const categoryForm = document.getElementById("categoryForm");
const categoryNameInput = document.getElementById("categoryNameInput");
const categoryError = document.getElementById("categoryError");

function makeId() {
  if (crypto && typeof crypto.randomUUID === "function") {
    return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return normalizeBackup(saved || seedData);
  } catch {
    return normalizeBackup(seedData);
  }
}

function normalizeBackup(raw) {
  const backup = raw && typeof raw === "object" ? raw : seedData;
  const categories = Array.isArray(backup.categories)
    ? backup.categories.map(normalizeCategory).filter(Boolean)
    : [];
  const validCategoryIds = new Set(categories.map(category => category.id));
  const verses = Array.isArray(backup.verses)
    ? backup.verses.map(verse => normalizeVerse(verse, validCategoryIds)).filter(Boolean)
    : [];

  return {
    app: "hidden-in-my-heart",
    version: EXPORT_VERSION,
    exported: backup.exported || new Date().toISOString(),
    categories,
    verses
  };
}

function normalizeCategory(category) {
  const name = String(category?.name || "").trim();
  if (!name) return null;
  return {
    id: String(category.id || makeId()),
    name
  };
}

function normalizeVerse(verse, validCategoryIds = null) {
  const reference = String(verse?.reference || "").trim();
  const text = String(verse?.text || "").trim();
  if (!reference || !text) return null;

  const added = Number.isFinite(Number(verse.added)) ? Number(verse.added) : Date.now() / 1000;
  const decodedEntries = Array.isArray(verse.journalEntries)
    ? verse.journalEntries.map(entry => normalizeJournalEntry(entry, added)).filter(Boolean)
    : [];
  const testimony = String(verse.testimony || "").trim();
  const journalEntries = decodedEntries.length ? decodedEntries : entriesFromLegacyText(testimony, added);
  const cats = Array.isArray(verse.cats) ? verse.cats.map(String).filter(id => !validCategoryIds || validCategoryIds.has(id)) : [];

  return {
    id: String(verse.id || makeId()),
    reference,
    text,
    translation: String(verse.translation || "").trim(),
    testimony: legacyText(journalEntries),
    journalEntries,
    cats,
    added
  };
}

function normalizeJournalEntry(entry, fallbackTimestamp) {
  const text = String(entry?.text || "").trim();
  if (!text) return null;
  const createdAt = Number.isFinite(Number(entry.createdAt)) ? Number(entry.createdAt) : fallbackTimestamp;
  return {
    id: String(entry.id || makeId()),
    createdAt,
    text
  };
}

function entriesFromLegacyText(text, fallbackTimestamp) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return [];
  return [{ id: `legacy-${Math.round(fallbackTimestamp * 1000)}`, createdAt: fallbackTimestamp, text: trimmed }];
}

function legacyText(entries) {
  return [...entries]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(entry => `Journaled ${dateLabel(entry.createdAt)}\n${entry.text}`)
    .join("\n\n");
}

function saveState() {
  state.exported = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function categoryById(id) {
  return state.categories.find(category => category.id === id);
}

function sortedCategories() {
  return [...state.categories].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function categoryCountFor(id) {
  return state.verses.filter(verse => verse.cats.includes(id)).length;
}

function journalEntryCount() {
  return state.verses.reduce((sum, verse) => sum + verse.journalEntries.length, 0);
}

function categoryColor(id) {
  const index = state.categories.findIndex(category => category.id === id);
  return CATEGORY_COLORS[(index < 0 ? 0 : index) % CATEGORY_COLORS.length];
}

function dateLabel(timestamp) {
  const date = new Date(Number(timestamp) * 1000);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setRoute(nextRoute) {
  route = nextRoute;
  document.querySelectorAll("[data-route]").forEach(button => {
    button.classList.toggle("active", button.dataset.route === route);
  });
  render();
}

function render() {
  verseCount.textContent = state.verses.length.toLocaleString();
  categoryCount.textContent = state.categories.length.toLocaleString();
  journalCount.textContent = journalEntryCount().toLocaleString();

  if (route === "library") renderLibrary();
  if (route === "practice") renderPractice();
  if (route === "categories") renderCategories();
  if (route === "backup") renderBackup();
}

function renderLibrary() {
  const categories = sortedCategories();
  const query = searchText.trim().toLowerCase();
  const filtered = state.verses.filter(verse => {
    if (selectedCategory !== "all" && !verse.cats.includes(selectedCategory)) return false;
    if (libraryMode === "journal" && !verse.journalEntries.length) return false;
    if (!query) return true;
    return [verse.reference, verse.text, verse.translation, verse.journalEntries.map(entry => entry.text).join(" ")]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  view.innerHTML = `
    <section class="toolbar-panel">
      <p class="quote">Thy word have I hid in mine heart</p>
      <div class="control-row">
        <input class="field" id="searchInput" type="search" placeholder="Search reference, text, translation, or journal" value="${escapeHtml(searchText)}">
        <div class="segmented" aria-label="Library view">
          <button type="button" class="${libraryMode === "scripture" ? "active" : ""}" data-library-mode="scripture">Scriptures</button>
          <button type="button" class="${libraryMode === "journal" ? "active" : ""}" data-library-mode="journal">Journal</button>
        </div>
        <button class="primary" type="button" data-action="new-verse">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>
          Add
        </button>
      </div>
    </section>
    <section class="chip-row" aria-label="Category filters">
      <button class="chip ${selectedCategory === "all" ? "active" : ""}" type="button" data-filter-category="all">All ${state.verses.length}</button>
      ${categories.map(category => `
        <button class="chip ${selectedCategory === category.id ? "active" : ""}" type="button" data-filter-category="${category.id}" style="color:${selectedCategory === category.id ? "#fff" : categoryColor(category.id)};${selectedCategory === category.id ? `background:${categoryColor(category.id)};` : ""}">
          ${escapeHtml(category.name)} ${categoryCountFor(category.id)}
        </button>
      `).join("")}
    </section>
    ${filtered.length ? `<section class="verse-grid">${filtered.map(verseCard).join("")}</section>` : emptyState(libraryMode === "journal" ? "No journal notes match this view." : "No verses match this view.", state.verses.length ? "" : "Add your first verse")}
  `;
}

function verseCard(verse) {
  const entries = [...verse.journalEntries].sort((a, b) => b.createdAt - a.createdAt);
  const heading = verse.translation ? `${verse.reference} ${verse.translation}` : verse.reference;
  const body = libraryMode === "journal"
    ? `
      ${entries.slice(0, 3).map(entry => `<div class="journal-card"><p class="journal-date">${escapeHtml(dateLabel(entry.createdAt))}</p><p>${escapeHtml(entry.text)}</p></div>`).join("")}
      ${entries.length > 3 ? `<p class="muted">${entries.length - 3} more journal ${entries.length - 3 === 1 ? "entry" : "entries"}</p>` : ""}
      <p class="translation">${escapeHtml(verse.reference)} - ${escapeHtml(verse.text)}</p>
    `
    : `<p class="verse-text">${escapeHtml(verse.text)}</p>`;

  return `
    <article class="verse-card" data-verse-card="${verse.id}">
      <div class="card-head">
        <h3 class="reference">${escapeHtml(heading)}</h3>
        <div class="button-row">
          <button class="small-button" type="button" data-edit-verse="${verse.id}" aria-label="Edit ${escapeHtml(verse.reference)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
          </button>
          <button class="small-button" type="button" data-delete-verse="${verse.id}" aria-label="Delete ${escapeHtml(verse.reference)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path></svg>
          </button>
        </div>
      </div>
      ${body}
      <div class="category-tags">
        ${entries.length ? `<button class="journal-pill" type="button" data-journal-verse="${verse.id}" aria-label="Journal for ${escapeHtml(verse.reference)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"></path><path d="M8 9h8"></path><path d="M8 13h5"></path></svg>Journal</button>` : ""}
        ${verse.cats.map(id => categoryById(id)).filter(Boolean).map(category => `<span class="tag" style="background:${categoryColor(category.id)}">${escapeHtml(category.name)}</span>`).join("")}
      </div>
    </article>
  `;
}

function emptyState(message, actionTitle = "") {
  return `
    <section class="panel empty-state">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10"></path><path d="M7 11h10"></path><path d="M7 15h6"></path><path d="M5 3h14a2 2 0 0 1 2 2v14l-4-3H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"></path></svg>
      <p class="empty-copy">${escapeHtml(message)}</p>
      ${actionTitle ? `<button class="primary" type="button" data-action="new-verse">${escapeHtml(actionTitle)}</button>` : ""}
    </section>
  `;
}

function renderPractice() {
  const pool = state.verses.filter(verse => practiceCategory === "all" || verse.cats.includes(practiceCategory));
  const current = practiceDeck.length ? state.verses.find(verse => verse.id === practiceDeck[practiceIndex]) : null;

  view.innerHTML = `
    <section class="toolbar-panel">
      <div class="control-row">
        <select class="select" id="practiceCategory">
          <option value="all">All verses (${state.verses.length})</option>
          ${sortedCategories().map(category => `<option value="${category.id}" ${practiceCategory === category.id ? "selected" : ""}>${escapeHtml(category.name)} (${categoryCountFor(category.id)})</option>`).join("")}
        </select>
        <button class="primary" type="button" data-action="start-practice" ${pool.length ? "" : "disabled"}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5"></path><path d="M4 20 21 3"></path><path d="M21 16v5h-5"></path><path d="M15 15 21 21"></path><path d="M4 4l5 5"></path></svg>
          Shuffle & Begin
        </button>
      </div>
    </section>
    ${current ? practiceCard(current) : emptyState("Pick a set and press Shuffle & Begin to start reciting.")}
  `;
}

function practiceCard(verse) {
  const hiddenText = practiceHint ? firstLetters(verse.text) : "Recite from memory, then reveal.";
  return `
    <section class="practice-card">
      <p class="practice-index">${practiceIndex + 1} / ${practiceDeck.length}</p>
      <h2 class="practice-reference">${escapeHtml(verse.reference)}</h2>
      <p class="practice-text">${escapeHtml(practiceRevealed ? verse.text : hiddenText)}</p>
      ${practiceRevealed && verse.translation ? `<p class="translation">${escapeHtml(verse.translation)}</p>` : ""}
      <div class="button-row" style="justify-content:center">
        <button class="secondary" type="button" data-action="practice-prev">Prev</button>
        ${practiceRevealed ? "" : `<button class="secondary" type="button" data-action="practice-hint">${practiceHint ? "Hide Hint" : "Hint"}</button>`}
        <button class="primary" type="button" data-action="practice-reveal">${practiceRevealed ? "Hide" : "Reveal"}</button>
        <button class="secondary" type="button" data-action="practice-next">Next</button>
      </div>
    </section>
  `;
}

function firstLetters(text) {
  return text.split(/\s+/).map(word => {
    const index = [...word].findIndex(char => /\p{L}/u.test(char));
    if (index < 0) return word;
    return [...word].map((char, offset) => offset === index || !/\p{L}/u.test(char) ? char : "_").join("");
  }).join(" ");
}

function renderCategories() {
  view.innerHTML = `
    <section class="toolbar-panel">
      <div class="control-row">
        <input class="field" id="newCategoryName" type="text" autocomplete="off" placeholder="New category name">
        <button class="primary" type="button" data-action="add-category">Add</button>
      </div>
    </section>
    ${state.categories.length ? `<section class="view">${sortedCategories().map(categoryRow).join("")}</section>` : emptyState("No categories yet. Create ones like Comfort, Promises, or Sunday Sermon.")}
  `;
}

function categoryRow(category) {
  return `
    <article class="category-row">
      <span class="swatch" style="background:${categoryColor(category.id)}"></span>
      <div>
        <p class="category-title">${escapeHtml(category.name)}</p>
        <p class="muted">${categoryCountFor(category.id)} ${categoryCountFor(category.id) === 1 ? "verse" : "verses"}</p>
      </div>
      <div class="button-row">
        <button class="secondary" type="button" data-filter-from-category="${category.id}">View</button>
        <button class="secondary" type="button" data-rename-category="${category.id}">Edit</button>
        <button class="danger-button" type="button" data-delete-category="${category.id}">Delete</button>
      </div>
    </article>
  `;
}

function renderBackup() {
  const backup = backupText();
  view.innerHTML = `
    <section class="backup-grid">
      <article class="backup-card">
        <h2>Export Backup</h2>
        <p>Your collection is saved automatically on this device. Export gives you a JSON file for moving or preserving the data.</p>
        <button class="primary wide" type="button" data-action="export-backup">Download Backup</button>
        <textarea class="field" rows="8" readonly>${escapeHtml(backup)}</textarea>
      </article>
      <article class="backup-card">
        <h2>Import Backup</h2>
        <p>Import the JSON from the native iPhone app. Importing adds to this web app and skips exact duplicate verses.</p>
        <button class="secondary wide" type="button" data-action="choose-import">Choose JSON File</button>
        <input class="file-input" id="backupFile" type="file" accept="application/json,.json">
        <textarea class="field" id="backupTextInput" rows="8" placeholder="...or paste backup JSON here"></textarea>
        <button class="primary wide" type="button" data-action="import-paste">Import Pasted Backup</button>
      </article>
    </section>
  `;
}

function backupText() {
  const payload = {
    app: "hidden-in-my-heart",
    version: EXPORT_VERSION,
    exported: new Date().toISOString(),
    categories: state.categories,
    verses: state.verses
  };
  return JSON.stringify(payload, null, 2);
}

function openVerseDialog(id = null) {
  editingVerseId = id;
  const verse = state.verses.find(item => item.id === id);
  verseDialogTitle.textContent = verse ? "Edit Verse" : "Add a Verse";
  referenceInput.value = verse?.reference || "";
  textInput.value = verse?.text || "";
  translationInput.value = verse?.translation || "";
  journalInput.value = "";
  newCategoryInput.value = "";
  verseError.classList.remove("show");
  verseError.textContent = "";
  categoryChecks.innerHTML = sortedCategories().map(category => `
    <label class="check-pill">
      <input type="checkbox" value="${category.id}" ${verse?.cats.includes(category.id) ? "checked" : ""}>
      ${escapeHtml(category.name)}
    </label>
  `).join("");
  verseDialog.showModal();
  setTimeout(() => referenceInput.focus(), 50);
}

function saveVerse(event) {
  event.preventDefault();
  const reference = referenceInput.value.trim();
  const text = textInput.value.trim();
  const translation = translationInput.value.trim();
  const journalText = journalInput.value.trim();
  const newCategoryName = newCategoryInput.value.trim();

  if (!reference || !text) {
    showFormError(verseError, "Please enter both a reference and the verse text.");
    return;
  }

  const cats = [...categoryChecks.querySelectorAll("input:checked")].map(input => input.value);
  if (newCategoryName) {
    cats.push(addCategoryByName(newCategoryName));
  }

  if (editingVerseId) {
    const index = state.verses.findIndex(verse => verse.id === editingVerseId);
    if (index !== -1) {
      state.verses[index].reference = reference;
      state.verses[index].text = text;
      state.verses[index].translation = translation;
      state.verses[index].cats = [...new Set(cats)].sort();
      if (journalText) {
        state.verses[index].journalEntries.push({ id: makeId(), createdAt: Date.now() / 1000, text: journalText });
      }
      state.verses[index].testimony = legacyText(state.verses[index].journalEntries);
    }
  } else {
    const journalEntries = journalText ? [{ id: makeId(), createdAt: Date.now() / 1000, text: journalText }] : [];
    state.verses.unshift({
      id: makeId(),
      reference,
      text,
      translation,
      testimony: legacyText(journalEntries),
      journalEntries,
      cats: [...new Set(cats)].sort(),
      added: Date.now() / 1000
    });
  }

  verseDialog.close();
  editingVerseId = null;
  saveState();
  showToast("Verse saved.");
}

function addCategoryByName(name) {
  const trimmed = name.trim();
  const existing = state.categories.find(category => category.name.localeCompare(trimmed, undefined, { sensitivity: "base" }) === 0);
  if (existing) return existing.id;
  const category = { id: makeId(), name: trimmed };
  state.categories.push(category);
  return category.id;
}

function deleteVerse(id) {
  const verse = state.verses.find(item => item.id === id);
  if (!verse || !confirm(`Remove ${verse.reference} from your memory deck?`)) return;
  state.verses = state.verses.filter(item => item.id !== id);
  saveState();
  showToast("Verse removed.");
}

function openJournalDialog(id) {
  currentJournalVerseId = id;
  journalNewInput.value = "";
  renderJournalDialog();
  journalDialog.showModal();
}

function renderJournalDialog() {
  const verse = state.verses.find(item => item.id === currentJournalVerseId);
  if (!verse) return;
  journalTitle.textContent = `${verse.reference} Journal`;
  journalVerseText.textContent = verse.text;
  const entries = [...verse.journalEntries].sort((a, b) => b.createdAt - a.createdAt);
  journalEntries.innerHTML = entries.length
    ? entries.map(entry => `
      <article class="journal-card">
        <div class="card-head">
          <p class="journal-date">${escapeHtml(dateLabel(entry.createdAt))}</p>
          <div class="button-row">
            <button class="small-button" type="button" data-edit-entry="${entry.id}">Edit</button>
            <button class="small-button" type="button" data-delete-entry="${entry.id}">Delete</button>
          </div>
        </div>
        <p>${escapeHtml(entry.text)}</p>
      </article>
    `).join("")
    : `<p class="muted">No journal entries yet.</p>`;
}

function addJournalEntry() {
  const text = journalNewInput.value.trim();
  if (!text) return;
  const verse = state.verses.find(item => item.id === currentJournalVerseId);
  if (!verse) return;
  verse.journalEntries.push({ id: makeId(), createdAt: Date.now() / 1000, text });
  verse.testimony = legacyText(verse.journalEntries);
  journalNewInput.value = "";
  saveState();
  renderJournalDialog();
  showToast("Journal entry saved.");
}

function editJournalEntry(id) {
  const verse = state.verses.find(item => item.id === currentJournalVerseId);
  const entry = verse?.journalEntries.find(item => item.id === id);
  if (!verse || !entry) return;
  const nextText = prompt("Edit journal entry:", entry.text);
  if (nextText == null) return;
  const trimmed = nextText.trim();
  if (!trimmed) {
    showToast("Journal entry cannot be empty.");
    return;
  }
  entry.text = trimmed;
  verse.testimony = legacyText(verse.journalEntries);
  saveState();
  renderJournalDialog();
}

function deleteJournalEntry(id) {
  const verse = state.verses.find(item => item.id === currentJournalVerseId);
  if (!verse || !confirm("Delete this journal entry?")) return;
  verse.journalEntries = verse.journalEntries.filter(entry => entry.id !== id);
  verse.testimony = legacyText(verse.journalEntries);
  saveState();
  renderJournalDialog();
}

function addCategoryFromInput() {
  const input = document.getElementById("newCategoryName");
  const name = input?.value.trim() || "";
  if (!name) return;
  addCategoryByName(name);
  saveState();
  showToast("Category added.");
}

function openCategoryDialog(id) {
  editingCategoryId = id;
  const category = categoryById(id);
  if (!category) return;
  categoryNameInput.value = category.name;
  categoryError.classList.remove("show");
  categoryDialog.showModal();
}

function saveCategoryRename(event) {
  event.preventDefault();
  const category = categoryById(editingCategoryId);
  const name = categoryNameInput.value.trim();
  if (!category || !name) {
    showFormError(categoryError, "Please enter a category name.");
    return;
  }
  if (state.categories.some(item => item.id !== category.id && item.name.localeCompare(name, undefined, { sensitivity: "base" }) === 0)) {
    showFormError(categoryError, "A category with that name already exists.");
    return;
  }
  category.name = name;
  categoryDialog.close();
  saveState();
  showToast("Category renamed.");
}

function deleteCategory(id) {
  const category = categoryById(id);
  if (!category || !confirm(`Delete ${category.name}? Verses stay, but lose this tag.`)) return;
  state.categories = state.categories.filter(item => item.id !== id);
  state.verses.forEach(verse => {
    verse.cats = verse.cats.filter(cat => cat !== id);
  });
  if (selectedCategory === id) selectedCategory = "all";
  if (practiceCategory === id) practiceCategory = "all";
  saveState();
  showToast("Category deleted.");
}

function startPractice() {
  const pool = state.verses.filter(verse => practiceCategory === "all" || verse.cats.includes(practiceCategory));
  practiceDeck = pool.map(verse => verse.id).sort(() => Math.random() - 0.5);
  practiceIndex = 0;
  practiceRevealed = false;
  practiceHint = false;
  render();
}

function movePractice(delta) {
  if (!practiceDeck.length) return;
  practiceIndex = (practiceIndex + delta + practiceDeck.length) % practiceDeck.length;
  practiceRevealed = false;
  practiceHint = false;
  render();
}

function exportBackup() {
  const blob = new Blob([backupText()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `scripture-memory-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Backup file created.");
}

function importBackupText(text) {
  const parsed = JSON.parse(text);
  const incoming = normalizeBackup(parsed);
  const idMap = new Map();
  let newCategories = 0;
  let newVerses = 0;

  incoming.categories.forEach(category => {
    const existing = state.categories.find(item => item.name.localeCompare(category.name, undefined, { sensitivity: "base" }) === 0);
    if (existing) {
      idMap.set(category.id, existing.id);
    } else {
      const id = state.categories.some(item => item.id === category.id) ? makeId() : category.id;
      state.categories.push({ id, name: category.name });
      idMap.set(category.id, id);
      newCategories += 1;
    }
  });

  const keys = new Set(state.verses.map(verse => `${verse.reference}|${verse.text}`.toLowerCase()));
  incoming.verses.forEach(verse => {
    const key = `${verse.reference}|${verse.text}`.toLowerCase();
    if (keys.has(key)) return;
    const cats = verse.cats.map(id => idMap.get(id) || (categoryById(id) ? id : null)).filter(Boolean);
    state.verses.unshift({
      ...verse,
      id: makeId(),
      cats,
      added: Date.now() / 1000,
      testimony: legacyText(verse.journalEntries)
    });
    keys.add(key);
    newVerses += 1;
  });

  saveState();
  showToast(`Imported ${newVerses} new ${newVerses === 1 ? "verse" : "verses"}${newCategories ? ` and ${newCategories} new ${newCategories === 1 ? "category" : "categories"}` : ""}.`);
}

function chooseImportFile() {
  const input = document.getElementById("backupFile");
  input?.click();
}

function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      importBackupText(String(reader.result || ""));
    } catch {
      showToast("That backup file could not be imported.");
    }
  };
  reader.readAsText(file);
}

function showFormError(element, message) {
  element.textContent = message;
  element.classList.add("show");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function closeDialogs() {
  verseDialog.close();
  journalDialog.close();
  categoryDialog.close();
}

document.addEventListener("click", event => {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.route) setRoute(target.dataset.route);
  if (target.dataset.action === "new-verse") openVerseDialog();
  if (target.dataset.action === "open-backup") setRoute("backup");
  if (target.dataset.action === "close-verse") verseDialog.close();
  if (target.dataset.action === "close-journal") journalDialog.close();
  if (target.dataset.action === "close-category") categoryDialog.close();
  if (target.dataset.action === "add-journal") addJournalEntry();
  if (target.dataset.action === "add-category") addCategoryFromInput();
  if (target.dataset.action === "start-practice") startPractice();
  if (target.dataset.action === "practice-prev") movePractice(-1);
  if (target.dataset.action === "practice-next") movePractice(1);
  if (target.dataset.action === "practice-hint") {
    practiceHint = !practiceHint;
    render();
  }
  if (target.dataset.action === "practice-reveal") {
    practiceRevealed = !practiceRevealed;
    render();
  }
  if (target.dataset.action === "export-backup") exportBackup();
  if (target.dataset.action === "choose-import") chooseImportFile();
  if (target.dataset.action === "import-paste") {
    try {
      importBackupText(document.getElementById("backupTextInput").value.trim());
    } catch {
      showToast("That pasted backup could not be imported.");
    }
  }

  if (target.dataset.libraryMode) {
    libraryMode = target.dataset.libraryMode;
    render();
  }
  if (target.dataset.filterCategory) {
    selectedCategory = target.dataset.filterCategory;
    render();
  }
  if (target.dataset.editVerse) openVerseDialog(target.dataset.editVerse);
  if (target.dataset.deleteVerse) deleteVerse(target.dataset.deleteVerse);
  if (target.dataset.journalVerse) openJournalDialog(target.dataset.journalVerse);
  if (target.dataset.editEntry) editJournalEntry(target.dataset.editEntry);
  if (target.dataset.deleteEntry) deleteJournalEntry(target.dataset.deleteEntry);
  if (target.dataset.renameCategory) openCategoryDialog(target.dataset.renameCategory);
  if (target.dataset.deleteCategory) deleteCategory(target.dataset.deleteCategory);
  if (target.dataset.filterFromCategory) {
    selectedCategory = target.dataset.filterFromCategory;
    setRoute("library");
  }
});

document.addEventListener("input", event => {
  if (event.target.id === "searchInput") {
    searchText = event.target.value;
    renderLibrary();
  }
});

document.addEventListener("change", event => {
  if (event.target.id === "practiceCategory") {
    practiceCategory = event.target.value;
    practiceDeck = [];
    practiceRevealed = false;
    practiceHint = false;
    render();
  }
  if (event.target.id === "backupFile") {
    handleImportFile(event.target.files[0]);
    event.target.value = "";
  }
});

verseForm.addEventListener("submit", saveVerse);
categoryForm.addEventListener("submit", saveCategoryRename);
verseDialog.addEventListener("cancel", event => {
  event.preventDefault();
  verseDialog.close();
});
journalDialog.addEventListener("cancel", event => {
  event.preventDefault();
  journalDialog.close();
});
categoryDialog.addEventListener("cancel", event => {
  event.preventDefault();
  categoryDialog.close();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

render();
