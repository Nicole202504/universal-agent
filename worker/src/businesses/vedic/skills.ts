import type { SkillManifest } from "../../types";
import {
  VEDIC_CALCULATOR_INSTRUCTIONS,
  VEDIC_CAREER_INSTRUCTIONS,
  VEDIC_CORE_INSTRUCTIONS,
  VEDIC_LOVE_INSTRUCTIONS,
  VEDIC_READER_INSTRUCTIONS,
  VEDIC_RECTIFIER_INSTRUCTIONS,
} from "./full-skill-content";

const FIRST_PHASE_FLOW = [
  "# Phase 1 product flow",
  "The user entry UI only allows birth date, birth time, and birth place. Treat the first usable user message as birth data.",
  "After birth data is available, always call `collect_birth_data` first.",
  "After chart calculation, always call `generate_validation_statements` and output exactly 5 pre-validation items when possible.",
  "Each validation item must be a yes/no selectable assertion. Do not ask the user for life events before validation.",
  "After the user answers the 5 items, call `evaluate_validation`.",
  "If validation passes, produce the final report incrementally: one planet artifact at a time, then topical artifacts, then a final summary artifact.",
].join("\n");

const INCREMENTAL_REPORT_FLOW = [
  "# Incremental final-report flow",
  "Do not generate the paid final report as one long hidden response.",
  "After validation passes, load `vedic-core`, `vedic-career`, and `vedic-love` first.",
  "Then call `generate_vedic_report` repeatedly and call `create_artifact` immediately after every section:",
  "1. `section=planet_audit, planet=sun`",
  "2. `section=planet_audit, planet=moon`",
  "3. `section=planet_audit, planet=mars`",
  "4. `section=planet_audit, planet=mercury`",
  "5. `section=planet_audit, planet=jupiter`",
  "6. `section=planet_audit, planet=venus`",
  "7. `section=planet_audit, planet=saturn`",
  "8. `section=planet_audit, planet=rahu`",
  "9. `section=planet_audit, planet=ketu`",
  "10. `section=houses`",
  "11. `section=divisional`",
  "12. `section=career`",
  "13. `section=love`",
  "14. `section=dasha`",
  "15. `section=final_summary`",
  "Chat replies between sections should be short progress notes; the full content belongs in artifacts.",
].join("\n");

export const vedicReaderSkill: SkillManifest = {
  id: "vedic-reader",
  description:
    "Vedic chart intake router. Trigger for birth data, chart reading, Jyotish, Vedic astrology, or starting a chart analysis.",
  instructions: [
    VEDIC_READER_INSTRUCTIONS,
    "",
    "# Vedic Chart Reader",
    FIRST_PHASE_FLOW,
    "",
    "Role: route the user into the right Vedic workflow.",
    "Phase 1 is locked: birth data -> calculator -> 5 yes/no validation assertions -> full report.",
    "If the user provides birth data, do not ask for PDF/screenshots. Use the calculator path.",
    "If data is incomplete, ask only for the missing birth field. Do not ask open-ended life-history questions.",
    "Once birth data is complete, call `collect_birth_data` immediately.",
    "For the final global report, the agent must load `vedic-core`, `vedic-career`, and `vedic-love` before producing the final answer.",
    INCREMENTAL_REPORT_FLOW,
  ].join("\n"),
  tool_ids: ["collect_birth_data", "generate_validation_statements", "evaluate_validation", "generate_vedic_report"],
  workflow: null,
};

export const vedicCalculatorSkill: SkillManifest = {
  id: "vedic-calculator",
  description:
    "Calculate a complete Vedic chart from birth date, time, place, latitude, and longitude using the pysweph/PyJHora engine.",
  instructions: [
    VEDIC_CALCULATOR_INSTRUCTIONS,
    "",
    "# Vedic Calculator",
    FIRST_PHASE_FLOW,
    "",
    "Use `collect_birth_data` for all direct birth-data chart calculation.",
    "The calculation result is the canonical source for Lagna, Moon, Dasha, SAV, house lords, dignity, combustion, and validation signals.",
    "Never invent chart data. If a field is missing from tool output, say it is unavailable or avoid using that signal.",
    "After tool output, immediately move to `generate_validation_statements`.",
  ].join("\n"),
  tool_ids: ["collect_birth_data", "generate_validation_statements"],
  workflow: null,
};

