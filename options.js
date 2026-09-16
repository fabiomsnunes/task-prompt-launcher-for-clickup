const DEFAULTS = {
  template: 'Vamos trabalhar na task ClickUp {id} - "{name}".\n\n',
  webTemplate: "Vamos trabalhar nesta task do ClickUp:\n\n{name}\n{url}\n\n",
};

const SAMPLE_TASK = {
  id: "86c1abcde",
  name: "Corrigir checkout do Woo em mobile",
  url: "https://app.clickup.com/t/86c1abcde",
};

const FIELDS = Object.keys(DEFAULTS);
const status = document.getElementById("status");

function render(field) {
  const value = document.getElementById(field).value;
  document.getElementById(`${field}-preview`).textContent = value
    .replaceAll("{id}", SAMPLE_TASK.id)
    .replaceAll("{name}", SAMPLE_TASK.name)
    .replaceAll("{url}", SAMPLE_TASK.url);
}

function announce(message) {
  status.textContent = message;
  setTimeout(() => {
    status.textContent = "";
  }, 2000);
}

function collect() {
  return Object.fromEntries(
    FIELDS.map((field) => [field, document.getElementById(field).value])
  );
}

chrome.storage.sync.get(DEFAULTS, (items) => {
  for (const field of FIELDS) {
    document.getElementById(field).value = items[field] || DEFAULTS[field];
    render(field);
  }
});

for (const field of FIELDS) {
  document.getElementById(field).addEventListener("input", () => render(field));
}

document.getElementById("save").addEventListener("click", () => {
  chrome.storage.sync.set(collect(), () => announce("Guardado"));
});

document.getElementById("reset").addEventListener("click", () => {
  for (const field of FIELDS) {
    document.getElementById(field).value = DEFAULTS[field];
    render(field);
  }
  chrome.storage.sync.set(DEFAULTS, () => announce("Defaults repostos"));
});
