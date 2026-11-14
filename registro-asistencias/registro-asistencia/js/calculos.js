// Funciones puras: no tocan la pantalla ni el navegador.

export function estadoDe(sesion, estudianteId) {
  return Object.hasOwn(sesion.registros, estudianteId) ? sesion.registros[estudianteId] : 'A';
}

export function formatoFecha(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function normalizarTexto(t) {
  return String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Asistencia = (Presente + Tarde) / (sesiones - Excusadas). Sin sesiones contables -> null.
export function resumenEstudiante(estudianteId, sesiones) {
  const c = { P: 0, T: 0, A: 0, E: 0 };
  for (const s of sesiones) c[estadoDe(s, estudianteId)]++;
  const contadas = sesiones.length - c.E;
  const porcentaje = contadas > 0 ? Math.round(((c.P + c.T) / contadas) * 100) : null;
  return { ...c, contadas, porcentaje };
}

export function resumenSesion(sesion, estudiantes) {
  const c = { P: 0, T: 0, A: 0, E: 0 };
  for (const e of estudiantes) c[estadoDe(sesion, e.id)]++;
  const contados = estudiantes.length - c.E;
  const porcentaje = contados > 0 ? Math.round(((c.P + c.T) / contados) * 100) : null;
  return { ...c, porcentaje };
}

export function promedioCurso(curso) {
  const valores = curso.estudiantes
    .map((e) => resumenEstudiante(e.id, curso.sesiones).porcentaje)
    .filter((p) => p !== null);
  if (valores.length === 0) return null;
  return Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
}

export function estudiantesEnRiesgo(curso, umbral) {
  return curso.estudiantes
    .map((est) => ({ est, ...resumenEstudiante(est.id, curso.sesiones) }))
    .filter((r) => r.porcentaje !== null && r.porcentaje < umbral)
    .sort((a, b) => a.porcentaje - b.porcentaje);
}

export function estadisticasGenerales(cursos) {
  return {
    cursos: cursos.length,
    estudiantes: cursos.reduce((n, c) => n + c.estudiantes.length, 0),
    sesiones: cursos.reduce((n, c) => n + c.sesiones.length, 0)
  };
}

// CSV: evita que Excel interprete una celda como fórmula y escapa comillas y separadores.
export function escaparCsv(valor) {
  let t = String(valor ?? '');
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  if (/[";\n\r]/.test(t)) t = '"' + t.replaceAll('"', '""') + '"';
  return t;
}

export function aCsv(curso) {
  const fila = (celdas) => celdas.map(escaparCsv).join(';');
  const lineas = [
    fila([
      'Estudiante', 'Código', 'Correo',
      ...curso.sesiones.map((s) => formatoFecha(s.fecha)),
      'Presentes', 'Tardes', 'Ausentes', 'Excusas', 'Asistencia (%)'
    ])
  ];
  for (const e of curso.estudiantes) {
    const r = resumenEstudiante(e.id, curso.sesiones);
    lineas.push(fila([
      e.nombre, e.codigo, e.correo,
      ...curso.sesiones.map((s) => estadoDe(s, e.id)),
      r.P, r.T, r.A, r.E, r.porcentaje ?? ''
    ]));
  }
  return lineas.join('\r\n');
}
