import type { SkillManifest } from "../../types";

// hello 业务的 skill（know-how / SOP 载体）。
// instructions 即 SOP 正文，双轨在文本里表达：简单→loop，不能漏→workflow。
export const helloSkill: SkillManifest = {
  id: "hello_demo",
  description: "Demo skill: greet a topic, optionally via the durable workflow.",
  instructions: [
    "# Hello demo SOP",
    "",
    "When the user asks to greet something:",
    "1. Quick reply path (柔性轨/loop): call `get_time` if helpful and answer inline.",
    "2. Durable / must-not-drop path (刚性轨/Workflow): call `start_hello_workflow` with the topic.",
    "3. Report the workflow instance id back to the user.",
  ].join("\n"),
  tool_ids: ["get_time", "start_hello_workflow"],
  workflow: "HELLO_WORKFLOW",
};
