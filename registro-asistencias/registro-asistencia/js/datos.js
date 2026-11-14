// Modelo de datos del registro de asistencia.
//
// curso      = { id, nombre, docente, periodo, estudiantes[], sesiones[] }
// estudiante = { id, nombre, codigo, correo }
// sesion     = { id, fecha 'AAAA-MM-DD', tema, registros: { [idEstudiante]: 'P' | 'T' | 'A' | 'E' } }
// Un estudiante sin registro en una sesión cuenta como Ausente ('A').

export const ESTADOS = { P: 'Presente', T: 'Tarde', A: 'Ausente', E: 'Excusado' };
export const CLAVES_ESTADO = Object.keys(ESTADOS);
export const UMBRAL_DEFECTO = 80;

export const estadoBase = {
  version: 2,
  cursos: [],
  cursoActivo: null,
  sesionActiva: null,
  ajustes: { umbral: UMBRAL_DEFECTO, tema: 'auto' }
};

export function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function hoyISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

const texto = (valor, max = 120) => (typeof valor === 'string' ? valor.trim().slice(0, max) : '');
const idSeguro = (valor) => {
  const id = texto(valor, 40);
  return id && id !== '__proto__' ? id : nuevoId();
};

function normalizarCurso(c) {
  const estudiantes = (Array.isArray(c.estudiantes) ? c.estudiantes : [])
    .filter((e) => e && typeof e === 'object')
    .map((e) => ({
      id: idSeguro(e.id),
      nombre: texto(e.nombre) || 'Sin nombre',
      codigo: texto(e.codigo, 30),
      correo: texto(e.correo)
    }));
  const ids = new Set(estudiantes.map((e) => e.id));

  const sesiones = (Array.isArray(c.sesiones) ? c.sesiones : [])
    .filter((s) => s && typeof s === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(s.fecha))
    .map((s) => {
      const registros = {};
      if (s.registros && typeof s.registros === 'object') {
        for (const [id, v] of Object.entries(s.registros)) {
          if (ids.has(id) && CLAVES_ESTADO.includes(v)) registros[id] = v;
        }
      } else if (Array.isArray(s.presentes)) {
        // Migración desde la versión 1 (lista de presentes)
        for (const e of estudiantes) registros[e.id] = s.presentes.includes(e.id) ? 'P' : 'A';
      }
      return { id: idSeguro(s.id), fecha: s.fecha, tema: texto(s.tema), registros };
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  return {
    id: idSeguro(c.id),
    nombre: texto(c.nombre) || 'Curso sin nombre',
    docente: texto(c.docente),
    periodo: texto(c.periodo, 40),
    estudiantes,
    sesiones
  };
}

// Limpia y completa cualquier dato leído (localStorage o archivo importado).
export function normalizarEstado(raw) {
  const estado = structuredClone(estadoBase);
  if (!raw || typeof raw !== 'object') return estado;

  estado.cursos = (Array.isArray(raw.cursos) ? raw.cursos : [])
    .filter((c) => c && typeof c === 'object')
    .map(normalizarCurso);
  estado.cursoActivo = estado.cursos.some((c) => c.id === raw.cursoActivo)
    ? raw.cursoActivo
    : (estado.cursos[0]?.id ?? null);
  estado.sesionActiva = typeof raw.sesionActiva === 'string' ? raw.sesionActiva : null;

  const aj = raw.ajustes && typeof raw.ajustes === 'object' ? raw.ajustes : {};
  const umbral = Number(aj.umbral);
  estado.ajustes.umbral = Number.isInteger(umbral) && umbral >= 1 && umbral <= 100 ? umbral : UMBRAL_DEFECTO;
  estado.ajustes.tema = ['auto', 'claro', 'oscuro'].includes(aj.tema) ? aj.tema : 'auto';
  return estado;
}
