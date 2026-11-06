import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { version as v, dependencies } from '../package.json';

const revisionFile = join(__dirname, '..', 'SOURCE_REVISION');

/** 源码导出版本；没有来源文件时仍可构建。 */
export const commitId = existsSync(revisionFile)
  ? readFileSync(revisionFile, 'utf8').trim() || 'unknown'
  : 'unknown';

/** 是否构建私有云版本。 */
export const isEnterprise = process.env.IS_ENTERPRISE === 'true';

/** 构建模式：production | development */
export const mode = process.env.MODE?.toLowerCase() === 'production' ? 'production' : 'development';

export const isDev = mode === 'development';

export const buildId = process.env.BUILD_ID || '1';

if (!/^\d+$/.test(buildId)) {
  if (isEnterprise) {
    throw new Error('Build enterprise version failed, `BUILD_ID` should be a number!');
  }
  if (isDev) {
    throw new Error('Build alpha version failed, `BUILD_ID` should be a number!');
  }
}

export const version = [
  v,
  isEnterprise ? '-enterprise' : '',
  isDev ? '-alpha' : '',
  (isEnterprise || isDev) && buildId ? `.${buildId}` : '',
].join('');

export const compileDefinedValues = {
  __COMMIT_ID__: JSON.stringify(commitId),
  __VERSION__: JSON.stringify(version),
  __IS_ENTERPRISE__: isEnterprise,
  __DEV__: isDev,
  __REQUIRED_ENGINE_VERSION__: JSON.stringify(dependencies['@rongcloud/engine'].match(/(\d+\.){2}\d+/)[0]),
  'process.env.NODE_ENV': '"production"',
};

export const root = join(__dirname, '..');
export const libRoot = join(root, 'src');
