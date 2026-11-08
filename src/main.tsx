import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// Cairo ships with the app (same font as before) instead of a render-blocking
// stylesheet from Google: pages paint without waiting on a third-party server,
// and the Android app gets it from its own files with no download at all.
import "@fontsource-variable/cairo/wght.css";
import "./index.css";
import { initNativeApp } from "@/lib/native";
import { initAppFontScale } from "@/lib/appFontScale";

initAppFontScale();

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(<App />);
void initNativeApp();
