# Web IMKit API 参考

本文档介绍 Web IMKit 的公开接口、类型、参数和事件。首次接入请参阅[快速上手](https://docs.rongcloud.cn/web-im-kit/quickstart)。在线版本见 [Web IMKit API 参考](https://doc.rongcloud.cn/apidoc/imkit-web/latest/zh_CN/)。

## 常用入口

| 任务 | 名称 |
| --- | --- |
| 安装与初始化 | `RCKitInstaller`、`IRCKitInitOpts` |
| 配置、会话和消息操作 | `RCKitApplication` |
| 业务资料 | `IRCKitServiceHooks`、用户与群组资料类型 |
| 事件 | `RCKitEvents`、`RCKitEvent` |
| 功能开关 | `RCKitCommand` |
| 自定义消息和组件 | `IRCKitRegisterMessageTypeOpts`、`RCKitOverrideAbleComponent` |

## 调用说明

先初始化 IMLib，在连接前安装 IMKit 插件，在 `ready()` 前完成功能开关、语言包和自定义组件注册。调用 `ready()` 后，还需等待连接和同步完成。业务接口返回非零 `code` 时，请参阅[状态码](https://docs.rongcloud.cn/web-im-kit/code)。

可通过包内 `package.json` 或 `RCKIT_VERSION` 查看 SDK 版本。

## 相关文档

- [快速上手](https://docs.rongcloud.cn/web-im-kit/quickstart)
- [业务数据 Hooks](https://docs.rongcloud.cn/web-im-kit/user/hooks)
- [配置与定制](https://docs.rongcloud.cn/web-im-kit/chat-ui/switch)
- [事件监听](https://docs.rongcloud.cn/web-im-kit/event)
- [从源码构建](https://github.com/rongcloud/web-imkit-sdk#%E4%BB%8E%E6%BA%90%E7%A0%81%E6%9E%84%E5%BB%BA)

本项目不接受外部代码、文档贡献或 Pull Request。问题反馈请提交 [GitHub Issue](https://github.com/rongcloud/web-imkit-sdk/issues)。
