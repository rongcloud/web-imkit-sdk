// 目前暂未找到其他方式对 d.ts 和 typedoc 的生成进行特别定义，以共享根目录的 compiler.d.ts
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

  declare module '*.ce.vue' {
    import { DefineComponent } from 'vue';

    const component: DefineComponent<{}, {}, any>;
    export default component;
  }
}

export {};
