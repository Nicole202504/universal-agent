import { generateText, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { Env } from "../types";
import { ALL_SKILLS, ALL_TOOLS } from "../registry";
import { filterSkills, filterTools, loadAgentConfig } from "./assembly";
import { buildToolSet } from "./tool-dispatch";
import { buildSkillDirectory, makeGetSkillInstructionsTool } from "./skill-loader";
import type { ToolCtx } from "./contracts/tool";

const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_PROMPT = "You are a general-purpose agent running on the universal-agent harness.";

const WORKSPACE_ARTIFACT_PROMPT = [
  "## Workspace artifacts",
  "When the user asks you to generate a complete report, markdown document, HTML page, or JSON output, call `create_artifact` with the complete content.",
  "For Vedic section reports, use `type=markdown`; for the final user-facing life report, use `type=html` and title it `完整人生报告`.",
  "When a `run_id` is provided, pass that exact `run_id` to `create_artifact`.",
  "After the tool call succeeds, keep the chat reply short and tell the user the artifact is available in the right-side report panel.",
  "Do not only paste the generated artifact inline when `create_artifact` is available.",
].join("\n");

const INLINE_FORM_PROMPT = [
  "## Inline forms",
  "When you need structured user input, call `ask_user_form` instead of asking the user to reply freely.",
  "For the Vedic first step, collect birth date, birth time, birth place, and gender with one form when any of those fields are missing.",
  "For Vedic validation, present exactly 5 yes/no/other questions as form controls after `generate_validation_statements` returns.",
  "After receiving the form result, continue the task using the submitted values.",
].join("\n");

function getDeepSeekModel(env: Env, modelName: string) {
  const deepseek = createOpenAI({
    baseURL: "https://api.deepseek.com/v1",
    apiKey: env.DEEPSEEK_API_KEY,
    fetch: async (url, init) => {
      if (init?.body) {
        const body = JSON.parse(init.body as string);
        if (body.messages) {
          body.messages = body.messages.map((m: { role: string; [key: string]: unknown }) =>
            m.role === "developer" ? { ...m, role: "system" } : m,
          );
        }
        init = { ...init, body: JSON.stringify(body) };
      }
      return fetch(url, init);
    },
  });
  return deepseek.chat(modelName);
}

export async function runBackgroundAgentStep({
  env,
  agentId,
  runId,
  prompt,
  maxSteps = 8,
  maxOutputTokens = 12000,
}: {
  env: Env;
  agentId: string;
  runId?: string;
  prompt: string;
  maxSteps?: number;
  maxOutputTokens?: number;
}) {
  const cfg = await loadAgentConfig(env.DB, agentId);
  const skills = filterSkills(ALL_SKILLS, cfg);
  const tools = [...filterTools(ALL_TOOLS, cfg), makeGetSkillInstructionsTool(skills)];
  const ctx: ToolCtx = { env, agentId, runId };
  const dir = buildSkillDirectory(skills);
  const system = [
    cfg?.system_prompt ?? DEFAULT_PROMPT,
    WORKSPACE_ARTIFACT_PROMPT,
    INLINE_FORM_PROMPT,
    dir,
  ].filter(Boolean).join("\n\n");

  const result = await generateText({
    model: getDeepSeekModel(env, cfg?.model ?? DEFAULT_MODEL),
    system,
    prompt,
    tools: buildToolSet(tools, ctx),
    stopWhen: stepCountIs(maxSteps),
    maxOutputTokens,
    temperature: 0.35,
  });

  return {
    text: result.text,
    finishReason: result.finishReason,
    steps: result.steps.length,
    toolCalls: result.toolCalls.map((call) => call.toolName),
  };
}
