import { estadoBase, nuevoId, normalizarEstado, hoyISO } from './datos.js';
import { cargarEstado, guardarEstado } from './storage.js';
import { aCsv, normalizarTexto, formatoFecha } from './calculos.js';
import { descargarTexto, leerArchivoTexto, nombreArchivoSeguro } from './archivos.js';
import * as ui from './ui.js';

const { $ } = ui;

const VISTAS = {
  resumen: 'Resumen',
  cursos: 'Cursos',
  estudiantes: 'Estudiantes',
  asistencia: 'Asistencia',
  reportes: 'Reportes',
  ajustes: 'Ajustes'
};
const AVISO_ALMACENAMIENTO =
  'No se pudo guardar en este navegador. Tus cambios se perderán al cerrar la página.';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const lectura = cargarEstado(estadoBase);
let estado = normalizarEstado(lectura.estado);
let guardadoOk = true;
let vistaActual = 'resumen';
let editandoCurso = null;
let editandoEstudiante = null;
let filtroBusqueda = '';

const cursoActual = () => estado.cursos.find((c) => c.id === estado.cursoActivo) || null;

function sesionActual() {
  const curso = cursoActual();
  if (!curso || curso.sesiones.length === 0) return null;
  let sesion = curso.sesiones.find((s) => s.id === estado.sesionActiva);
  if (!sesion) {
    sesion = curso.sesiones[curso.sesiones.length - 1];
    estado.sesionActiva = sesion.id;
  }
  return sesion;
}

const leer = (datos, campo, max = 120) => String(datos.get(campo) ?? '').trim().slice(0, max);
const error = (texto) => ui.mostrarMensaje(texto, 'error');

// ---------- Guardado y mensajes ----------
function guardar() {
  guardadoOk = guardarEstado(estado);
  if (!guardadoOk) ui.mostrarMensaje(AVISO_ALMACENAMIENTO, 'error');
  return guardadoOk;
}

function confirmar(texto) {
  if (guardadoOk) ui.mostrarMensaje(texto, 'exito');
}

function requerirCurso() {
  const curso = cursoActual();
  if (!curso) error('Primero crea o elige un curso.');
  return curso;
}

