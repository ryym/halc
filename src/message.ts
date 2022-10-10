export interface MessageTemplate {
  readonly name: string;
}

export interface Message<P> {
  readonly _ghost?: { payload: P };
  readonly name: string;
}

export const defineMessage = <P>(template: MessageTemplate): Message<P> => {
  return Object.freeze(template);
};
