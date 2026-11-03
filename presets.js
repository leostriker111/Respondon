// presets.js — Las instrucciones que se le pegan a la IA según lo que elijas en el panel.
//
// Por qué vive en su propio archivo: lo cargan tres lugares distintos (el panel que sale
// junto al campo, el fondo que arma el prompt y la página de opciones donde los editas).
// Si cada uno tuviera su copia, al cambiar un tono en opciones el panel seguiría
// mostrando el viejo y el prompt usaría otro texto distinto.
//
// Cada preset es { id, nombre, instruccion }:
//   - id: lo que se guarda (no lo cambies o se pierde la última elección del panel).
//   - nombre: lo que ves en el menú desplegable.
//   - instruccion: el texto que de verdad lee la IA. Aquí está todo el "truco".

const PRESETS_DE_FABRICA = {
  recetas: [
    {
      id: "review-curso",
      nombre: "Review de curso / lección",
      instruccion:
        "Es la reseña o evaluación de una lección o curso en línea. Menciona al menos una cosa concreta del tema de la lección (sácala del contexto de la página), di qué te sirvió y, si el sentimiento lo permite, una sugerencia pequeña. Nada de frases genéricas tipo 'excelente contenido' sin decir de qué."
    },
    {
      id: "libre",
      nombre: "Libre (lo que pida el campo)",
      instruccion: "Responde exactamente lo que pide el campo, guiándote por la pregunta y el contexto."
    },
    {
      id: "respuesta-abierta",
      nombre: "Respuesta abierta / reflexión de tarea",
      instruccion:
        "Es una pregunta abierta de tarea o reflexión. Contesta la pregunta de verdad, con una idea principal clara y un ejemplo o razón que la respalde. Que se note que entendiste el tema de la página."
    },
    {
      id: "comentario-foro",
      nombre: "Comentario en foro / publicación",
      instruccion:
        "Es un comentario en un foro o en la publicación de otra persona. Reacciona a lo que dice el texto de alrededor, aporta algo (una pregunta, un dato, una experiencia) y no repitas lo que ya dijo."
    },
    {
      id: "feedback-companero",
      nombre: "Feedback a un compañero",
      instruccion:
        "Es retroalimentación al trabajo de otra persona. Empieza por algo que hizo bien y que sea específico, luego una o dos mejoras concretas y accionables, y cierra con ánimo. Háblale de tú."
    },
    {
      id: "autoevaluacion",
      nombre: "Autoevaluación",
      instruccion:
        "Es una autoevaluación. Habla de lo que aprendiste, lo que te costó y qué harías distinto, en primera persona y con honestidad creíble."
    },
    {
      id: "sugerencia",
      nombre: "Sugerencia de mejora",
      instruccion:
        "Es un campo de sugerencias o '¿qué mejorarías?'. Da una o dos sugerencias concretas y realistas, explicando brevemente por qué ayudarían."
    },
    {
      id: "mensaje",
      nombre: "Mensaje / correo",
      instruccion:
        "Es un mensaje o correo para otra persona. Incluye saludo y despedida solo si el tono es formal o profesional; si es casual, ve directo al punto."
    },
    {
      id: "pulir",
      nombre: "Pulir lo que ya escribí",
      instruccion:
        "El campo ya tiene un borrador escrito por la persona. Corrige ortografía, puntuación y claridad, y ajústalo al tono pedido, pero respeta sus ideas y no agregues cosas nuevas."
    },
    {
      id: "expandir",
      nombre: "Expandir mi idea",
      instruccion:
        "La persona te dio una idea en bruto (puede ser algo como 'sisi muy chido'). Conviértela en un texto completo que diga eso mismo pero bien dicho, conservando su postura."
    }
  ],

  tonos: [
    { id: "amigable", nombre: "Amigable", instruccion: "Tono amigable y cercano, como hablándole a alguien que te cae bien." },
    { id: "casual", nombre: "Casual", instruccion: "Tono casual y relajado, frases cortas, como en un chat." },
    { id: "profesional", nombre: "Profesional", instruccion: "Tono profesional: claro, respetuoso, sin coloquialismos." },
    { id: "formal", nombre: "Formal", instruccion: "Tono formal, usa usted si te diriges a alguien, vocabulario cuidado." },
    { id: "entusiasta", nombre: "Entusiasta", instruccion: "Tono entusiasta y con energía, pero creíble, sin exagerar con exclamaciones." },
    { id: "neutro", nombre: "Neutro", instruccion: "Tono neutro e informativo." },
    { id: "chilango", nombre: "Mexicano coloquial", instruccion: "Español coloquial de México (chido, padre, la neta, está buenísimo), natural y sin caricatura." },
    { id: "directo", nombre: "Directo y conciso", instruccion: "Ve al grano, sin relleno ni introducciones." },
    { id: "academico", nombre: "Académico", instruccion: "Tono académico: preciso, argumentado, con conectores formales." },
    { id: "humor", nombre: "Con humor", instruccion: "Tono ligero con un toque de humor, sin perder el punto." }
  ],

  idiomas: [
    {
      id: "auto",
      nombre: "El de la pregunta",
      instruccion:
        "Idioma: responde en el MISMO idioma en que está escrita la pregunta del campo (si la pregunta está en inglés, responde en inglés aunque la página esté en español). Solo si no hay pregunta, usa el idioma de la página."
    },
    { id: "es-mx", nombre: "Español (México)", instruccion: "Escribe en español de México." },
    { id: "es", nombre: "Español neutro", instruccion: "Escribe en español neutro, sin regionalismos." },
    { id: "en-us", nombre: "Inglés (EE. UU.)", instruccion: "Write in natural American English." },
    { id: "en-gb", nombre: "Inglés (Reino Unido)", instruccion: "Write in natural British English." },
    { id: "pt-br", nombre: "Portugués (Brasil)", instruccion: "Escreva em português do Brasil." },
    { id: "fr", nombre: "Francés", instruccion: "Écris en français naturel." }
  ],

  sentimientos: [
    { id: "positivo", nombre: "Positivo", instruccion: "Postura positiva: te gustó y lo dices con razones." },
    { id: "muy-positivo", nombre: "Muy positivo", instruccion: "Postura muy positiva: te encantó y se nota." },
    { id: "constructivo", nombre: "Positivo con crítica constructiva", instruccion: "Postura mayormente positiva, con una crítica constructiva concreta y amable." },
    { id: "balanceado", nombre: "Balanceado", instruccion: "Postura balanceada: lo bueno y lo mejorable en proporciones parecidas." },
    { id: "neutral", nombre: "Neutral", instruccion: "Sin carga emocional, solo describe." },
    { id: "negativo", nombre: "Negativo pero educado", instruccion: "Postura negativa: no te convenció; dilo con respeto y explica por qué." }
  ],

  largos: [
    { id: "corto", nombre: "Corto (2-3 frases)", instruccion: "Largo: 2 o 3 frases." },
    { id: "frase", nombre: "Una frase", instruccion: "Largo: una sola frase." },
    { id: "medio", nombre: "Medio (1 párrafo)", instruccion: "Largo: un párrafo de 4 a 6 frases." },
    { id: "largo", nombre: "Largo (2-3 párrafos)", instruccion: "Largo: 2 o 3 párrafos." }
  ]
};

// Las categorías en el orden en que salen en el panel y en opciones. Si agregas una
// categoría nueva a PRESETS_DE_FABRICA y no la pones aquí, no aparece en ningún lado.
const CATEGORIAS = [
  { clave: "recetas", titulo: "Receta (qué tipo de campo es)" },
  { clave: "tonos", titulo: "Tono" },
  { clave: "idiomas", titulo: "Idioma" },
  { clave: "sentimientos", titulo: "Sentimiento" },
  { clave: "largos", titulo: "Largo" }
];

// Devuelve los presets que el usuario editó en opciones, o los de fábrica si nunca tocó
// nada. Sin esta función, lo que guardas en opciones nunca llegaría al panel ni al
// prompt. Si a lo guardado le falta una categoría (porque se agregó en una versión
// nueva), se rellena con la de fábrica para que el menú no salga vacío.
async function cargarPresets() {
  const guardado = await chrome.storage.local.get("presets");
  const presets = guardado.presets || {};
  const completos = {};
  for (const categoria of CATEGORIAS) {
    const lista = presets[categoria.clave];
    completos[categoria.clave] = lista && lista.length ? lista : PRESETS_DE_FABRICA[categoria.clave];
  }
  return completos;
}
