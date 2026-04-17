# Agent Skill Registry

**Project**: BlendPadel
**Last Updated**: Tue Apr 14 2026

## Core Development Patterns
*Extracted from CLAUDE.md / AGENTS.md*

- **Architecture**: Domain-driven (backend), feature folders (mobile/admin).
- **Go Conventions**: `snake_case` files, `camelCase` vars, no globals, constructor injection.
- **Frontend Conventions**: `kebab-case` files, React Native with Expo, TailwindCSS/NativeWind.
- **Error Handling**: RFC 7807 (Problem Details) in Backend. Toast notifications in Frontend. Wrap errors in Go (`fmt.Errorf`).
- **Testing**: `go test` + `testify` + `testcontainers` (PostgreSQL). STRICT TDD for Core Domain (ELO, Trust Score).
- **Security**: JWT Auth (HS256), rate limiting in-memory, no Redis for MVP.
- **Agent Guidelines**: Direct, warm, passionate teacher persona. Explain WHY, not just WHAT. Use Spanish (voseo) if requested.

## Available Skills

| Skill | Trigger | Source |
|-------|---------|--------|
| `docker-expert` | Container optimization, multi-stage builds, orchestration. | Project |
| `frontend-design` | Building web components, React/HTML/CSS, UI/UX. | Project |
| `golang-pro` | Concurrent Go, microservices, gRPC, CLI tools, optimizations. | Project |
| `golang-testing` | Go testing patterns, subtests, TDD methodology. | Project |
| `ui-ux-pro-max` | UI/UX design intelligence, layouts, shadcn. | User |
| `go-testing` | Go testing patterns, Bubbletea TUI. | User |
| `skill-creator` | Creating new AI agent skills. | User |
| `skill-registry` | Updating/creating this file. | User |
| `sdd-*` | Spec-Driven Development workflows. | User |

## Engram Protocol
Mandatory saving for architecture decisions, bug fixes, patterns. Use `mem_session_summary` on completion.