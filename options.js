const DEFAULTS = {
  template: 'Vamos trabalhar na task ClickUp {id} - "{name}".\n\n',
  webTemplate: "Vamos trabalhar nesta task do ClickUp:\n\n{name}\n{url}\n\n",
};

const SHORTCODES = [
  { key: "id", hint: "ID da task", sample: "86c1abcde" },
  { key: "name", hint: "Nome", sample: "Corrigir checkout do Woo em mobile" },
  { key: "url", hint: "Link", sample: "https://app.clickup.com/t/86c1abcde" },
  { key: "date", hint: "Due date", sample: "Today (2026-09-16)" },
  { key: "priority", hint: "Prioridade", sample: "High" },
  { key: "tags", hint: "Tags", sample: "support, woo" },
  { key: "assignees", hint: "Assignees", sample: "Fábio Nunes" },
  { key: "list", hint: "Lista", sample: "Moneybox (20min)" },
];

const FIELDS = Object.keys(DEFAULTS);
const status = document.getElementById("status");
let lastFocused = document.getElementById("template");

function render(field) {
  const value = document.getElementById(field).value;
  document.getElementById(`${field}-preview`).textContent = SHORTCODES.reduce(
    (text, { key, sample }) => text.replaceAll(`{${key}}`, sample),
    value
  );
}

function announce(message) {
  status.textContent = message;
  setTimeout(() => {
    status.textContent = "";
  }, 2000);
}

function insert(shortcode) {
  const field = lastFocused;
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? field.value.length;
  field.value = field.value.slice(0, start) + shortcode + field.value.slice(end);
  field.selectionStart = field.selectionEnd = start + shortcode.length;
  field.focus();
  render(field.id);
}

for (const { key, hint } of SHORTCODES) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "shortcode";
  chip.title = hint;
  chip.innerHTML = `<code>{${key}}</code><span>${hint}</span>`;
  chip.addEventListener("click", () => insert(`{${key}}`));
  document.getElementById("shortcodes").appendChild(chip);
}

chrome.storage.sync.get(DEFAULTS, (items) => {
  for (const field of FIELDS) {
    document.getElementById(field).value = items[field] || DEFAULTS[field];
    render(field);
  }
});

for (const field of FIELDS) {
  const node = document.getElementById(field);
  node.addEventListener("input", () => render(field));
  node.addEventListener("focus", () => {
    lastFocused = node;
  });
}

document.getElementById("save").addEventListener("click", () => {
  const values = Object.fromEntries(
    FIELDS.map((field) => [field, document.getElementById(field).value])
  );
  chrome.storage.sync.set(values, () => announce("Guardado"));
});

document.getElementById("reset").addEventListener("click", () => {
  for (const field of FIELDS) {
    document.getElementById(field).value = DEFAULTS[field];
    render(field);
  }
  chrome.storage.sync.set(DEFAULTS, () => announce("Defaults repostos"));
});
