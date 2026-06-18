# Claude Code Agent Rules

You are acting within the `agent-team-config` framework. Please adhere to the following principles defined for this repository:

1. **Check Progress**: Always read `progress.md` before starting to understand the current task list and context.
2. **Mailbox Coordination**: Check `.mailbox/` for any pending messages directed to you. Wait for user input if conflicting instructions are found.
3. **Roles and Workflows**: Depending on your exact assignment, rely on `.agents/prompts/` and `.agents/workflows/` for specialized instructions (e.g. executing `/dev`, `/deploy-verify`, etc.).
4. **No Secrets**: Never hardcode API keys or secrets in logs or code.
5. **No Scope Reduction**: Do not silently reduce the scope of the task if you find it complex. Stop and ask the user.
6. **Verify First**: Verify changes via tests or building before declaring a task done. Use checklist conventions in `progress.md` where applicable.
7. **Delegation Gate（默认启动子代理）**: 实现、修复、测试、部署、重构、PR/MR、任务自动化等行动型请求都视为任务，必须先做 Delegation Decision，再改文件。默认主进程拆解，子代理执行或独立验证，主进程最终审查裁决；中/高风险、多文件、多 subsystem、架构/API/数据/状态机/迁移/安全/权限/计费/生产配置、根因不明、不熟悉区域、UI/E2E 行为、需要外部核验或需要审查自己完成声明时，使用 explorer → executor → verifier → orchestrator PASS/FAIL。低风险单文件且验收清楚的任务可由主进程直接实现，但完成前仍必须派发独立 verifier；完全跳过子代理只允许纯解释/只读/简单命令/格式化/纯文档，并必须记录 `safe_skip_reason`。子代理模型按当前 runtime 可用性选择：Codex runtime 默认 `gpt-5.3-codex`；Claude Code runtime 使用当前可用或项目配置的 Claude 模型，不要硬填 Codex-only 模型；只有高风险仲裁、生产/安全/数据/不可逆决策或 reviewer 分歧才升级到对应 runtime 的最高推理模型，并记录 `escalation_reason`。Design deliverables should go through `/design-review`; when `.agents/goal-forge/` exists and a sibling `goal-forge` checkout is available, use `agent-team goal-forge init . "<goal>"` and record `goal_forge.run_dir` in the Task Contract.

## Task Automation

- Task Ledger (`tasks.md`) is the execution source; re-read it and `.mailbox/` after completing or blocking any task.
- Claim only one task at a time. Update `progress.md` for every claim, block, or completion.
- Before execution, form a Task Contract with goal, non-goals, acceptance criteria, required skills, and verification plan.
- Stack/Deployment/Database Profile required when task involves technology stack, hosting, or persistence choices. Use recommended fallbacks only for greenfield projects.

## Skills and Conventions

- Load relevant skills from `~/.agent-team-config/references/skills/` or project-level `.agents/` before implementation.
- Use `stack-profile-selector` for stack decisions, `deployment-target-selector` for hosting, `database-profile-selector` for persistence.
- Follow existing project patterns, framework conventions, and testing practices.

## Safety

- Never use `git push -f` or `rm -rf /`.
- Confirm before destructive git operations, production deploys, or remote write commands.
- State management files are in `.agents/state/`.
