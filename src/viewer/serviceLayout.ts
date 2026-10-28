import ELK, {
  type ElkExtendedEdge,
  type ElkNode,
} from "elkjs/lib/elk.bundled.js";
import {
  flattenServices,
  type Service,
  type ServiceDiagram,
} from "../services.js";

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };

/**
 * One connection per pair of services that ever talk, pointing from the one
 * declared first. Requests and replies share it, so the graph has no cycles
 * and ELK never routes a reply around the whole diagram.
 */
export type ServiceLink = {
  id: string;
  a: string;
  b: string;
  /** Some event goes a → b. */
  forward: boolean;
  /** Some event goes b → a. */
  backward: boolean;
  /** The longest label on the link. */
  label: string | undefined;
};

export type ServiceLayout = {
  width: number;
  height: number;
  /** Each service's own header and state, measured before layout. */
  sizes: Map<string, Size>;
  boxes: Map<string, Rect>;
  routes: Map<string, Point[]>;
};

export function serviceLinks(diagram: ServiceDiagram): ServiceLink[] {
  const order = new Map(
    flattenServices(diagram.services).map(({ service }, index) => [
      service.name,
      index,
    ]),
  );
  const links = new Map<string, ServiceLink>();
  for (const step of diagram.steps)
    for (const event of step.events) {
      const forward = order.get(event.from)! <= order.get(event.to)!;
      const [a, b] = forward ? [event.from, event.to] : [event.to, event.from];
      const id = linkId(a, b);
      const link = links.get(id) ?? {
        id,
        a,
        b,
        forward: false,
        backward: false,
        label: undefined,
      };
      if (forward) link.forward = true;
      else link.backward = true;
      // Measure the pill as drawn: a linked event shows ↗.
      const shown =
        event.label !== "" && event.annotation !== undefined
          ? `${event.label} ↗`
          : event.label;
      if (shown.length > (link.label?.length ?? 0)) link.label = shown;
      links.set(id, link);
    }
  return [...links.values()];
}

export function linkId(from: string, to: string) {
  return from < to ? `${from}|${to}` : `${to}|${from}`;
}

const elk = new ELK();

function contains(service: Service, name: string): boolean {
  return service.children.some(
    (child) => child.name === name || contains(child, name),
  );
}

/**
 * `sizes` are each service's own header and state; a parent grows around its
 * children. `label` is the largest event label, which must fit between layers.
 */
export async function layoutServices(input: {
  diagram: ServiceDiagram;
  links: ServiceLink[];
  sizes: Map<string, Size>;
  label: Size;
  direction: "RIGHT" | "DOWN";
}): Promise<ServiceLayout> {
  // Room for a label pill on the edge between two layers. Each parent lays out
  // its own children, so parents need it too.
  const betweenLayers = String(
    input.direction === "RIGHT"
      ? Math.max(40, input.label.width + 24)
      : Math.max(40, input.label.height + 28),
  );
  const node = (service: Service): ElkNode => {
    const own = input.sizes.get(service.name)!;
    if (service.children.length === 0)
      return { id: service.name, width: own.width, height: own.height };
    // A parent that talks to its own children needs room for that route and
    // its label between its header and the children.
    const inner = input.links.some(
      (link) => link.a === service.name && contains(service, link.b),
    );
    const room = (size: number) => (inner ? size + 24 : 0);
    const top =
      own.height +
      4 +
      (input.direction === "DOWN" ? room(input.label.height) : 0);
    const left =
      16 + (input.direction === "RIGHT" ? room(input.label.width) : 0);
    return {
      id: service.name,
      layoutOptions: {
        "elk.padding": `[top=${top},left=${left},bottom=16,right=16]`,
        "elk.nodeSize.constraints": "MINIMUM_SIZE",
        "elk.layered.spacing.nodeNodeBetweenLayers": betweenLayers,
        // Wide enough for its own header. ELK applies this before rotating
        // a top-to-bottom layout, so the axes swap.
        "elk.nodeSize.minimum":
          input.direction === "DOWN" ? `(0,${own.width})` : `(${own.width},0)`,
      },
      children: service.children.map(node),
    };
  };
  const graph: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": input.direction,
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.json.edgeCoords": "ROOT",
      "elk.json.shapeCoords": "ROOT",
      "elk.padding": "[top=8,left=8,bottom=8,right=8]",
      "elk.spacing.nodeNode": "32",
      "elk.layered.spacing.nodeNodeBetweenLayers": betweenLayers,
      "elk.spacing.edgeNode": "16",
      "elk.spacing.edgeEdge": "12",
    },
    children: input.diagram.services.map(node),
    edges: input.links.map((link): ElkExtendedEdge => ({
      id: link.id,
      sources: [link.a],
      targets: [link.b],
    })),
  };
  const result = await elk.layout(graph);

  const boxes = new Map<string, Rect>();
  const visit = (nodes: ElkNode[] | undefined) => {
    for (const child of nodes ?? []) {
      boxes.set(child.id, {
        x: child.x!,
        y: child.y!,
        width: child.width!,
        height: child.height!,
      });
      visit(child.children);
    }
  };
  visit(result.children);
  const routes = new Map(
    (result.edges ?? []).map((edge) => {
      const section = edge.sections![0]!;
      return [
        edge.id,
        [section.startPoint, ...(section.bendPoints ?? []), section.endPoint],
      ];
    }),
  );
  return {
    width: result.width!,
    height: result.height!,
    sizes: input.sizes,
    boxes,
    routes,
  };
}
