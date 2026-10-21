import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { store } from "./ui/store";
import "./ui/styles.css";
import { startAnalytics } from "./ui/analyticsWatch";
import { startCloud } from "./ui/cloudSync";

store.start();
startAnalytics();
startCloud();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// debug helper in browser console (dev only)
if (import.meta.env.DEV) (window as any).game = store;
