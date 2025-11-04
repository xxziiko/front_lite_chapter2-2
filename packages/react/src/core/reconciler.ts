import { context } from "./context";
import { Fragment, NodeTypes, TEXT_ELEMENT } from "./constants";
import { Instance, VNode } from "./types";
import {
  getFirstDom,
  getFirstDomFromChildren,
  insertInstance,
  removeInstance,
  setDomProps,
  updateDomProps,
} from "./dom";
import { createChildPath } from "./elements";
import { isEmptyValue } from "../utils";

/**
 * 이전 인스턴스와 새로운 VNode를 비교하여 DOM을 업데이트하는 재조정 과정을 수행합니다.
 *
 * @param parentDom - 부모 DOM 요소
 * @param instance - 이전 렌더링의 인스턴스
 * @param node - 새로운 VNode
 * @param path - 현재 노드의 고유 경로
 * @returns 업데이트되거나 새로 생성된 인스턴스
 */
export const reconcile = (
  parentDom: HTMLElement,
  instance: Instance | null,
  node: VNode | null,
  path: string,
): Instance | null => {
  // 1. 새 노드가 null이면 기존 인스턴스를 제거합니다. (unmount)
  if (node === null) {
    if (instance) {
      removeInstance(parentDom, instance);
    }
    return null;
  }

  // 2. 기존 인스턴스가 없으면 새 노드를 마운트합니다. (mount)
  if (!instance) {
    return mount(parentDom, node, path);
  }

  // 3. 타입이나 키가 다르면 기존 인스턴스를 제거하고 새로 마운트합니다.
  if (instance.node.type !== node.type || instance.key !== node.key) {
    removeInstance(parentDom, instance);
    return mount(parentDom, node, path);
  }

  // 4. 타입과 키가 같으면 인스턴스를 업데이트합니다. (update)
  instance.node = node;
  instance.path = path;

  // 텍스트 노드 업데이트
  if (node.type === TEXT_ELEMENT) {
    const textNode = instance.dom as Text;
    const newValue = node.props.nodeValue ?? "";
    if (textNode && textNode.nodeValue !== newValue) {
      textNode.nodeValue = newValue;
    }
    return instance;
  }

  // DOM 요소 업데이트
  if (typeof node.type === "string") {
    const dom = instance.dom as HTMLElement;
    if (dom) {
      updateDomProps(dom, instance.node.props, node.props);
    }
    // 자식 재조정
    reconcileChildren(dom, instance, node, path);
    return instance;
  }

  // Fragment 처리
  if (node.type === Fragment) {
    reconcileChildren(parentDom, instance, node, path);
    return instance;
  }

  // 컴포넌트 업데이트
  if (typeof node.type === "function") {
    return updateComponent(parentDom, instance, node, path);
  }

  return instance;
};

function mount(parentDom: HTMLElement, node: VNode, path: string): Instance | null {
  // 텍스트 노드
  if (node.type === TEXT_ELEMENT) {
    const textNode = document.createTextNode(node.props.nodeValue ?? "");
    const instance: Instance = {
      kind: NodeTypes.TEXT,
      dom: textNode,
      node,
      children: [],
      key: node.key,
      path,
    };
    // insertInstance를 사용하여 DOM 삽입
    insertInstance(parentDom, instance, null);
    return instance;
  }

  // DOM 요소
  if (typeof node.type === "string") {
    const dom = document.createElement(node.type);
    setDomProps(dom, node.props);
    const instance: Instance = {
      kind: NodeTypes.HOST,
      dom,
      node,
      children: [],
      key: node.key,
      path,
    };

    // 자식 마운트 (isEmptyValue로 필터링)
    const children = ((node.props.children || []) as VNode[]).filter((child) => !isEmptyValue(child));
    instance.children = children.map((child, index) => {
      if (isEmptyValue(child)) return null;
      const childPath = createChildPath(path, child.key, index, child.type, children);
      return reconcile(dom, null, child, childPath);
    });

    // insertInstance를 사용하여 DOM 삽입
    insertInstance(parentDom, instance, null);
    return instance;
  }

  // Fragment
  if (node.type === Fragment) {
    const instance: Instance = {
      kind: NodeTypes.FRAGMENT,
      dom: null,
      node,
      children: [],
      key: node.key,
      path,
    };

    // 자식 마운트 (isEmptyValue로 필터링)
    const children = ((node.props.children || []) as VNode[]).filter((child) => !isEmptyValue(child));
    instance.children = children.map((child, index) => {
      if (isEmptyValue(child)) return null;
      const childPath = createChildPath(path, child.key, index, child.type, children);
      return reconcile(parentDom, null, child, childPath);
    });

    return instance;
  }

  // 함수 컴포넌트 마운트
  if (typeof node.type === "function") {
    return mountComponent(parentDom, node, path);
  }

  return null;
}

