import { generateId } from "./globalId";
import { defineMessage } from "./message";
import { Block, BlockUpdateConfigBuilder, Comparer } from "./storeTypes";

export interface BlockConfig<V> {
  readonly default: () => V;
  readonly name?: string;
  readonly isSame?: Comparer<V>;
  readonly update?: BlockUpdateConfigBuilder<V>;
}

export const block = <V>(config: BlockConfig<V>): Block<V> => {
  const changedMsgName = config.name ? `block-${config.name}-changed` : "anonymous-block-changed";
  return {
    type: "Block",
    id: generateId(),
    default: config.default,
    isSame: config.isSame || Object.is,
    buildUpdateConfigs: config.update || (() => []),
    changed: defineMessage<never>({ name: changedMsgName }),
  };
};
