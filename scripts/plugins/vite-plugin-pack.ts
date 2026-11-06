import { resolve } from 'path';
import { rollup } from 'rollup';
import rollupDts from 'rollup-plugin-dts';
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';
import alias from '@rollup/plugin-alias';

import {
  libRoot, root, version, isDev,
} from '../constants';
import { copyFile, rmdir } from '../helper';
import packTmp from '../assets/package-template.json';
import packJson from '../../package.json';

const generateDts = async () => {
  const dtsBundle = await rollup({
    input: resolve(libRoot, 'index.ts'),
    plugins: [
      alias({
        entries: {
          '@lib': resolve(libRoot),
        },
      }),
      rollupDts(),
    ],
    external: ['@rongcloud/engine', '@rongcloud/imlib-next'],
  });
  await dtsBundle.write({
    file: resolve(root, 'release/npm/dist/index.d.ts'),
    format: 'esm',
  });
};

/**
 * 打包
 */
export default function pack() {
  return {
    name: 'pack',
    buildStart() {
      // 构建开始时清理 release 目录
      rmdir(resolve(root, 'release'));
    },
    async closeBundle() {
      // 生成 dts 文件
      await generateDts();

      // 拷贝 npm 包资源，LICENSE、README.md, package.json
      const assetsRoom = resolve(__dirname, '../assets');
      const npmRoot = resolve(root, 'release/npm');
      copyFile(resolve(assetsRoom, 'LICENSE'), resolve(npmRoot, 'LICENSE'));
      copyFile(resolve(assetsRoom, 'README_4_NPM_PACK.md'), resolve(npmRoot, 'README.md'));

      // 生成 package.json
      const engineVer = packJson.dependencies['@rongcloud/engine'];
      const imlibVer = packJson.dependencies['@rongcloud/imlib-next'];
      writeFileSync(resolve(npmRoot, 'package.json'), JSON.stringify({
        ...packTmp,
        version,
        peerDependencies: {
          '@rongcloud/engine': engineVer,
          '@rongcloud/imlib-next': imlibVer,
        },
      }, null, '  '));

      // 生成 CDN 资源
      const umdFile = resolve(npmRoot, 'dist/index.umd.js');
      copyFile(umdFile, resolve(root, `release/cdn/RongIMKit-${version}.${isDev ? 'js' : 'prod.js'}`));

      // 生成 APIDoc
      execSync('npm run build:apidoc');
    },
  };
}
