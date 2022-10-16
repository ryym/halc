import { generateId } from "./globalId";
import { defineMessage } from "./message";
import { Block, BlockUpdateConfigBuilder, Comparer } from "./storeTypes";

export interface BlockConfig<V> {
  readonly default: () => V;
  readonly id?: string;
  readonly name?: string;
  readonly isSame?: Comparer<V>;
  readonly update?: BlockUpdateConfigBuilder<V>;
}

export const block = <V>(config: BlockConfig<V>): Block<V> => {
  const id = config.id || generateId();
  const blockName = config.name || `block[${id}]`;
  return {
    type: "Block",
    id,
    name: blockName,
    default: config.default,
    isSame: config.isSame || Object.is,
    buildUpdateConfigs: config.update || (() => []),
    changed: defineMessage<never>({ name: `${blockName}-changed` }),
  };
};
