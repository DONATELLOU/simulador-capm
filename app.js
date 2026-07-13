"use strict";

const DURACION_EXAMEN = 60 * 60;
const LETRAS = ["A", "B", "C", "D", "E", "F"];
const CLAVES = {
  sesion: "capm_sesion_v2",
  historial: "capm_historial_v2",
  tema: "capm_tema_v2"
};

const examenesInfo = [
  { numero: 1, nombre: "Examen 1", descripcion: "Fundamentos aplicados y decisiones", nivel: "Intermedio" },
  { numero: 2, nombre: "Examen 2", descripcion: "Escenarios con distractores cercanos", nivel: "Intermedio-avanzado" },
  { numero: 3, nombre: "Examen 3", descripcion: "Integración de enfoques y análisis", nivel: "Avanzado" },
  { numero: 4, nombre: "Examen 4", descripcion: "Decisiones primero/siguiente", nivel: "Avanzado situacional" },
  { numero: 5, nombre: "Examen 5", descripcion: "Simulación final exigente", nivel: "Avanzado situacional" }
];

let examenActual = [];
let numeroExamenActual = null;
let indicePregunta = 0;
let respuestasUsuario = [];
let preguntasMarcadas = [];
let fechaLimite = null;
let tiempoRestante = DURACION_EXAMEN;
let intervaloTemporizador = null;
let examenEnCurso = false;
let ultimoResultado = null;
let filtroRevision = "todas";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

window.addEventListener("DOMContentLoaded", inicializar);
window.addEventListener("beforeunload", evento => {
  if (examenEnCurso) {
    evento.preventDefault();
    evento.returnValue = "";
  }
});

function inicializar() {
  if (!Array.isArray(window.bancoPreguntas)) {
    mostrarErrorCarga();
    return;
  }

  configurarEventos();
  aplicarTemaGuardado();
  cargarTarjetasExamenes();
  cargarHistorial();
  mostrarSesionPendiente();
}

function configurarEventos() {
  $("#btn-anterior").addEventListener("click", preguntaAnterior);
  $("#btn-siguiente").addEventListener("click", siguientePregunta);
  $("#btn-marcar").addEventListener("click", alternarMarcada);
  $("#btn-finalizar").addEventListener("click", () => solicitarFinalizacion(false));
  $("#btn-salir").addEventListener("click", salirDelExamen);
  $("#btn-continuar").addEventListener("click", continuarSesion);
  $("#btn-volver").addEventListener("click", volverInicio);
  $("#btn-repetir").addEventListener("click", repetirExamen);
  $("#btn-borrar-historial").addEventListener("click", borrarHistorial);
  $("#btn-tema").addEventListener("click", alternarTema);
  $("#logo-inicio").addEventListener("click", evento => {
    evento.preventDefault();
    if (!examenEnCurso || confirm("Hay un examen en curso. Tu avance quedará guardado. ¿Volver al inicio?")) {
      volverInicio();
    }
  });

  $$(".filtro").forEach(boton => {
    boton.addEventListener("click", () => {
      filtroRevision = boton.dataset.filtro;
      $$(".filtro").forEach(item => item.classList.toggle("activo", item === boton));
      mostrarRevision();
    });
  });

  document.addEventListener("keydown", manejarTeclado);
}

function mostrarErrorCarga() {
  document.body.innerHTML = `
    <main class="contenedor">
      <section class="tarjeta">
        <h1>No se pudo cargar el banco de preguntas</h1>
        <p>Verifica que el archivo se llame <strong>preguntas.js</strong> y esté en la misma carpeta que index.html.</p>
      </section>
    </main>
  `;
}

