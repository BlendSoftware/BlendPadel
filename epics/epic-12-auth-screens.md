# EPIC 12 — Auth Screens

> **Sprint**: 5
> **Prioridad**: Alta
> **Dependencias**: EPIC 11
> **Historias**: FE-007 a FE-012

---

## Objetivo

Implementar las pantallas de autenticación: login, registro, onboarding (cuestionario de 5 pasos), y el flujo de cambio de contraseña. Al terminar esta EPIC, un usuario puede registrarse, completar el onboarding anti-humo, ver su ELO asignado, y loguearse.

## Contexto

El flujo de auth es lo primero que ve el usuario. Registro → Login → Onboarding obligatorio → recién ahí accede a las tabs. El onboarding es un cuestionario de 5 preguntas que NO permite elegir categoría — el sistema asigna el ELO.

## Historias de Usuario

### FE-007: Pantalla de Login
- Email + password inputs
- Botón "Iniciar Sesión"
- Link a registro
- Manejo de errores: credenciales inválidas (401), rate limiting (429)
- Loading state en el botón
- Llamar POST /auth/login → guardar tokens en auth store

### FE-008: Pantalla de Registro
- Email, nombre, password, confirmar password
- Validación client-side (email formato, password min 8 chars, 1 mayúscula, 1 número)
- Manejo errores: email duplicado (409), password débil (422)
- POST /auth/register → navegar a login (no auto-login)

### FE-009: Pantalla de Onboarding — Cuestionario (5 pasos)
- Step 1: Frecuencia de juego (nunca, rara_vez, 1_2_sem, 3_mas_sem)
- Step 2: Torneos (nunca, amateur, federado)
- Step 3: Tipo de paleta (iniciacion, intermedia, avanzada)
- Step 4: Autoevaluación (principiante, intermedio, avanzado, competitivo)
- Step 5: Años jugando (number input)
- Progress bar arriba
- Botón "Siguiente" en cada paso, "Enviar" en el último
- POST /onboarding/questionnaire → mostrar ELO asignado con animación

### FE-010: Pantalla de Resultado de Onboarding
- Mostrar ELO asignado con animación (número que sube)
- Mensaje: "Tu nivel inicial es {ELO}. En tus primeros partidos, el sistema te va a ajustar rápido."
- Botón "Empezar a jugar" → navegar a Main Tabs
- Estado de calibración visible

### FE-011: Flujo de Cambio de Contraseña
- Accesible desde perfil (Tab 4)
- Inputs: contraseña actual, nueva contraseña, confirmar
- PUT /auth/password
- Éxito → logout automático (tokens revocados) → navegar a login

### FE-012: Protección de rutas y redirección
- Si usuario no completó onboarding → redirigir al cuestionario
- Si token expiró y refresh falla → redirigir a login
- Deep link handling básico

## Enfoque Técnico

### Estructura
```
src/features/auth/
├── screens/
│   ├── LoginScreen.tsx
│   ├── RegisterScreen.tsx
│   ├── OnboardingScreen.tsx      # Multi-step form
│   ├── OnboardingResultScreen.tsx
│   └── ChangePasswordScreen.tsx
├── components/
│   ├── OnboardingStep.tsx
│   ├── OnboardingProgress.tsx
│   └── ELORevealAnimation.tsx
└── hooks/
    └── useOnboarding.ts          # State for multi-step form
```

## Testing

- Jest: snapshot tests de cada pantalla
- Verificar flujo completo: register → login → onboarding → ver ELO → tabs

## Definition of Done

- [ ] Login funciona contra el backend real
- [ ] Registro con validación client + server
- [ ] Onboarding 5 pasos con progress bar
- [ ] ELO reveal con animación
- [ ] Cambio de contraseña con logout automático
- [ ] Redirección correcta según estado del usuario
