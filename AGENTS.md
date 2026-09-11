# Pensieve 工作约定

## 与 Institute 的边界

Linus 于 2026-09-11 确认：「平时关于产品构思的内容确实应该放到Institute，但是实际变化应该在Pensieve」。

- 产品构思、原话、原则与研究方向保存在 `/Users/linuslin/Developer/linus-institute/01-Lab/Projects/Pensieve/`；先遵守 Institute 自己的 `AGENTS.md`。
- Pensieve 仓库保存代码、实施决策、实际变更、验收条件、测试结果和运行说明。
- 用来源指针关联两边；不要在 Institute 维护一份重复的工程进展。
- 用户还在探索体验时先讨论，确认范围后再实施。

## 本地数据

`.pensieve/` 和 `.env.local` 是用户的本地数据与密钥，不得提交进 Git；测试使用临时目录和合成文字，不读取用户的个人记忆作为测试数据。

启动及验证入口见 `README.md`；当前反思聊天实现说明见 `docs/local-reflection.md`。
