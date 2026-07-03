# agent-harness-kit

A portable harness kit for building repository-aware agents with skills, commands, API adapters, and review workflows.

This repository starts with an AtomGit/GitCode pull request reader and reviewer flow. The goal is to make public AtomGit PRs easier for coding agents to inspect, summarize, and review in a way that feels close to GitHub PR review workflows.

## Current modules

```text
.agent/
  tools/
    atomgit-pr-reader.ts      # read PR metadata, changed files, comments, commits
    atomgit-pr-comment.ts     # optional write action, requires explicit confirmation
  skills/
    atomgit-pr-reviewer/
      SKILL.md                # skill contract for agent tools
  commands/
    atomgit-pr-review.md      # command wrapper for PR review

docs/
  atomgit-openapi-action.yaml # Custom GPT Action schema, read-only
  architecture.md             # design notes
```

## Safety model

Default behavior is read-only.

Write operations such as posting comments must be separate from PR reading/reviewing and must require an explicit confirmation flag:

```bash
--confirm-post
```

This matches the expected Agent harness behavior: dangerous or externally visible actions require a second confirmation.

## Install

```bash
pnpm install
```

## Read an AtomGit/GitCode PR

```bash
pnpm atomgit:pr:read https://atomgit.com/OWNER/REPO/pull/123
```

For public PRs, a token may not be required. If the API returns `401`, set a token:

```bash
export ATOMGIT_TOKEN="your-token"
# or
export GITCODE_TOKEN="your-token"
```

The reader writes:

```text
.agent/cache/atomgit/<owner>__<repo>__pr-<number>/context.json
.agent/cache/atomgit/<owner>__<repo>__pr-<number>/review-input.md
```

Feed `review-input.md` to a coding agent to produce:

- PR summary
- key changes
- risk points
- files worth deeper review
- review comment draft
- merge recommendation

## Post a PR comment

Posting comments is intentionally separate and disabled unless explicitly confirmed:

```bash
pnpm atomgit:pr:comment \
  https://atomgit.com/OWNER/REPO/pull/123 \
  review-comment.md \
  --confirm-post
```

## Environment variables

```bash
ATOMGIT_API_BASE=https://api.atomgit.com/api/v5
ATOMGIT_TOKEN=...
GITCODE_TOKEN=...
ATOMGIT_MAX_PATCH_CHARS=20000
```

## Roadmap

- [x] AtomGit PR reader
- [x] AtomGit PR reviewer skill contract
- [x] Custom GPT Action schema for read-only PR access
- [ ] MCP server adapter
- [ ] GitHub-compatible provider interface
- [ ] Issue triage workflow
- [ ] PR review test fixtures
