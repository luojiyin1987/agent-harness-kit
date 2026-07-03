# AtomGit PR Reviewer

Use this skill when the user provides an AtomGit or GitCode pull request URL and asks for a PR summary, diff analysis, or review comment draft.

## Default safety policy

- Read-only by default.
- Do not post comments automatically.
- Do not merge, close, label, assign, or otherwise mutate PR state.
- Before any write action, show the target repository, PR number, and exact content to be posted.
- Only post when the user explicitly confirms.

## Workflow

1. Parse the PR URL.
2. Run:

   ```bash
   pnpm atomgit:pr:read <PR_URL>
   ```

3. Read the generated `review-input.md` under:

   ```text
   .agent/cache/atomgit/<owner>__<repo>__pr-<number>/review-input.md
   ```

4. Produce:

   - PR summary
   - key changes
   - risk points
   - files worth deeper review
   - concrete review comment draft
   - merge recommendation: can merge / needs changes / insufficient information

5. Keep review comments actionable and specific.

## Output format

```markdown
## PR Summary

## Key Changes

## Risks

## Files Worth Reviewing

## Suggested Review Comment

## Merge Recommendation
```

## Posting comments

Posting is intentionally not part of the default review flow.

Only after explicit user confirmation, use:

```bash
pnpm atomgit:pr:comment <PR_URL> review-comment.md --confirm-post
```
