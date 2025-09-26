// Ejemplo de uso dentro de tu PWA
// Importa en tu bundler o usa un <script type="module"> en index.html
import { initICDFromConfig, searchICD11, getICD11EntityByUri } from "./icd_oauth.js";

async function demoICD() {
  await initICDFromConfig("./config.json");

  const q = "hypertension";
  try {
    const res = await searchICD11(q, { lang: "es" });
    console.log("Resultados búsqueda:", res);

    // Si existe primer resultado con URI, obtén detalles
    const first = res?.destinationEntities?.[0] || res?.[0];
    const uri = first?.theCode || first?.id || first?.uri || first?.@id;
    if (uri) {
      const details = await getICD11EntityByUri(uri, { lang: "es" });
      console.log("Detalle entidad:", details);
    }
  } catch (e) {
    console.error("Error ICD:", e);
    // Muestra un toast/alert al usuario
  }
}

document.addEventListener("DOMContentLoaded", demoICD);