export const vedicRectifierSkill: SkillManifest = {
  id: "vedic-rectifier",
  description:
    "Birth time rectification from major life events and Dasha matching. Use only when validation is weak or user asks for time correction.",
  instructions: [
    VEDIC_RECTIFIER_INSTRUCTIONS,
    "",
    "# Vedic Birth Time Rectifier",
    "This is not the phase-1 default path. Use it only after weak validation or explicit time-correction intent.",
    "Collect 5 major dated life events only when rectification is needed.",
    "Call `rectify_birth_time` with birth data and the event list.",
    "Explain the match result clearly and deterministically. If the original time is good, say so. If adjustment is needed, give the recommended time and caution that divisional charts should be recalculated.",
  ].join("\n"),
  tool_ids: ["rectify_birth_time"],
  workflow: null,
};

export const vedicCoreSkill: SkillManifest = {
  id: "vedic-core",
  description:
    "Full Vedic core analysis: P1-P12 planet audit, divisional cross-checks, house diagnosis, life areas, Dasha timing, and report generation.",
  instructions: [
    VEDIC_CORE_INSTRUCTIONS,
    "",
    "# Vedic Core Analysis",
    FIRST_PHASE_FLOW,
    "",
    "Use this skill only after the 5 validation assertions have been answered and evaluated.",
    "The final report must be comprehensive, not a short chat answer.",
    "Writing style: 70% plain-language interpretation, 20% data tables, 10% technical notes.",
    "Do not reverse-engineer conclusions from the user's validation answers. Use validation only as time-confidence context.",
    INCREMENTAL_REPORT_FLOW,
    "Required report structure:",
    "1. Validation result and time-confidence note.",
    "2. Birth chart summary: Lagna, Moon, Sun, Nakshatra, current Dasha, SAV total.",
    "3. Nine-planet audit: role, dignity, house, aspects, combustion/retrograde, life expression.",
    "4. Divisional chart summary: D9/D10/D4/D5 if available.",
    "5. Twelve-house diagnosis, with house lord and SAV where available.",
    "6. Dasha timeline: current period, next 3 years, practical timing windows.",
    "7. Yogas and special signals.",
    "8. Ten life areas: personality, wealth, career, love, health, education, family, social network, spirituality, strategic advantage.",
    "9. Action suggestions and technical appendix.",
    "Before final report synthesis, also load `vedic-career` and `vedic-love` and include those analyses.",
  ].join("\n"),
  tool_ids: ["generate_vedic_report"],
  workflow: null,
};

export const vedicCareerSkill: SkillManifest = {
  id: "vedic-career",
  description:
    "Career direction and timing analysis from a calculated Vedic chart. Use after the core report or when user explicitly asks career questions.",
  instructions: [
    VEDIC_CAREER_INSTRUCTIONS,
    "",
    "# Vedic Career Analysis",
    "Phase 1 does not route here before validation and the full report.",
    "For career analysis, focus on L10, 10th house, AmK, D10, Saturn, Mercury, Sun, current Dasha, and income houses.",
    "Speak like a seasoned astrologer: interpretation first, evidence second.",
    "If no chart data is available, route through `vedic-reader` and `vedic-calculator` first.",
  ].join("\n"),
  tool_ids: ["generate_vedic_report"],
  workflow: null,
};

export const vedicLoveSkill: SkillManifest = {
  id: "vedic-love",
  description:
    "Relationship pattern and love timing analysis from a calculated Vedic chart. Use after the core report or for explicit love/relationship questions.",
  instructions: [
    VEDIC_LOVE_INSTRUCTIONS,
    "",
    "# Vedic Love Timing Analysis",
    "Phase 1 does not route here before validation and the full report.",
    "For love analysis, focus on 5th house, 7th house, Venus, Jupiter, DK/PK, UL, D9, and relationship Dasha windows.",
    "Speak in plain relationship language first, then cite chart evidence.",
    "If no chart data is available, route through `vedic-reader` and `vedic-calculator` first.",
  ].join("\n"),
  tool_ids: ["generate_vedic_report"],
  workflow: null,
};

export const vedicSkills: SkillManifest[] = [
  vedicReaderSkill,
  vedicCalculatorSkill,
  vedicRectifierSkill,
  vedicCoreSkill,
  vedicCareerSkill,
  vedicLoveSkill,
];
