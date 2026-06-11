import type { Env } from "../../types";

// ── I/O 边缘槽位（docs/08 §2 的关键发现）──
// 真正会随业务变化的部分 = ingress(外部→agent) / egress(agent→外部)。
// talent 的「飞书IM」、insight 的「Reddit抓取 / 报告输出」都是 Connector 的不同实现。
//
// ⚠️ P0 无实现：hello 业务走 Agents 自带的 chat 协议入站。
//    talent → LarkConnector、insight → RedditConnector/ReportSink 在 P2/P3 实现这些接口。
//    这里只定义契约，不放投机实现。

export interface IngressEvent {
  source: string;
  payload: unknown;
}

export interface Ingress {
  /** 把外部输入（webhook / cron tick / 抓取批次）规整成 agent 事件 */
  pull(env: Env): Promise<IngressEvent[]>;
}

export interface Egress {
  /** 把 agent 产出送出去（IM 消息 / 报告 / 写表） */
  emit(env: Env, payload: unknown): Promise<void>;
}

export interface Connector {
  id: string;
  ingress?: Ingress;
  egress?: Egress;
}
