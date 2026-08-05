import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializePwa } from "@/lib/pwa";

window.addEventListener("load", () => void initializePwa());

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(<App />);
