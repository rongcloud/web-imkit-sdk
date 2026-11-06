# RongCloud Web IMKit

IMKit 是基于 Vue 3 和 Web Components 的融云即时通讯 UI 组件库，提供会话列表、消息列表、输入框，以及菜单、语言、消息气泡和自定义消息渲染能力。

[源码仓库](https://github.com/rongcloud/web-imkit-sdk) · [产品文档](https://docs.rongcloud.cn/web-im-kit) · [快速上手](https://docs.rongcloud.cn/web-im-kit/quickstart) · [API 参考](https://doc.rongcloud.cn/apidoc/imkit-web/latest/zh_CN/) · [问题反馈](https://github.com/rongcloud/web-imkit-sdk/issues)

## 版本与安装

安装配套的 Engine 和 IMLib：

```sh
npm install @rongcloud/engine@5.48.0-alpha.1 @rongcloud/imlib-next@5.48.0-alpha.1
```

安装本地构建的 IMKit 包，以下以 5.48.0 为例：

```sh
npm install ./rongcloud-im-kit-5.48.0.tgz
```

请将路径替换为生成的 `.tgz` 文件路径。构建步骤见[从源码构建](https://github.com/rongcloud/web-imkit-sdk#%E4%BB%8E%E6%BA%90%E7%A0%81%E6%9E%84%E5%BB%BA)，其他版本的依赖要求见包内 `package.json` 的 `peerDependencies`。

## 接入前准备

- 支持 Custom Elements 的浏览器及有明确高度的 UI 容器。
- 融云应用 App Key 与同一应用下的用户 Token；App Secret 仅保存在服务端。
- 用户、群组、群成员和系统会话资料 hooks。

初始化顺序是：IMLib 初始化 → 安装 IMKit 插件 → 完成配置 → `ready()` → 连接 → 挂载 UI → 同步完成后打开会话。完整接入步骤见[快速上手](https://docs.rongcloud.cn/web-im-kit/quickstart)。

## 进一步使用

- [功能列表与首次支持版本](https://docs.rongcloud.cn/web-im-kit/feature-list)
- [业务数据 Hooks](https://docs.rongcloud.cn/web-im-kit/user/hooks)
- [配置与定制](https://docs.rongcloud.cn/web-im-kit/chat-ui/switch)
- [事件监听](https://docs.rongcloud.cn/web-im-kit/event)、[状态码](https://docs.rongcloud.cn/web-im-kit/code)
- [更新日志](https://docs.rongcloud.cn/web-im-kit/release-notes)
- [API 参考](https://doc.rongcloud.cn/apidoc/imkit-web/latest/zh_CN/)

## 许可证和支持

本项目采用 Apache License 2.0，详见包内 LICENSE。第三方依赖的许可信息见[第三方授权说明](https://github.com/rongcloud/web-imkit-sdk/blob/HEAD/THIRD_PARTY_NOTICES.md)。

本项目由 RongCloud 内部维护，不接受外部代码、文档贡献或 Pull Request。

问题反馈请提交 [GitHub Issue](https://github.com/rongcloud/web-imkit-sdk/issues)，并附上 IMKit、Engine、IMLib 的版本和最小复现。安全漏洞请按 [SECURITY.md](https://github.com/rongcloud/web-imkit-sdk/blob/HEAD/SECURITY.md) 中的方式私下报告。
