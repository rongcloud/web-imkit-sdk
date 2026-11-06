declare global {
  /**
   * package 包构建时的 CommitID
   */
  const __COMMIT_ID__: string;
  /**
   * package 版本
   */
  const __VERSION__: string;
  /**
   * 依赖 engine 版本
   */
  const __REQUIRED_ENGINE_VERSION__: string;
  /**
   * 开发版标记
   */
  const __DEV__: boolean;
  /**
   * 是否是私有云包
   */
  const __IS_ENTERPRISE__: boolean;

  declare module '*.svg?raw' {
    const content: string;
    export default content;
  }
}

export {};
