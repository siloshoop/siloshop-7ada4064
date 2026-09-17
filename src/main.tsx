import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNativeApp } from "@/lib/native";

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(<App />);
void initNativeApp();
