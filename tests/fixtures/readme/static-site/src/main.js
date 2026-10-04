import { duree } from "./duree.js";
const favoris = JSON.parse(localStorage.getItem("favoris") ?? "[]");
document.querySelector("#app").textContent = `${favoris.length} favoris — ${duree(12, 800)}`;
