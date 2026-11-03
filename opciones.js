// opciones.js — La página de opciones: qué IA usar y el editor de presets.
//
// Todo se guarda en chrome.storage.local (no en .sync): la clave de API no debe viajar a
// otras computadoras donde inicies sesión en Chrome.

const camposDeConfig = ["claveClaude", "modeloClaude", "urlCompatible", "claveCompatible", "modeloCompatible"];
const editor = document.getElementById("editor");

// Muestra solo los datos del proveedor elegido. Si se vieran los dos bloques, es fácil
// llenar la clave en el lugar equivocado y no entender por qué "no funciona".
function mostrarBloqueDelProveedor() {
  const proveedor = document.querySelector('input[name="proveedor"]:checked').value;
  document.getElementById("bloque-claude").hidden = proveedor !== "claude";
  document.getElementById("bloque-compatible").hidden = proveedor === "claude";
}

async function cargarPagina() {
  const { config = {} } = await chrome.storage.local.get("config");
  const proveedor = config.proveedor || "compatible"; // igual que CONFIG_DE_FABRICA en fondo.js
  document.querySelector(`input[name="proveedor"][value="${proveedor}"]`).checked = true;
  document.getElementById("modeloClaude").value = config.modeloClaude || "claude-opus-5-5";
  document.getElementById("claveClaude").value = config.claveClaude || "";
  document.getElementById("urlCompatible").value = config.urlCompatible || "http://127.0.0.1:11434/v1";
  document.getElementById("claveCompatible").value = config.claveCompatible || "";
  document.getElementById("modeloCompatible").value = config.modeloCompatible || "qwen3:4b-instruct";
  mostrarBloqueDelProveedor();
  dibujarEditor(await cargarPresets());
}

// ─── Editor de presets ────────────────────────────────────────────────────────────────

// Una fila = un preset: nombre, instrucción y botón de borrar. El id va escondido en el
// propio elemento porque no lo editas tú (si cambiara, el panel perdería tu última
// elección).
function crearFila(preset) {
  const fila = document.createElement("div");
  fila.className = "fila";
  fila.dataset.id = preset.id;
  fila.innerHTML = `
    <input class="nombre" placeholder="Nombre en el menú">
    <textarea class="instruccion" placeholder="Lo que le dices a la IA"></textarea>
    <button class="borrar" title="Borrar">✕</button>`;
  fila.querySelector(".nombre").value = preset.nombre;
  fila.querySelector(".instruccion").value = preset.instruccion;
  fila.querySelector(".borrar").addEventListener("click", () => fila.remove());
  return fila;
}

function dibujarEditor(presets) {
  editor.innerHTML = "";
  for (const categoria of CATEGORIAS) {
    const bloque = document.createElement("details");
    bloque.dataset.categoria = categoria.clave;
    bloque.innerHTML = `<summary>${categoria.titulo} (${presets[categoria.clave].length})</summary><div class="filas"></div>
      <p class="pie-categoria"><button class="agregar">+ Agregar</button></p>`;
    const filas = bloque.querySelector(".filas");
    for (const preset of presets[categoria.clave]) filas.appendChild(crearFila(preset));
    bloque.querySelector(".agregar").addEventListener("click", () => {
      // Un id nuevo que no choque con ninguno: "propio-" + la hora en milisegundos.
      const fila = crearFila({ id: "propio-" + Date.now(), nombre: "", instruccion: "" });
      filas.appendChild(fila);
      fila.querySelector(".nombre").focus();
    });
    editor.appendChild(bloque);
  }
  editor.querySelector("details").open = true;
}

// Lee lo que hay en pantalla de vuelta a la misma forma que PRESETS_DE_FABRICA. Las filas
// sin nombre o sin instrucción se descartan: en el menú saldrían como una opción en
// blanco que no le dice nada a la IA.
function leerEditor() {
  const presets = {};
  for (const bloque of editor.querySelectorAll("details")) {
    presets[bloque.dataset.categoria] = [...bloque.querySelectorAll(".fila")]
      .map((fila) => ({
        id: fila.dataset.id,
        nombre: fila.querySelector(".nombre").value.trim(),
        instruccion: fila.querySelector(".instruccion").value.trim()
      }))
      .filter((preset) => preset.nombre && preset.instruccion);
  }
  return presets;
}

// ─── Guardar y probar ─────────────────────────────────────────────────────────────────

async function guardar() {
  const config = { proveedor: document.querySelector('input[name="proveedor"]:checked').value };
  for (const id of camposDeConfig) config[id] = document.getElementById(id).value.trim();
  await chrome.storage.local.set({ config, presets: leerEditor() });
  const estado = document.getElementById("estado-guardar");
  estado.textContent = "Guardado ✓";
  estado.className = "estado bien";
  setTimeout(() => (estado.textContent = ""), 2500);
}

// Guarda primero y luego prueba: si probara sin guardar, fondo.js usaría la
// configuración vieja y diría que falla aunque lo que acabas de escribir esté bien.
async function probar() {
  const estado = document.getElementById("estado-prueba");
  estado.textContent = "Probando…";
  estado.className = "estado";
  await guardar();
  const respuesta = await chrome.runtime.sendMessage({ tipo: "probar" });
  if (respuesta.error) {
    estado.textContent = respuesta.error;
    estado.className = "estado mal";
  } else {
    estado.textContent = `Funciona ✓ (respondió: "${respuesta.texto.trim().slice(0, 40)}")`;
    estado.className = "estado bien";
  }
}

for (const radio of document.querySelectorAll('input[name="proveedor"]')) {
  radio.addEventListener("change", mostrarBloqueDelProveedor);
}

// Los botones de atajo (Ollama, Gemini, Groq...) solo rellenan la dirección y un modelo
// de ejemplo; la clave la pones tú.
for (const atajo of document.querySelectorAll(".atajos button")) {
  atajo.addEventListener("click", () => {
    document.getElementById("urlCompatible").value = atajo.dataset.url;
    document.getElementById("modeloCompatible").value = atajo.dataset.modelo;
  });
}

document.getElementById("guardar").addEventListener("click", guardar);
document.getElementById("probar").addEventListener("click", probar);
document.getElementById("restaurar").addEventListener("click", () => {
  if (confirm("¿Regresar todos los presets a los de fábrica? Se pierden los que editaste (hasta que guardes).")) {
    dibujarEditor(PRESETS_DE_FABRICA);
  }
});

cargarPagina();
