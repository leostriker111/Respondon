// fondo.js — El service worker: arma el prompt y habla con la IA.
//
// Por qué las llamadas a la IA salen de aquí y no del panel en la página: el panel corre
// dentro de la página de TripleTen (o la que sea), y cualquier petición que haga desde
// ahí la bloquea el CORS de esa página. El service worker de la extensión no tiene ese
// problema, y además así tu clave de API nunca toca el JavaScript de la página.

importScripts("presets.js");

// De fábrica usa Ollama en esta misma compu: es gratis y funciona recién instalada, sin
// clave. Claude se elige en opciones cuando quieras mejor redacción.
const CONFIG_DE_FABRICA = {
  proveedor: "compatible", // "claude" o "compatible" (Ollama u otro servidor estilo OpenAI)
  claveClaude: "",
  modeloClaude: "claude-opus-5-5",
  urlCompatible: "http://127.0.0.1:11434/v1",
  claveCompatible: "",
  // La variante "instruct", no qwen3:4b a secas: esa siempre razona ~2,000 tokens antes de
  // contestar (no hay forma de apagárselo) y en el CPU de la mini eran 5 minutos por review.
  modeloCompatible: "qwen3:4b-instruct"
};

// Modelos de Claude que aceptan fallbacks: "default". Si Claude rechaza una petición por
// sus filtros de seguridad (falsos positivos pasan), el servidor la reintenta con otro
// modelo en la misma llamada en vez de devolverte un error. Haiku no tiene ese respaldo:
// mandarle el parámetro no sirve de nada, por eso va fuera de la lista.
const MODELOS_CON_RESPALDO = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-1", "claude-opus-5"];

// Ollama rechaza con 403 cualquier petición que traiga "Origin: chrome-extension://...",
// salvo que configures la variable OLLAMA_ORIGINS y lo reinicies. Esta regla le quita el
// Origin solo a las peticiones que hace ESTA extensión hacia tu propia máquina, así
// funciona sin tocar nada en Windows. Es de sesión: Chrome la borra al cerrarse, por eso
// se vuelve a poner cada vez que arranca el service worker.
chrome.declarativeNetRequest.updateSessionRules({
  removeRuleIds: [1],
  addRules: [
    {
      id: 1,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [{ header: "origin", operation: "remove" }]
      },
      condition: {
        requestDomains: ["localhost", "127.0.0.1"],
        tabIds: [chrome.tabs.TAB_ID_NONE], // -1 = no viene de una pestaña, o sea, de este service worker
        resourceTypes: ["xmlhttprequest", "other"]
      }
    }
  ]
});

// El menú del clic derecho sobre un campo. Sin esto, la única forma de abrir el panel
// sería el botón ✦ o el atajo, y hay páginas que esconden el botón detrás de su propio
// diseño.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "respondon-abrir",
    title: "Responder con Respondón",
    contexts: ["editable"]
  });
});

chrome.contextMenus.onClicked.addListener((info, pestana) => {
  if (info.menuItemId !== "respondon-abrir") return;
  // frameId importa: si el campo está dentro de un iframe, el panel tiene que abrirse en
  // ese iframe y no en la página de arriba.
  chrome.tabs.sendMessage(pestana.id, { tipo: "abrir-panel" }, { frameId: info.frameId });
});

// Clic en el icono de la extensión = abrir opciones (no hay popup).
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

// El buzón: el panel manda { tipo: "generar", datos } y opciones manda { tipo: "probar" }.
// Hay que devolver true para que Chrome mantenga abierta la respuesta mientras la IA
// contesta; si no, el panel recibe "undefined" al instante.
chrome.runtime.onMessage.addListener((mensaje, _remitente, responder) => {
  if (mensaje.tipo === "generar") {
    generarTexto(mensaje.datos)
      .then((texto) => responder({ texto }))
      .catch((error) => responder({ error: error.message }));
    return true;
  }
  if (mensaje.tipo === "probar") {
    probarConexion()
      .then((texto) => responder({ texto }))
      .catch((error) => responder({ error: error.message }));
    return true;
  }
});

async function cargarConfig() {
  const guardado = await chrome.storage.local.get("config");
  return { ...CONFIG_DE_FABRICA, ...(guardado.config || {}) };
}

