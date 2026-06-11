import { z } from "zod";
import type { ToolDef } from "../../harness/contracts/tool";

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
];
