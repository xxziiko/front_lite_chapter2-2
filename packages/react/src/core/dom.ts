/* eslint-disable @typescript-eslint/no-explicit-any */
import { NodeTypes } from "./constants";
import { Instance } from "./types";

/**
 * DOM 요소에 속성(props)을 설정합니다.
 * 이벤트 핸들러, 스타일, className 등 다양한 속성을 처리해야 합니다.
 */
export const setDomProps = (dom: HTMLElement, props: Record<string, any>): void => {
  Object.keys(props).forEach((key) => {
    if (key === "children") return;

    if (key.startsWith("on") && typeof props[key] === "function") {
      const eventName = key.slice(2).toLowerCase();
      dom.addEventListener(eventName, props[key]);
    } else if (key === "className") {
      dom.className = props[key] || "";
    } else if (key === "style" && typeof props[key] === "object") {
      Object.assign(dom.style, props[key]);
    } else if (key.startsWith("data-")) {
      dom.setAttribute(key, props[key]);
    } else {
      (dom as any)[key] = props[key];
    }
  });
};

/**
 * 이전 속성과 새로운 속성을 비교하여 DOM 요소의 속성을 업데이트합니다.
 * 변경된 속성만 효율적으로 DOM에 반영해야 합니다.
 */
export const updateDomProps = (
  dom: HTMLElement,
  prevProps: Record<string, any> = {},
  nextProps: Record<string, any> = {},
): void => {
  // 이전 속성 중 제거해야 할 것들 처리
  Object.keys(prevProps).forEach((key) => {
    if (key === "children") return;

    if (key.startsWith("on") && typeof prevProps[key] === "function") {
      // 이벤트 제거
      const eventName = key.slice(2).toLowerCase();
      dom.removeEventListener(eventName, prevProps[key]);
    } else if (key === "className") {
      // className이 새 props에 없거나 다르면 제거
      if (!(key in nextProps) || nextProps[key] !== prevProps[key]) {
        // setDomProps에서 처리하므로 여기서는 제거하지 않음
      }
    } else if (key === "style" && typeof prevProps[key] === "object") {
      // 이전 스타일 속성들 제거
      Object.keys(prevProps[key]).forEach((styleKey) => {
        if (!nextProps[key] || !(styleKey in nextProps[key])) {
          (dom.style as any)[styleKey] = "";
        }
      });
    } else if (key.startsWith("data-")) {
      // data 속성 제거
      if (!(key in nextProps)) {
        dom.removeAttribute(key);
      }
    } else if (!(key in nextProps)) {
      // 일반 속성 제거
      (dom as any)[key] = undefined;
    }
  });

  // 새 속성 설정
  setDomProps(dom, nextProps);
};

/**
 * 주어진 인스턴스에서 실제 DOM 노드(들)를 재귀적으로 찾아 배열로 반환합니다.
 * Fragment나 컴포넌트 인스턴스는 여러 개의 DOM 노드를 가질 수 있습니다.
 */
export const getDomNodes = (instance: Instance | null): (HTMLElement | Text)[] => {
  if (!instance) return [];

  if (instance.kind === NodeTypes.TEXT || instance.kind === NodeTypes.HOST) {
    return instance.dom ? [instance.dom] : [];
  }

  // Fragment나 Component인 경우 자식들의 DOM 노드를 수집
  const nodes: (HTMLElement | Text)[] = [];
  instance.children.forEach((child) => {
    nodes.push(...getDomNodes(child));
  });
  return nodes;
};

/**
 * 주어진 인스턴스에서 첫 번째 실제 DOM 노드를 찾습니다.
 */
export const getFirstDom = (instance: Instance | null): HTMLElement | Text | null => {
  if (!instance) return null;

  if (instance.kind === NodeTypes.TEXT || instance.kind === NodeTypes.HOST) {
    return instance.dom;
  }

  // Fragment나 Component인 경우 자식 중 첫 번째 DOM 찾기
  for (const child of instance.children) {
    const dom = getFirstDom(child);
    if (dom) return dom;
  }
  return null;
};

/**
 * 자식 인스턴스들로부터 첫 번째 실제 DOM 노드를 찾습니다.
 */
export const getFirstDomFromChildren = (children: (Instance | null)[]): HTMLElement | Text | null => {
  for (const child of children) {
    const dom = getFirstDom(child);
    if (dom) return dom;
  }
  return null;
};

/**
 * 인스턴스를 부모 DOM에 삽입합니다.
 * anchor 노드가 주어지면 그 앞에 삽입하여 순서를 보장합니다.
 */
export const insertInstance = (
  parentDom: HTMLElement,
  instance: Instance | null,
  anchor: HTMLElement | Text | null = null,
): void => {
  if (!instance) return;

  const domNodes = getDomNodes(instance);
  if (domNodes.length === 0) return;

  if (anchor) {
    const firstDom = domNodes[0];
    parentDom.insertBefore(firstDom, anchor);
    // 나머지 노드들도 순서대로 삽입
    for (let i = 1; i < domNodes.length; i++) {
      parentDom.insertBefore(domNodes[i], domNodes[i - 1].nextSibling);
    }
  } else {
    domNodes.forEach((node) => {
      parentDom.appendChild(node);
    });
  }
};

/**
 * 부모 DOM에서 인스턴스에 해당하는 모든 DOM 노드를 제거합니다.
 */
export const removeInstance = (parentDom: HTMLElement, instance: Instance | null): void => {
  if (!instance) return;

  const domNodes = getDomNodes(instance);
  domNodes.forEach((node) => {
    if (node.parentNode === parentDom) {
      parentDom.removeChild(node);
    }
  });
};
