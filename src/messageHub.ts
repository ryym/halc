import { Message } from "./message";
import { Unsubscribe } from "./storeTypes";

export type MessageSubscriber<P extends any[]> = (...payload: P) => unknown;

interface MessageState<P extends any[]> {
  subscribers: MessageSubscriber<P>[];
}

export class MessageHub {
  private readonly messageStates = new Map<Message<any[]>, MessageState<any[]>>();

  subscribe = <P extends any[]>(msg: Message<P>, fn: MessageSubscriber<P>): Unsubscribe => {
    this.getMessageState(msg).subscribers.push(fn);
    return () => {
      const state = this.getMessageState(msg);
      state.subscribers = state.subscribers.filter((s) => s !== fn);
    };
  };

  notify = <P extends any[]>(msg: Message<P>, ...payload: P): void => {
    const state = this.getMessageState(msg);
    state.subscribers.forEach((s) => s(...payload));
  };

  private getMessageState<P extends any[]>(msg: Message<P>): MessageState<P> {
    let state = this.messageStates.get(msg);
    if (state == null) {
      state = { subscribers: [] };
      this.messageStates.set(msg, state);
    }
    return state;
  }
}
