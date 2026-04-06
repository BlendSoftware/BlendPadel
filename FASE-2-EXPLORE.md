# BlendPadel — Fase 2: Prompt para /opsx:explore

> Copiar y pegar este prompt en la próxima sesión de Claude Code.

```
/opsx:explore

Fase 2 de BlendPadel. El MVP está completo (backend Go 44 endpoints + PWA React 4 tabs + 
ELO + Trust Score + Rankings por zona + Matchmaking). Ahora necesito evolucionar el producto.

Quiero explorar estas 7 features antes de implementar:

## 1. Partidos Mixtos
- Soporte para partidos masculinos, femeninos y mixtos
- ¿Cómo afecta el ELO? ¿Rankings separados por género? ¿ELO mixto aparte?
- Campo de género en el perfil (masculino/femenino/otro)
- Filtros en matchmaking por tipo de partido

## 2. Cancelación de Partidos con Penalización
- Endpoint para cancelar un partido
- Si cancelás con menos de 3 horas → Trust Score baja (como la cancelación tardía)
- Si cancelás con más de 3 horas → sin penalización
- Notificar a los demás jugadores del partido cancelado
- ¿Qué pasa con el partido? ¿Se elimina o queda como "cancelled"?

## 3. Asignación de Pareja Fija
- Poder designar tu compañero habitual de dobles
- Relación bidireccional (ambos deben aceptar)
- Cuando creás un partido o flare, se pre-asigna tu pareja
- ¿Un jugador puede tener múltiples parejas? ¿O solo una activa?

## 4. Métricas de Pareja
- Win rate jugando juntos vs jugando con otros
- ELO combinado de la dupla
- Historial de partidos como pareja
- "Mejor pareja" — con quién tenés mejor porcentaje
- Comparar rendimiento individual vs en dupla

## 5. Red Social del Pádel
- Feed de actividad: "Franco subió a 5ta", "Rami ganó 3 partidos seguidos"
- Seguir jugadores (follow)
- Reacciones en resultados (like, comentar)
- Muro de actividad en el perfil
- ¿Esto es core o es un nice-to-have? ¿Cuánto agrega a la retención?

## 6. Mapa de Canchas Reales
- Reemplazar el radar de partidos con un mapa de CANCHAS de pádel reales
- Cada cancha: nombre, dirección, coordenadas, cantidad de canchas, horarios
- Los partidos se asocian a una cancha
- ¿Quién carga las canchas? ¿Admin? ¿Los usuarios? ¿Scraping?
- Integración con Google Maps o datos propios

## 7. Ranking por Género
- Rankings masculino y femenino separados
- ¿El ELO es unificado o separado por género?
- ¿Qué pasa en partidos mixtos? ¿Cuenta para ambos rankings?
- Campo de género obligatorio en onboarding

---

Para cada feature necesito:
1. ¿Es viable para un equipo de 1 orquestador + Claude?
2. ¿Qué cambia en el backend (tablas, endpoints)?
3. ¿Qué cambia en el frontend?
4. ¿Cuál es la prioridad? (impacto en retención vs esfuerzo)
5. ¿Cuáles se pueden hacer en paralelo?
6. Proponé un orden de EPICs con dependencias
```
