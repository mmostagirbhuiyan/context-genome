import Anthropic from "@anthropic-ai/sdk";
import { buildGenerationPrompt, buildEditPrompt } from "./prompt.js";

const DEFAULT_MODEL = "claude-sonnet-4-6";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      "ANTHROPIC_API_KEY not set.\n" +
        "Get one at https://console.anthropic.com/settings/keys\n" +
        "Then: export ANTHROPIC_API_KEY=sk-ant-...",
    );
    process.exit(1);
  }
  return new Anthropic({ apiKey });
}

/**
 * Generate a genome via the Anthropic API.
 */
export async function generateGenome(context: string): Promise<string> {
  const prompt = buildGenerationPrompt(context);
  return callAPI(prompt);
}

/**
 * Refine a genome with one editing pass.
 */
export async function editGenome(
  genome: string,
  originalContext: string,
): Promise<string> {
  const prompt = buildEditPrompt(genome, originalContext);
  return callAPI(prompt);
}

async function callAPI(prompt: string): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  if (!text) {
    throw new Error("Empty response from API");
  }

  return text.trim();
}
