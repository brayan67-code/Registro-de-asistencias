import { ESTADOS } from './datos.js';
import {
  estadoDe, formatoFecha, normalizarTexto, resumenEstudiante, resumenSesion,
  promedioCurso, estudiantesEnRiesgo, estadisticasGenerales
} from './calculos.js';

export const $ = (selector) => document.querySelector(selector);

// ---------- Ayudas para construir el DOM (siempre con textContent) ----------
function el(etiqueta, texto, clase) {
  const e = document.createElement(etiqueta);
  if (texto !== undefined) e.textContent = texto;
  if (clase) e.className = clase;
  return e;
}
const td = (texto, clase) => el('td', texto, clase);

function th(texto, clase, ambito = 'col') {
  const e = el('th', texto, clase);
  e.scope = ambito;
  return e;
}

function boton(texto, etiquetaAccesible, alClic, clase = 'neutro') {
  const b = el('button', texto, clase);
  b.type = 'button';
  b.setAttribute('aria-label', etiquetaAccesible);
  b.addEventListener('click', alClic);
  return b;
}

function filaVacia(texto, columnas) {
  const tr = el('tr');
  const celda = td(texto, 'vacio');
  celda.colSpan = columnas;
  tr.append(celda);
  return tr;
}

const textoPct = (p) => (p === null ? '—' : `${p} %`);

function mostrarSolo(contenido, aviso, hayCurso, textoAviso) {
  contenido.hidden = !hayCurso;
  aviso.hidden = hayCurso;
  if (!hayCurso) aviso.textContent = textoAviso;
}

// ---------- Mensajes ----------
let temporizador;
export function mostrarMensaje(texto, tipo = 'error') {
  const p = $('#mensaje');
  clearTimeout(temporizador);
  p.textContent = texto;
  p.className = `mensaje ${tipo}`;
  if (tipo === 'exito') {
    temporizador = setTimeout(() => { p.textContent = ''; p.className = 'mensaje'; }, 6000);
  }
}

export function limpiarMensaje() {
  clearTimeout(temporizador);
  const p = $('#mensaje');
  p.textContent = '';
  p.className = 'mensaje';
}

