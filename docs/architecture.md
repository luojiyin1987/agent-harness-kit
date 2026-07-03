# Architecture

`agent-harness-kit` is organized around a small but extensible harness pattern:

```text
provider API / CLI
  -> reader tool
  -> normalized context
  -> agent skill / command
  -> review draft
  -> guarded writer tool
```

## AtomGit PR reader

The first provider adapter is AtomGit/GitCode PR reading.

The reader calls these AtomGit API v5 endpoints:

```text
GET /api/v5/repos/:owner/:repo/pulls/:number
GET /api/v5/repos/:owner/:repo/pulls/:number/files
GET /api/v5/repos/:owner/:repo/pulls/:number/comments
GET /api/v5/repos/:owner/:repo/pulls/:number/commits
```

The output is normalized into:

```text
context.json      # structured data
review-input.md  # agent-readable review context
```

## Reviewer skill

The reviewer skill consumes `review-input.md` and asks the agent to produce:

- PR summary
- key changes
- risk points
- files worth deeper review
- review comment draft
- merge recommendation

## Writer tool

The comment writer is separate from the reader and requires:

```bash
--confirm-post
```

This keeps externally visible actions out of the default review flow.

## Future provider interface

A future provider abstraction can standardize this shape:

```ts
export interface PullRequestProvider {
  getPullRequest(ref: PullRequestRef): Promise<unknown>;
  getPullRequestFiles(ref: PullRequestRef): Promise<unknown[]>;
  getPullRequestComments(ref: PullRequestRef): Promise<unknown[]>;
  getPullRequestCommits(ref: PullRequestRef): Promise<unknown[]>;
}
```

Then GitHub, GitLab, Gitea, AtomGit, and other code forges can share the same agent-facing review workflow.
