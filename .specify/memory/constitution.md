<!--
=============================================================================
SYNC IMPACT REPORT - Constitution Update
=============================================================================
Version Change: Template → 1.0.0 (Initial ratification)

New Principles:
  1. Code Quality & Type Safety
  2. Testing Standards
  3. User Experience Consistency
  4. Performance Requirements

New Sections:
  - Quality Gates & Automation
  - Development Standards
  - Governance (formalized)

Templates Status:
  ✅ plan-template.md - Constitution Check section references this file
  ✅ spec-template.md - Requirements and success criteria align with principles
  ✅ tasks-template.md - Testing discipline and structure align with principles
  ⚠️  checklist-template.md - Generic, no updates required
  ⚠️  agent-file-template.md - Generic, no updates required

Follow-up Actions:
  - None. All placeholders filled.
  - Version 1.0.0 represents initial constitution ratification.
=============================================================================
-->

# Issue-Ops Constitution

## Core Principles

### I. Code Quality & Type Safety

TypeScript MUST be used with strict mode enabled for all source code. All functions, parameters, and return types MUST be explicitly typed—`any` type is prohibited except when wrapping untyped third-party APIs, and such cases MUST include a justification comment. Code MUST pass linting (ESLint) and formatting (Prettier) checks without warnings before merge. No warnings or unused imports are permitted.

**Rationale**: Type safety prevents entire classes of runtime errors, improves IDE support, and serves as living documentation. Enforcing explicit types catches bugs at compile time and makes refactoring safer.

### II. Testing Standards

All new features MUST include automated tests using the existing AVA test framework. Tests MUST achieve minimum 80% code coverage for new code. Tests MUST be organized into three categories: unit tests (isolated logic), integration tests (component interaction), and contract tests (external API boundaries). Each test MUST follow the Given-When-Then pattern and have a clear, descriptive name explaining what is being tested.

**Rationale**: Comprehensive testing prevents regressions, documents expected behavior, and enables confident refactoring. The three-tier testing strategy ensures both isolation and real-world interaction validation.

### III. User Experience Consistency

All CLI outputs MUST follow consistent formatting: structured data to stdout, errors to stderr. Error messages MUST be actionable (tell the user what to do next) and include relevant context. Success operations MUST produce clear confirmation messages. All async operations taking longer than 2 seconds MUST provide progress indicators or feedback.

**Rationale**: Consistent, clear interfaces reduce cognitive load, make automation easier, and improve user confidence. Actionable errors reduce support burden and user frustration.

### IV. Performance Requirements

All GitHub API operations MUST implement retry logic with exponential backoff to handle rate limits gracefully. Database queries MUST use connection pooling and parameterized queries to prevent injection vulnerabilities. The CLI MUST start and respond to `--help` in under 1 second. Batch operations processing >100 items MUST provide progress feedback and support cancellation.

**Rationale**: Reliability under real-world conditions (rate limits, network issues) is non-negotiable for production tools. Performance requirements ensure the tool remains responsive and doesn't frustrate users.

## Quality Gates & Automation

All code changes MUST pass the following automated gates before merge:

- **Type Checking**: `pnpm check` (TypeScript compilation) exits 0
- **Linting**: `pnpm lint` (ESLint) reports 0 errors and 0 warnings
- **Formatting**: `pnpm format` (Prettier) produces no changes
- **Testing**: `pnpm test` (AVA + c8 coverage) passes all tests with ≥80% coverage for new code
- **Build**: `pnpm build` completes successfully, producing valid artifacts in `lib/`

Tests MUST be meaningful—no empty test files or placeholder tests that always pass. Coverage requirements apply only to new code, not to legacy code being preserved.

## Development Standards

**Repository Structure**: Source files live in `src/`, compiled output in `lib/`, tests in `test/` mirroring `src/` structure. All exports go through `src/main.ts` as the single public API entry point.

**Dependency Management**: Production dependencies MUST be pinned to specific versions. New dependencies MUST be justified in PR descriptions. Unused dependencies MUST be removed immediately.

**Documentation**: All exported functions MUST include TSDoc comments explaining purpose, parameters, return values, and example usage. README.md MUST be kept current with accurate usage examples and API references.

**Error Handling**: All errors MUST be properly typed using custom error classes extending `Error`. Async functions MUST handle rejections explicitly. Network errors MUST include retry context in error messages.

**Git Workflow**: Commits MUST follow conventional commit format (`feat:`, `fix:`, `docs:`, `chore:`, etc.). Each commit MUST represent a single logical change. PRs MUST reference related issues.

## Governance

This constitution supersedes all other development practices and guidelines. All pull requests MUST be reviewed for compliance with these principles before merge. Any deviation from constitution principles MUST be explicitly justified in PR descriptions and approved by a maintainer.

**Amendment Process**: Constitution changes require documentation of rationale, impact analysis on existing code, and migration plan if applicable. Version bumps follow semantic versioning: MAJOR for breaking principle changes, MINOR for new principles, PATCH for clarifications.

**Complexity Justification**: Any architectural complexity not directly required by user scenarios MUST be justified against simpler alternatives. Premature optimization is discouraged—start simple and evolve based on measured needs.

**Enforcement**: Automated CI checks enforce technical standards (types, linting, tests). Human review enforces architectural principles and UX consistency. Non-compliance blocks merge.

**Version**: 1.0.0 | **Ratified**: 2025-12-31 | **Last Amended**: 2025-12-31
