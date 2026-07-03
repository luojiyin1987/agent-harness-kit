# atomgit-pr-review

Input: an AtomGit or GitCode pull request URL.

## Steps

1. Run:

   ```bash
   pnpm atomgit:pr:read "$ARGUMENTS"
   ```

2. Locate the generated review context:

   ```text
   .agent/cache/atomgit/<owner>__<repo>__pr-<number>/review-input.md
   ```

3. Review the PR using the generated context.

4. Output:

   - PR summary
   - key changes
   - risk points
   - files worth deeper review
   - review comment draft
   - merge recommendation

5. Do not post a comment unless the user explicitly confirms.

## Safety

Never run `atomgit:pr:comment` without a second confirmation from the user.
