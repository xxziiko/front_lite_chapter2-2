const isNullOrUndefined = (value: unknown): value is null | undefined => {
  return value === null || value === undefined;
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isArray = (value: unknown): value is unknown[] => {
  return Array.isArray(value);
};

const shallowCompareArrays = (a: unknown[], b: unknown[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) {
      return false;
    }
  }
  return true;
};

const shallowCompareObjects = (a: Record<string, unknown>, b: Record<string, unknown>): boolean => {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!keysB.includes(key)) {
      return false;
    }
    if (!Object.is(a[key], b[key])) {
      return false;
    }
  }
  return true;
};

const deepCompareArrays = (a: unknown[], b: unknown[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (!deepEquals(a[i], b[i])) {
      return false;
    }
  }
  return true;
};

const deepCompareObjects = (a: Record<string, unknown>, b: Record<string, unknown>): boolean => {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!keysB.includes(key)) {
      return false;
    }
    if (!deepEquals(a[key], b[key])) {
      return false;
    }
  }
  return true;
};

/**
 * 두 값의 얕은 동등성을 비교합니다.
 * 객체와 배열은 1단계 깊이까지만 비교합니다.
 */
export const shallowEquals = (a: unknown, b: unknown): boolean => {
  // 참조 동일성 검사
  if (Object.is(a, b)) {
    return true;
  }

  // null/undefined 처리
  if (isNullOrUndefined(a) || isNullOrUndefined(b)) {
    return false;
  }

  // 타입이 다르면 false
  if (typeof a !== typeof b) {
    return false;
  }

  // 배열 비교
  if (isArray(a) && isArray(b)) {
    return shallowCompareArrays(a, b);
  }

  // 객체 비교 (배열이 아닌 경우)
  if (isObject(a) && isObject(b) && !isArray(a) && !isArray(b)) {
    return shallowCompareObjects(a, b);
  }

  return false;
};

/**
 * 두 값의 깊은 동등성을 비교합니다.
 * 객체와 배열의 모든 중첩된 속성을 재귀적으로 비교합니다.
 */
export const deepEquals = (a: unknown, b: unknown): boolean => {
  // 참조 동일성 검사
  if (Object.is(a, b)) {
    return true;
  }

  // null/undefined 처리
  if (isNullOrUndefined(a) || isNullOrUndefined(b)) {
    return false;
  }

  // 타입이 다르면 false
  if (typeof a !== typeof b) {
    return false;
  }

  // 배열 비교
  if (isArray(a) && isArray(b)) {
    return deepCompareArrays(a, b);
  }

  // 객체 비교 (배열이 아닌 경우)
  if (isObject(a) && isObject(b) && !isArray(a) && !isArray(b)) {
    return deepCompareObjects(a, b);
  }

  // 기본 타입 비교
  return false;
};
