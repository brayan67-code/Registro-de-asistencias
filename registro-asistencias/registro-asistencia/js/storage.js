const CLAVE = 'registro-asistencia';

// Devuelve true si se pudo guardar; false si el navegador lo bloqueó o no hay espacio.
export function guardarEstado(estado) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(estado));
    return true;
  } catch (error) {
    console.error('No se pudo guardar en localStorage:', error);
    return false;
  }
}

// Devuelve { estado, ok }. Si la lectura falla o el dato está dañado, usa el respaldo y ok = false.
export function cargarEstado(respaldo) {
  try {
    const texto = localStorage.getItem(CLAVE);
    if (!texto) return { estado: structuredClone(respaldo), ok: true };
    const dato = JSON.parse(texto);
    if (!Array.isArray(dato.cursos)) throw new Error('Formato de datos no válido');
    return { estado: { ...structuredClone(respaldo), ...dato }, ok: true };
  } catch (error) {
    console.error('No se pudo leer localStorage:', error);
    return { estado: structuredClone(respaldo), ok: false };
  }
}
