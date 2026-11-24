import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { HashRouter } from "react-router";
import { App } from "./app";
import { storedSound } from "./audio/stored";
import { connectionHint } from "./connection";
import { RegistryContext } from "./hooks";
import type { PackageSources } from "./scenarios/registry";
import { addErrorNotification } from "./state/notificationSlice";
import { createAppStore } from "./state/store";
import "./style.scss";

async function bootstrap(): Promise<void> {
  const root = document.querySelector<HTMLElement>("#app");
  if (root === null) throw new Error("App root element was not found.");

  // Test fixtures register only in the e2e build mode; this branch is removed from production builds.
  const extraSources: PackageSources[] = import.meta.env.MODE === "e2e"
    ? [(await import("../test/fixtures/scenarios/fixtureSources")).fixtureSources]
    : [];
  // The packages, the loader and Zod load here, outside the initial chunk.
  const { loadBuiltInRegistry } = await import("./scenarios/lazySources");
  const registry = await loadBuiltInRegistry(...extraSources);
  const store = createAppStore({ preloadedState: { audio: storedSound(() => window.localStorage, connectionHint()) }, registry });
  for (const problem of registry.problems) {
    console.error(problem);
    store.dispatch(addErrorNotification("A scenario package failed validation and is unavailable."));
  }

  // Sound loads beside the first screen and never holds it up; without it the game is silent.
  import("./audio/browser").then(({ startBrowserSound }) => { startBrowserSound(store, registry); }).catch(() => undefined);

  createRoot(root).render(
    <StrictMode>
      <Provider store={store}>
        <RegistryContext value={registry}>
          <HashRouter>
            <App />
          </HashRouter>
        </RegistryContext>
      </Provider>
    </StrictMode>
  );
}

void bootstrap();
