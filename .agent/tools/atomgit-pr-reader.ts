import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const API_BASE = process.env.ATOMGIT_API_BASE ?? "https://api.atomgit.com/api/v5";
const TOKEN = process.env.ATOMGIT_TOKEN ?? process.env.GITCODE_TOKEN ?? "";
const MAX_PATCH_CHARS = Number(process.env.ATOMGIT_MAX_PATCH_CHARS ?? 20_000);

type PrRef = {
  owner: string;
  repo: string;
  number: number;
  url: string;
};

type NormalizedFile = {
  path: string;
  oldPath?: string;
  status?: string;
  additions?: number;
  deletions?: number;
  patch: string;
};

type NormalizedCommit = {
  sha: string;
  message: string;
  author: string;
};

type NormalizedComment = {
  id: string;
  author: string;
  body: string;
  path: string;
  position: string;
  createdAt: string;
};

function parsePrUrl(input: string): PrRef {
  const url = input.trim();
  const match = url.match(
    /^https?:\/\/(?:www\.)?(?:atomgit\.com|gitcode\.com)\/([^/]+)\/([^/]+)\/(?:pull|pulls|merge_requests)\/(\d+)/,
  );

  if (!match) {
    throw new Error(`Invalid AtomGit/GitCode PR URL: ${url}`);
  }

  const [, owner, repo, number] = match;

  if (!owner || !repo || !number) {
    throw new Error(`Invalid AtomGit/GitCode PR URL: ${url}`);
  }

  return {
    owner: decodeURIComponent(owner),
    repo: decodeURIComponent(repo),
    number: Number(number),
    url,
  };
}

