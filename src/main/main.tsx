import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { App } from "./app";
import "./style.scss";
import { createAppStore } from "./state/store";

const root = document.querySelector<HTMLElement>("#app");

if (root === null) {
  throw new Error("App root element was not found.");
}

createRoot(root).render(
  <StrictMode>
    <Provider store={createAppStore()}>
      <App />
    </Provider>
  </StrictMode>
);
