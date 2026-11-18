import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { HashRouter } from "react-router";
import { App } from "./app";
import { RegistryContext } from "./hooks";
import { builtInSources } from "./scenarios/builtInSources";
import { createScenarioRegistry, type PackageSources } from "./scenarios/registry";
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
  const registry = createScenarioRegistry(builtInSources, ...extraSources);
  const store = createAppStore({ registry });
  for (const problem of registry.problems) {
    console.error(problem);
    store.dispatch(addErrorNotification("A scenario package failed validation and is unavailable."));
  }

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
