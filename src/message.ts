export interface MessageTemplate {
  readonly name: string;
}

export interface Message<P extends any[]> {
  readonly _ghost?: { payload: P };
  readonly name: string;
}

export const defineMessage = <P extends any[]>(template: MessageTemplate): Message<P> => {
  return Object.freeze(template);
};
