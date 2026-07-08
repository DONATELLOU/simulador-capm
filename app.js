const examenesInfo = [
  {
    numero: 1,
    nombre: "Examen 1",
    descripcion: "Diagnóstico inicial",
    nivel: "Medio",
    tiempo: "60 minutos"
  },
  {
    numero: 2,
    nombre: "Examen 2",
    descripcion: "Refuerzo general",
    nivel: "Medio",
    tiempo: "60 minutos"
  },
  {
    numero: 3,
    nombre: "Examen 3",
    descripcion: "Intermedio avanzado",
    nivel: "Medio-alto",
    tiempo: "60 minutos"
  },
  {
    numero: 4,
    nombre: "Examen 4",
    descripcion: "Alto situacional",
    nivel: "Alto",
    tiempo: "60 minutos"
  },
  {
    numero: 5,
    nombre: "Examen 5",
    descripcion: "Simulación final CAPM",
    nivel: "Alto situacional",
    tiempo: "60 minutos"
  }
];

let examenActual = [];
let numeroExamenActual = null;
let indicePregunta = 0;
let respuestasUsuario = [];
let tiempoRestante = 60 * 60;
let intervaloTemporizador = null;

document.addEventListener("DOMContentLoaded", cargarTarjetasExamenes);

function cargarTarjetasExamenes() {
  const contenedor = document.getElementById("lista-examenes");
  let html = "";

  examenesInfo.forEach(examen => {
    const cantidadPreguntas = bancoPreguntas.filter(p => p.examen === examen.numero).length;
    const estaCompleto = cantidadPreguntas === 50;

    html += `
      <div class="card-examen">
        <h3>${examen.nombre}</h3>
        <p>${examen.descripcion}</p>
        <span>Nivel: ${examen.nivel}</span>
        <span>${examen.tiempo}</span>
        <span class="${estaCompleto ? "estado-completo" : "estado-incompleto"}">
          ${cantidadPreguntas}/50 preguntas cargadas
        </span>
        <button onclick="iniciarExamen(${examen.numero})">Iniciar</button>
      </div>
    `;
  });

  contenedor.innerHTML = html;
}

function iniciarExamen(numeroExamen) {
  examenActual = bancoPreguntas.filter(p => p.examen === numeroExamen);
  numeroExamenActual = numeroExamen;
  indicePregunta = 0;
  respuestasUsuario = [];
  tiempoRestante = 60 * 60;

  if (examenActual.length === 0) {
    alert("Este examen todavía no tiene preguntas cargadas.");
    return;
  }

  if (examenActual.length < 50) {
    alert(`Este examen tiene ${examenActual.length} preguntas cargadas. La versión final debe tener 50.`);
  }

  document.getElementById("pantalla-inicio").classList.add("oculto");
  document.getElementById("pantalla-resultados").classList.add("oculto");
  document.getElementById("pantalla-examen").classList.remove("oculto");

  iniciarTemporizador();
  mostrarPregunta();
}

function mostrarPregunta() {
  const pregunta = examenActual[indicePregunta];

  document.getElementById("numero-pregunta").textContent =
    `Pregunta ${indicePregunta + 1} de ${examenActual.length}`;

  document.getElementById("dominio-pregunta").textContent =
    `Dominio: ${pregunta.dominio}`;

  document.getElementById("dificultad-pregunta").textContent =
    `Dificultad: ${pregunta.dificultad}`;

  document.getElementById("texto-pregunta").textContent = pregunta.pregunta;

  const contenedorOpciones = document.getElementById("opciones");
  contenedorOpciones.innerHTML = "";

  pregunta.opciones.forEach((opcion, index) => {
    const div = document.createElement("div");
    div.className = "opcion";
    div.textContent = opcion;
    div.onclick = () => seleccionarOpcion(index, div);
    contenedorOpciones.appendChild(div);
  });

  const progreso = ((indicePregunta + 1) / examenActual.length) * 100;
  document.getElementById("barra-progreso").style.width = `${progreso}%`;

  document.getElementById("btn-siguiente").textContent =
    indicePregunta === examenActual.length - 1 ? "Finalizar" : "Siguiente";
}

function seleccionarOpcion(index, elemento) {
  respuestasUsuario[indicePregunta] = index;

  const opciones = document.querySelectorAll(".opcion");
  opciones.forEach(opcion => opcion.classList.remove("seleccionada"));

  elemento.classList.add("seleccionada");
}

function siguientePregunta() {
  if (respuestasUsuario[indicePregunta] === undefined) {
    alert("Selecciona una alternativa antes de continuar.");
    return;
  }

  if (indicePregunta < examenActual.length - 1) {
    indicePregunta++;
    mostrarPregunta();
  } else {
    finalizarExamen();
  }
}

