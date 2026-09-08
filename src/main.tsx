import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "@/lib/registerServiceWorker";
import { initNativeApp } from "@/lib/native";

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(<App />);
registerServiceWorker();
void initNativeApp();