// Lo que hace el botón "Generar". Recibe lo que el panel juntó de la página y lo que
// elegiste en los menús, arma las instrucciones y se lo pasa al proveedor configurado.
async function generarTexto(datos) {
  const config = await cargarConfig();
  const presets = await cargarPresets();
  const sistema = armarInstrucciones(datos, presets);
  const pedido = armarPedido(datos);

  // Chrome duerme al service worker tras 30 s sin eventos, aunque esté esperando una
  // respuesta; un modelo local en CPU tarda más que eso y la petición moriría a medias.
  // Llamar cualquier API de la extensión cada 20 s cuenta como actividad y lo mantiene
  // despierto mientras dure la espera.
  const latido = setInterval(() => chrome.runtime.getPlatformInfo(), 20000);
  try {
    let texto;
    if (config.proveedor === "claude") {
      texto = await preguntarAClaude(config, sistema, pedido);
    } else {
      texto = await preguntarACompatible(config, sistema, pedido);
    }
    return limpiarRespuesta(texto, datos.campo.limite);
  } finally {
    clearInterval(latido);
  }
}

// El "system prompt": quién es la IA y cómo debe escribir. Aquí se juntan las cinco
// elecciones del panel. Si una elección no se encuentra (borraste ese preset en
// opciones), simplemente se omite en vez de tronar.
function armarInstrucciones(datos, presets) {
  const buscar = (categoria, id) => {
    const preset = presets[categoria].find((p) => p.id === id);
    return preset ? preset.instruccion : "";
  };

  return [
    "Escribes el texto que una persona va a pegar en un campo de un formulario web.",
    "Escribes COMO esa persona, en primera persona. Nunca como asistente.",
    "",
    "Reglas:",
    "- Devuelve solo el texto final listo para pegar: sin comillas alrededor, sin títulos, sin 'Aquí tienes', sin notas ni explicaciones.",
    "- Sin markdown (ni asteriscos, ni viñetas, ni encabezados).",
    "- Que suene a persona real: frases naturales y variadas. Evita muletillas de IA como 'sin duda', 'cabe destacar', 'en definitiva', 'en resumen', 'me encantó cómo'. No uses el guion largo (—).",
    "- Usa el contexto de la página para hablar de algo concreto, pero no inventes hechos verificables (nombres, fechas, calificaciones, cifras).",
    "- Si se indica un límite de caracteres, no lo pases.",
    "",
    "Tipo de campo: " + buscar("recetas", datos.receta),
    buscar("tonos", datos.tono),
    buscar("idiomas", datos.idioma),
    buscar("sentimientos", datos.sentimiento),
    buscar("largos", datos.largo)
  ].join("\n");
}

// El mensaje del usuario: todo lo que el panel leyó de la página, en secciones con
// etiquetas para que la IA no confunda la pregunta del campo con el texto de la lección.
// Las secciones vacías no se mandan.
function armarPedido(datos) {
  const secciones = [];
  const agregar = (etiqueta, contenido) => {
    if (contenido && String(contenido).trim()) {
      secciones.push(`<${etiqueta}>\n${String(contenido).trim()}\n</${etiqueta}>`);
    }
  };

  agregar("pagina", `Título: ${datos.pagina.titulo}\nDirección: ${datos.pagina.url}\nEncabezados: ${datos.pagina.encabezados}`);
  agregar("contenido_de_la_pagina", datos.pagina.textoPrincipal);
  agregar("texto_alrededor_del_campo", datos.campo.textoAlrededor);
  agregar("pregunta_del_campo", datos.campo.pregunta);
  agregar("lo_que_ya_tiene_el_campo", datos.campo.textoActual);
  agregar("mi_idea_en_bruto", datos.idea);
  agregar("indicaciones_extra", datos.guia);
  if (datos.campo.limite > 0) {
    agregar("limite_de_caracteres", String(datos.campo.limite));
  }

  secciones.push("Escribe el texto para este campo.");
  return secciones.join("\n\n");
}

