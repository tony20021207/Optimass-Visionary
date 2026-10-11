/** UI languages. Coaching text authored in content/ (cues, "why" notes) stays in English for now. */
export type Lang = "en" | "zh";

const PARTS: Record<string, string> = { head: "头部", shoulder: "肩部", elbow: "肘部", wrist: "手腕", hip: "髋部" };

export const TRACKING_TEXT = {
  en: {
    reading: "Reading your movement…",
    onPhone: "This runs on your phone. Your video isn't uploaded.",
    failed: "We couldn't track your body in this video",
    retry: "Try again",
    tracked: (pct: number) => `Body tracked in ${pct}% of the video`,
    skeleton: "Skeleton",
    hardToSee: (part: string, pct: number) =>
      `Your ${part} was hard to see in ${pct}% of the video, so checks there are less sure. Next set, keep it in frame and well lit.`,
    part: (p: string) => p,
  },
  zh: {
    reading: "正在分析你的动作…",
    onPhone: "分析在你的手机上进行，视频不会上传。",
    failed: "无法在这段视频中追踪到你的身体",
    retry: "重试",
    tracked: (pct: number) => `视频中 ${pct}% 的画面追踪到身体`,
    skeleton: "骨架",
    hardToSee: (part: string, pct: number) => `你的${part}在 ${pct}% 的画面中看不清，相关检查的可靠度较低。下一组请让它保持在画面内，光线充足。`,
    part: (p: string) => PARTS[p] ?? p,
  },
} satisfies Record<Lang, unknown>;
