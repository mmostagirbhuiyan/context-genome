import { spawn } from "node:child_process";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { buildGenerationPrompt, buildEditPrompt } from "./prompt.js";

export type Provider = "claude" | "codex" | "gemini";

/**
 * Generate a genome by shelling out to the user's LLM CLI.
 * No API keys needed — uses their existing CLI auth.
 */
export async function generateGenome(
  context: string,
  provider: Provider,
): Promise<string> {
  const prompt = buildGenerationPrompt(context);
  return callLLM(prompt, provider);
}

/**
 * Refine a genome with one editing pass.
 */
export async function editGenome(
  genome: string,
  originalContext: string,
  provider: Provider,
): Promise<string> {
  const prompt = buildEditPrompt(genome, originalContext);
  return callLLM(prompt, provider);
}

/**
 * Detect which LLM CLIs are available.
 */
export async function detectProvider(): Promise<Provider | null> {
  for (const provider of ["claude", "codex", "gemini"] as const) {
    if (await isAvailable(provider)) return provider;
  }
  return null;
}

async function isAvailable(cmd: string): Promise<boolean> {
  try {
    await execSimple("which", [cmd]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write prompt to temp file, then invoke the LLM CLI.
 *
 * - Claude: pipes file content to stdin (`claude -p` reads stdin)
 * - Codex/Gemini: prompt passed as arg via shell `$(cat tmpfile)` — the temp
 *   file path is controlled by us (random hex in /tmp), so no injection risk.
 *   This avoids OS ARG_MAX limits since the shell expands `$(cat)` internally.
 */
async function callLLM(prompt: string, provider: Provider): Promise<string> {
  const tmpFile = join(
    tmpdir(),
    `genome-${randomBytes(6).toString("hex")}.txt`,
  );
  await writeFile(tmpFile, prompt);

  try {
    switch (provider) {
      case "claude":
        // Pipe prompt via stdin — no shell needed
        return await execWithStdin(
          "claude",
          ["-p", "--model", "claude-sonnet-4-6", "--output-format", "text"],
          await readFile(tmpFile, "utf-8"),
        );
      case "codex":
        // Shell reads prompt from our controlled temp file
        return await execShell(
          `codex exec --full-auto -q "$(cat '${tmpFile}')"`,
        );
      case "gemini":
        return await execShell(
          `gemini --approval-mode yolo "$(cat '${tmpFile}')"`,
        );
    }
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

/**
 * Spawn a process with stdin piping. No shell involved.
 */
function execWithStdin(
  cmd: string,
  args: string[],
  stdin: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.CLAUDECODE;

    const proc = spawn(cmd, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(
          new Error(
            `${cmd} exited with code ${code}: ${(stderr || stdout).slice(0, 500)}`,
          ),
        );
      }
    });
    proc.on("error", (err) => {
      reject(new Error(`Failed to run ${cmd}: ${err.message}`));
    });

    proc.stdin.write(stdin);
    proc.stdin.end();
  });
}

/**
 * Execute a shell command. Used for Codex/Gemini where the prompt must
 * be a positional arg. The only interpolated value is our temp file path
 * (random hex in /tmp — no user-controlled content in the shell string).
 */
function execShell(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.CLAUDECODE;

    const proc = spawn("bash", ["-c", command], {
      stdio: ["pipe", "pipe", "pipe"],
      env,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(
          new Error(
            `command exited with code ${code}: ${(stderr || stdout).slice(0, 500)}`,
          ),
        );
      }
    });
    proc.on("error", reject);
  });
}

function execSimple(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.on("close", (code) =>
      code === 0 ? resolve(stdout.trim()) : reject(new Error(`exit ${code}`)),
    );
    proc.on("error", reject);
  });
}
