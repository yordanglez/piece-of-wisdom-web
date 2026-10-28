# Piece of Wisdom · web

Sitio público de **Piece of Wisdom**, la app de meditación guiada. HTML, CSS y JavaScript estáticos, sin dependencias ni proceso de compilación: se sirve con GitHub Pages en `https://yordanglez.github.io/piece-of-wisdom-web/`.

El código de la app vive aparte, en el repositorio privado `piece-of-wisdom`.

## Páginas

| Página | Para qué sirve |
|---|---|
| `/` | Portada interactiva. Es la *Marketing URL* de las tiendas. |
| `/privacidad.html` | Política de privacidad. Obligatoria en Google Play (ficha y *Data safety*). |
| `/terminos.html` | Términos de uso. |
| `/eliminar-datos.html` | Cómo borrar la cuenta. Es la URL que pide Google Play en *Data safety* → eliminación de cuenta. |
| `/soporte.html` | Ayuda y contacto. Es la *Support URL*. |
| `/404.html` | Lo que sirve GitHub Pages cuando una ruta no existe. |

Solo en español, como la app.

## Lo interactivo de la portada

- **El móvil de «Pruébala».** Reproduce el recorrido de la app con sus textos: Hoy → Tu sesión → Preparando → reproductor → cierre, más Escuchar y Mi camino. Se puede escribir una nota, elegir tema, duración, voz y sonidos, pedir la Palabra (con el diálogo de consentimiento), escuchar con el guion avanzando y guardar en el diario. **No genera nada**: el guion es el ejemplo de la app (`SCRIPT_LINES`), no hay voz y el tiempo corre diez veces más deprisa. La página lo dice debajo del móvil. Si una nota contiene señales de riesgo, la demo enseña la pantalla «Hoy no», igual que la app.
- **Los sonidos de fondo** (Lluvia suave, Olas, Viento, Fuego, Cuencos tibetanos) se sintetizan en el navegador con Web Audio. No son los de la app.
- **Los nueve salmos** de «Meditar en un salmo» se leen enteros. `salmos.js` es una copia literal de esos capítulos sacada de `assets/rv1909.db` de la app (Reina-Valera 1909, dominio público).
- **Un minuto de respiración** sobre el horizonte, con olas opcionales.
- **Noche y Cielo.** Sigue el tema del sistema y se puede cambiar con el botón de la cabecera; la elección se guarda en el navegador.

## Estructura

```
index.html                 portada
privacidad.html, ...       páginas legales y de ayuda
styles.css                 estilos compartidos y tokens de color
tema.js                    tema claro/oscuro y botón de copiar el correo (todas las páginas)
app.js                     la demo, los sonidos, el lector de salmos y el minuto (solo la portada)
salmos.js                  los nueve salmos, literales de RV 1909
assets/noche, assets/dia   el arte de cada tema y las portadas
assets/og.jpg              la imagen que se ve al compartir el enlace
```

`styles.css` copia los tokens de color de la app (`src/theme/tokens.ts` en `piece-of-wisdom`) y usa la misma tipografía, Hanken Grotesk. Los iconos son los trazos de `src/art/Icon.tsx`, en un sprite SVG dentro de cada página. Si cambia la paleta o un icono de la app, hay que reflejarlo aquí a mano: los dos proyectos no comparten código.

Las imágenes salen de `assets/presencia` y `assets/presencia-claro` de la app, reescaladas: 1170 de ancho para los paisajes y 560 para las portadas.

## Publicar cambios

Editar el HTML y hacer push a `main`. GitHub Pages reconstruye el sitio solo, en menos de un minuto.

La primera vez hay que activarlo: *Settings → Pages → Build and deployment → Source: Deploy from a branch*, rama `main`, carpeta `/ (root)`.

## Dominio propio

Si algún día hay dominio (como `kalinda.app` en Kalinda):

1. Añadir un archivo `CNAME` con el dominio.
2. Cambiar las URLs de `og:url` y `og:image` en `index.html`.
3. Cambiar `<base href="/piece-of-wisdom-web/">` por `<base href="/">` en `404.html`.

## Pendiente

- Los botones «Solicitar acceso» abren un correo porque la app aún no está publicada. Cuando salga en Google Play, sustituirlos por el enlace a la ficha (están en `index.html`: cabecera, portada y llamada final).
- La portada dice que Premium da «30 sesiones creadas para ti al mes», igual que el paywall de la app. Hay que revisarlo cuando se decida qué incluye cada plan: la revisión de producto del 28 de octubre (hallazgo C-05, en `docs/revisiones/` del repo de la app) vio que el plan gratuito ya tiene la biblioteca y la escucha sin conexión.
- La política de privacidad nombra a Supabase, Modal, Cloudflare, RevenueCat, Google Play y Expo, pero no al proveedor del modelo de lenguaje ni al de la voz, porque el código de la app no los nombra. Conviene añadirlos.
