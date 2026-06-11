import type { SkillManifest } from "./types";
import type { ToolDef } from "./harness/contracts/tool";
import { helloTools } from "./businesses/hello/tools";
import { helloSkill } from "./businesses/hello/skill";
import { vedicTools } from "./businesses/vedic/tools";
import { vedicSkill } from "./businesses/vedic/skill";

// ── 组合根（Composition Root）──
// 聚合所有业务的 tools / skills。harness 只 import 本文件，不直接 import businesses/*。
// 加新业务 = 在此 import 并 push，harness 一行不改（OCP）。
export const ALL_TOOLS: ToolDef[] = [...helloTools, ...vedicTools];

export const ALL_SKILLS: SkillManifest[] = [helloSkill, vedicSkill];
