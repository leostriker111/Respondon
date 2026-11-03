// campo.js — Lo que vive dentro de cada página: el botón ✦ junto al campo, el panel,
// la lectura de la pregunta y la escritura del texto en el campo.
//
// Este archivo nunca habla con la IA; le pasa todo a fondo.js con un mensaje. Así la
// clave de API no se asoma a la página y el CORS de la página no estorba.

let campoActual = null; // el último campo de texto en el que estuviste
let temporizadorOcultar = null;

// ─── La interfaz ──────────────────────────────────────────────────────────────────────
// Todo va dentro de un Shadow DOM cerrado. Sin eso, el CSS de la página (TripleTen,
// Google Forms, lo que sea) se mete con los botones y el panel sale deforme, y al revés:
// nuestro CSS podría descomponer la página.

const anfitrion = document.createElement("div");
anfitrion.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;";
const sombra = anfitrion.attachShadow({ mode: "closed" });

sombra.innerHTML = `
<style>
  :host { all: initial; }
  * { box-sizing: border-box; font-family: system-ui, "Segoe UI", sans-serif; }
  .boton {
    position: fixed; width: 28px; height: 28px; border-radius: 50%; border: none;
    background: #6d4aff; color: #fff; font-size: 15px; cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,.3); display: none; padding: 0; line-height: 28px;
  }
  .boton:hover { background: #5531f0; }
  .panel {
    position: fixed; width: 380px; max-width: calc(100vw - 16px);
    max-height: calc(100vh - 16px); overflow-y: auto;
    background: #fff; color: #1d1b26; border: 1px solid #d9d4ee; border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,.25); padding: 12px; font-size: 13px;
  }
  .panel[hidden], [hidden] { display: none !important; }
  header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  header b { font-size: 14px; color: #6d4aff; }
  .cerrar { border: none; background: none; font-size: 18px; cursor: pointer; color: inherit; }
  .pregunta {
    background: #f4f1ff; border-radius: 8px; padding: 6px 8px; margin-bottom: 8px;
    max-height: 60px; overflow-y: auto; font-size: 12px; color: #4a4560; white-space: pre-wrap;
  }
  .rejilla { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px; }
  .rejilla label:first-child { grid-column: 1 / -1; }
  label { display: flex; flex-direction: column; gap: 2px; font-size: 11px; color: #6b6680; }
  select, textarea, input {
    font-size: 13px; padding: 5px 6px; border: 1px solid #d9d4ee; border-radius: 6px;
    background: #fff; color: #1d1b26; width: 100%;
  }
  textarea { resize: vertical; }
  .idea { min-height: 44px; }
  .resultado { min-height: 120px; margin-top: 8px; }
  .acciones { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
  .acciones button {
    flex: 1; padding: 7px 8px; border-radius: 6px; border: 1px solid #6d4aff;
    background: #fff; color: #6d4aff; cursor: pointer; font-size: 13px; white-space: nowrap;
  }
  .acciones button.principal { background: #6d4aff; color: #fff; }
  .acciones button:disabled { opacity: .5; cursor: wait; }
  .estado { margin-top: 6px; font-size: 12px; color: #6b6680; min-height: 16px; }
  .estado.error { color: #c0262d; }
  @media (prefers-color-scheme: dark) {
    .panel { background: #1f1d29; color: #ece9f7; border-color: #3a3550; }
    .pregunta { background: #2a2640; color: #c9c3e0; }
    select, textarea, input { background: #15131d; color: #ece9f7; border-color: #3a3550; }
    .acciones button { background: transparent; color: #b3a1ff; border-color: #8a72ff; }
    .acciones button.principal { background: #6d4aff; color: #fff; }
    label, .estado { color: #a59fbd; }
  }
</style>

<button class="boton" title="Responder con Respondón (Alt+Shift+R)">✦</button>

<div class="panel" hidden>
  <header><b>✦ Respondón</b><button class="cerrar" title="Cerrar (Esc)">×</button></header>
  <div class="pregunta"></div>
  <div class="rejilla">
    <label>Receta<select data-categoria="recetas"></select></label>
    <label>Tono<select data-categoria="tonos"></select></label>
    <label>Idioma<select data-categoria="idiomas"></select></label>
    <label>Sentimiento<select data-categoria="sentimientos"></select></label>
    <label>Largo<select data-categoria="largos"></select></label>
  </div>
  <label>Tu idea en bruto (opcional)
    <textarea class="idea" placeholder="sisi muy chido, me sirvió lo de los JOIN"></textarea>
  </label>
  <label style="margin-top:6px">Indicaciones extra (opcional)
    <input class="guia" placeholder="menciona los ejercicios prácticos; no hables del instructor">
  </label>
  <div class="acciones">
    <button class="generar principal">Generar</button>
    <button class="todos" title="Escribe en todos los cuadros de texto vacíos de la página, uno por uno">Llenar todos los vacíos</button>
  </div>
  <div class="estado"></div>
  <textarea class="resultado" hidden></textarea>
  <div class="acciones acciones-resultado" hidden>
    <button class="insertar principal">Insertar</button>
    <button class="otra">Otra versión</button>
    <button class="copiar">Copiar</button>
  </div>
</div>`;