async function apiGet<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "agent-harness-kit/atomgit-pr-reader",
  };

  if (TOKEN) {
    headers.Authorization = `Bearer ${TOKEN}`;
  }

  const endpoint = `${API_BASE}${path}`;
  const res = await fetch(endpoint, { headers });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET ${endpoint} failed: ${res.status} ${res.statusText}\n${body}`);
  }

  return res.json() as Promise<T>;
}

function asArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["data", "files", "comments", "commits", "list", "items"]) {
      const value = record[key];
      if (Array.isArray(value)) return value;
    }
  }

  return payload ? [payload] : [];
}

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";
  return String(value);
}

function numberOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function field(record: unknown, keys: string[]): unknown {
  if (!record || typeof record !== "object") return undefined;
  const obj = record as Record<string, unknown>;
  for (const key of keys) {
    if (obj[key] !== undefined) return obj[key];
  }
  return undefined;
}

function compactPatch(value: unknown): string {
  const patch = text(value);
  if (patch.length <= MAX_PATCH_CHARS) return patch;
  return `${patch.slice(0, MAX_PATCH_CHARS)}\n\n...[patch truncated]...`;
}

function normalizeFile(raw: unknown): NormalizedFile {
  const file = raw as Record<string, unknown>;
  return {
    path: text(field(file, ["filename", "new_path", "path", "file_path", "name"])) || "unknown",
    oldPath: text(field(file, ["old_path", "previous_filename"])) || undefined,
    status: text(field(file, ["status", "state", "change_type"])) || undefined,
    additions: numberOrUndefined(field(file, ["additions", "added_lines", "total_added_lines"])),
    deletions: numberOrUndefined(field(file, ["deletions", "removed_lines", "total_removed_lines"])),
    patch: compactPatch(field(file, ["patch", "diff", "content", "raw_diff"])),
  };
}

function normalizeCommit(raw: unknown): NormalizedCommit {
  const commit = raw as Record<string, unknown>;
  const nested = field(commit, ["commit"]);
  const author = field(commit, ["author"]);
  const nestedAuthor = field(nested, ["author"]);

  return {
    sha: text(field(commit, ["sha", "id", "commit_id"])),
    message: text(field(commit, ["message", "title"])) || text(field(nested, ["message"])),
    author:
      text(field(author, ["name", "login"])) ||
      text(field(nestedAuthor, ["name", "login"])) ||
      text(field(commit, ["author_name"])),
  };
}

function normalizeComment(raw: unknown): NormalizedComment {
  const comment = raw as Record<string, unknown>;
  const user = field(comment, ["user"]);
  const author = field(comment, ["author"]);

  return {
    id: text(field(comment, ["id", "comment_id"])),
    author:
      text(field(user, ["login", "name"])) ||
      text(field(author, ["login", "name"])) ||
      text(author),
    body: text(field(comment, ["body", "content", "note"])),
    path: text(field(comment, ["path", "file_path"])),
    position: text(field(comment, ["position", "line"])),
    createdAt: text(field(comment, ["created_at", "createdAt"])),
  };
}

function renderReviewInput(context: {
  ref: PrRef;
  pr: Record<string, unknown>;
  files: NormalizedFile[];
  comments: NormalizedComment[];
  commits: NormalizedCommit[];
}): string {
  const { ref, pr, files, comments, commits } = context;
  const user = field(pr, ["user"]);
  const author = field(pr, ["author"]);
  const head = field(pr, ["head"]);
  const base = field(pr, ["base"]);

  const title = text(field(pr, ["title", "name"]));
  const state = text(field(pr, ["state", "status"]));
  const authorName = text(field(user, ["login", "name"])) || text(field(author, ["login", "name"]));
  const sourceBranch = text(field(head, ["ref"])) || text(field(pr, ["source_branch", "head_branch"]));
  const targetBranch = text(field(base, ["ref"])) || text(field(pr, ["target_branch", "base_branch"]));
  const description = text(field(pr, ["body", "description"]));

  const commitList = commits.length
    ? commits
        .map((commit) => {
          const sha = commit.sha ? commit.sha.slice(0, 12) : "";
          const titleLine = commit.message.split("\n")[0] ?? "";
          return `- ${sha} ${titleLine}${commit.author ? ` — ${commit.author}` : ""}`.trim();
        })
        .join("\n")
    : "_No commits fetched._";

  const fileList = files.length
    ? files
        .map((file) => {
          const stats = file.additions !== undefined || file.deletions !== undefined
            ? ` (+${file.additions ?? "?"}/-${file.deletions ?? "?"})`
            : "";
          return `- ${file.path}${file.status ? ` [${file.status}]` : ""}${stats}`;
        })
        .join("\n")
    : "_No files fetched._";

  const commentList = comments.length
    ? comments
        .map((comment) => {
          const location = comment.path ? `File: ${comment.path}${comment.position ? `:${comment.position}` : ""}\n` : "";
          return `### Comment ${comment.id}${comment.author ? ` by ${comment.author}` : ""}\n\n${location}${comment.body}`;
        })
        .join("\n\n")
    : "_No existing comments fetched._";

  const diffs = files.length
    ? files
        .map((file) => `### ${file.path}\n\n\`\`\`diff\n${file.patch || "[no patch body returned by API]"}\n\`\`\``)
        .join("\n\n")
    : "_No diffs fetched._";

  return `# AtomGit PR Review Context

## PR

- URL: ${ref.url}
- Repo: ${ref.owner}/${ref.repo}
- PR: #${ref.number}
- Title: ${title}
- State: ${state}
- Author: ${authorName}
- Source branch: ${sourceBranch}
- Target branch: ${targetBranch}

## Description

${description || "_No description._"}

## Commits

${commitList}

## Changed Files

${fileList}

## Existing Comments

${commentList}

## Diffs

${diffs}

## Review Instruction

请基于上面的 PR 信息输出：

1. PR 摘要
2. 关键改动
3. 潜在风险
4. 需要重点 review 的文件
5. 具体 review comment 草稿
6. 是否建议合并：可以合并 / 需要修改 / 信息不足

默认只生成草稿，不要发布评论。
`;
}

async function main(): Promise<void> {
  const input = process.argv[2];

  if (!input) {
    console.error("Usage: tsx .agent/tools/atomgit-pr-reader.ts <atomgit-pr-url>");
    process.exit(1);
  }

  const ref = parsePrUrl(input);
  const prefix = `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/pulls/${ref.number}`;

  const [pr, filesPayload, commentsPayload, commitsPayload] = await Promise.all([
    apiGet<Record<string, unknown>>(prefix),
    apiGet<unknown>(`${prefix}/files`),
    apiGet<unknown>(`${prefix}/comments`),
    apiGet<unknown>(`${prefix}/commits`),
  ]);

  const context = {
    fetchedAt: new Date().toISOString(),
    ref,
    pr,
    files: asArray(filesPayload).map(normalizeFile),
    comments: asArray(commentsPayload).map(normalizeComment),
    commits: asArray(commitsPayload).map(normalizeCommit),
  };

  const outDir = join(".agent", "cache", "atomgit", `${ref.owner}__${ref.repo}__pr-${ref.number}`);
  mkdirSync(outDir, { recursive: true });

  writeFileSync(join(outDir, "context.json"), JSON.stringify(context, null, 2));
  writeFileSync(join(outDir, "review-input.md"), renderReviewInput(context));

  console.log(`Wrote ${join(outDir, "context.json")}`);
  console.log(`Wrote ${join(outDir, "review-input.md")}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