function iniciarTemporizador() {
  clearInterval(intervaloTemporizador);

  document.getElementById("temporizador").textContent = "60:00";

  intervaloTemporizador = setInterval(() => {
    tiempoRestante--;

    const minutos = Math.floor(tiempoRestante / 60);
    const segundos = tiempoRestante % 60;

    document.getElementById("temporizador").textContent =
      `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;

    if (tiempoRestante <= 0) {
      finalizarExamen();
    }
  }, 1000);
}

function finalizarExamen() {
  clearInterval(intervaloTemporizador);

  document.getElementById("pantalla-examen").classList.add("oculto");
  document.getElementById("pantalla-resultados").classList.remove("oculto");

  let correctas = 0;
  const resumenDominios = {};
  const resumenTemas = {};

  examenActual.forEach((pregunta, index) => {
    const respuestaUsuario = respuestasUsuario[index];
    const esCorrecta = respuestaUsuario === pregunta.respuestaCorrecta;

    if (esCorrecta) {
      correctas++;
    }

    if (!resumenDominios[pregunta.dominio]) {
      resumenDominios[pregunta.dominio] = {
        total: 0,
        correctas: 0
      };
    }

    resumenDominios[pregunta.dominio].total++;

    if (esCorrecta) {
      resumenDominios[pregunta.dominio].correctas++;
    }

    if (!resumenTemas[pregunta.tema]) {
      resumenTemas[pregunta.tema] = {
        total: 0,
        correctas: 0
      };
    }

    resumenTemas[pregunta.tema].total++;

    if (esCorrecta) {
      resumenTemas[pregunta.tema].correctas++;
    }
  });

  mostrarResultadoGeneral(correctas);
  mostrarResultadoDominios(resumenDominios);
  mostrarFeedback(resumenDominios, resumenTemas);
  mostrarRevision();
}

function mostrarResultadoGeneral(correctas) {
  const total = examenActual.length;
  const porcentaje = Math.round((correctas / total) * 100);

  let mensaje = "";

  if (porcentaje >= 80) {
    mensaje = "Excelente rendimiento. Estás en un nivel sólido para seguir con simulacros más exigentes.";
  } else if (porcentaje >= 70) {
    mensaje = "Buen resultado, pero todavía debes reforzar algunos temas antes de rendir el examen real.";
  } else {
    mensaje = "Necesitas reforzar varios dominios antes de rendir el examen real.";
  }

  document.getElementById("resultado-general").innerHTML = `
    <h3>Puntaje general</h3>
    <p><strong>Examen ${numeroExamenActual}</strong></p>
    <p><strong>${correctas}/${total}</strong> respuestas correctas</p>
    <p><strong>${porcentaje}%</strong> de aciertos</p>
    <p>${mensaje}</p>
  `;
}

function mostrarResultadoDominios(resumenDominios) {
  let html = "<h3>Rendimiento por dominio</h3>";

  for (const dominio in resumenDominios) {
    const datos = resumenDominios[dominio];
    const porcentaje = Math.round((datos.correctas / datos.total) * 100);

    html += `
      <div class="dominio">
        <strong>${dominio}</strong><br>
        ${datos.correctas}/${datos.total} correctas - ${porcentaje}%
      </div>
    `;
  }

  document.getElementById("resultado-dominios").innerHTML = html;
}

function mostrarFeedback(resumenDominios, resumenTemas) {
  let puntosDebilesDominios = [];
  let puntosDebilesTemas = [];

  for (const dominio in resumenDominios) {
    const datos = resumenDominios[dominio];
    const porcentaje = Math.round((datos.correctas / datos.total) * 100);

    if (porcentaje < 70) {
      puntosDebilesDominios.push({
        nombre: dominio,
        porcentaje
      });
    }
  }

  for (const tema in resumenTemas) {
    const datos = resumenTemas[tema];
    const porcentaje = Math.round((datos.correctas / datos.total) * 100);

    if (porcentaje < 70) {
      puntosDebilesTemas.push({
        nombre: tema,
        porcentaje,
        total: datos.total
      });
    }
  }

  puntosDebilesDominios.sort((a, b) => a.porcentaje - b.porcentaje);
  puntosDebilesTemas.sort((a, b) => a.porcentaje - b.porcentaje);

  let html = "<h3>Feedback personalizado</h3>";

  if (puntosDebilesDominios.length === 0) {
    html += "<p>No se detectaron dominios críticos. Mantén la práctica con simulacros más difíciles.</p>";
  } else {
    html += "<p><strong>Dominios que debes reforzar:</strong></p><ol>";

    puntosDebilesDominios.forEach(item => {
      html += `<li>${item.nombre} - ${item.porcentaje}% de aciertos</li>`;
    });

    html += "</ol>";
  }

  if (puntosDebilesTemas.length > 0) {
    html += "<p><strong>Temas débiles detectados:</strong></p>";

    puntosDebilesTemas.slice(0, 5).forEach(item => {
      html += `
        <div class="tema-debil">
          <strong>${item.nombre}</strong><br>
          ${item.porcentaje}% de aciertos en ${item.total} pregunta(s)
        </div>
      `;
    });
  }

  html += `
    <p><strong>Recomendación:</strong> vuelve a estudiar los temas con menos de 70% y repite el simulacro después de revisar las explicaciones.</p>
  `;

  document.getElementById("feedback").innerHTML = html;
}

function mostrarRevision() {
  let html = "";

  examenActual.forEach((pregunta, index) => {
    const respuestaUsuario = respuestasUsuario[index];
    const esCorrecta = respuestaUsuario === pregunta.respuestaCorrecta;

    const textoRespuestaUsuario =
      respuestaUsuario !== undefined
        ? pregunta.opciones[respuestaUsuario]
        : "Sin respuesta";

    html += `
      <div class="${esCorrecta ? "correcta" : "incorrecta"}">
        <strong>Pregunta ${index + 1}:</strong> ${pregunta.pregunta}<br><br>
        <strong>Tu respuesta:</strong> ${textoRespuestaUsuario}<br>
        <strong>Respuesta correcta:</strong> ${pregunta.opciones[pregunta.respuestaCorrecta]}<br>
        <strong>Dominio:</strong> ${pregunta.dominio}<br>
        <strong>Tema:</strong> ${pregunta.tema}<br>
        <strong>Dificultad:</strong> ${pregunta.dificultad}<br>
        <strong>Explicación:</strong> ${pregunta.explicacion}
      </div>
    `;
  });

  document.getElementById("revision").innerHTML = html;
}

function volverInicio() {
  document.getElementById("pantalla-resultados").classList.add("oculto");
  document.getElementById("pantalla-inicio").classList.remove("oculto");

  cargarTarjetasExamenes();
}