const boton = sombra.querySelector(".boton");
const panel = sombra.querySelector(".panel");
const cajaPregunta = sombra.querySelector(".pregunta");
const menus = [...sombra.querySelectorAll("select")];
const cajaIdea = sombra.querySelector(".idea");
const cajaGuia = sombra.querySelector(".guia");
const cajaEstado = sombra.querySelector(".estado");
const cajaResultado = sombra.querySelector(".resultado");
const accionesResultado = sombra.querySelector(".acciones-resultado");
const botonGenerar = sombra.querySelector(".generar");
const botonTodos = sombra.querySelector(".todos");

document.documentElement.appendChild(anfitrion);

// Las teclas que escribes en el panel no deben llegar a la página. Hay sitios con atajos
// de teclado (la "k" pausa el video, la "/" abre el buscador) que se activarían mientras
// escribes tu idea.
for (const tipo of ["keydown", "keyup", "keypress"]) {
  anfitrion.addEventListener(tipo, (evento) => {
    if (evento.key === "Escape" && tipo === "keydown") cerrarPanel();
    evento.stopPropagation();
  });
}

// ─── Saber en qué campo estás ─────────────────────────────────────────────────────────

// Decide si un elemento es un campo donde tiene sentido escribir. Las contraseñas, los
// campos deshabilitados y los de solo lectura quedan fuera; los inputs de una línea solo
// cuentan para el atajo y el clic derecho, no para el botón ✦ (si no, saldría en cada
// buscador y en cada campo de correo).
function esCampoEditable(elemento) {
  if (!elemento || elemento === anfitrion) return false;
  if (elemento instanceof HTMLTextAreaElement) return !elemento.readOnly && !elemento.disabled;
  if (elemento instanceof HTMLInputElement) {
    return ["text", "search", "url"].includes(elemento.type) && !elemento.readOnly && !elemento.disabled;
  }
  return elemento.isContentEditable;
}

// En un editor enriquecido (contenteditable) el foco puede caer en un <p> de adentro;
// lo que hay que llenar es el contenedor editable de hasta arriba.
function raizEditable(elemento) {
  while (elemento.parentElement && elemento.parentElement.isContentEditable) {
    elemento = elemento.parentElement;
  }
  return elemento;
}

document.addEventListener(
  "focusin",
  (evento) => {
    let elemento = evento.target;
    if (!esCampoEditable(elemento)) return;
    if (elemento.isContentEditable) elemento = raizEditable(elemento);
    campoActual = elemento;
    clearTimeout(temporizadorOcultar);
    if (!(elemento instanceof HTMLInputElement)) mostrarBoton();
  },
  true
);

