import { shallowEquals } from "../utils";
import { context } from "./context";
import { EffectHook } from "./types";
import { enqueueRender } from "./render";
import { HookTypes } from "./constants";

/**
 * 사용되지 않는 컴포넌트의 훅 상태와 이펙트 클린업 함수를 정리합니다.
 */
export const cleanupUnusedHooks = () => {
  // visited에 없는 경로의 훅들을 정리
  const pathsToRemove: string[] = [];
  context.hooks.state.forEach((_, path) => {
    if (!context.hooks.visited.has(path)) {
      pathsToRemove.push(path);
    }
  });

  pathsToRemove.forEach((path) => {
    context.hooks.state.delete(path);
    context.hooks.cursor.delete(path);
  });

  context.hooks.visited.clear();
};

/**
 * 컴포넌트의 상태를 관리하기 위한 훅입니다.
 * @param initialValue - 초기 상태 값 또는 초기 상태를 반환하는 함수
 * @returns [현재 상태, 상태를 업데이트하는 함수]
 */
export const useState = <T>(initialValue: T | (() => T)): [T, (nextValue: T | ((prev: T) => T)) => void] => {
  // 1. 현재 컴포넌트의 훅 커서와 상태 배열을 가져옵니다.
  const path = context.hooks.currentPath;
  const cursor = context.hooks.currentCursor;
  const hooks = context.hooks.currentHooks;

  // 2. 첫 렌더링이라면 초기값으로 상태를 설정합니다.
  if (cursor >= hooks.length) {
    const value = typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;
    hooks.push(value);
  }

  // 3. 현재 상태 가져오기
  const state = hooks[cursor] as T;

  // 4. 상태 변경 함수(setter)를 생성합니다.
  const setState = (nextValue: T | ((prev: T) => T)) => {
    const newValue = typeof nextValue === "function" ? (nextValue as (prev: T) => T)(state) : nextValue;

    // 새 값이 이전 값과 같으면(Object.is) 재렌더링을 건너뜁니다.
    if (Object.is(state, newValue)) {
      return;
    }

    // 값이 다르면 상태를 업데이트하고 재렌더링을 예약(enqueueRender)합니다.
    hooks[cursor] = newValue;
    enqueueRender();
  };

  // 5. 훅 커서를 증가시킵니다.
  context.hooks.cursor.set(path, cursor + 1);

  return [state, setState];
};

/**
 * 컴포넌트의 사이드 이펙트를 처리하기 위한 훅입니다.
 * @param effect - 실행할 이펙트 함수. 클린업 함수를 반환할 수 있습니다.
 * @param deps - 의존성 배열. 이 값들이 변경될 때만 이펙트가 다시 실행됩니다.
 */
export const useEffect = (effect: () => (() => void) | void, deps?: unknown[]): void => {
  // 1. 현재 컴포넌트 정보 가져오기
  const path = context.hooks.currentPath;
  const cursor = context.hooks.currentCursor;
  const hooks = context.hooks.currentHooks;

  // 2. 이전 훅 정보 확인
  let prevHook: EffectHook | undefined = undefined;
  if (cursor < hooks.length && hooks[cursor] && typeof hooks[cursor] === "object" && "kind" in hooks[cursor]) {
    prevHook = hooks[cursor] as EffectHook;
  }

  // 3. 의존성 배열 비교
  const shouldRun =
    !prevHook || // 첫 렌더링
    deps === undefined || // deps가 없으면 매 렌더링마다 실행
    !shallowEquals(prevHook.deps, deps); // 의존성이 변경됨

  // 4. 이펙트 실행 결정
  if (shouldRun) {
    // 이전 cleanup 함수가 있으면 스케줄링
    if (prevHook?.cleanup) {
      context.effects.queue.push({
        path,
        cursor,
        cleanup: prevHook.cleanup,
      });
    }

    // 새 이펙트 생성 및 저장
    const hook: EffectHook = {
      kind: HookTypes.EFFECT,
      deps: deps ?? null,
      cleanup: null,
      effect,
    };

    // 훅 저장
    if (cursor >= hooks.length) {
      hooks.push(hook);
    } else {
      hooks[cursor] = hook;
    }

    // 이펙트 실행을 큐에 추가 (렌더링 후 비동기 실행)
    context.effects.queue.push({
      path,
      cursor,
      effect: () => {
        const cleanup = effect();
        if (typeof cleanup === "function") {
          const currentHook = hooks[cursor] as EffectHook;
          if (currentHook) {
            currentHook.cleanup = cleanup;
          }
        }
      },
    });
  } else {
    // 의존성이 변경되지 않았으면 이전 훅 정보 유지
    if (cursor >= hooks.length) {
      hooks.push(prevHook!);
    }
  }

  // 5. 훅 커서를 증가시킵니다.
  context.hooks.cursor.set(path, cursor + 1);
};
