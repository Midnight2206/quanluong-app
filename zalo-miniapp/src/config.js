const configured = import.meta.env && import.meta.env.VITE_API_BASE;

export const API_BASE = String(configured || "http://localhost:3000/api").replace(/\/+$/, "");