document.addEventListener(
  "focusout",
  () => {
    // Se espera un momento porque al hacer clic en el ✦ el campo pierde el foco justo
    // antes del clic; si se ocultara al instante, el clic caería en el vacío.
    // Y antes de ocultar se revisa que el foco de verdad se haya ido del campo: al abrir
    // un modal, el navegador enfoca solo su textarea y DESPUÉS el botón "Abrir" suelta
    // el foco; sin esa revisión, ese focusout tardío escondía el ✦ del campo enfocado.
    temporizadorOcultar = setTimeout(() => {
      if (panel.hidden && document.activeElement !== campoActual) boton.style.display = "none";
    }, 250);
  },
  true
);

// Alt+Shift+R abre el panel para el campo donde estás, incluidos los inputs de una línea.
document.addEventListener(
  "keydown",
  (evento) => {
    if (evento.altKey && evento.shiftKey && evento.code === "KeyR" && campoActual) {
      evento.preventDefault();
      abrirPanel();
    }
  },
  true
);

// El clic derecho → "Responder con Respondón" llega como mensaje desde fondo.js.
chrome.runtime.onMessage.addListener((mensaje) => {
  if (mensaje.tipo !== "abrir-panel") return;
  const enfocado = document.activeElement;
  if (esCampoEditable(enfocado)) {
    campoActual = enfocado.isContentEditable ? raizEditable(enfocado) : enfocado;
  }
  if (campoActual) abrirPanel();
});

// ─── Posicionar el botón y el panel ───────────────────────────────────────────────────

// Convierte una coordenada de la pantalla en una relativa al anfitrión. Normalmente es
// la misma, pero si el anfitrión quedó dentro de un modal con "transform" (animaciones),
// position:fixed se mide desde el modal y no desde la ventana, y todo saldría corrido.
function colocar(elemento, izquierda, arriba) {
  const origen = anfitrion.getBoundingClientRect();
  elemento.style.left = izquierda - origen.left + "px";
  elemento.style.top = arriba - origen.top + "px";
}

// Mete el anfitrión dentro del modal donde está el campo, si hay uno. Los modales
// "atrapan el foco": si el panel quedara afuera, cada clic en tu idea regresaría el
// cursor al modal, y un <dialog> nativo hasta deja el resto de la página sin clics.
function moverAnfitrionJuntoAlCampo() {
  const modal = campoActual.closest('dialog, [role="dialog"], [aria-modal="true"]');
  const destino = modal || document.documentElement;
  if (anfitrion.parentNode !== destino) destino.appendChild(anfitrion);
}

function mostrarBoton() {
  moverAnfitrionJuntoAlCampo();
  boton.style.display = "block";
  acomodar();
}

// Pone el ✦ en la esquina SUPERIOR derecha del campo (la inferior ya la ocupa la barrita
// de Grammarly y quedarían encimados) y el panel abajo del campo (o arriba, si abajo no
// cabe). Se llama al hacer scroll y al cambiar el tamaño porque las posiciones fijas no
// siguen al campo solas.
function acomodar() {
  if (!campoActual || !campoActual.isConnected) return;
  const caja = campoActual.getBoundingClientRect();
  colocar(boton, caja.right - 34, caja.top + 6);

  if (panel.hidden) return;
  const anchoPanel = panel.offsetWidth;
  const altoPanel = panel.offsetHeight;
  let izquierda = Math.min(caja.left, window.innerWidth - anchoPanel - 8);
  izquierda = Math.max(8, izquierda);
  let arriba = caja.bottom + 6;
  if (arriba + altoPanel > window.innerHeight - 8) {
    arriba = Math.max(8, caja.top - altoPanel - 6);
  }
  colocar(panel, izquierda, arriba);
}

window.addEventListener("scroll", acomodar, true);
window.addEventListener("resize", acomodar);
document.addEventListener("input", acomodar, true);

// mousedown con preventDefault: así el campo no pierde el foco al picarle al ✦.
boton.addEventListener("mousedown", (evento) => evento.preventDefault());
boton.addEventListener("click", () => abrirPanel());
sombra.querySelector(".cerrar").addEventListener("click", () => cerrarPanel());

// ─── Abrir el panel ───────────────────────────────────────────────────────────────────

