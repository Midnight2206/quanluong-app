import React from "react";
import ReactDOM from "react-dom/client";
import SuperadminApp from "@/superadmin-app/SuperadminApp.jsx";
import "@/index.css";
import { initializeTheme } from "@/utils/theme";

initializeTheme();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SuperadminApp />
  </React.StrictMode>,
);
