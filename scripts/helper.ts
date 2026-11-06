import {
  rmdirSync, existsSync, statSync, rmSync, mkdirSync, unlinkSync, copyFileSync,
  readdirSync,
} from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

/** 删除目录 */
export function rmdir(target: string) {
  // node 14.14 新增，后续 rmdirSync 会被废弃
  const handler = typeof rmSync === 'function' ? rmSync : rmdirSync;
  if (existsSync(target) && statSync(target).isDirectory()) handler(target, { recursive: true });
}

/** 创建目录 */
export function mkdir(target: string) {
  mkdirSync(target, { recursive: true });
}

/** 删除文件 */
export function rmFile(target: string) {
  if (existsSync(target) && !statSync(target).isDirectory()) unlinkSync(target);
}

/** 拷贝文件到指定位置 */
export function copyFile(src: string, desk: string) {
  mkdir(join(desk, '..'));
  copyFileSync(src, desk);
}

/** 拷贝目录（或文件）到指定位置 */
export function copy(src: string, desk: string) {
  if (statSync(src).isDirectory()) {
    readdirSync(src).forEach((item) => copy(join(src, item), join(desk, item)));
    return;
  }
  copyFile(src, desk);
}

/** 执行 shell 命令 */
export function exec(command: string, cwd: string = process.cwd()) {
  execSync(command, { stdio: 'inherit', cwd });
}

/**
 * 遍历删除目录下符合匹配特征的文件
 * @param path 待删除文件所属目录
 * @param regexp 匹配待删除文件的正则表达式
 * @param skip 需要跳过的文件，文件位置需为全路径
 * @returns
 */
export function rmF(path: string, regexp: RegExp, skips: string[] = []) {
  if (statSync(path).isDirectory()) {
    readdirSync(path).forEach((item) => rmF(join(path, item), regexp, skips));
    // 删除空文件夹
    if (readdirSync(path).length === 0) rmdir(path);
    return;
  }

  if (skips.some((item) => item === path)) {
    return;
  }

  if (regexp.test(path)) {
    unlinkSync(path);
  }
}

export const log = (content: string) => {
  process.stdout.write(`${content}\n`);
};

export const error = (content: string) => {
  process.stderr.write(`${content}\n`);
};