async function abrirPanel() {
  moverAnfitrionJuntoAlCampo();
  await llenarMenus();
  cajaPregunta.textContent = preguntaDelCampo(campoActual) || "(no encontré la pregunta del campo; me guiaré por la página)";
  cajaResultado.hidden = true;
  accionesResultado.hidden = true;
  mostrarEstado("");
  panel.hidden = false;
  boton.style.display = "block";
  acomodar();
  cajaIdea.focus();
}

function cerrarPanel() {
  panel.hidden = true;
  boton.style.display = "none";
  if (campoActual && campoActual.isConnected) campoActual.focus();
}

// Llena los cinco menús con los presets (los tuyos de opciones o los de fábrica) y
// selecciona lo que elegiste la última vez. Se hace cada vez que se abre el panel para
// que un cambio en opciones se vea sin recargar la página.
async function llenarMenus() {
  const presets = await cargarPresets();
  const { ultimaEleccion = {} } = await chrome.storage.local.get("ultimaEleccion");
  for (const menu of menus) {
    const categoria = menu.dataset.categoria;
    menu.innerHTML = "";
    for (const preset of presets[categoria]) {
      menu.add(new Option(preset.nombre, preset.id));
    }
    if (ultimaEleccion[categoria] && presets[categoria].some((p) => p.id === ultimaEleccion[categoria])) {
      menu.value = ultimaEleccion[categoria];
    }
  }
}

// Recordar la elección: si cada vez tuvieras que volver a escoger "Review de curso" y
// "Mexicano coloquial", la herramienta ahorraría la mitad de lo que promete.
for (const menu of menus) {
  menu.addEventListener("change", () => {
    const eleccion = {};
    for (const m of menus) eleccion[m.dataset.categoria] = m.value;
    chrome.storage.local.set({ ultimaEleccion: eleccion });
  });
}

// ─── Leer la página ───────────────────────────────────────────────────────────────────

// El texto visible de un elemento sin el contenido del propio campo (para no mandarle a
// la IA tu borrador como si fuera la pregunta).
function textoSin(elemento, campo) {
  let texto = elemento.innerText || "";
  const propio = campo.isContentEditable ? campo.innerText : "";
  if (propio) texto = texto.replace(propio, "");
  return texto.replace(/\n{3,}/g, "\n\n").trim();
}

// Sube por los contenedores del campo hasta encontrar uno con al menos "minimo" letras
// de texto. Así se encuentra la pregunta aunque la página no use <label> (casi ninguna
// app moderna lo hace bien). Si en 10 niveles no se junta tanto texto, se regresa lo
// más que se haya encontrado: poco contexto es mejor que ninguno.
function textoCercano(campo, minimo, maximo) {
  let mejor = "";
  let nodo = campo.parentElement;
  for (let nivel = 0; nodo && nivel < 10; nivel++, nodo = nodo.parentElement) {
    const texto = textoSin(nodo, campo);
    if (texto.length >= minimo) return texto.slice(0, maximo);
    if (texto.length > mejor.length) mejor = texto;
  }
  return mejor.slice(0, maximo);
}

// La pregunta que hace el campo. Primero lo que la página declara a propósito (etiquetas
// de accesibilidad, <label>, placeholder); si no hay nada de eso, el texto más cercano.
function preguntaDelCampo(campo) {
  const partes = [];
  const idsEtiqueta = campo.getAttribute("aria-labelledby");
  if (idsEtiqueta) {
    for (const id of idsEtiqueta.split(/\s+/)) {
      const etiqueta = document.getElementById(id);
      if (etiqueta) partes.push(etiqueta.innerText);
    }
  }
  if (campo.getAttribute("aria-label")) partes.push(campo.getAttribute("aria-label"));
  if (campo.id) {
    const etiqueta = document.querySelector(`label[for="${CSS.escape(campo.id)}"]`);
    if (etiqueta) partes.push(etiqueta.innerText);
  }
  const etiquetaPadre = campo.closest("label");
  if (etiquetaPadre) partes.push(textoSin(etiquetaPadre, campo));
  const marcador = campo.getAttribute("placeholder") || campo.getAttribute("data-placeholder");
  if (marcador) partes.push(marcador);

  if (partes.length === 0) partes.push(textoCercano(campo, 10, 600));
  const sinRepetir = [...new Set(partes.map((p) => p.trim()).filter(Boolean))];
  return sinRepetir.join("\n").slice(0, 800);
}

