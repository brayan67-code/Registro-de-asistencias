# Registro de asistencia · Proyecto final · Desarrollo Web I

**Nombre:** [Escribe aquí tu nombre completo]
**Idea elegida:** Registro de asistencia (nivel básico, ampliado)
**Enlace público (GitHub Pages):** https://TU-USUARIO.github.io/registro-asistencia/

## Qué hace
Barra de navegación con seis secciones (se navega con `#resumen`, `#cursos`, `#estudiantes`, `#asistencia`, `#reportes` y `#ajustes`):

- **Resumen:** tarjetas con totales, asistencia promedio, estudiantes en riesgo y las últimas sesiones con barras de progreso.
- **Cursos:** crear, editar, eliminar y activar cursos (nombre, docente, periodo). El curso activo se cambia también desde la barra.
- **Estudiantes:** agregar uno por uno (nombre, código, correo) o pegar una lista; editar, quitar y buscar (sin distinguir tildes).
- **Asistencia:** crear sesiones con fecha y tema; marcar Presente, Tarde, Ausente o Excusado (con teclado: flechas); botones para marcar a todos.
- **Reportes:** matriz estudiante × sesión, asistencia por estudiante y por sesión, filtro de estudiantes en riesgo, exportar a CSV e imprimir.
- **Ajustes:** asistencia mínima (por defecto 80 %), tema claro/oscuro/automático, copia de seguridad en JSON (descargar y restaurar) y borrado total.

### Cómo se calcula la asistencia
`(Presentes + Tardes) / (sesiones − Excusadas) × 100`. Una sesión sin marcar cuenta como Ausente. Si todas las sesiones de un estudiante son excusas, se muestra «—».

## Estructura
```
registro-asistencia/
├── index.html
├── css/estilos.css
├── js/
│   ├── datos.js      (modelo, estados, normalización y migración de datos)
│   ├── calculos.js   (funciones puras: porcentajes, riesgo, CSV)
│   ├── storage.js    (localStorage + JSON, con errores capturados)
│   ├── archivos.js   (descargar y leer archivos)
│   ├── ui.js         (dibuja cada vista; solo textContent)
│   └── app.js        (rutas por #hash, eventos y conexión)
└── README.md
```

## Cómo ejecutarlo en local
Abre la carpeta en VS Code → clic derecho en `index.html` → **Open with Live Server**. Con doble clic los módulos no cargan.

## Buenas prácticas y accesibilidad aplicadas
- Un solo `h1`, encabezados en orden, `header`/`nav`/`main`/`section`/`footer`, `lang="es"`.
- Menú con `aria-current`, botón de menú móvil con `aria-expanded` (Escape lo cierra), enlace «Saltar al contenido» y foco que pasa al título de cada sección.
- Cada campo con `label`; avisos en `role="status"`; tablas con `caption` y `scope`; cada casilla y botón con nombre accesible.
- Contraste mínimo 4.5:1 en tema claro y oscuro, fuentes en `rem`, `prefers-reduced-motion`, sin scroll horizontal a 360 px, estilos de impresión.
- Errores de `localStorage` y de archivos importados capturados y avisados en pantalla.
- Sin `innerHTML`; el CSV evita fórmulas (`=`, `+`, `-`, `@`) y usa `;` como separador (Excel en español).
- Los datos de la versión anterior (lista de presentes) se migran solos.

## Cómo publicarlo en GitHub Pages
1. Crea un repositorio **público** llamado `registro-asistencia` (sin marcar «Add a README»).
2. Sube **el contenido** de esta carpeta, de modo que `index.html` quede en la raíz del repositorio.
3. Settings → Pages → Source: *Deploy from a branch* → Branch: `main` y `/ (root)` → Save.
4. Espera uno o dos minutos, abre el enlace y pégalo arriba en este README.
5. Comprueba que funciona en el celular y en otro equipo.

## Prueba rápida
1. En **Cursos** crea un curso; en **Estudiantes** pega 4 nombres; en **Asistencia** crea 3 sesiones y marca.
2. Ve a **Resumen** y a **Reportes**: los porcentajes y el filtro de riesgo deben coincidir con lo marcado.
3. Exporta el CSV, activa el modo oscuro y recarga con F5: todo debe seguir igual.
