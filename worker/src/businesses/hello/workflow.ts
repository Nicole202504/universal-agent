import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import type { Env } from "../../types";

export interface HelloParams {
  topic: string;
}

// 刚性轨示例：不能漏的多步长流程。step.do 跑过即记账、自动重试；step.sleep 免费不占并发。
export class HelloWorkflow extends WorkflowEntrypoint<Env, HelloParams> {
  async run(event: WorkflowEvent<HelloParams>, step: WorkflowStep): Promise<void> {
    const topic = event.payload.topic;

    const greeting = await step.do("compose-greeting", async () => `Hello, ${topic}!`);

    await step.sleep("cool-down", "5 seconds");

    await step.do("persist-run", async () => {
      await this.env.DB.prepare(
        "INSERT INTO runs (id, kind, payload, created_at) VALUES (?1, ?2, ?3, ?4)",
      )
        .bind(crypto.randomUUID(), "hello", greeting, Date.now())
        .run();
    });
  }
}
