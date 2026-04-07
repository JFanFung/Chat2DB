此次合并主要涉及两个文件的变更，包括新增了 Yarn 配置文件和修改了 ChatInput 组件的同步表模型功能。变更的主要目的是优化表同步模式的选择界面，增加了自动同步选项并改进了条件渲染逻辑。
| 文件 | 变更 |
|------|---------|
| chat2db-client/.yarnrc.yml | - 新增 Yarn 配置文件，设置 nodeLinker 为 node-modules |
| chat2db-client/src/components/ConsoleEditor/components/ChatInput/index.tsx | - 从 props 中解构出 syncTableModel 属性<br>- 将 Radio.Group 的 value 从硬编码的 MANUAL 改为使用 syncTableModel 变量<br>- 取消注释并启用了"自动"选项的 Radio 按钮<br>- 修复了条件渲染逻辑，当 syncTableModel 为 AUTO 时显示提示信息<br>- 为提示信息添加了样式类名 aiSelectedTableTips |