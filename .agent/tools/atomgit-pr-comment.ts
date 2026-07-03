import { readFileSync } from "node:fs";

const API_BASE = process.env.ATOMGIT_API_BASE ?? "https://api.atomgit.com/api/v5";
const TOKEN = process.env.ATOMGIT_TOKEN ?? process.env.GITCODE_TOKEN ?? "";

type PrRef = {
  owner: string;
  repo: string;
  number: number;
};

function parsePrUrl(input: string): PrRef {
  const match = input.trim().match(
    /^https?:\/\/(?:www\.)?(?:atomgit\.com|gitcode\.com)\/([^/]+)\/([^/]+)\/(?:pull|pulls|merge_requests)\/(\d+)/,
  );

  if (!match) {
    throw new Error(`Invalid AtomGit/GitCode PR URL: ${input}`);
  }

  const [, owner, repo, number] = match;

  if (!owner || !repo || !number) {
    throw new Error(`Invalid AtomGit/GitCode PR URL: ${input}`);
  }

  return {
    owner: decodeURIComponent(owner),
    repo: decodeURIComponent(repo),
    number: Number(number),
  };
}

async function main(): Promise<void> {
  const [url, bodyFile, confirm] = process.argv.slice(2);

  if (!url || !bodyFile) {
    console.error("Usage: tsx .agent/tools/atomgit-pr-comment.ts <pr-url> <body-file> --confirm-post");
    process.exit(1);
  }

  if (confirm !== "--confirm-post") {
    console.error("Refuse to post without --confirm-post");
    process.exit(1);
  }

  if (!TOKEN) {
    throw new Error("ATOMGIT_TOKEN or GITCODE_TOKEN is required for posting comments.");
  }

  const ref = parsePrUrl(url);
  const body = readFileSync(bodyFile, "utf8");

  console.log("About to post AtomGit/GitCode PR comment:");
  console.log(`Repo: ${ref.owner}/${ref.repo}`);
  console.log(`PR: #${ref.number}`);
  console.log(`Body file: ${bodyFile}`);

  const endpoint = `${API_BASE}/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/pulls/${ref.number}/comments`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "agent-harness-kit/atomgit-pr-comment",
    },
    body: JSON.stringify({ body }),
  });

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}\n${await res.text()}`);
  }

  console.log(await res.text());
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
