/**
 * Adds a launch button to the ClickUp task view: a click opens Claude Code
 * with a prompt built from the template; the caret next to it opens the menu
 * with the other actions.
 *
 * ClickUp is a SPA: the page never reloads, the header nodes are destroyed and
 * rebuilt on every navigation and the selectors change now and then. So the
 * button is re-injected from a MutationObserver and, when no known anchor
 * exists, falls back to a floating button.
 */

const ROOT_ID = "claude-code-launcher";
const MENU_ID = "claude-code-launcher-menu";
// With the ClickUp MCP connected, Claude Code reaches the rest of the task from
// its ID; the web apps cannot, so the web template carries the name and URL.
const DEFAULTS = {
  template: 'Let\'s work on ClickUp task {id} - "{name}".\n\n',
  webTemplate: "Let's work on this ClickUp task:\n\n{name}\n{url}\n\n",
};

// Checked against the app in September 2026. The first is the full path; the
// rest are fallbacks for when the structure around it changes.
const HEADER_ANCHOR_SELECTORS = [
  '[data-test="task-container__header-wrapper"] .cu-task-view-header__right',
  ".cu-task-view-header__right",
  '[data-test="task-view-header__right"]',
  ".task-view-header__right",
];

// The inner anchor: the group sits right before the Share button.
const SHARE_BUTTON_SELECTOR = "cu-share-header-button";

const TASK_NAME_SELECTORS = [
  '[data-test="task-title__text-area"]',
  '[data-test="task-title__title-overlay"]',
  '[data-test="task-name__container"]',
  ".cu-task-title__title",
  ".cu-task-title__overlay",
];

// Inline so it needs no web_accessible_resources.
const LAUNCH_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5M14 5h5v5M19 5l-8 8"/></svg>`;

const CHECK_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.5l5 5 10-11"/></svg>`;

const CARET_ICON = `<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M3 4.5L6 7.5l3-3"/></svg>`;

let cachedTemplates = { ...DEFAULTS };

/**
 * The menu actions. Adding a tool means adding an entry here: each one gets
 * the task and the prompt already built.
 */
const ACTIONS = [
  {
    id: "open",
    label: "Open in Claude Code",
    primary: true,
    run: (task, prompt) => {
      openExternal(`claude://code/new?q=${encodeURIComponent(prompt)}`);
    },
  },
  {
    id: "open-web",
    label: "Open in Claude.ai",
    template: "webTemplate",
    run: (task, prompt) =>
      openExternal(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`, true),
  },
  {
    id: "open-chatgpt",
    label: "Open in ChatGPT",
    template: "webTemplate",
    run: (task, prompt) =>
      openExternal(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`, true),
  },
  {
    id: "copy-prompt",
    label: "Copy prompt",
    run: (task, prompt) => navigator.clipboard.writeText(prompt),
  },
  {
    id: "copy-id",
    label: "Copy task ID",
    run: (task) => navigator.clipboard.writeText(task.id),
  },
  {
    id: "options",
    label: "Edit templates",
    separated: true,
    run: () => chrome.runtime.sendMessage({ type: "open-options" }),
  },
];

function readTemplates() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULTS, (items) => {
      resolve({
        template: items.template || DEFAULTS.template,
        webTemplate: items.webTemplate || DEFAULTS.webTemplate,
      });
    });
  });
}

/**
 * Accepts /t/{id}, /t/{teamId}/{id} and /t/{teamId}/{CUSTOM-ID}. ClickUp
 * rewrites the URL to the teamId form shortly after the task opens.
 */
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