function cargarTarjetasExamenes() {
  const contenedor = $("#lista-examenes");
  const historial = obtenerHistorial();
  const sesion = obtenerSesionGuardada();

  contenedor.innerHTML = examenesInfo.map(examen => {
    const preguntas = bancoPreguntas.filter(p => p.examen === examen.numero);
    const registro = historial.filter(item => item.examen === examen.numero);
    const mejor = registro.length ? Math.max(...registro.map(item => item.porcentaje)) : null;
    const tieneSesion = sesion?.numeroExamen === examen.numero && sesion.fechaLimite > Date.now();

    return `
      <article class="card-examen">
        <span class="card-examen__numero">${examen.numero}</span>
        <h3>${escaparHtml(examen.nombre)}</h3>
        <p class="card-examen__descripcion">${escaparHtml(examen.descripcion)}</p>

        <div class="card-examen__datos">
          <span>Nivel <strong>${escaparHtml(examen.nivel)}</strong></span>
          <span>Duración <strong>60 min</strong></span>
          <span>Preguntas <strong class="${preguntas.length === 50 ? "estado-completo" : "estado-incompleto"}">${preguntas.length}/50</strong></span>
          <span>Mejor puntaje <strong>${mejor === null ? "—" : `${mejor}%`}</strong></span>
        </div>

        <div class="card-examen__acciones">
          <button class="boton" type="button" data-iniciar="${examen.numero}">${registro.length ? "Nuevo intento" : "Iniciar examen"}</button>
          ${tieneSesion ? `<button class="boton boton--secundario" type="button" data-continuar="${examen.numero}">Continuar</button>` : ""}
        </div>
      </article>
    `;
  }).join("");

  $$('[data-iniciar]').forEach(boton => {
    boton.addEventListener("click", () => iniciarExamen(Number(boton.dataset.iniciar)));
  });

  $$('[data-continuar]').forEach(boton => {
    boton.addEventListener("click", continuarSesion);
  });
}

function iniciarExamen(numeroExamen, forzar = false) {
  const sesionAnterior = obtenerSesionGuardada();
  if (!forzar && sesionAnterior && sesionAnterior.fechaLimite > Date.now()) {
    const reemplazar = confirm("Ya tienes un examen en curso. ¿Deseas descartarlo e iniciar uno nuevo?");
    if (!reemplazar) return;
  }

  examenActual = bancoPreguntas.filter(p => p.examen === numeroExamen);
  if (!examenActual.length) {
    alert("Este examen todavía no tiene preguntas cargadas.");
    return;
  }

  numeroExamenActual = numeroExamen;
  indicePregunta = 0;
  respuestasUsuario = Array(examenActual.length).fill(null);
  preguntasMarcadas = Array(examenActual.length).fill(false);
  fechaLimite = Date.now() + DURACION_EXAMEN * 1000;
  tiempoRestante = DURACION_EXAMEN;
  examenEnCurso = true;

  guardarSesion();
  abrirPantalla("examen");
  iniciarTemporizador();
  mostrarPregunta();
}

function continuarSesion() {
  const sesion = obtenerSesionGuardada();
  if (!sesion) {
    alert("No se encontró un examen guardado.");
    mostrarSesionPendiente();
    return;
  }

  examenActual = bancoPreguntas.filter(p => p.examen === sesion.numeroExamen);
  if (!examenActual.length) {
    localStorage.removeItem(CLAVES.sesion);
    alert("No se pudo recuperar el banco de preguntas del examen guardado.");
    return;
  }

  numeroExamenActual = sesion.numeroExamen;
  indicePregunta = limitar(sesion.indicePregunta ?? 0, 0, examenActual.length - 1);
  respuestasUsuario = normalizarArray(sesion.respuestas, examenActual.length, null);
  preguntasMarcadas = normalizarArray(sesion.marcadas, examenActual.length, false);
  fechaLimite = sesion.fechaLimite;
  tiempoRestante = Math.max(0, Math.ceil((fechaLimite - Date.now()) / 1000));
  examenEnCurso = true;

  abrirPantalla("examen");

  if (tiempoRestante <= 0) {
    finalizarExamen(true);
    return;
  }

  iniciarTemporizador();
  mostrarPregunta();
}

