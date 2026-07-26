# ADR-0001 — Monorepo Architecture

## Estado

Aceptado

## Fecha

2026-07-19

---

# Contexto

CreatorOS será una plataforma SaaS compuesta por múltiples aplicaciones y paquetes compartidos.

Desde el inicio del proyecto se decidió utilizar una arquitectura basada en Monorepo para facilitar la reutilización de código, mantener consistencia entre aplicaciones y simplificar el desarrollo.

---

# Decisión

Se adopta la siguiente arquitectura:

```
apps/
packages/
docs/
```

Las aplicaciones vivirán dentro de `apps`.

Los componentes reutilizables, librerías y configuraciones compartidas vivirán dentro de `packages`.

Toda la documentación técnica vivirá dentro de `docs`.

---

# Principios

- Un único repositorio Git.
- Componentes reutilizables.
- Sin duplicación de código.
- Arquitectura modular.
- Escalabilidad horizontal.
- Internacionalización desde el inicio.
- AI First.

---

# Beneficios

- Mejor mantenimiento.
- Reutilización de componentes.
- Builds más rápidos con Turborepo.
- Versionado unificado.
- Escalabilidad para múltiples productos.

---

# Consecuencias

Todo componente reutilizable deberá desarrollarse dentro de `packages`.

Las aplicaciones consumirán dichos componentes.

No se permitirá duplicar componentes entre aplicaciones.

---

# Aprobado por

Junior Perez

Proyecto CreatorOS