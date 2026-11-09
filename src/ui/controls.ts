interface CheckItem {
  id: string;
  label: string;
  hint?: string;
}

export function mountChecks(
  container: HTMLElement,
  items: readonly CheckItem[],
  hints: boolean,
  onToggle: (id: string, on: boolean) => void,
): void {
  container.replaceChildren();
  for (const item of items) {
    const label = document.createElement("label");
    label.className = "check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.id = item.id;
    input.addEventListener("change", () => onToggle(item.id, input.checked));
    const text = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = item.label;
    text.append(name);
    if (hints && item.hint) {
      const hint = document.createElement("small");
      hint.textContent = item.hint;
      text.append(hint);
    }
    label.append(input, text);
    container.append(label);
  }
}

export function syncChecks(container: HTMLElement, isOn: (id: string) => boolean): void {
  for (const input of container.querySelectorAll("input")) {
    if (!(input instanceof HTMLInputElement)) continue;
    const id = input.dataset.id ?? "";
    input.checked = isOn(id);
  }
}

export function mountChips(
  container: HTMLElement,
  items: readonly CheckItem[],
  onToggle: (id: string, on: boolean) => void,
): void {
  container.replaceChildren();
  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.dataset.id = item.id;
    button.textContent = item.label;
    button.addEventListener("click", () => {
      const next = button.getAttribute("aria-pressed") !== "true";
      onToggle(item.id, next);
    });
    container.append(button);
  }
}

export function syncChips(container: HTMLElement, isOn: (id: string) => boolean): void {
  for (const button of container.querySelectorAll("button")) {
    const id = button.dataset.id ?? "";
    button.setAttribute("aria-pressed", String(isOn(id)));
  }
}

export function applyTheme(dark: boolean): void {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!(node instanceof HTMLElement)) throw new Error(`brak #${id}`);
  return node as T;
}
