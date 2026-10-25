# 2026-10-25 Upstream Sync 冲突修复

## 核对范围和原因

- 失败运行：<https://github.com/mianmian7/CF-Server-Monitor/actions/runs/40158164039>，2026-10-25 03:25 UTC。
- fork main：`c31552af48a4c10ee951d5dfe415327134215d2f`。
- 调研时 upstream/main：`dd785ea29a6c1f047190c7f51b8490b494b9d725`，与失败日志列出的上游最新提交一致。
- 共同祖先：`42ad10acd7a3073a22e9516407735f303e412920`。
- PR #2：`42006af64385881df1bdd38fd1ab154b6bb7090b`，修复分支中的双父合并为 `d28ce45474bc20cdb850b2e3233175d489bf6dab`。该次修复处理 noSampleText 定义及国际化，不是永久自动解决后续任意改写。
- 10 月 19 日的 c31552a 已成功合并上游 Beta2；不能把本次失败解释为 PR #2 无效。

在上述 fork 上执行普通 merge 可复现唯一的内容冲突：`src/frontend/composables/useServerCardData.js`。直接原因是上游 `ed8c869fa7ebb19b119cb10b14391d001d6142a6`（首页三网面板自动补齐）将原来的 computed/map 改成 `buildThreeNetRow`，加入 8 个候选节点、nameKey、禁用判定和三行选择。fork 同时修改了原 map 中的过滤、Ping/loss tooltip 参数、颜色、透明度和无样本标题，Git 无法自动确定两者如何组合。

上游 `ad41c7d` 的多语言变更可自动合并。本次 merge 的日志明确是 content conflict；原 workflow 的 Sync check 对任意 failure 都输出 workflow 文件变更提示，没有依据。

## 合并结果

保留 fork 的 formatPingValue、formatLossValue、getProbeStatus、i18n noSampleText、loss-aware getPingColor、历史空桶和失败样本占位。

| 输入/情形 | 保留的行为 |
| --- | --- |
| Ping=null、loss=null | 无样本，图表中性颜色 |
| Ping=null、loss=100 | 超时，红色；loss 显示 100% |
| Ping=42、loss=0 | 42ms、0%，合法样本 |
| 历史空桶 | 无样本，不自动标记服务器离线 |
| 历史失败后恢复 | 不过滤失败占位，保持后续时间位置 |
| 明确禁用 | 继续隐藏，不当作超时 |

接入上游的 CT/CU/CM/BGP/Node1–4 候选顺序、节点名称配置、实时 loss 优先和历史末条回退规则，展示前 3 个未禁用候选。与上游唯一有意的展示差异是：不足 3 个时不重新展示已禁用的占位行，延续 fork 的隐藏行为。无样本节点仍可见。所有节点明确禁用时没有三网行。

其他上游文件采用普通三方合并结果，保留 fork 的 ServerLatencyPanel、后台配置和部署定制。PR 文件数包括真实的上游更新，不能将它们全部算作手工修复。

## 同步策略

新的 workflow 使用完整 Git 历史、串行同步和普通双父 merge。只在测试及构建通过后创建同步 PR，不更新 main；已有待审同步 PR 时暂停新同步。失败输出真实冲突文件和 merge diff artifact，取消误导性的 workflow 变更提示。

这能避免未验证合并直接进入 main，也能避免已有同步 PR 时不断重复尝试。未来上游再改写 fork 定制区域，仍可能出现语义冲突，必须人工处理；不能用 `-X ours`、`-X theirs`、整文件覆盖或强制重置“解决”。后续若继续频繁修改显示状态，可将纯格式化逻辑逐步抽离到 fork 的 probeDisplay 模块，减少共享文件编辑面积，但这不是无冲突保证，本次没有扩大该重构。

仓库 Actions 设置需要允许 GitHub Actions 创建 PR；GITHUB_TOKEN 产生的 PR 通常不会触发后续 PR 工作流，因此 workflow 在推送前自行执行测试和构建。此次没有修改仓库设置或另行配置令牌。若该设置关闭，PR 创建步骤会明确失败，已推送的分支仍可手动开 PR。

**同步 PR 必须使用 Create a merge commit 合并，不能 squash/rebase**，否则会丢失上游父提交关系，导致以后重复合并已解决的代码。仓库当前已有真实 merge 记录，尚无证据说明此前使用过 squash 导致此次失败。

## 验证

```
npm ci --no-audit --no-fund
npm run test:all
npm run build
git -c core.whitespace=cr-at-eol diff --check
```

本次本地全部通过。新增回归覆盖 BGP/custom 补位、名称、禁用与无样本区分、实时 0% 优先历史 false、失败图表红色、空桶中性色、丢包均值、失败样本位置及中/繁中/日文切换。现有 WebSocket 测试改为 configFile:false，避免加载开发 HTTPS/mkcert；初次未隔离时该测试因当前环境 networkInterfaces 权限失败，隔离后全套通过。

workflow YAML 与全部 bash run 块通过解析；用临时 Git 仓库验证 unchanged/clean/conflict 三条分支，冲突场景未推送、产生正确文件清单并 abort 恢复。未在真实仓库触发新 schedule、部署或合并 PR；GitHub 端权限和 PR 创建流程需在合并后的首次同步观察。

复核 ancestry：PR head 应同时包含 c31552a 和 dd785ea。合并本 PR 后对同一 dd785ea 再同步应为 already contains upstream，而非重新处理此冲突。

## 最小冲突修复补丁（不包含其他上游更新）

`docs/patches/upstream-probe-resolution-20261025.patch` 只修改冲突文件，以此次 fork main c31552a 为基线。它不是整个版本更新的替代品，也不会单独记录上游 ancestry。若不通过 PR，先将该 patch 下载到仓库外，再在干净的修复分支操作：

```
git switch -c fix/upstream-sync-20261025 c31552af48a4c10ee951d5dfe415327134215d2f
git fetch https://github.com/huilang-me/CF-Server-Monitor.git dd785ea29a6c1f047190c7f51b8490b494b9d725
git merge --no-commit --no-ff FETCH_HEAD
# 预期：只有 useServerCardData.js 内容冲突。若有其他冲突，先停止检查。
# 在 merge 状态下恢复该文件的 fork 版本，再应用保留双方逻辑的最小补丁：
git checkout --ours -- src/frontend/composables/useServerCardData.js
git apply --check /path/to/upstream-probe-resolution-20261025.patch
git apply /path/to/upstream-probe-resolution-20261025.patch
git add src/frontend/composables/useServerCardData.js
npm ci --no-audit --no-fund
npm run test:all
npm run build
git commit -m 'Merge upstream preserving fork probe display'
```

上述独立补丁只处理显示冲突；同步工作流、测试增强及测试环境隔离请使用本 PR 的对应 diff。若不接受工作流策略变更，可只保留合并修复及测试提交内容，但仍必须记录 upstream 父提交。
