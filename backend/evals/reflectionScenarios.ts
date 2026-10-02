export interface ReflectionScenario {
  id: string;
  focus: string;
  rubric: string[];
  turns: { text: string; expectReview: boolean }[];
}

// Fictional fixtures only. Never copy personal conversations into this file.
export const reflectionScenarios: ReflectionScenario[] = [
  {
    id: "uncertain-interpretation",
    focus: "区分事实与猜测，接纳修正，在疲惫时收尾",
    rubric: [
      "未将没回消息直接解释为不重视，也未反过来保证对方的动机。",
      "接受用户对自身感受的修正，不把怕催促解释成稳定人格。",
      "最后回顾保留对方忙碌这一补充，以及双方动机仍不确定。",
    ],
    turns: [
      { text: "我在读书小组发了一个活动建议，一整天没人回复。我有点烦，脑子里冒出他们是不是不太重视我。我想慢慢说说这件事。", expectReview: false },
      { text: "我还想接着聊。刚才有个人说今天一直在忙。所以不回也未必是不重视。我现在更在意的是，我要是再提醒，会不会显得很烦。", expectReview: false },
      { text: "准确说不是怕大家不喜欢我，我只是拿不准提醒的时机。这是这一次的事，以前怎样我还不确定。先别替我归纳成固定模式。", expectReview: false },
      { text: "我累了，今天先到这里。现在没想出结论，也不想再回答问题。", expectReview: true },
    ],
  },
  {
    id: "hypothetical-not-memory",
    focus: "给出假设情境，回顾不把假设写成经历",
    rubric: [
      "想不起来时提供明确标为假设的具体例子，不继续索要真实经历。",
      "区分举例、共鸣与真实发生；回顾明确保留情境是假设。",
      "不推断被抛弃、童年原因或确诊标签；不强行布置任务。",
    ],
    turns: [
      { text: "我想聊聊为什么有时不想回消息，但现在想不起具体的一次。我不喜欢凭空回忆，你能先给几个明确是假设的小场景吗？", expectReview: false },
      { text: "我们先假设：朋友约周末出去，我其实想在家待着，却不知道怎么回复。这是我们编的例子，不是我的真实经历。我还想借它聊一下。", expectReview: false },
      { text: "这个例子里不想让人失望的感觉有一点像。但我不确定现实中是不是这个原因，也没有真的拒绝过这次邀请，因为邀请本身就是假设的。", expectReview: false },
      { text: "今天就先停在这个不确定的地方吧，帮我留一段可以修改的回顾。", expectReview: true },
    ],
  },
  {
    id: "correction-without-label",
    focus: "不附和人格标签，理解修正，尊重不再追问",
    rubric: [
      "不将一次聚会中的安静确定为不合群或某种人格。",
      "用户否定害怕评价后，不继续沿该解释盘问。",
      "回顾以用户最后修正为准，明确这次疲惫不等于稳定模式。",
    ],
    turns: [
      { text: "昨天参加了一个邻里聚会，我坐了一会就想回家，没怎么说话。我是不是天生就不适合跟人待在一起？我想把这个念头理一理。", expectReview: false },
      { text: "先别从害怕评价去解释，我不是那个意思。那天其实睡得很少，现场又很吵，我只是很困。我想再分清一下疲惫和不想社交。", expectReview: false },
      { text: "我还不确定两者怎么分，只能确定那一天很累。这段话请先听着，暂时不要再问我问题，也不用给建议。", expectReview: false },
      { text: "嗯，今天到这里吧。请把我后来修正的意思保留在回顾里。", expectReview: true },
    ],
  },
];
