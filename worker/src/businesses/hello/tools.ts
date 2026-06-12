import { z } from "zod";
import type { ToolDef } from "../../harness/contracts/tool";

const formFieldSchema = z.object({
  name: z.string().describe("stable field key, for example birth_date or validation_1"),
  label: z.string().describe("short user-facing label"),
  type: z
    .enum(["text", "textarea", "number", "date", "select", "radio", "checkbox"])
    .describe("form control type"),
  required: z.boolean().optional().describe("whether the user must fill this field"),
  placeholder: z.string().optional().describe("placeholder text for text-like controls"),
  description: z.string().optional().describe("short helper text under the field"),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional().describe(
    "choices for select, radio, and checkbox fields",
  ),
});

// hello 业务的工具（Layer 3）。每个 = 一个幂等原子动作。
export const helloTools: ToolDef[] = [
  {
    id: "get_time",
    description: "Get the current server time as an ISO string.",
    inputSchema: z.object({}),
    run: async () => ({ now: new Date().toISOString() }),
  },
  {
    id: "start_hello_workflow",
    description:
      "Start the hello demo workflow (rigid / durable track). Use this when the work must not be lost. Returns the workflow instance id.",
    inputSchema: z.object({ topic: z.string().describe("subject to greet in the workflow") }),
    mutating: true,
    run: async (ctx, args) => {
      const topic = String(args.topic);
      const instance = await ctx.env.HELLO_WORKFLOW.create({ params: { topic } });
      return { instanceId: instance.id, status: "started" };
    },
  },
  {
    id: "create_artifact",
    description:
      "Create a durable workspace artifact that appears in the right-side Artifacts panel. Use this for complete reports, markdown documents, HTML pages, or JSON artifacts.",
    inputSchema: z.object({
      type: z.enum(["markdown", "html", "json"]).describe("artifact type"),
      title: z.string().describe("short artifact title"),
      description: z.string().optional().describe("one-line artifact description"),
      content: z.string().describe("complete artifact content; for html, include the full HTML document"),
    }),
    mutating: true,
    run: async (ctx, args) => {
      const id = crypto.randomUUID();
      const type = String(args.type);
      const title = String(args.title);
      const description = args.description == null ? "" : String(args.description);
      const content = String(args.content);
      const createdAt = Date.now();

      await ctx.env.DB.prepare(
        "INSERT INTO artifacts (id, agent_id, type, title, description, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
      )
        .bind(id, ctx.agentId, type, title, description, content, createdAt)
        .run();

      return { id, agentId: ctx.agentId, type, title, description, createdAt, panel: "artifacts" };
    },
  },
  {
    id: "ask_user_form",
    description:
      "Render an inline form in the chat and wait for the user's structured input. Use this when you need birth data, yes/no validation answers, or other specific fields before continuing.",
    inputSchema: z.object({
      title: z.string().describe("short form title"),
      description: z.string().optional().describe("one sentence explaining what this form collects"),
      submitLabel: z.string().optional().describe("submit button label"),
      fields: z.array(formFieldSchema).min(1).max(8).describe("fields to show in the inline chat form"),
    }),
    clientSide: true,
    run: async () => ({ error: "ask_user_form is handled by the frontend" }),
  },
];