function mostrarPregunta() {
  const pregunta = examenActual[indicePregunta];
  if (!pregunta) return;

  const info = examenesInfo.find(item => item.numero === numeroExamenActual);
  $("#nombre-examen").textContent = info?.nombre ?? `Examen ${numeroExamenActual}`;
  $("#numero-pregunta").textContent = `Pregunta ${indicePregunta + 1} de ${examenActual.length}`;
  $("#dominio-pregunta").textContent = pregunta.dominio;
  $("#dificultad-pregunta").textContent = `Dificultad ${capitalizar(pregunta.dificultad)}`;
  $("#texto-pregunta").textContent = pregunta.pregunta;

  const contenedor = $("#opciones");
  contenedor.innerHTML = "";

  pregunta.opciones.forEach((opcion, index) => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = `opcion${respuestasUsuario[indicePregunta] === index ? " seleccionada" : ""}`;
    boton.setAttribute("role", "radio");
    boton.setAttribute("aria-checked", respuestasUsuario[indicePregunta] === index ? "true" : "false");
    boton.innerHTML = `<span class="opcion__letra">${LETRAS[index] ?? index + 1}</span><span>${escaparHtml(opcion)}</span>`;
    boton.addEventListener("click", () => seleccionarOpcion(index));
    contenedor.appendChild(boton);
  });

  const progreso = ((indicePregunta + 1) / examenActual.length) * 100;
  $("#barra-progreso").style.width = `${progreso}%`;

  $("#btn-anterior").disabled = indicePregunta === 0;
  $("#btn-siguiente").textContent = indicePregunta === examenActual.length - 1 ? "Revisar y finalizar" : "Siguiente →";

  const marcada = Boolean(preguntasMarcadas[indicePregunta]);
  $("#btn-marcar").classList.toggle("activo", marcada);
  $("#btn-marcar").setAttribute("aria-pressed", String(marcada));
  $("#btn-marcar").textContent = marcada ? "★ Marcada" : "☆ Marcar";

  actualizarNavegador();
  guardarSesion();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function seleccionarOpcion(index) {
  respuestasUsuario[indicePregunta] = index;
  $$(".opcion").forEach((opcion, posicion) => {
    const seleccionada = posicion === index;
    opcion.classList.toggle("seleccionada", seleccionada);
    opcion.setAttribute("aria-checked", String(seleccionada));
  });
  actualizarNavegador();
  guardarSesion();
}

function preguntaAnterior() {
  if (indicePregunta > 0) {
    indicePregunta--;
    mostrarPregunta();
  }
}

function siguientePregunta() {
  if (indicePregunta < examenActual.length - 1) {
    indicePregunta++;
    mostrarPregunta();
  } else {
    solicitarFinalizacion(false);
  }
}

function irAPregunta(indice) {
  indicePregunta = limitar(indice, 0, examenActual.length - 1);
  mostrarPregunta();
}

function alternarMarcada() {
  preguntasMarcadas[indicePregunta] = !preguntasMarcadas[indicePregunta];
  mostrarPregunta();
}

function actualizarNavegador() {
  const contenedor = $("#navegador-preguntas");
  contenedor.innerHTML = examenActual.map((_, index) => {
    const clases = ["numero-nav"];
    if (respuestasUsuario[index] !== null && respuestasUsuario[index] !== undefined) clases.push("respondida");
    if (preguntasMarcadas[index]) clases.push("marcada");
    if (index === indicePregunta) clases.push("actual");

    return `<button type="button" class="${clases.join(" ")}" data-pregunta="${index}" aria-label="Ir a la pregunta ${index + 1}">${index + 1}</button>`;
  }).join("");

  $$('[data-pregunta]').forEach(boton => {
    boton.addEventListener("click", () => irAPregunta(Number(boton.dataset.pregunta)));
  });

  const respondidas = respuestasUsuario.filter(respuesta => respuesta !== null && respuesta !== undefined).length;
  $("#contador-respondidas").textContent = `${respondidas}/${examenActual.length}`;
}

function iniciarTemporizador() {
  clearInterval(intervaloTemporizador);
  actualizarTemporizador();

  intervaloTemporizador = setInterval(() => {
    tiempoRestante = Math.max(0, Math.ceil((fechaLimite - Date.now()) / 1000));
    actualizarTemporizador();

    if (tiempoRestante <= 0) {
      finalizarExamen(true);
    }
  }, 1000);
}

