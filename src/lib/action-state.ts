export interface ActionState {
  error?: string;
  ok?: string;
  fieldErrors?: Record<string, string>;
}

export const initialState: ActionState = {};

export function formString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}