// ---------- Barra de navegación ----------
export function marcarNavActiva(vista) {
  document.querySelectorAll('.menu a').forEach((a) => {
    if (a.dataset.vista === vista) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

export function renderSelectorCurso(cursos, activoId) {
  const select = $('#select-curso');
  select.replaceChildren();
  select.disabled = cursos.length === 0;
  if (cursos.length === 0) {
    const o = el('option', 'Sin cursos');
    o.value = '';
    select.append(o);
    return;
  }
  for (const c of cursos) {
    const o = el('option', c.nombre);
    o.value = c.id;
    o.selected = c.id === activoId;
    select.append(o);
  }
}

export function actualizarBotonTema(oscuro) {
  const b = $('#btn-tema');
  b.setAttribute('aria-pressed', String(oscuro));
}

// ---------- Resumen ----------
export function renderResumen(estado, curso, umbral) {
  const g = estadisticasGenerales(estado.cursos);
  $('#resumen-curso').textContent = curso
    ? `Curso activo: ${curso.nombre}${curso.periodo ? ' · ' + curso.periodo : ''}`
    : 'No hay un curso activo. Crea uno en la sección Cursos.';

  const datos = [
    [String(g.cursos), 'Cursos'],
    [String(curso ? curso.estudiantes.length : 0), 'Estudiantes del curso'],
    [String(curso ? curso.sesiones.length : 0), 'Sesiones del curso'],
    [curso ? textoPct(promedioCurso(curso)) : '—', 'Asistencia promedio']
  ];
  const lista = $('#resumen-tarjetas');
  lista.replaceChildren();
  for (const [cifra, etiqueta] of datos) {
    const li = el('li');
    li.append(el('p', cifra, 'cifra'), el('p', etiqueta, 'etiqueta-tarjeta'));
    lista.append(li);
  }

  const riesgo = $('#resumen-riesgo');
  riesgo.replaceChildren();
  if (!curso) {
    riesgo.append(el('p', 'Sin curso activo.', 'vacio'));
  } else if (curso.sesiones.length === 0) {
    riesgo.append(el('p', 'Aún no hay sesiones registradas.', 'vacio'));
  } else {
    const enRiesgo = estudiantesEnRiesgo(curso, umbral);
    if (enRiesgo.length === 0) {
      riesgo.append(el('p', `Ningún estudiante está por debajo de ${umbral} %.`));
    } else {
      const ul = el('ul', undefined, 'lista-limpia');
      for (const r of enRiesgo) {
        const li = el('li');
        li.append(
          el('strong', r.est.nombre),
          document.createTextNode(' '),
          el('span', `${r.porcentaje} %`, 'bajo'),
          el('span', ` · ${r.P} presente(s), ${r.T} tarde(s), ${r.A} ausente(s), ${r.E} excusa(s)`, 'meta')
        );
        ul.append(li);
      }
      riesgo.append(ul);
    }
  }

  const recientes = $('#resumen-sesiones');
  recientes.replaceChildren();
  if (!curso || curso.sesiones.length === 0) {
    recientes.append(el('p', 'Aún no hay sesiones registradas.', 'vacio'));
    return;
  }
  const ul = el('ul', undefined, 'lista-limpia');
  for (const s of curso.sesiones.slice(-5).reverse()) {
    const r = resumenSesion(s, curso.estudiantes);
    const li = el('li');
    li.append(el('strong', formatoFecha(s.fecha)));
    if (s.tema) li.append(el('span', ` · ${s.tema}`, 'meta'));
    li.append(document.createElement('br'));
    if (r.porcentaje === null) {
      li.append(el('span', 'Sin estudiantes contables', 'meta'));
    } else {
      const barra = document.createElement('progress');
      barra.max = 100;
      barra.value = r.porcentaje;
      barra.setAttribute('aria-label', `Asistencia del ${formatoFecha(s.fecha)}`);
      li.append(barra, el('span', `${r.porcentaje} %`, 'meta'));
    }
    ul.append(li);
  }
  recientes.append(ul);
}

// ---------- Cursos ----------
export function renderCursos(estado, acciones) {
  const tbody = $('#cursos-cuerpo');
  tbody.replaceChildren();
  if (estado.cursos.length === 0) {
    tbody.append(filaVacia('Aún no hay cursos. Crea el primero con el formulario.', 7));
    return;
  }
  for (const c of estado.cursos) {
    const activo = c.id === estado.cursoActivo;
    const tr = el('tr');
    const celdaNombre = th(c.nombre, '', 'row');
    if (activo) celdaNombre.append(el('span', 'Activo', 'etiqueta'));
    const celdaAcc = el('td', undefined, 'acciones');
    if (!activo) celdaAcc.append(boton('Abrir', `Abrir el curso ${c.nombre}`, () => acciones.abrir(c.id)));
    celdaAcc.append(
      boton('Editar', `Editar el curso ${c.nombre}`, () => acciones.editar(c.id)),
      boton('Eliminar', `Eliminar el curso ${c.nombre}`, () => acciones.eliminar(c.id), 'peligro')
    );
    tr.append(
      celdaNombre,
      td(c.docente || '—'),
      td(c.periodo || '—'),
      td(String(c.estudiantes.length), 'num'),
      td(String(c.sesiones.length), 'num'),
      td(textoPct(promedioCurso(c)), 'num'),
      celdaAcc
    );
    tbody.append(tr);
  }
}

// ---------- Estudiantes ----------
export function renderEstudiantes(curso, umbral, filtro, acciones) {
  mostrarSolo($('#est-contenido'), $('#est-aviso'), Boolean(curso),
    'Crea o elige un curso en la sección Cursos para administrar estudiantes.');
  if (!curso) return;

  const tbody = $('#est-cuerpo');
  tbody.replaceChildren();
  const q = normalizarTexto(filtro);
  const lista = curso.estudiantes.filter(
    (e) => !q || normalizarTexto(e.nombre).includes(q) || normalizarTexto(e.codigo).includes(q)
  );
  $('#est-conteo').textContent = q
    ? `${lista.length} de ${curso.estudiantes.length} estudiante(s)`
    : `${curso.estudiantes.length} estudiante(s) en ${curso.nombre}`;

  if (lista.length === 0) {
    tbody.append(filaVacia(q ? 'Ningún estudiante coincide con la búsqueda.' : 'Aún no hay estudiantes en este curso.', 5));
    return;
  }
  for (const e of lista) {
    const r = resumenEstudiante(e.id, curso.sesiones);
    const bajo = r.porcentaje !== null && r.porcentaje < umbral;
    const tr = el('tr');
    const celdaAcc = el('td', undefined, 'acciones');
    celdaAcc.append(
      boton('Editar', `Editar a ${e.nombre}`, () => acciones.editar(e.id)),
      boton('Quitar', `Quitar a ${e.nombre}`, () => acciones.quitar(e.id), 'peligro')
    );
    tr.append(
      th(e.nombre, '', 'row'),
      td(e.codigo || '—'),
      td(e.correo || '—'),
      td(textoPct(r.porcentaje), 'num ' + (r.porcentaje === null ? '' : bajo ? 'bajo' : 'ok')),
      celdaAcc
    );
    tbody.append(tr);
  }
}

// ---------- Tomar asistencia ----------
export function renderSelectorSesion(curso, sesionId) {
  const select = $('#select-sesion');
  select.replaceChildren();
  const sesiones = curso ? curso.sesiones : [];
  select.disabled = sesiones.length === 0;
  $('#btn-borrar-sesion').disabled = sesiones.length === 0;
  if (sesiones.length === 0) {
    const o = el('option', 'Sin sesiones');
    o.value = '';
    select.append(o);
    return;
  }
  for (const s of [...sesiones].reverse()) {
    const o = el('option', formatoFecha(s.fecha) + (s.tema ? ` — ${s.tema}` : ''));
    o.value = s.id;
    o.selected = s.id === sesionId;
    select.append(o);
  }
}

export function renderTomaResumen(curso, sesion) {
  const p = $('#toma-resumen');
  if (!curso || !sesion) { p.textContent = ''; return; }
  const r = resumenSesion(sesion, curso.estudiantes);
  p.textContent =
    `Presentes: ${r.P} · Tarde: ${r.T} · Ausentes: ${r.A} · Excusados: ${r.E} · ` +
    `Asistencia de la sesión: ${textoPct(r.porcentaje)}`;
}

export function renderToma(curso, sesion, alMarcar) {
  mostrarSolo($('#asistencia-contenido'), $('#asistencia-aviso'), Boolean(curso),
    'Crea o elige un curso en la sección Cursos para tomar asistencia.');
  if (!curso) return;

  renderSelectorSesion(curso, sesion?.id ?? null);

  const aviso = $('#toma-aviso');
  const contenido = $('#toma-contenido');
  const cab = $('#toma-cabecera');
  const cuerpo = $('#toma-cuerpo');
  cab.replaceChildren();
  cuerpo.replaceChildren();

  let mensaje = '';
  if (curso.estudiantes.length === 0) mensaje = 'Agrega estudiantes al curso para tomar asistencia.';
  else if (!sesion) mensaje = 'Crea una sesión con el formulario para empezar a marcar asistencia.';
  aviso.hidden = mensaje === '';
  aviso.textContent = mensaje;
  contenido.hidden = mensaje !== '';
  if (mensaje) return;

  const filaCab = el('tr');
  filaCab.append(th('Estudiante'));
  for (const nombre of Object.values(ESTADOS)) filaCab.append(th(nombre, 'centro'));
  cab.append(filaCab);

  for (const est of curso.estudiantes) {
    const actual = estadoDe(sesion, est.id);
    const tr = el('tr');
    tr.append(th(est.nombre, '', 'row'));
    for (const [clave, nombre] of Object.entries(ESTADOS)) {
      const celda = td('', 'centro');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `asistencia-${est.id}`;
      radio.value = clave;
      radio.checked = clave === actual;
      radio.setAttribute('aria-label', `${est.nombre}: ${nombre}`);
      radio.addEventListener('change', () => alMarcar(est.id, clave));
      celda.append(radio);
      tr.append(celda);
    }
    cuerpo.append(tr);
  }
  renderTomaResumen(curso, sesion);
}

// ---------- Reportes ----------
export function renderReporte(curso, umbral, soloRiesgo) {
  mostrarSolo($('#reporte-contenido'), $('#reporte-aviso'), Boolean(curso),
    'Crea o elige un curso en la sección Cursos para ver el reporte.');
  if (!curso) return;

  $('#reporte-titulo').textContent =
    `${curso.nombre} · ${curso.estudiantes.length} estudiante(s) · ${curso.sesiones.length} sesión(es) · mínimo ${umbral} %`;

  const cab = $('#reporte-cabecera');
  const cuerpo = $('#reporte-cuerpo');
  const pie = $('#reporte-pie');
  cab.replaceChildren();
  cuerpo.replaceChildren();
  pie.replaceChildren();

  const filaCab = el('tr');
  filaCab.append(th('Estudiante'));
  for (const s of curso.sesiones) filaCab.append(th(formatoFecha(s.fecha).slice(0, 5), 'centro'));
  for (const t of ['P', 'T', 'A', 'E']) filaCab.append(th(t, 'centro'));
  filaCab.append(th('Asistencia', 'num'));
  cab.append(filaCab);

  let filas = curso.estudiantes.map((est) => ({ est, ...resumenEstudiante(est.id, curso.sesiones) }));
  if (soloRiesgo) filas = filas.filter((f) => f.porcentaje !== null && f.porcentaje < umbral);

  if (filas.length === 0) {
    cuerpo.append(filaVacia(
      soloRiesgo ? 'Ningún estudiante está en riesgo.' : 'Aún no hay estudiantes en este curso.',
      curso.sesiones.length + 6
    ));
  }

  for (const f of filas) {
    const tr = el('tr');
    tr.append(th(f.est.nombre, '', 'row'));
    for (const s of curso.sesiones) {
      const e = estadoDe(s, f.est.id);
      const celda = td('', `centro e-${e}`);
      celda.append(el('span', e), el('span', ESTADOS[e], 'sr'));
      celda.firstChild.setAttribute('aria-hidden', 'true');
      tr.append(celda);
    }
    for (const t of ['P', 'T', 'A', 'E']) tr.append(td(String(f[t]), 'centro'));
    const bajo = f.porcentaje !== null && f.porcentaje < umbral;
    tr.append(td(textoPct(f.porcentaje), 'num ' + (f.porcentaje === null ? '' : bajo ? 'bajo' : 'ok')));
    cuerpo.append(tr);
  }

  if (curso.sesiones.length > 0 && curso.estudiantes.length > 0) {
    const filaPie = el('tr');
    filaPie.append(th('Asistencia por sesión', '', 'row'));
    for (const s of curso.sesiones) {
      filaPie.append(td(textoPct(resumenSesion(s, curso.estudiantes).porcentaje), 'centro'));
    }
    const final = td(`Promedio: ${textoPct(promedioCurso(curso))}`, 'num');
    final.colSpan = 5;
    filaPie.append(final);
    pie.append(filaPie);
  }
}

// ---------- Ajustes ----------
export function renderAjustes(ajustes) {
  $('#aj-umbral').value = ajustes.umbral;
  $('#aj-tema').value = ajustes.tema;
}
