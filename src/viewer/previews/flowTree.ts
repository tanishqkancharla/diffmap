import type { FlowState } from "../../parseFence.js";

/** The story IDs from the flow's start to `index`, which the preview page plays in order to reach the state. */
export function statePath(states: FlowState[], index: number) {
  const path: string[] = [];
  for (
    let at: number | undefined = index;
    at !== undefined;
    at = states[at]!.parent
  )
    path.unshift(states[at]!.story);
  return path;
}

/** The indexes from the start to `index`, for breadcrumbs. */
export function stateAncestry(states: FlowState[], index: number) {
  const indexes: number[] = [];
  for (
    let at: number | undefined = index;
    at !== undefined;
    at = states[at]!.parent
  )
    indexes.unshift(at);
  return indexes;
}

export function stateChildren(states: FlowState[], index: number) {
  return states.flatMap((state, at) => (state.parent === index ? [at] : []));
}

export function stateDepth(states: FlowState[], index: number) {
  return stateAncestry(states, index).length - 1;
}

export type MapPlacement = { column: number; row: number };

/**
 * Places each state for the expanded map: a column per step from the start, and rows so each subtree gets its own band,
 * with a parent centered on its children, as flow-preview's canvas lays states out.
 */
export function layoutFlow(states: FlowState[]) {
  const placements: MapPlacement[] = states.map(() => ({ column: 0, row: 0 }));
  let nextRow = 0;
  const place = (index: number, column: number): number => {
    const children = stateChildren(states, index);
    let row: number;
    if (children.length === 0) row = nextRow++;
    else {
      const rows = children.map((child) => place(child, column + 1));
      row = (rows[0]! + rows.at(-1)!) / 2;
    }
    placements[index] = { column, row };
    return row;
  };
  if (states.length > 0) place(0, 0);
  return {
    placements,
    columns:
      Math.max(0, ...placements.map((placement) => placement.column)) + 1,
    rows: Math.max(1, nextRow),
  };
}