// ---------- Tema ----------
function aplicarTema() {
  const pref = estado.ajustes.tema;
  const oscuro = pref === 'oscuro' ||
    (pref === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.tema = oscuro ? 'oscuro' : 'claro';
  ui.actualizarBotonTema(oscuro);
}

// ---------- Vistas y navegación ----------
function renderVista(nombre) {
  const curso = cursoActual();
  const { umbral } = estado.ajustes;
  switch (nombre) {
    case 'resumen': ui.renderResumen(estado, curso, umbral); break;
    case 'cursos': ui.renderCursos(estado, accionesCursos); break;
    case 'estudiantes': ui.renderEstudiantes(curso, umbral, filtroBusqueda, accionesEstudiantes); break;
    case 'asistencia': ui.renderToma(curso, sesionActual(), marcar); break;
    case 'reportes': ui.renderReporte(curso, umbral, $('#solo-riesgo').checked); break;
    case 'ajustes': ui.renderAjustes(estado.ajustes); break;
  }
}

function renderTodo() {
  ui.renderSelectorCurso(estado.cursos, estado.cursoActivo);
  aplicarTema();
  renderVista(vistaActual);
}

function cerrarMenu() {
  $('#menu-principal').classList.remove('abierto');
  $('#btn-menu').setAttribute('aria-expanded', 'false');
}

function enfocarVista() {
  $(`#t-${vistaActual}`).focus();
}

function irA(nombre, { enfocar = false } = {}) {
  vistaActual = nombre;
  document.querySelectorAll('.vista').forEach((v) => { v.hidden = v.id !== `vista-${nombre}`; });
  ui.marcarNavActiva(nombre);
  ui.limpiarMensaje();
  document.title = `${VISTAS[nombre]} · Registro de asistencia`;
  renderVista(nombre);
  cerrarMenu();
  if (enfocar) enfocarVista();
}

function vistaDelHash() {
  const nombre = location.hash.slice(1);
  return Object.hasOwn(VISTAS, nombre) ? nombre : null;
}

// ---------- Cursos ----------
function entrarEdicionCurso(curso) {
  const f = $('#form-curso');
  editandoCurso = curso.id;
  f.elements.nombre.value = curso.nombre;
  f.elements.docente.value = curso.docente;
  f.elements.periodo.value = curso.periodo;
  $('#btn-curso-guardar').textContent = 'Guardar cambios';
  $('#btn-curso-cancelar').hidden = false;
  f.elements.nombre.focus();
}

function salirEdicionCurso() {
  editandoCurso = null;
  $('#form-curso').reset();
  $('#btn-curso-guardar').textContent = 'Crear curso';
  $('#btn-curso-cancelar').hidden = true;
}

const accionesCursos = {
  abrir(id) {
    estado.cursoActivo = id;
    estado.sesionActiva = null;
    guardar();
    renderTodo();
    confirmar(`Curso activo: ${cursoActual().nombre}.`);
  },
  editar(id) {
    entrarEdicionCurso(estado.cursos.find((c) => c.id === id));
  },
  eliminar(id) {
    const curso = estado.cursos.find((c) => c.id === id);
    if (!confirm(`¿Eliminar el curso "${curso.nombre}" con sus estudiantes y sesiones?`)) return;
    estado.cursos = estado.cursos.filter((c) => c.id !== id);
    if (estado.cursoActivo === id) {
      estado.cursoActivo = estado.cursos[0]?.id ?? null;
      estado.sesionActiva = null;
    }
    if (editandoCurso === id) salirEdicionCurso();
    guardar();
    renderTodo();
    enfocarVista();
    confirmar('Curso eliminado.');
  }
};

$('#form-curso').addEventListener('submit', (e) => {
  e.preventDefault();
  const datos = new FormData(e.target);
  const nombre = leer(datos, 'nombre');
  if (!nombre) return error('Escribe el nombre del curso.');
  const repetido = estado.cursos.some(
    (c) => c.id !== editandoCurso && normalizarTexto(c.nombre) === normalizarTexto(nombre)
  );
  if (repetido) return error('Ya existe un curso con ese nombre.');

  const campos = { nombre, docente: leer(datos, 'docente'), periodo: leer(datos, 'periodo', 40) };
  if (editandoCurso) {
    Object.assign(estado.cursos.find((c) => c.id === editandoCurso), campos);
    salirEdicionCurso();
    guardar();
    renderTodo();
    return confirmar('Curso actualizado.');
  }
  const curso = { id: nuevoId(), ...campos, estudiantes: [], sesiones: [] };
  estado.cursos.push(curso);
  estado.cursoActivo = curso.id;
  estado.sesionActiva = null;
  e.target.reset();
  guardar();
  renderTodo();
  confirmar('Curso creado y activado.');
});

$('#btn-curso-cancelar').addEventListener('click', salirEdicionCurso);

$('#select-curso').addEventListener('change', (e) => {
  estado.cursoActivo = e.target.value || null;
  estado.sesionActiva = null;
  guardar();
  renderVista(vistaActual);
});

// ---------- Estudiantes ----------
function entrarEdicionEstudiante(est) {
  const f = $('#form-estudiante');
  editandoEstudiante = est.id;
  f.elements.nombre.value = est.nombre;
  f.elements.codigo.value = est.codigo;
  f.elements.correo.value = est.correo;
  $('#btn-est-guardar').textContent = 'Guardar cambios';
  $('#btn-est-cancelar').hidden = false;
  f.elements.nombre.focus();
}

function salirEdicionEstudiante() {
  editandoEstudiante = null;
  $('#form-estudiante').reset();
  $('#btn-est-guardar').textContent = 'Agregar estudiante';
  $('#btn-est-cancelar').hidden = true;
}

const ordenarEstudiantes = (curso) =>
  curso.estudiantes.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

const accionesEstudiantes = {
  editar(id) {
    entrarEdicionEstudiante(cursoActual().estudiantes.find((e) => e.id === id));
  },
  quitar(id) {
    const curso = cursoActual();
    const est = curso.estudiantes.find((e) => e.id === id);
    if (!confirm(`¿Quitar a "${est.nombre}" del curso? Se borrará también su asistencia.`)) return;
    curso.estudiantes = curso.estudiantes.filter((e) => e.id !== id);
    curso.sesiones.forEach((s) => { delete s.registros[id]; });
    if (editandoEstudiante === id) salirEdicionEstudiante();
    guardar();
    renderVista('estudiantes');
    enfocarVista();
    confirmar('Estudiante quitado.');
  }
};

$('#form-estudiante').addEventListener('submit', (e) => {
  e.preventDefault();
  const curso = requerirCurso();
  if (!curso) return;
  const datos = new FormData(e.target);
  const nombre = leer(datos, 'nombre');
  const codigo = leer(datos, 'codigo', 30);
  const correo = leer(datos, 'correo');

  if (!nombre) return error('Escribe el nombre del estudiante.');
  if (correo && !EMAIL.test(correo)) return error('El correo no tiene un formato válido.');
  const otros = curso.estudiantes.filter((x) => x.id !== editandoEstudiante);
  if (otros.some((x) => normalizarTexto(x.nombre) === normalizarTexto(nombre))) {
    return error('Ese estudiante ya está en el curso.');
  }
  if (codigo && otros.some((x) => x.codigo && normalizarTexto(x.codigo) === normalizarTexto(codigo))) {
    return error('Ya hay un estudiante con ese código.');
  }

  if (editandoEstudiante) {
    Object.assign(curso.estudiantes.find((x) => x.id === editandoEstudiante), { nombre, codigo, correo });
    salirEdicionEstudiante();
    ordenarEstudiantes(curso);
    guardar();
    renderVista('estudiantes');
    return confirmar('Estudiante actualizado.');
  }
  curso.estudiantes.push({ id: nuevoId(), nombre, codigo, correo });
  ordenarEstudiantes(curso);
  e.target.reset();
  guardar();
  renderVista('estudiantes');
  confirmar('Estudiante agregado.');
});

$('#btn-est-cancelar').addEventListener('click', salirEdicionEstudiante);

$('#form-lote').addEventListener('submit', (e) => {
  e.preventDefault();
  const curso = requerirCurso();
  if (!curso) return;
  const lineas = leer(new FormData(e.target), 'lista', 20000).split(/\r?\n/);
  const existentes = new Set(curso.estudiantes.map((x) => normalizarTexto(x.nombre)));
  let agregados = 0;
  let omitidos = 0;
  for (const linea of lineas) {
    const nombre = linea.trim().slice(0, 120);
    if (!nombre) continue;
    const clave = normalizarTexto(nombre);
    if (existentes.has(clave)) { omitidos++; continue; }
    existentes.add(clave);
    curso.estudiantes.push({ id: nuevoId(), nombre, codigo: '', correo: '' });
    agregados++;
  }
  if (agregados === 0) {
    return error(omitidos ? 'Todos los nombres ya estaban en el curso.' : 'Escribe al menos un nombre.');
  }
  ordenarEstudiantes(curso);
  e.target.reset();
  guardar();
  renderVista('estudiantes');
  confirmar(`Se agregaron ${agregados} estudiante(s)` + (omitidos ? ` (${omitidos} repetido(s) omitido(s)).` : '.'));
});

$('#buscar-est').addEventListener('input', (e) => {
  filtroBusqueda = e.target.value;
  renderVista('estudiantes');
});

// ---------- Sesiones y toma de asistencia ----------
function marcar(estudianteId, valor) {
  const sesion = sesionActual();
  sesion.registros[estudianteId] = valor;
  guardar();
  ui.renderTomaResumen(cursoActual(), sesion);
}

function marcarTodos(valor) {
  const curso = cursoActual();
  const sesion = sesionActual();
  if (!curso || !sesion) return;
  for (const est of curso.estudiantes) sesion.registros[est.id] = valor;
  guardar();
  renderVista('asistencia');
  confirmar(valor === 'P' ? 'Todos marcados como presentes.' : 'Todos marcados como ausentes.');
}

$('#form-sesion').addEventListener('submit', (e) => {
  e.preventDefault();
  const curso = requerirCurso();
  if (!curso) return;
  const datos = new FormData(e.target);
  const fecha = leer(datos, 'fecha', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return error('Elige la fecha de la sesión.');
  if (curso.sesiones.some((s) => s.fecha === fecha)) return error('Ya existe una sesión en esa fecha.');
  const sesion = { id: nuevoId(), fecha, tema: leer(datos, 'tema'), registros: {} };
  curso.sesiones.push(sesion);
  curso.sesiones.sort((a, b) => a.fecha.localeCompare(b.fecha));
  estado.sesionActiva = sesion.id;
  e.target.reset();
  e.target.elements.fecha.value = hoyISO();
  guardar();
  renderVista('asistencia');
  confirmar('Sesión creada. Marca la asistencia de cada estudiante.');
});

$('#select-sesion').addEventListener('change', (e) => {
  estado.sesionActiva = e.target.value || null;
  guardar();
  renderVista('asistencia');
});

$('#btn-borrar-sesion').addEventListener('click', () => {
  const curso = cursoActual();
  const sesion = sesionActual();
  if (!curso || !sesion) return;
  if (!confirm(`¿Eliminar la sesión del ${formatoFecha(sesion.fecha)} y su asistencia?`)) return;
  curso.sesiones = curso.sesiones.filter((s) => s.id !== sesion.id);
  estado.sesionActiva = null;
  guardar();
  renderVista('asistencia');
  enfocarVista();
  confirmar('Sesión eliminada.');
});

$('#btn-todos-presentes').addEventListener('click', () => marcarTodos('P'));
$('#btn-todos-ausentes').addEventListener('click', () => marcarTodos('A'));

// ---------- Reportes ----------
$('#solo-riesgo').addEventListener('change', () => renderVista('reportes'));

$('#btn-csv').addEventListener('click', () => {
  const curso = cursoActual();
  if (!curso) return;
  if (curso.estudiantes.length === 0 || curso.sesiones.length === 0) {
    return error('Necesitas al menos un estudiante y una sesión para exportar.');
  }
  descargarTexto(`asistencia-${nombreArchivoSeguro(curso.nombre)}.csv`, '\ufeff' + aCsv(curso), 'text/csv');
  confirmar('Archivo CSV descargado.');
});

$('#btn-imprimir').addEventListener('click', () => window.print());

// ---------- Ajustes ----------
$('#form-ajustes').addEventListener('submit', (e) => {
  e.preventDefault();
  const datos = new FormData(e.target);
  const umbral = Number(datos.get('umbral'));
  if (!Number.isInteger(umbral) || umbral < 1 || umbral > 100) {
    return error('La asistencia mínima debe ser un número entero entre 1 y 100.');
  }
  const tema = datos.get('tema');
  estado.ajustes = { umbral, tema: ['auto', 'claro', 'oscuro'].includes(tema) ? tema : 'auto' };
  guardar();
  aplicarTema();
  confirmar('Ajustes guardados.');
});

$('#btn-tema').addEventListener('click', () => {
  const oscuro = document.documentElement.dataset.tema === 'oscuro';
  estado.ajustes.tema = oscuro ? 'claro' : 'oscuro';
  guardar();
  aplicarTema();
  if (vistaActual === 'ajustes') ui.renderAjustes(estado.ajustes);
});

$('#btn-respaldo').addEventListener('click', () => {
  descargarTexto(`respaldo-asistencia-${hoyISO()}.json`, JSON.stringify(estado, null, 2), 'application/json');
  confirmar('Copia de seguridad descargada.');
});

$('#input-importar').addEventListener('change', async (e) => {
  const archivo = e.target.files[0];
  e.target.value = '';
  if (!archivo) return;
  let dato;
  try {
    if (archivo.size > 5_000_000) throw new Error('Archivo demasiado grande');
    dato = JSON.parse(await leerArchivoTexto(archivo));
    if (!dato || !Array.isArray(dato.cursos)) throw new Error('Formato no válido');
  } catch (err) {
    console.error(err);
    return error('El archivo no es una copia de seguridad válida.');
  }
  if (!confirm('Esto reemplazará todos los datos actuales por los del archivo. ¿Continuar?')) return;
  estado = normalizarEstado(dato);
  salirEdicionCurso();
  salirEdicionEstudiante();
  guardar();
  renderTodo();
  confirmar('Datos restaurados desde la copia de seguridad.');
});

$('#btn-borrar-todo').addEventListener('click', () => {
  if (!confirm('¿Borrar TODOS los cursos, estudiantes y asistencias? Esta acción no se puede deshacer.')) return;
  estado = { ...normalizarEstado(null), ajustes: estado.ajustes };
  salirEdicionCurso();
  salirEdicionEstudiante();
  guardar();
  renderTodo();
  confirmar('Todos los datos fueron borrados.');
});

// ---------- Barra de navegación ----------
$('#btn-menu').addEventListener('click', () => {
  const menu = $('#menu-principal');
  const abierto = menu.classList.toggle('abierto');
  $('#btn-menu').setAttribute('aria-expanded', String(abierto));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('#menu-principal').classList.contains('abierto')) {
    cerrarMenu();
    $('#btn-menu').focus();
  }
});

document.querySelector('.saltar').addEventListener('click', (e) => {
  e.preventDefault();
  $('#contenido').focus();
});

window.addEventListener('hashchange', () => {
  const nombre = vistaDelHash();
  if (nombre) irA(nombre, { enfocar: true });
});

window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', aplicarTema);

// ---------- Inicio ----------
$('#ses-fecha').value = hoyISO();
renderTodo();
irA(vistaDelHash() ?? 'resumen');
if (!lectura.ok) {
  ui.mostrarMensaje(
    guardar()
      ? 'Los datos guardados no se pudieron leer. Se empezó con un registro vacío.'
      : AVISO_ALMACENAMIENTO,
    'error'
  );
}
