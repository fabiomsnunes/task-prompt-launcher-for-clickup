/**
 * Injeta um botao "Claude Code" na vista de task do ClickUp.
 *
 * O ClickUp e uma SPA: a pagina nunca recarrega, os nos do header sao
 * destruidos e recriados a cada navegacao e os selectors mudam com alguma
 * frequencia. Por isso o botao e reinjectado a partir de um MutationObserver
 * e, quando nenhuma ancora conhecida existe, cai para um botao flutuante.
 */

const BUTTON_ID = "claude-code-launcher";
const DEFAULT_TEMPLATE = 'Vamos trabalhar na task ClickUp {id} - "{name}".\n\n';

const HEADER_ANCHOR_SELECTORS = [
  '[data-test="task-view-header"] [data-test="task-view-header__right"]',
  '[data-test="task-view-header__right"]',
  '[data-test="task-header-actions"]',
  ".task-view-header__right",
  ".task-container__header-actions",
  ".cu-task-view-header__right",
  ".cu-task-hero__actions",
];

const TASK_NAME_SELECTORS = [
  '[data-test="task-name__container"]',
  '[data-test="task-title__input"]',
  '[data-test="task-name"]',
  ".task-name__overlay",
  ".task-title__text",
  "#task-name",
  "textarea.task-name",
];

let cachedTemplate = DEFAULT_TEMPLATE;

function readTemplate() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ template: DEFAULT_TEMPLATE }, (items) => {
      resolve(items.template || DEFAULT_TEMPLATE);
    });
  });
}

function readTaskId() {
  const match = location.pathname.match(/\/t\/(?:(\d+)\/)?([A-Za-z0-9_-]+)/);
  return match ? match[2] : null;
}

function readTaskNameFromDom() {
  for (const selector of TASK_NAME_SELECTORS) {
    const node = document.querySelector(selector);
    if (!node) continue;
    const text = (node.value || node.textContent || "").trim();
    if (text) return text;
  }
  return "";
}

function readTaskNameFromTitle() {
  return document.title
    .replace(/^\(\d+\)\s*/, "")
    .split("|")[0]
    .trim();
}

function readTaskName() {
  return readTaskNameFromDom() || readTaskNameFromTitle();
}

function buildPrompt(template, task) {
  return template
    .replaceAll("{id}", task.id)
    .replaceAll("{name}", task.name)
    .replaceAll("{url}", task.url);
}

function openInClaudeCode(prompt) {
  const link = document.createElement("a");
  link.href = `claude://code/new?q=${encodeURIComponent(prompt)}`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function flash(button, label) {
  const original = button.dataset.label;
  button.textContent = label;
  setTimeout(() => {
    button.textContent = original;
  }, 1500);
}

async function handleClick(event) {
  const id = readTaskId();
  if (!id) return;

  const task = { id, name: readTaskName(), url: location.href.split("?")[0] };
  const prompt = buildPrompt(cachedTemplate, task);
  const button = event.currentTarget;

  // Alt-clique copia o prompt em vez de abrir a app: escape para quando o
  // browser bloqueia o esquema claude:// ou quando quero colar noutro sitio.
  if (event.altKey) {
    try {
      await navigator.clipboard.writeText(prompt);
      flash(button, "Copiado");
    } catch {
      flash(button, "Falhou");
    }
    return;
  }

  openInClaudeCode(prompt);
}

function createButton(floating) {
  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.className = floating
    ? "claude-code-launcher claude-code-launcher--floating"
    : "claude-code-launcher";
  button.dataset.label = "Claude Code";
  button.textContent = "Claude Code";
  button.title = "Abrir no Claude Code (Alt+clique copia o prompt)";
  button.addEventListener("click", handleClick);
  return button;
}

function findHeaderAnchor() {
  for (const selector of HEADER_ANCHOR_SELECTORS) {
    const node = document.querySelector(selector);
    if (node) return node;
  }
  return null;
}

function syncButton() {
  const existing = document.getElementById(BUTTON_ID);

  if (!readTaskId()) {
    existing?.remove();
    return;
  }

  const anchor = findHeaderAnchor();

  if (existing) {
    const isFloating = existing.classList.contains(
      "claude-code-launcher--floating"
    );
    if (anchor && isFloating) existing.remove();
    else if (existing.isConnected) return;
    else existing.remove();
  }

  const button = createButton(!anchor);
  if (anchor) anchor.prepend(button);
  else document.body.appendChild(button);
}

function watchUrlChanges(onChange) {
  for (const method of ["pushState", "replaceState"]) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      onChange();
      return result;
    };
  }
  window.addEventListener("popstate", onChange);
}

function start() {
  let pending = null;
  const schedule = () => {
    clearTimeout(pending);
    pending = setTimeout(syncButton, 250);
  };

  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
  });
  watchUrlChanges(schedule);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.template) {
      cachedTemplate = changes.template.newValue || DEFAULT_TEMPLATE;
    }
  });

  readTemplate().then((template) => {
    cachedTemplate = template;
    syncButton();
  });
}

start();
