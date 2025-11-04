import { context } from "./context";
// import { getDomNodes, insertInstance } from "./dom";
import { reconcile } from "./reconciler";
import { cleanupUnusedHooks } from "./hooks";
import { withEnqueue, enqueue } from "../utils";

/**
 * 루트 컴포넌트의 렌더링을 수행하는 함수입니다.
 * `enqueueRender`에 의해 스케줄링되어 호출됩니다.
 */
export const render = (): void => {
  // 1. visited Set 초기화 (이번 렌더링에서 사용된 경로를 추적하기 위해)
  context.hooks.visited.clear();
  context.hooks.componentStack = [];

  // 2. reconcile 함수를 호출하여 루트 노드를 재조정합니다.
  const { container, node } = context.root;
  if (container && node) {
    const instance = reconcile(container, context.root.instance, node, "");
    context.root.instance = instance;
  }

  // 3. 사용되지 않은 훅들을 정리(cleanupUnusedHooks)합니다.
  cleanupUnusedHooks();

  // 4. 이펙트 큐 실행 (렌더링 후 비동기로)
  flushEffects();
};

/**
 * 이펙트 큐를 비동기로 실행합니다.
 */
const flushEffects = withEnqueue(() => {
  while (context.effects.queue.length > 0) {
    const item = context.effects.queue.shift();
    if (!item) continue;

    if ("cleanup" in item) {
      // cleanup 실행
      item.cleanup();
    } else if ("effect" in item) {
      // effect 실행 (비동기)
      enqueue(item.effect);
    }
  }
});

/**
 * `render` 함수를 마이크로태스크 큐에 추가하여 중복 실행을 방지합니다.
 */
export const enqueueRender = withEnqueue(render);