// Lo que se sabe de la página: título, encabezados y el texto principal (que en una
// lección es el tema; sin él, la review no podría mencionar nada concreto). Se esconde el
// panel un instante para que su propio texto no se cuele en la lectura.
function datosDePagina() {
  anfitrion.style.display = "none";
  const principal = document.querySelector('main, article, [role="main"]') || document.body;
  const encabezados = [...document.querySelectorAll("h1, h2, h3")]
    .map((h) => h.innerText.trim())
    .filter(Boolean)
    .slice(0, 12)
    .join(" | ");
  const datos = {
    titulo: document.title,
    url: location.origin + location.pathname, // sin ?parámetros: pueden traer datos tuyos
    encabezados,
    textoPrincipal: (principal.innerText || "").replace(/\n{3,}/g, "\n\n").slice(0, 4000)
  };
  anfitrion.style.display = "";
  return datos;
}

function datosDelCampo(campo) {
  anfitrion.style.display = "none";
  const datos = {
    pregunta: preguntaDelCampo(campo),
    textoAlrededor: textoCercano(campo, 300, 2000),
    textoActual: campo.isContentEditable ? campo.innerText : campo.value,
    limite: campo.maxLength > 0 ? campo.maxLength : 0
  };
  anfitrion.style.display = "";
  return datos;
}

// Todo lo que se le manda a fondo.js para un campo. Los nombres (receta, tono...) son
// los que fondo.js busca en armarInstrucciones.
function juntarDatos(campo) {
  const elegido = (categoria) => menus.find((m) => m.dataset.categoria === categoria).value;
  return {
    receta: elegido("recetas"),
    tono: elegido("tonos"),
    idioma: elegido("idiomas"),
    sentimiento: elegido("sentimientos"),
    largo: elegido("largos"),
    idea: cajaIdea.value,
    guia: cajaGuia.value,
    pagina: datosDePagina(),
    campo: datosDelCampo(campo)
  };
}

// ─── Generar e insertar ───────────────────────────────────────────────────────────────

function mostrarEstado(texto, esError = false) {
  cajaEstado.textContent = texto;
  cajaEstado.classList.toggle("error", esError);
}

// Le pide el texto a fondo.js. Si recargaste la extensión mientras la página estaba
// abierta, este script quedó huérfano y Chrome lanza "Extension context invalidated";
// en vez de ese mensaje críptico se dice qué hacer.
async function pedirTexto(campo) {
  let respuesta;
  try {
    respuesta = await chrome.runtime.sendMessage({ tipo: "generar", datos: juntarDatos(campo) });
  } catch (error) {
    throw new Error("Respondón se actualizó. Recarga esta página (F5) y vuelve a intentar.");
  }
  if (!respuesta) throw new Error("No hubo respuesta del fondo de la extensión.");
  if (respuesta.error) throw new Error(respuesta.error);
  return respuesta.texto;
}

async function generar() {
  if (!campoActual) return;
  botonGenerar.disabled = true;
  sombra.querySelector(".otra").disabled = true;
  // Con un modelo local en CPU tarda medio minuto; sin un contador parece colgado.
  const inicio = Date.now();
  mostrarEstado("Escribiendo…");
  const reloj = setInterval(() => mostrarEstado(`Escribiendo… ${Math.round((Date.now() - inicio) / 1000)} s`), 1000);
  try {
    cajaResultado.value = await pedirTexto(campoActual);
    clearInterval(reloj); // antes de escribir el estado final, para que el reloj no lo pise
    cajaResultado.hidden = false;
    accionesResultado.hidden = false;
    mostrarEstado(`${cajaResultado.value.length} caracteres. Puedes editarlo antes de insertar.`);
  } catch (error) {
    clearInterval(reloj);
    mostrarEstado(error.message, true);
  } finally {
    botonGenerar.disabled = false;
    sombra.querySelector(".otra").disabled = false;
    acomodar();
  }
}

