// revisar-manifest.mjs — Comprueba que cada archivo que nombra manifest.json existe.
//
// Por qué hace falta: si se renombra un archivo y el manifest se queda con el nombre
// viejo, Chrome se niega a cargar la extensión entera con un error que el usuario ve
// hasta después de descargar el .zip. Mejor que truene aquí, antes de publicar.

import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));

const nombrados = [
  manifest.background.service_worker,
  manifest.options_page,
  ...Object.values(manifest.icons),
  ...manifest.content_scripts.flatMap((script) => script.js)
];

const faltan = nombrados.filter((archivo) => !fs.existsSync(archivo));
if (faltan.length) {
  console.error("manifest.json nombra archivos que no existen:", faltan.join(", "));
  process.exit(1);
}

// La etiqueta de la release tiene que coincidir con la versión del manifest; si no,
// el .zip "v1.0.1" traería una extensión que dice ser la 1.0.0.
const etiqueta = process.env.GITHUB_REF_NAME || "";
if (etiqueta.startsWith("v") && etiqueta !== "v" + manifest.version) {
  console.error(`La etiqueta ${etiqueta} no coincide con la versión del manifest (${manifest.version}).`);
  process.exit(1);
}

console.log(`manifest.json bien: ${nombrados.length} archivos, versión ${manifest.version}.`);
