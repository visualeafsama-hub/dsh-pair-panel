# Changelog

本仓库每次修复/功能的变更记录。格式：`日期 · 提交` — 说明。

## 2026-08-19

### `2ca79ae` — pair 解析：桥标记优先，不再全局乱跳
- 宿主 `findPair` 原来**全局扫所有 pair 取 current-thread.json 最新**，不认当前实例桥接的 pair——换个 abg 实例面板就会跳到别的 pair。
- 现在优先级：① 桥标记 `~/agentbridge-dsh/run/bridge.pair`（abg 每次启动写入的实例真身）→ ② 会话工作区精确匹配的 live pair → ③ 任意 live pair → ④ 最新。
- 附带：`deriveCwd` 把会话完整 cwd 传给 findPair 做工作区匹配。

### `66e66b2` — 消息去重 + 统一左侧对齐
- **double 份根因**：Codex rollout 的 `task_complete.last_agent_message`（200 字截断）重复了消息记录（600 字截断），宿主去重用**精确相等**比较必然失配 → 任务记录漏进 feed，渲染成居中无框的 `.pp-task`。
- 修复：宿主与客户端去重都改为**前缀比较**（+4 条回看窗口回溯）；消息排版从"我右/Codex 左"改为**全部统一左侧**（与主会话一致，靠底色区分）。

### `d4a0137` — README：皮肤兼容性
- 新增「皮肤兼容性」表：dsh-web-ui 全家桶（whale-mom/whale-song 等 13 款 + dsh-pet）为背景画式皮肤，不注入 `[data-maid-character]`、不改布局，面板天然走无皮肤回退路径。
- 修正过时的「布局说明」（左鲸鱼不再缩小，右侧用皮肤契约确定性计算）。

## 2026-08-17

### `e8da74a` — 确定性布局：锚定皮肤契约，不测量鲸鱼
- F5 / 新会话切老会话弹跳的终局修复：右侧鲸鱼最终位置按 maid-atelier 皮肤 active 规则（`right: clamp(-70px,-3vw,-24px); height: clamp(420px,62vh,730px)`）**确定性计算**，不再测量实时 DOM（实时 rect 会停留在英雄尺寸数秒，测量式锚点必然写错 margin）。
- margin **只写一次**，先决条件（输入框挂载、列存在）不满足时保持 pending；`data-pp-ready` 原子提交可见性。

### 之前的关键修复链（`f653d50` → `d6ec85e` → `57e4da8`）
- `f653d50` 会话切换过渡动画；`830f958` 新会话面板自动 off + 左鲸鱼保持原尺寸；`2f3b66b` 禁用 centerCol margin 动画；`1188220` 稳定性门控（后来被 e8da74a 取代）；`d6ec85e` 面板开关动画 + 原子布局提交；`57e4da8` margin 永不写两次。
- `174ce1a` 无皮肤回退（右侧 610px 预留）。
