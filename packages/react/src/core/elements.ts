/* eslint-disable @typescript-eslint/no-explicit-any */
import { isEmptyValue } from "../utils";
import { VNode } from "./types";
import { TEXT_ELEMENT } from "./constants";

/**
 * 주어진 노드를 VNode 형식으로 정규화합니다.
 * null, undefined, boolean, 배열, 원시 타입 등을 처리하여 일관된 VNode 구조를 보장합니다.
 */
export const normalizeNode = (node: VNode): VNode | null => {
  if (isEmptyValue(node)) return null;

  if (typeof node === "string" || typeof node === "number") {
    return createTextElement(node);
  }

  return node as VNode;
};

/**
 * 텍스트 노드를 위한 VNode를 생성합니다.
 */
const createTextElement = (node: string | number): VNode => {
  // 여기를 구현하세요.
  return {
    type: TEXT_ELEMENT,
    key: null,
    props: {
      nodeValue: String(node),
      children: [],
    },
  };
};

/**
 * JSX로부터 전달된 인자를 VNode 객체로 변환합니다.
 * 이 함수는 JSX 변환기에 의해 호출됩니다. (예: Babel, TypeScript)
 */
export const createElement = (
  type: string | symbol | React.ComponentType<any>,
  originProps?: Record<string, any> | null,
  ...rawChildren: any[]
) => {
  const flatten = (children: any[]): any[] => {
    return children.flatMap((child) => {
      if (Array.isArray(child)) {
        return flatten(child);
      }
      return child;
    });
  };

  const children = flatten(rawChildren)
    .map((child) => normalizeNode(child))
    .filter((n): n is VNode => n !== null);

  const { key, ...rest } = originProps ?? {};
  const props = children.length > 0 ? { ...rest, children } : { ...rest };

  return {
    type,
    key: key ?? null,
    props,
  };
};

/**
 * 부모 경로와 자식의 key/index를 기반으로 고유한 경로를 생성합니다.
 * 이는 훅의 상태를 유지하고 Reconciliation에서 컴포넌트를 식별하는 데 사용됩니다.
 */
export const createChildPath = (
  parentPath: string,
  key: string | null,
  index: number,
  nodeType?: string | symbol | React.ComponentType,
  siblings?: VNode[],
): string => {
  // key가 있으면 key 기반 경로
  if (key !== null) {
    return `${parentPath}k${String(key)}`;
  }

  // key가 없으면 타입별 인덱스 기반 경로
  let typeIndex = 0;
  if (siblings && nodeType) {
    for (let i = 0; i < index; i += 1) {
      if (siblings[i]?.type === nodeType) {
        typeIndex += 1;
      }
    }
  }

  // 타입 이름 추출
  let typeName = "unknown";
  if (typeof nodeType === "string") {
    typeName = nodeType;
  } else if (typeof nodeType === "function") {
    typeName = (nodeType as any).displayName || (nodeType as any).name || "Component";
  } else if (typeof nodeType !== "undefined") {
    typeName = String(nodeType);
  }

  return `${parentPath}.i${index}.c${typeName}_${typeIndex}`;
};
