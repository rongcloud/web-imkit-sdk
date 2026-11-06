# RongCloud Web IMKit

[产品文档](https://docs.rongcloud.cn/web-im-kit) · [问题反馈](https://github.com/rongcloud/web-imkit-sdk/issues)

IMKit 是基于 Vue 3 和 Web Components 的融云即时通讯 UI 组件库，提供会话列表、消息列表和输入框，并支持语言、菜单、消息气泡和自定义消息渲染。

本仓库提供 SDK 源码，用于调试、构建和定制。接入与使用说明请参阅[官方文档](https://docs.rongcloud.cn/web-im-kit)。

## 从源码构建

构建环境：Node.js >= 18.12.0、pnpm 9.15.1。在仓库根目录执行：

```sh
corepack enable
pnpm install
pnpm run lint
pnpm run release
```

如未安装 Corepack，请先[安装 Corepack](https://github.com/nodejs/corepack)，或直接安装 pnpm 9.15.1。Windows 环境请通过 WSL 执行构建命令。

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm run typecheck` | 使用 vue-tsc 检查库类型 |
| `pnpm run lint` | 先执行类型检查，再执行 ESLint |
| `pnpm run build` | 开发构建，含内联 source map |
| `pnpm run release` | 生产构建，压缩产物且不带 source map |
| `pnpm run build:apidoc` | 从公开入口生成 `release/apidoc/` |

构建产物：

| 路径 | 内容 |
| --- | --- |
| `release/npm/` | npm 包目录，含 ESM、CommonJS、UMD、类型声明、README 和 LICENSE |
| `release/cdn/` | 带版本号的 UMD 文件 |
| `release/apidoc/` | 从公开接口生成的 API 文档 |

每次构建会清空 `release/` 目录，请勿在该目录存放需要保留的文件。

版本计算位于 `scripts/constants.ts`。以根版本 `5.48.0`、`BUILD_ID=1` 为例：

| 命令 | 生成的版本 |
| --- | --- |
| `pnpm run build` | `5.48.0-alpha.1` |
| `pnpm run release` | `5.48.0` |
| `IS_ENTERPRISE=true pnpm run build` | `5.48.0-enterprise-alpha.1` |
| `IS_ENTERPRISE=true pnpm run release` | `5.48.0-enterprise.1` |

`BUILD_ID` 默认为 `1`，开发或 Enterprise 构建中要求为数字。`IS_ENTERPRISE=true` 不会自动替换 dependencies。

### 目录结构

| 路径 | 用途 |
| --- | --- |
| `src/index.ts` | 对外导出入口 |
| `src/core/` | 插件实例、上下文、事件与生命周期 |
| `src/modules/` | 会话、消息、菜单、缓存、语言和业务资料逻辑 |
| `src/ui/` | Vue Custom Elements、UI providers 和可替换组件 |
| `src/languages/` | 内置语言包及词条类型 |
| `src/assets/` | 图标等资源 |
| `scripts/` | 版本计算和打包逻辑 |
| `scripts/assets/` | npm 包 README、LICENSE、package 模板及 API 首页 |
| `SOURCE_REVISION` | 源码导出来源版本 |

### 本地打包

构建后，将 npm 包打包到 `/tmp`：

```sh
pnpm run release
npm pack ./release/npm --pack-destination /tmp
```

在业务项目中安装生成的 `.tgz` 文件，即可使用本地构建的 SDK。接入步骤见[快速上手](https://docs.rongcloud.cn/web-im-kit/quickstart)，依赖版本以生成包的 `peerDependencies` 为准。

## 文档

| 任务 | 入口 |
| --- | --- |
| 接入、初始化、双用户验证 | [官方快速上手](https://docs.rongcloud.cn/web-im-kit/quickstart) |
| 平台支持、版本矩阵与开发准备 | [官方开发准备](https://docs.rongcloud.cn/web-im-kit) |
| 功能列表与首次支持版本 | [官方功能列表](https://docs.rongcloud.cn/web-im-kit/feature-list) |
| 组件替换与自定义消息 | [组件概述](https://docs.rongcloud.cn/web-im-kit/components/overview)、[自定义消息](https://docs.rongcloud.cn/web-im-kit/chat/register-message) |
| 用户、群组与业务资料 Hooks | [官方业务数据](https://docs.rongcloud.cn/web-im-kit/user/hooks) |
| 功能开关、菜单、多语言 | [官方配置与定制](https://docs.rongcloud.cn/web-im-kit/chat-ui/switch) |
| 事件监听、状态码 | [事件](https://docs.rongcloud.cn/web-im-kit/event)、[状态码](https://docs.rongcloud.cn/web-im-kit/code) |
| 移动端推送 | [移动端推送](https://docs.rongcloud.cn/web-im-kit/push) |
| 版本变化 | [官方更新日志](https://docs.rongcloud.cn/web-im-kit/release-notes) |
| 接口签名与类型 | [在线 API 参考](https://doc.rongcloud.cn/apidoc/imkit-web/latest/zh_CN/) |

## 支持

本项目由 RongCloud 内部维护，不接受外部代码、文档贡献或 Pull Request。

问题反馈请提交 [GitHub Issue](https://github.com/rongcloud/web-imkit-sdk/issues)，并附上 IMKit、Engine、IMLib 的版本和最小复现。安全漏洞请按 [SECURITY.md](SECURITY.md) 中的方式私下报告。

## 许可证

本项目采用 [Apache License 2.0](LICENSE)。第三方依赖和素材的许可信息见[第三方授权说明](THIRD_PARTY_NOTICES.md)。