function actualizarTemporizador() {
  const minutos = Math.floor(tiempoRestante / 60);
  const segundos = tiempoRestante % 60;
  const elemento = $("#temporizador");
  elemento.textContent = `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
  elemento.classList.toggle("alerta", tiempoRestante <= 5 * 60);
}

function solicitarFinalizacion(forzada) {
  if (forzada) {
    finalizarExamen(true);
    return;
  }

  const sinResponder = respuestasUsuario.filter(respuesta => respuesta === null || respuesta === undefined).length;
  const marcadas = preguntasMarcadas.filter(Boolean).length;
  const detalles = [
    sinResponder ? `${sinResponder} pregunta(s) sin responder` : null,
    marcadas ? `${marcadas} pregunta(s) marcada(s)` : null
  ].filter(Boolean).join(" y ");

  const mensaje = detalles
    ? `Aún tienes ${detalles}. ¿Deseas finalizar de todas formas?`
    : "¿Deseas finalizar y ver tus resultados?";

  if (confirm(mensaje)) finalizarExamen(false);
}

function finalizarExamen(porTiempo = false) {
  if (!examenEnCurso) return;

  clearInterval(intervaloTemporizador);
  tiempoRestante = Math.max(0, Math.ceil((fechaLimite - Date.now()) / 1000));
  examenEnCurso = false;
  localStorage.removeItem(CLAVES.sesion);

  const resultado = calcularResultado();
  ultimoResultado = resultado;
  guardarResultado(resultado);
  abrirPantalla("resultados");
  mostrarResultados(resultado, porTiempo);
  cargarTarjetasExamenes();
  cargarHistorial();
  mostrarSesionPendiente();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function calcularResultado() {
  let correctas = 0;
  const resumenDominios = {};
  const resumenTemas = {};

  examenActual.forEach((pregunta, index) => {
    const respuesta = respuestasUsuario[index];
    const esCorrecta = respuesta === pregunta.respuestaCorrecta;
    if (esCorrecta) correctas++;

    acumularResumen(resumenDominios, pregunta.dominio, esCorrecta);
    acumularResumen(resumenTemas, pregunta.tema, esCorrecta);
  });

  const total = examenActual.length;
  const sinResponder = respuestasUsuario.filter(respuesta => respuesta === null || respuesta === undefined).length;
  const porcentaje = total ? Math.round((correctas / total) * 100) : 0;
  const tiempoUsado = Math.min(DURACION_EXAMEN, Math.max(0, DURACION_EXAMEN - tiempoRestante));

  return {
    examen: numeroExamenActual,
    fecha: Date.now(),
    correctas,
    total,
    porcentaje,
    sinResponder,
    tiempoUsado,
    resumenDominios,
    resumenTemas,
    respuestas: [...respuestasUsuario]
  };
}

function acumularResumen(objeto, clave, esCorrecta) {
  if (!objeto[clave]) objeto[clave] = { total: 0, correctas: 0 };
  objeto[clave].total++;
  if (esCorrecta) objeto[clave].correctas++;
}

function mostrarResultados(resultado, porTiempo) {
  const mensaje = obtenerMensajeResultado(resultado.porcentaje);
  $("#mensaje-resultado").textContent = porTiempo ? `El tiempo terminó. ${mensaje}` : mensaje;

  $("#resultado-general").innerHTML = `
    <article class="resumen-card">
      <span>Puntaje</span>
      <strong>${resultado.porcentaje}%</strong>
      <small>${resultado.correctas} de ${resultado.total} correctas</small>
    </article>
    <article class="resumen-card">
      <span>Respondidas</span>
      <strong>${resultado.total - resultado.sinResponder}</strong>
      <small>${resultado.sinResponder} sin responder</small>
    </article>
    <article class="resumen-card">
      <span>Tiempo utilizado</span>
      <strong>${formatearDuracion(resultado.tiempoUsado)}</strong>
      <small>de 60 minutos</small>
    </article>
    <article class="resumen-card">
      <span>Examen</span>
      <strong>${resultado.examen}</strong>
      <small>${escaparHtml(examenesInfo.find(item => item.numero === resultado.examen)?.nivel ?? "")}</small>
    </article>
  `;

  mostrarResultadoDominios(resultado.resumenDominios);
  mostrarFeedback(resultado.resumenDominios, resultado.resumenTemas);
  filtroRevision = "todas";
  $$(".filtro").forEach(item => item.classList.toggle("activo", item.dataset.filtro === "todas"));
  mostrarRevision();
}

function mostrarResultadoDominios(resumenDominios) {
  $("#resultado-dominios").innerHTML = Object.entries(resumenDominios).map(([dominio, datos]) => {
    const porcentaje = Math.round((datos.correctas / datos.total) * 100);
    return `
      <div class="dominio">
        <div class="dominio__linea">
          <strong>${escaparHtml(dominio)}</strong>
          <span>${datos.correctas}/${datos.total} · ${porcentaje}%</span>
        </div>
        <div class="dominio__barra" aria-label="${escaparHtml(dominio)}: ${porcentaje}%">
          <span style="width: ${porcentaje}%"></span>
        </div>
      </div>
    `;
  }).join("");
}

function mostrarFeedback(resumenDominios, resumenTemas) {
  const dominios = convertirEnRanking(resumenDominios);
  const temas = convertirEnRanking(resumenTemas).filter(item => item.porcentaje < 70).slice(0, 5);
  const debiles = dominios.filter(item => item.porcentaje < 70);
  const fortalezas = dominios.filter(item => item.porcentaje >= 80);

  let html = "";

  if (fortalezas.length) {
    html += `<p><strong>Fortalezas:</strong></p><ul class="feedback-lista">${fortalezas.map(item => `<li>${escaparHtml(item.nombre)} (${item.porcentaje}%)</li>`).join("")}</ul>`;
  }

  if (debiles.length) {
    html += `<p><strong>Dominios por reforzar:</strong></p><ul class="feedback-lista">${debiles.map(item => `<li>${escaparHtml(item.nombre)} (${item.porcentaje}%)</li>`).join("")}</ul>`;
  } else {
    html += "<p>No se detectaron dominios críticos por debajo de 70%. Continúa con preguntas más situacionales.</p>";
  }

  if (temas.length) {
    html += "<p><strong>Temas prioritarios:</strong></p>";
    html += temas.map(item => `
      <div class="tema-debil">
        <strong>${escaparHtml(item.nombre)}</strong>
        <span>${item.correctas}/${item.total} correctas · ${item.porcentaje}%</span>
      </div>
    `).join("");
  }

  html += "<p><strong>Siguiente paso:</strong> revisa primero las respuestas incorrectas, estudia los temas con menos de 70% y realiza un nuevo intento sin memorizar las alternativas.</p>";
  $("#feedback").innerHTML = html;
}

function convertirEnRanking(resumen) {
  return Object.entries(resumen)
    .map(([nombre, datos]) => ({
      nombre,
      total: datos.total,
      correctas: datos.correctas,
      porcentaje: Math.round((datos.correctas / datos.total) * 100)
    }))
    .sort((a, b) => a.porcentaje - b.porcentaje || b.total - a.total);
}

function mostrarRevision() {
  if (!ultimoResultado) return;

  const elementos = examenActual.map((pregunta, index) => {
    const respuesta = ultimoResultado.respuestas[index];
    const sinRespuesta = respuesta === null || respuesta === undefined;
    const esCorrecta = respuesta === pregunta.respuestaCorrecta;
    const estado = sinRespuesta ? "sin-respuesta" : (esCorrecta ? "correcta" : "incorrecta");

    return { pregunta, index, respuesta, sinRespuesta, esCorrecta, estado };
  }).filter(item => {
    if (filtroRevision === "incorrectas") return !item.esCorrecta && !item.sinRespuesta;
    if (filtroRevision === "sin-respuesta") return item.sinRespuesta;
    return true;
  });

  if (!elementos.length) {
    $("#revision").innerHTML = '<div class="vacio">No hay preguntas en esta categoría.</div>';
    return;
  }

  $("#revision").innerHTML = elementos.map(item => {
    const textoUsuario = item.sinRespuesta ? "Sin respuesta" : item.pregunta.opciones[item.respuesta];
    const textoCorrecto = item.pregunta.opciones[item.pregunta.respuestaCorrecta];
    const etiqueta = item.sinRespuesta ? "Sin responder" : (item.esCorrecta ? "Correcta" : "Incorrecta");

    return `
      <details class="revision-item ${item.estado}">
        <summary>
          <span class="revision-item__numero">${item.index + 1}</span>
          <span>${escaparHtml(item.pregunta.pregunta)}</span>
          <span class="revision-item__estado">${etiqueta}</span>
        </summary>
        <div class="revision-item__contenido">
          <p><strong>Tu respuesta:</strong> ${escaparHtml(textoUsuario)}</p>
          <p><strong>Respuesta correcta:</strong> ${escaparHtml(textoCorrecto)}</p>
          <p><strong>Dominio:</strong> ${escaparHtml(item.pregunta.dominio)}</p>
          <p><strong>Tema:</strong> ${escaparHtml(item.pregunta.tema)}</p>
          <p class="explicacion"><strong>Explicación:</strong> ${escaparHtml(item.pregunta.explicacion)}</p>
        </div>
      </details>
    `;
  }).join("");
}

function guardarSesion() {
  if (!examenEnCurso) return;

  const sesion = {
    version: 2,
    numeroExamen: numeroExamenActual,
    indicePregunta,
    respuestas: respuestasUsuario,
    marcadas: preguntasMarcadas,
    fechaLimite,
    actualizado: Date.now()
  };

  localStorage.setItem(CLAVES.sesion, JSON.stringify(sesion));
}

function obtenerSesionGuardada() {
  try {
    const sesion = JSON.parse(localStorage.getItem(CLAVES.sesion));
    if (!sesion || !Number.isInteger(sesion.numeroExamen)) return null;
    if (!Number.isFinite(sesion.fechaLimite) || sesion.fechaLimite <= Date.now()) {
      localStorage.removeItem(CLAVES.sesion);
      return null;
    }
    return sesion;
  } catch {
    localStorage.removeItem(CLAVES.sesion);
    return null;
  }
}

function mostrarSesionPendiente() {
  const sesion = obtenerSesionGuardada();
  const aviso = $("#aviso-continuar");

  if (!sesion) {
    aviso.classList.add("oculto");
    return;
  }

  const restantes = Math.max(0, Math.ceil((sesion.fechaLimite - Date.now()) / 1000));
  const respondidas = (sesion.respuestas ?? []).filter(item => item !== null && item !== undefined).length;
  $("#texto-continuar").textContent = `Examen ${sesion.numeroExamen} · ${respondidas}/50 respondidas · ${formatearDuracion(restantes)} restantes.`;
  aviso.classList.remove("oculto");
}

function guardarResultado(resultado) {
  const historial = obtenerHistorial();
  historial.unshift({
    examen: resultado.examen,
    fecha: resultado.fecha,
    porcentaje: resultado.porcentaje,
    correctas: resultado.correctas,
    total: resultado.total,
    tiempoUsado: resultado.tiempoUsado
  });

  localStorage.setItem(CLAVES.historial, JSON.stringify(historial.slice(0, 20)));
}

function obtenerHistorial() {
  try {
    const historial = JSON.parse(localStorage.getItem(CLAVES.historial));
    return Array.isArray(historial) ? historial : [];
  } catch {
    return [];
  }
}

function cargarHistorial() {
  const historial = obtenerHistorial();
  const seccion = $("#historial-seccion");

  if (!historial.length) {
    seccion.classList.add("oculto");
    return;
  }

  seccion.classList.remove("oculto");
  $("#historial").innerHTML = historial.slice(0, 6).map(item => `
    <article class="historial__item">
      <div>
        <strong>Examen ${item.examen}</strong>
        <small>${formatearFecha(item.fecha)}</small>
      </div>
      <div class="historial__dato"><span>Puntaje</span><strong>${item.porcentaje}%</strong></div>
      <div class="historial__dato"><span>Aciertos</span><strong>${item.correctas}/${item.total}</strong></div>
      <div class="historial__dato"><span>Tiempo</span><strong>${formatearDuracion(item.tiempoUsado)}</strong></div>
    </article>
  `).join("");
}

function borrarHistorial() {
  if (!confirm("¿Deseas borrar todo el historial de resultados guardado en este navegador?")) return;
  localStorage.removeItem(CLAVES.historial);
  cargarHistorial();
  cargarTarjetasExamenes();
}

function salirDelExamen() {
  guardarSesion();
  if (!confirm("Tu avance quedará guardado. ¿Deseas volver al inicio?")) return;
  clearInterval(intervaloTemporizador);
  examenEnCurso = false;
  volverInicio();
}

function repetirExamen() {
  const examen = numeroExamenActual;
  ultimoResultado = null;
  iniciarExamen(examen, true);
}

function volverInicio() {
  clearInterval(intervaloTemporizador);
  examenEnCurso = false;
  abrirPantalla("inicio");
  cargarTarjetasExamenes();
  cargarHistorial();
  mostrarSesionPendiente();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function abrirPantalla(nombre) {
  $("#pantalla-inicio").classList.toggle("oculto", nombre !== "inicio");
  $("#pantalla-examen").classList.toggle("oculto", nombre !== "examen");
  $("#pantalla-resultados").classList.toggle("oculto", nombre !== "resultados");
}

function manejarTeclado(evento) {
  if (!examenEnCurso || $("#pantalla-examen").classList.contains("oculto")) return;
  if (evento.ctrlKey || evento.metaKey || evento.altKey) return;

  const tecla = evento.key.toLowerCase();
  const indiceOpcion = ["a", "b", "c", "d", "e", "f"].indexOf(tecla);

  if (indiceOpcion >= 0 && indiceOpcion < (examenActual[indicePregunta]?.opciones.length ?? 0)) {
    seleccionarOpcion(indiceOpcion);
  } else if (evento.key === "ArrowLeft") {
    preguntaAnterior();
  } else if (evento.key === "ArrowRight") {
    siguientePregunta();
  } else if (tecla === "m") {
    alternarMarcada();
  }
}

function aplicarTemaGuardado() {
  const guardado = localStorage.getItem(CLAVES.tema);
  const preferido = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  aplicarTema(guardado || preferido);
}

function alternarTema() {
  const actual = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const nuevo = actual === "dark" ? "light" : "dark";
  localStorage.setItem(CLAVES.tema, nuevo);
  aplicarTema(nuevo);
}

function aplicarTema(tema) {
  document.documentElement.dataset.theme = tema;
  $("#icono-tema").textContent = tema === "dark" ? "☀" : "☾";
  $("#btn-tema").setAttribute("aria-label", tema === "dark" ? "Activar tema claro" : "Activar tema oscuro");
}

function obtenerMensajeResultado(porcentaje) {
  if (porcentaje >= 85) return "Rendimiento sobresaliente. Mantén la práctica con escenarios complejos y revisa los pocos errores restantes.";
  if (porcentaje >= 75) return "Buen rendimiento. Estás cerca de un nivel sólido; enfócate en los dominios con menor porcentaje.";
  if (porcentaje >= 65) return "Base aceptable, pero aún necesitas reforzar conceptos y practicar decisiones situacionales.";
  return "Conviene reforzar los fundamentos antes de avanzar a simulacros más exigentes.";
}

function formatearDuracion(segundosTotales) {
  const segundos = Math.max(0, Math.round(segundosTotales));
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return `${String(minutos).padStart(2, "0")}:${String(resto).padStart(2, "0")}`;
}

function formatearFecha(timestamp) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

function normalizarArray(valor, longitud, relleno) {
  const arreglo = Array.isArray(valor) ? valor.slice(0, longitud) : [];
  while (arreglo.length < longitud) arreglo.push(relleno);
  return arreglo;
}

function limitar(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, Number(valor) || 0));
}

function capitalizar(texto) {
  const valor = String(texto ?? "");
  return valor ? valor.charAt(0).toUpperCase() + valor.slice(1) : "";
}

function escaparHtml(valor) {
  return String(valor ?? "").replace(/[&<>'"]/g, caracter => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[caracter]);
}
