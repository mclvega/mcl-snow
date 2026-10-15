# Plan: McL Snow (estilo fy_snow de CS 1.6)

## Referencia

fy_snow es un mapa pequeño, nevado y simétrico de Counter-Strike 1.6. Cada equipo sale de una casa y en el centro hay cajas de madera, muros bajos y una torre. Las rondas son rápidas: gana el equipo que elimina al otro.

## Qué hacemos

- Motor FPS con three.js: colisiones con cilindros contra cajas alineadas a los ejes, gravedad, escalones y saltos sobre cajas de 1,2 m.
- Disparos instantáneos con zonas de impacto (cabeza ×4, cuerpo y piernas), dispersión al moverse y retroceso.
- Bots con IA: patrullan, tienen campo de visión y línea de visión, tardan en reaccionar según la dificultad y su puntería empeora con la distancia.
- Rondas infinitas: cada 2 rondas hay un enemigo más (hasta 8) y cada 3, un aliado más (hasta 4). Pierdes la partida al perder N rondas (según la dificultad).
- HUD: mira dinámica, marcador de impacto, radar, registro de bajas y mira telescópica de la AWP.
- Reglas comunes (netlify/CLAUDE.md): 3D, avatares del Arcade, 4 dificultades, configuración común y pantalla completa.

## Ideas siguientes

- Más mapas «fy_» (fy_iceworld, fy_pool_day) que roten entre rondas.
- Granadas y compra de armas al inicio de cada ronda.
- Sonidos con distinto volumen según la distancia.