// Llamada directa a la API de Claude con fetch. No se usa el SDK oficial porque una
// extensión de Chrome sin empaquetador no puede importar paquetes de npm, y el SDK solo
// envolvería esta misma petición.
//   - anthropic-dangerous-direct-browser-access: sin este encabezado la API rechaza
//     cualquier petición que venga de un navegador (CORS).
//   - effort "low": para un párrafo de review no hace falta que piense mucho; así
//     contesta en segundos y gasta menos.
async function preguntarAClaude(config, sistema, pedido) {
  if (!config.claveClaude) {
    throw new Error("Falta tu clave de API de Claude. Ponla en las opciones de Respondón.");
  }

  const encabezados = {
    "content-type": "application/json",
    "x-api-key": config.claveClaude,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true"
  };
  const cuerpo = {
    model: config.modeloClaude,
    max_tokens: 16000,
    system: sistema,
    messages: [{ role: "user", content: pedido }],
    output_config: { effort: "low" }
  };
  if (MODELOS_CON_RESPALDO.includes(config.modeloClaude)) {
    encabezados["anthropic-beta"] = "server-side-fallback-2026-07-01";
    cuerpo.fallbacks = "default";
  }

  const respuesta = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: encabezados,
    body: JSON.stringify(cuerpo)
  });
  const json = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    const detalle = json.error ? json.error.message : respuesta.statusText;
    if (respuesta.status === 401) throw new Error("Claude dice que la clave no es válida (401).");
    if (respuesta.status === 429) throw new Error("Demasiadas peticiones a Claude (429). Espera unos segundos.");
    throw new Error(`Claude respondió ${respuesta.status}: ${detalle}`);
  }
  // Un rechazo llega con estado 200, así que hay que revisarlo antes de leer el texto;
  // si no, se pegaría un campo vacío sin avisar.
  if (json.stop_reason === "refusal") {
    throw new Error("Claude se negó a escribir esto. Cambia la idea o las indicaciones.");
  }

  return json.content
    .filter((bloque) => bloque.type === "text")
    .map((bloque) => bloque.text)
    .join("");
}

// Llamada a cualquier servidor que hable el formato de OpenAI: Ollama y LM Studio en tu
// máquina, o Gemini, Groq, OpenRouter y OpenAI en la nube. Solo cambian la dirección,
// la clave y el nombre del modelo.
async function preguntarACompatible(config, sistema, pedido) {
  const url = config.urlCompatible.replace(/\/+$/, "") + "/chat/completions";
  const encabezados = { "content-type": "application/json" };
  if (config.claveCompatible) {
    encabezados.authorization = "Bearer " + config.claveCompatible;
  }

  let respuesta;
  try {
    respuesta = await fetch(url, {
      method: "POST",
      headers: encabezados,
      body: JSON.stringify({
        model: config.modeloCompatible,
        messages: [
          { role: "system", content: sistema },
          { role: "user", content: pedido }
        ],
        temperature: 0.8
      })
    });
  } catch (error) {
    throw new Error(`No pude conectar con ${url}. ¿Está prendido el servidor (Ollama)?`);
  }
  const json = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    const detalle = json.error ? json.error.message || json.error : respuesta.statusText;
    if (respuesta.status === 404 && String(detalle).includes("not found")) {
      throw new Error(`El modelo "${config.modeloCompatible}" no está descargado. En una terminal: ollama pull ${config.modeloCompatible}`);
    }
    throw new Error(`El servidor respondió ${respuesta.status}: ${detalle}`);
  }
  return json.choices[0].message.content;
}

// Lo que llega de la IA casi nunca está 100% listo para pegar:
//   - modelos locales como qwen3 escriben su razonamiento entre <think>...</think>;
//   - a veces envuelven todo en comillas aunque se les pida que no;
//   - y si el campo tiene maxlength, el navegador cortaría el texto a media palabra.
function limpiarRespuesta(texto, limite) {
  // A veces el razonamiento llega sin su <think> de apertura y solo con el cierre:
  // entonces se tira todo lo que haya antes del último </think>.
  let limpio = texto.replace(/<think>[\s\S]*?<\/think>/g, "");
  if (limpio.includes("</think>")) limpio = limpio.slice(limpio.lastIndexOf("</think>") + 8);
  limpio = limpio.trim();
  if (/^["“«].*["”»]$/s.test(limpio)) {
    limpio = limpio.slice(1, -1).trim();
  }
  if (limite > 0 && limpio.length > limite) {
    const cortado = limpio.slice(0, limite);
    const ultimoPunto = Math.max(cortado.lastIndexOf(". "), cortado.lastIndexOf(".\n"));
    limpio = ultimoPunto > limite * 0.5 ? cortado.slice(0, ultimoPunto + 1) : cortado;
  }
  return limpio;
}

// El botón "Probar conexión" de opciones: una petición mínima para saber si la clave, la
// dirección y el modelo están bien, sin tener que ir a una página con un campo.
async function probarConexion() {
  const config = await cargarConfig();
  const sistema = "Contesta solo con la palabra: listo";
  const pedido = "¿Me escuchas?";
  if (config.proveedor === "claude") {
    return preguntarAClaude(config, sistema, pedido);
  }
  return limpiarRespuesta(await preguntarACompatible(config, sistema, pedido), 0);
}
