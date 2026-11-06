const deepCopy = (target: any): Object => {
  // 定义一个变量
  let result: any;
  // 如果当前需要深拷贝的是一个对象的话
  if (typeof target === 'object' && target !== null) {
    // 如果是一个数组的话
    if (Array.isArray(target)) {
      result = []; // 将result赋值为一个数组，并且执行遍历
      for (let i in target) {
        // 递归克隆数组中的每一项
        result.push(deepCopy(target[i]));
      }
    } else {
      // 否则是普通对象，直接for in循环，递归赋值对象的所有值
      result = {};
      for (let i in target) {
        result[i] = deepCopy(target[i]);
      }
    }
    // 如果不是对象的话，就是基本数据类型，那么直接赋值
  } else {
    result = target;
  }
  // 返回最终结果
  return result;
};

export const clone = (target: any) => {
  let result;
  try {
    result = deepCopy(target);
  } catch (e) {
    result = JSON.parse(JSON.stringify(target));
  }
  return result;
};

/**
 * 通过 JSON 拷贝
*/
export const cloneByJSON = <T>(sourceObj: T): T => JSON.parse(JSON.stringify(sourceObj));