/** The tab title is `Task name | #id`. */
function readTaskNameFromTitle() {
  return document.title
    .replace(/^\(\d+\)\s*/, "")
    .replace(/\s*\|\s*#\S+\s*$/, "")
    .trim();
}

/**
 * The dates button shows what ClickUp draws ("Today", "Mon", "12 Sep"), not
 * the absolute date. Relative ones are resolved here so the prompt still makes
 * sense when it is read days later.
 */
const RELATIVE_DAYS = { today: 0, tomorrow: 1, yesterday: -1 };

function readDueDate() {
  const text = readText('[data-test="task-dates-display-button"]');
  const offset = RELATIVE_DAYS[text.toLowerCase()];
  if (offset === undefined) return text;

  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${text} (${date.toISOString().slice(0, 10)})`;
}

function readText(selector) {
  const node = document.querySelector(selector);
  const text = (node?.innerText || "").trim();
  return text === "Empty" ? "" : text;
}

function readAll(selector) {
  return [...document.querySelectorAll(selector)]
    .map((node) => node.innerText.trim())
    .filter(Boolean)
    .join(", ");
}

/** Empty values stay empty: what the preview shows is what comes out. */
const SHORTCODES = {
  id: (id) => id,
  name: () => readTaskNameFromDom() || readTaskNameFromTitle(),
  url: () => location.href.split("?")[0],
  date: readDueDate,
  priority: () => readText('[data-test="task-hero-section-priority__row-data"]'),
  tags: () => readAll('[data-test="task-hero-section__tags"] .cu-cf-value-tag__text'),
  // The visually hidden list in cu-assignees has one name per assignee; the
  // visible one collapses into avatars as soon as there is more than one.
  assignees: () => readAll('[data-test="task-hero-section__assignees"] ul li'),
  // The last breadcrumb is the list; the ones before are the space and folder.
  list: () => {
    const crumbs = document.querySelectorAll(
      '[data-test="task-view-breadcrumbs__timl-list-item"]'
    );
    return crumbs.length ? crumbs[crumbs.length - 1].innerText.trim() : "";
  },
};

function readTask() {
  const id = readTaskId();
  if (!id) return null;
  return Object.fromEntries(
    Object.entries(SHORTCODES).map(([key, read]) => [key, read(id)])
  );
}

function buildPrompt(template, task) {
  return Object.entries(task).reduce(
    (prompt, [key, value]) => prompt.replaceAll(`{${key}}`, value),
    template
  );
}

function openExternal(href, newTab) {
  const link = document.createElement("a");
  link.href = href;
  if (newTab) {
    link.target = "_blank";
    link.rel = "noopener";
  }
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function flash(button, modifier) {
  button.innerHTML = CHECK_ICON;
  button.classList.add(modifier);
  setTimeout(() => {
    button.innerHTML = LAUNCH_ICON;
    button.classList.remove(modifier);
  }, 1500);
}

async function runAction(action, { feedback } = {}) {
  const task = readTask();
  if (!task) return;

  try {
    const template = cachedTemplates[action.template ?? "template"];
    await action.run(task, buildPrompt(template, task));
    if (feedback && !action.primary) flash(feedback, "claude-code-launcher__button--ok");
  } catch {
    if (feedback) flash(feedback, "claude-code-launcher__button--failed");
  }
}

/**
 * ClickUp has light and dark themes and the header ignores the system theme.
 * The menu colours follow the first opaque background above the anchor.
 */
function resolveTheme(node) {
  for (let el = node; el; el = el.parentElement) {
    const background = getComputedStyle(el).backgroundColor;
    const parts = background.match(/[\d.]+/g);
    if (!parts || Number(parts[3] ?? 1) === 0) continue;
    const [r, g, b] = parts.map(Number);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128 ? "dark" : "light";
  }
  return "light";
}

function closeMenu() {
  document.getElementById(MENU_ID)?.remove();
  document
    .querySelector(".claude-code-launcher__toggle")
    ?.setAttribute("aria-expanded", "false");
}

function openMenu(toggle, feedback) {
  closeMenu();

  const menu = document.createElement("div");
  menu.id = MENU_ID;
  menu.className = `claude-code-launcher-menu claude-code-launcher-menu--${resolveTheme(
    toggle
  )}`;
  menu.setAttribute("role", "menu");

  for (const action of ACTIONS) {
    if (action.separated) {
      const separator = document.createElement("div");
      separator.className = "claude-code-launcher-menu__separator";
      menu.appendChild(separator);
    }
    const item = document.createElement("button");
    item.type = "button";
    item.className = "claude-code-launcher-menu__item";
    item.setAttribute("role", "menuitem");
    item.textContent = action.label;
    item.addEventListener("click", () => {
      closeMenu();
      runAction(action, { feedback });
    });
    menu.appendChild(item);
  }

  document.body.appendChild(menu);

  const rect = toggle.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 6}px`;
  menu.style.left = `${Math.max(
    8,
    Math.min(rect.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 8)
  )}px`;

  toggle.setAttribute("aria-expanded", "true");
}

function createLauncher(floating) {
  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.className = floating
    ? "claude-code-launcher claude-code-launcher--floating"
    : "claude-code-launcher";

  const main = document.createElement("button");
  main.type = "button";
  main.className = "claude-code-launcher__button claude-code-launcher__main";
  main.innerHTML = LAUNCH_ICON;
  main.title = "Open in Claude Code";
  main.setAttribute("aria-label", "Open in Claude Code");
  main.addEventListener("click", () => {
    closeMenu();
    runAction(ACTIONS[0], { feedback: main });
  });

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "claude-code-launcher__button claude-code-launcher__toggle";
  toggle.innerHTML = CARET_ICON;
  toggle.title = "More actions";
  toggle.setAttribute("aria-label", "More actions");
  toggle.setAttribute("aria-haspopup", "menu");
  toggle.setAttribute("aria-expanded", "false");
  toggle.addEventListener("click", () => {
    if (document.getElementById(MENU_ID)) closeMenu();
    else openMenu(toggle, main);
  });

  root.append(main, toggle);
  return root;
}

function findHeaderAnchor() {
  for (const selector of HEADER_ANCHOR_SELECTORS) {
    const node = document.querySelector(selector);
    if (node) return node;
  }
  return null;
}

function placeInHeader(anchor, launcher) {
  const share = anchor.querySelector(SHARE_BUTTON_SELECTOR);
  if (share) anchor.insertBefore(launcher, share);
  else anchor.prepend(launcher);
}

function syncLauncher() {
  const existing = document.getElementById(ROOT_ID);

  if (!readTaskId()) {
    existing?.remove();
    closeMenu();
    return;
  }

  const anchor = findHeaderAnchor();

  if (existing) {
    const isFloating = existing.classList.contains(
      "claude-code-launcher--floating"
    );
    // A floating button gives way to the header as soon as it appears.
    if (existing.isConnected && !(anchor && isFloating)) return;
    existing.remove();
    closeMenu();
  }

  const launcher = createLauncher(!anchor);
  if (anchor) placeInHeader(anchor, launcher);
  else document.body.appendChild(launcher);
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
    pending = setTimeout(syncLauncher, 250);
  };

  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
  });
  watchUrlChanges(schedule);

  document.addEventListener("click", (event) => {
    if (!event.target.closest(`#${MENU_ID}, #${ROOT_ID}`)) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
  window.addEventListener("resize", closeMenu);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const key of Object.keys(DEFAULTS)) {
      if (changes[key]) cachedTemplates[key] = changes[key].newValue || DEFAULTS[key];
    }
  });

  readTemplates().then((templates) => {
    cachedTemplates = templates;
    syncLauncher();
  });
}

start();