function reconcileChildren(parentDom: HTMLElement, instance: Instance, node: VNode, path: string): void {
  const prevChildren = instance.children;
  // isEmptyValue로 필터링된 children
  const nextChildren = ((node.props.children || []) as VNode[]).filter((child) => !isEmptyValue(child));

  // 간단한 구현: 길이만 맞춤
  const maxLength = Math.max(prevChildren.length, nextChildren.length);
  const newChildren: (Instance | null)[] = [];

  for (let i = 0; i < maxLength; i++) {
    const prevChild = prevChildren[i] || null;
    const nextChild = nextChildren[i] || null;

    if (nextChild === null || isEmptyValue(nextChild)) {
      if (prevChild) {
        removeInstance(parentDom, prevChild);
      }
      newChildren.push(null);
    } else {
      // 다음 자식의 첫 번째 DOM을 anchor로 사용 (역순 순회 최적화)
      const nextSibling = getFirstDomFromChildren(prevChildren.slice(i + 1));
      const childPath = createChildPath(path, nextChild.key, i, nextChild.type, nextChildren);
      const childInstance = reconcile(parentDom, prevChild, nextChild, childPath);

      // 새로 마운트된 경우 올바른 위치에 삽입
      if (childInstance && !prevChild && nextSibling) {
        const firstDom = getFirstDom(childInstance);
        if (firstDom && firstDom.parentNode !== parentDom) {
          insertInstance(parentDom, childInstance, nextSibling);
        }
      }

      newChildren.push(childInstance);
    }
  }

  instance.children = newChildren;
}

function mountComponent(parentDom: HTMLElement, node: VNode, path: string): Instance | null {
  const Component = node.type as React.ComponentType;

  // 컴포넌트 경로를 스택에 추가
  context.hooks.componentStack.push(path);
  context.hooks.visited.add(path);

  // 훅 상태 초기화
  if (!context.hooks.state.has(path)) {
    context.hooks.state.set(path, []);
  }
  if (!context.hooks.cursor.has(path)) {
    context.hooks.cursor.set(path, 0);
  }

  try {
    // 컴포넌트 함수 실행
    const childNode = Component(node.props);

    // 컴포넌트 인스턴스 생성
    const instance: Instance = {
      kind: NodeTypes.COMPONENT,
      dom: null,
      node,
      children: [],
      key: node.key,
      path,
    };

    // 자식 VNode를 reconcile (컴포넌트의 자식이므로 경로는 그대로 사용)
    if (childNode !== null && !isEmptyValue(childNode)) {
      const childInstance = reconcile(parentDom, null, childNode, path);
      instance.children = [childInstance];
    }

    return instance;
  } finally {
    // 컴포넌트 경로 제거
    context.hooks.componentStack.pop();
  }
}

function updateComponent(parentDom: HTMLElement, instance: Instance, node: VNode, path: string): Instance | null {
  const Component = node.type as React.ComponentType;

  // 컴포넌트 경로를 스택에 추가
  context.hooks.componentStack.push(path);
  context.hooks.visited.add(path);

  // 훅 커서 초기화
  context.hooks.cursor.set(path, 0);

  try {
    // 컴포넌트 함수 재실행
    const childNode = Component(node.props);

    // 인스턴스 업데이트
    instance.node = node;
    instance.path = path;

    // 기존 자식과 새 자식 reconcile
    const prevChild = instance.children[0] || null;
    const nextChild =
      childNode !== null && !isEmptyValue(childNode) ? reconcile(parentDom, prevChild, childNode, path) : null;

    // 자식이 null이면 제거
    if (nextChild === null && prevChild) {
      removeInstance(parentDom, prevChild);
    }

    instance.children = [nextChild];

    return instance;
  } finally {
    // 컴포넌트 경로 제거
    context.hooks.componentStack.pop();
  }
}
