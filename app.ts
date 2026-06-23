import "./style.scss";

export const appTitle = "Spanish Diplomacy";
export const appSubtitle = "Hidden orders. Simultaneous resolution.";

export function renderApp(root: HTMLElement): void {
  root.innerHTML = `
    <section class="app-shell" aria-labelledby="app-title">
      <p class="app-kicker">Strategy prototype</p>
      <h1 id="app-title">${appTitle}</h1>
      <p>${appSubtitle}</p>
    </section>
  `;
}

export function mountApp(root: HTMLElement | null): void {
  if (root === null) {
    return;
  }

  renderApp(root);
}

mountApp(document.querySelector<HTMLElement>("#app"));