// Escribe el texto en el campo de forma que la página SÍ se entere. Asignar .value a
// secas no basta en apps hechas con React (TripleTen lo es): el texto se ve, pero al
// enviar el formulario manda el campo vacío porque React nunca recibió el evento.
//   1. Primero se intenta como si lo hubieras tecleado (execCommand "insertText"): la
//      página recibe sus eventos normales y además funciona Ctrl+Z para deshacer.
//   2. Si el navegador no lo permite, se usa el "setter" nativo de value y se disparan
//      a mano los eventos input y change.
function escribirEnCampo(campo, texto) {
  campo.focus();

  if (campo.isContentEditable) {
    const rango = document.createRange();
    rango.selectNodeContents(campo);
    const seleccion = window.getSelection();
    seleccion.removeAllRanges();
    seleccion.addRange(rango);
    const funciono = document.execCommand("insertText", false, texto);
    if (!funciono || campo.innerText.trim() !== texto.trim()) {
      campo.innerText = texto;
      campo.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: texto }));
    }
    return;
  }

  campo.select();
  const funciono = document.execCommand("insertText", false, texto);
  if (!funciono || campo.value !== texto) {
    const prototipo = campo instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototipo, "value").set.call(campo, texto);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  }
  campo.dispatchEvent(new Event("change", { bubbles: true }));
}

// Los cuadros de texto grandes que están a la vista y vacíos. Solo textarea y editores
// enriquecidos: los inputs de una línea suelen ser nombre, correo o buscador, y llenarlos
// con una reseña sería un desastre.
function camposVaciosDeLaPagina() {
  const candidatos = [...document.querySelectorAll('textarea, [contenteditable=""], [contenteditable="true"]')];
  return candidatos.filter((campo) => {
    if (!esCampoEditable(campo)) return false;
    if (campo.isContentEditable && campo.parentElement && campo.parentElement.isContentEditable) return false;
    if (campo.getClientRects().length === 0) return false; // escondido
    const texto = campo.isContentEditable ? campo.innerText : campo.value;
    return texto.trim() === "";
  });
}

// "Llenar todos los vacíos": uno por uno (no en paralelo) para que cada campo lea su
// propia pregunta y para no pegarle cinco peticiones juntas al límite de la API.
async function llenarTodos() {
  const campos = camposVaciosDeLaPagina();
  if (campos.length === 0) {
    mostrarEstado("No encontré cuadros de texto vacíos en esta página.");
    return;
  }
  const campoOriginal = campoActual;
  botonTodos.disabled = true;
  botonGenerar.disabled = true;
  let hechos = 0;
  try {
    for (const campo of campos) {
      mostrarEstado(`Escribiendo ${hechos + 1} de ${campos.length}…`);
      campoActual = campo;
      escribirEnCampo(campo, await pedirTexto(campo));
      hechos++;
    }
    mostrarEstado(`Listo: llené ${hechos} campos. Revísalos antes de enviar.`);
  } catch (error) {
    mostrarEstado(`Llené ${hechos} de ${campos.length}. Error: ${error.message}`, true);
  } finally {
    campoActual = campoOriginal;
    botonTodos.disabled = false;
    botonGenerar.disabled = false;
    acomodar();
  }
}

botonGenerar.addEventListener("click", generar);
sombra.querySelector(".otra").addEventListener("click", generar);
botonTodos.addEventListener("click", llenarTodos);

sombra.querySelector(".insertar").addEventListener("click", () => {
  escribirEnCampo(campoActual, cajaResultado.value);
  panel.hidden = true;
  boton.style.display = "none";
});

sombra.querySelector(".copiar").addEventListener("click", async () => {
  await navigator.clipboard.writeText(cajaResultado.value);
  mostrarEstado("Copiado.");
});

// Ctrl+Enter en tu idea = Generar, para no tener que ir al botón con el mouse.
cajaIdea.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter" && evento.ctrlKey) generar();
});
