# StreamTV - Cliente IPTV Xtream Codes (Smart TV / Nintendo Switch / Vercel SPA)

Una aplicación web Single Page Application (SPA) ultra-optimizada para actuar como cliente de **IPTV compatible con servidores Xtream Codes**. Diseñada específicamente con interfaz oscura tipo **Netflix / Smart TV / Nintendo Switch**, control mediante **D-Pad (flechas del teclado o controles de juego)** e integración con **Neon (PostgreSQL)** para persistencia de reproducciones.

---

## 🚀 Características Principales

1. **Optimización para Nintendo Switch & Móviles:**
   - **Paginación / Carga en Bloques:** Las cuadrículas cargan sólo 24 elementos por página para evitar desbordamiento de memoria en la Switch.
   - **Proxy de Imágenes (`images.weserv.nl`):** Redimensiona posters a ~300px en formato WebP liviano para reducir la carga de red en un 80%.
   - **Lazy Loading Native:** Atributos `loading="lazy"` en todas las carátulas e íconos.
2. **Persistencia "Continuar Viendo" con Neon PostgreSQL:**
   - Guarda automáticamente el avance del reproductor al pausar, cambiar de minuto o salir.
   - Utiliza una **Vercel Serverless API Route (`/api/history`)** conectada a **Neon PostgreSQL** a través de `@neondatabase/serverless` para `UPSERT` atómico.
   - Respaldo transparente en `localStorage` si no hay conexión de base de datos en desarrollo local.
3. **Diseño Totalmente Responsivo (Mobile-First + Smart TV Layout):**
   - **Móviles:** 2 columnas.
   - **Nintendo Switch / Tablets:** 3 a 4 columnas.
   - **PC / Smart TV:** 5 a 6 columnas.
   - Resaltado `.focused` de alto contraste compatible con pantallas táctiles, mouse y mando D-Pad.
4. **Tres Secciones Estrictas:**
   - **TV en Vivo:** Canales agrupados por categorías con buscador y previsualizador.
   - **Películas (VOD):** Posters HD con calificaciones, sinopsis y reproductor.
   - **Series:** Desglose de temporadas y selección rápida de episodios.

---

## 🛠️ Tecnologías Utilizadas

- **Vite 5** + **React 18**
- **Tailwind CSS 3** (Estética Netflix `#141414`, acentos rojo `#E50914`, glassmorphism)
- **Hls.js** (Reproducción de transmisiones `.m3u8` en vivo)
- **@neondatabase/serverless** (Driver para Vercel Serverless Functions + Neon DB)
- **Lucide React** (Iconografía)

---

## 💻 Variables de Entorno

Configura el archivo `.env` en la raíz del proyecto basándote en `.env.example`:

```env
VITE_IPTV_SERVER=http://your-iptv-server.com:8080
VITE_IPTV_USER=your_username
VITE_IPTV_PASS=your_password
DATABASE_URL=postgres://user:password@your-neon-host.aws.neon.tech/neondb?sslmode=require
```

---

## 🌐 Despliegue en Vercel & Neon PostgreSQL

### Paso 1: Crear Base de Datos en Neon
1. Registrate en [Neon Console](https://console.neon.tech/).
2. Crea un proyecto de PostgreSQL.
3. Copia tu **Connection String** (ej. `postgres://alex:secret@ep-xyz.neon.tech/neondb?sslmode=require`).

### Paso 2: Configurar Variables de Entorno en Vercel
En el panel de Vercel (**Project Settings -> Environment Variables**), agrega:

| Variable | Descripción |
| :--- | :--- |
| `VITE_IPTV_SERVER` | URL Servidor IPTV (ej. `http://your-iptv-server.com:8080`) |
| `VITE_IPTV_USER` | Usuario IPTV |
| `VITE_IPTV_PASS` | Contraseña IPTV |
| `DATABASE_URL` | String de Conexión de Neon PostgreSQL |

### Paso 3: Desplegar
Conecta el repositorio a Vercel y haz clic en **Deploy**. Las rutas serverless en `/api/history` crearán automáticamente la tabla `watch_history` al ejecutarse por primera vez.

---

## 🎮 Controles por Teclado / Control Remoto / Nintendo Switch

| Tecla | Acción |
| :--- | :--- |
| **Flechas Arriba / Abajo / Izquierda / Derecha** | Mover el foco en la cuadrícula D-Pad espacial |
| **Enter / Espacio** | Seleccionar elemento enfocado / Play-Pausa en reproductor |
| **Backspace / Escape** | Volver al menú anterior / Cerrar reproductor |
| **Controles de Reproductor** | Izquierda/Derecha (-10s / +10s), Arriba/Abajo (Volumen) |

---

## 📄 Licencia
MIT - Optimizado para Nintendo Switch & Smart TV.
