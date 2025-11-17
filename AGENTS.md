# Repository Guidelines

This document is for contributors (human and AI) working on **QuiverDM**. Follow these guidelines for any changes under this repository.

## Project Structure & Module Organization

- Application code lives under `src/` (for example `src/QuiverDM/`).
- Automated tests live under `tests/` (for example `tests/QuiverDM.Tests/`).
- Configuration, CI, and scripts live under `config/` and `scripts/` when present.
- Keep new files aligned with this separation: runtime code in `src/`, test-only helpers in `tests/`.

## Build, Test, and Development Commands

- `dotnet build` – compile the solution and validate dependencies.
- `dotnet test` – run the full test suite.
- `dotnet run --project src/QuiverDM` – run the main application locally (adjust project path as needed).
- Prefer adding new tooling (linters, generators) as `dotnet` or script commands rather than ad‑hoc one‑offs.

## Coding Style & Naming Conventions

- Use the existing style in nearby files as the source of truth.
- Default to 4‑space indentation, no tabs.
- C# namespaces and classes: `PascalCase`; methods and properties: `PascalCase`; local variables and parameters: `camelCase`.
- File names should match the primary type (e.g., `UserRepository.cs`).
- Run any available formatters or analyzers (for example `dotnet format`) before opening a PR.

## Testing Guidelines

- Add or update tests in the corresponding project under `tests/`.
- Mirror the namespace and folder structure of `src/` (e.g., `src/QuiverDM/Services` → `tests/QuiverDM.Tests/Services`).
- Name test methods descriptively, e.g., `MethodName_WhenCondition_ShouldOutcome`.
- Ensure `dotnet test` passes locally before submitting changes.

## Commit & Pull Request Guidelines

- Write clear, imperative commit messages, e.g., `Add user validation to onboarding`.
- Keep commits logically scoped; avoid mixing unrelated changes.
- For PRs, include:
  - A short summary of the change and rationale.
  - Links to related issues or tickets.
  - Screenshots or logs for UI or behavior changes where applicable.

