import {
  createContext,
  createElement,
  Fragment,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode
} from "react";
import {
  EvoClient,
  createEvoClient,
  type EvoClientOptions,
  type VariantContext
} from "@evofork/sdk-core";

export { EvoClient, createEvoClient };
export type { EvoClientOptions, VariantContext, VariantResolution } from "@evofork/sdk-core";

export const moduleId = "@evofork/sdk-react";

export type EvoProviderProps = {
  children?: ReactNode;
  client?: EvoClient;
  endpoint?: string;
  appId?: string;
  apiKey?: string;
  timeoutMs?: number;
  strict?: boolean;
};

export type UseEvoVariantOptions = {
  fallbackVariant?: string;
};

export type EvoSlotProps = {
  surface: string;
  variant?: string | null;
  fallback: ReactNode;
  variants?: Record<string, ReactNode> | ((variant: string, surface: string) => ReactNode);
};

const defaultEndpoint = "/";
const defaultVariant = "default";
const EvoClientContext = createContext<EvoClient | undefined>(undefined);

export function EvoProvider(props: EvoProviderProps): ReactElement {
  const client = useMemo(() => {
    if (props.client) {
      return props.client;
    }

    if (!props.appId) {
      throw new Error("EvoProvider requires appId when client is not provided");
    }

    return createEvoClient({
      endpoint: props.endpoint ?? defaultEndpoint,
      appId: props.appId,
      apiKey: props.apiKey,
      timeoutMs: props.timeoutMs,
      strict: props.strict
    });
  }, [props.apiKey, props.appId, props.client, props.endpoint, props.strict, props.timeoutMs]);

  return createElement(EvoClientContext.Provider, { value: client }, props.children);
}

export function useEvoClient(): EvoClient {
  const client = useContext(EvoClientContext);

  if (!client) {
    throw new Error("useEvoClient must be used within EvoProvider");
  }

  return client;
}

export function useEvoVariant(
  surfaceId: string,
  context: VariantContext = {},
  options: UseEvoVariantOptions = {}
): string {
  const client = useEvoClient();
  const fallbackVariant = options.fallbackVariant ?? defaultVariant;
  const [variant, setVariant] = useState(fallbackVariant);
  const contextKey = stableContextKey(context);

  useEffect(() => {
    let active = true;

    setVariant(fallbackVariant);

    client
      .getVariant(surfaceId, context)
      .then((resolution) => {
        if (active) {
          setVariant(resolution.variant || fallbackVariant);
        }
      })
      .catch(() => {
        if (active) {
          setVariant(fallbackVariant);
        }
      });

    return () => {
      active = false;
    };
  }, [client, contextKey, fallbackVariant, surfaceId]);

  return variant;
}

export function EvoSlot(props: EvoSlotProps): ReactElement {
  const variant = props.variant ?? defaultVariant;
  const rendered = resolveVariantNode(props.surface, variant, props.fallback, props.variants);

  return createElement(Fragment, null, rendered);
}

function resolveVariantNode(
  surface: string,
  variant: string,
  fallback: ReactNode,
  variants: EvoSlotProps["variants"]
): ReactNode {
  if (!variant || variant === defaultVariant || !variants) {
    return fallback;
  }

  if (typeof variants === "function") {
    return variants(variant, surface) ?? fallback;
  }

  return variants[variant] ?? fallback;
}

function stableContextKey(context: VariantContext): string {
  return JSON.stringify(sortForStableKey(context));
}

function sortForStableKey(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForStableKey);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, childValue]) => [key, sortForStableKey(childValue)])
    );
  }

  return value;
}
