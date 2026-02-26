import { spawn } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
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

async function callLLM(prompt: string, provider: Provider): Promise<string> {
  // Write prompt to temp file — prompts can be 80KB+
  const tmpFile = join(
    tmpdir(),
    `genome-${randomBytes(6).toString("hex")}.txt`,
  );
  await writeFile(tmpFile, prompt);

  try {
    switch (provider) {
      case "claude":
        return await execLLM(
          "claude",
          ["-p", "--model", "claude-sonnet-4-6"],
          tmpFile,
        );
      case "codex":
        return await execLLM("codex", ["exec", "--full-auto"], tmpFile);
      case "gemini":
        return await execLLM(
          "gemini",
          ["--approval-mode", "yolo"],
          tmpFile,
        );
    }
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

/**
 * Execute an LLM CLI with the prompt read from a temp file.
 * For Claude: pipes the file content to stdin (claude -p reads stdin).
 * For Codex/Gemini: passes file content as the last argument via shell.
 */
function execLLM(
  cmd: string,
  args: string[],
  promptFile: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    // Allow running Claude CLI from within a Claude Code session
    delete env.CLAUDECODE;

    let proc;

    if (cmd === "claude") {
      // Claude -p reads the prompt from stdin when no prompt arg is given
      proc = spawn("bash", ["-c", `cat "${promptFile}" | ${cmd} ${args.join(" ")}`], {
        stdio: ["pipe", "pipe", "pipe"],
        env,
      });
    } else {
      // Codex/Gemini take prompt as last positional argument
      proc = spawn("bash", ["-c", `${cmd} ${args.join(" ")} "$(cat "${promptFile}")"`], {
        stdio: ["pipe", "pipe", "pipe"],
        env,
      });
    }

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
