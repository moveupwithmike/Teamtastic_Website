# Gemini & Antigravity Agent Guidelines

This document provides specialized guidelines for Gemini (Antigravity) instances when modifying code, executing tasks, or orchestrating agents in this repository.

---

## 1. Tool-Specific Guidelines

Antigravity equips Gemini with advanced agentic tools. When performing tasks:

- **Timer & Scheduling**: Use the `schedule` tool for scheduling background notifications, cron triggers, or wait intervals. Do not execute shell commands containing `sleep` (e.g. `sleep 300`) as this blocks synchronous execution and wastes sandbox resources.
- **Subagent Delegation**: Leverage `invoke_subagent` to spawn specialized agents for research (using the `research` subagent) or parallel tasks. Avoid spawning too many descendants; reuse idle subagents by sending messages using `send_message`.
- **Markdown & File Linking**: Always generate clickable links for all code symbols (classes, types, functions) and files modified or referenced. Use the `file:///` URI scheme format (e.g. `[AGENTS.md](file:///absolute/path/to/docs/governance/AGENTS.md)`).

---

## 2. Coding Conventions & Sandbox Safety

- **Try Sandbox First**: Execute command operations (e.g., database test executions, code compiling) in standard sandbox mode first.
- **Incremental Verification**: When running tests, check both Next.js vitest suites (`npm run test`) and Deno Edge Function tests (`npm run test:edge`) to verify full subsystem health.
- **Avoid Key Commits**: Never write plain text API keys (e.g. Stripe, Apollo, or Resend keys) into files. If keys are required for testing, configure them locally via `.env.local` (which is gitignored).

---

## 3. Workflow Steps

When executing complex changes:
1. **Research**: Check existing schemas and API endpoints under `docs/technical/architecture/` before creating new ones.
2. **Task Tracking**: Document steps in a custom `task.md` inside your session artifact folder to trace progress.
3. **Lint & Test**: Run `npm run check` synchronously to ensure that documentation reorganizations, links, or code updates have not broken repository syntax.
