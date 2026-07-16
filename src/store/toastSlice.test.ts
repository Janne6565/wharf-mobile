import reducer, { dismissToast, showToast } from "./toastSlice";

describe("toastSlice", () => {
  it("starts empty", () => {
    expect(reducer(undefined, { type: "@@INIT" })).toEqual({ toasts: [], nextId: 1 });
  });

  it("appends a toast with an incrementing id and defaults kind to info", () => {
    const state = reducer(undefined, showToast({ messageKey: "toast.inviteRevoked" }));
    expect(state.toasts).toEqual([
      { id: 1, messageKey: "toast.inviteRevoked", params: undefined, kind: "info" },
    ]);
    expect(state.nextId).toBe(2);
  });

  it("keeps params and kind, and stacks multiple toasts with unique ids", () => {
    let state = reducer(
      undefined,
      showToast({ messageKey: "toast.inviteSent", params: { email: "a@b.io" }, kind: "success" }),
    );
    state = reducer(state, showToast({ messageKey: "toast.revokeFailed", kind: "error" }));
    expect(state.toasts.map((toast) => toast.id)).toEqual([1, 2]);
    expect(state.toasts[0]).toMatchObject({ params: { email: "a@b.io" }, kind: "success" });
    expect(state.toasts[1]).toMatchObject({ kind: "error" });
  });

  it("dismisses only the toast with the given id", () => {
    let state = reducer(
      undefined,
      showToast({ messageKey: "toast.inviteSent", params: { email: "x" } }),
    );
    state = reducer(state, showToast({ messageKey: "toast.inviteRevoked" }));
    state = reducer(state, dismissToast(1));
    expect(state.toasts.map((toast) => toast.id)).toEqual([2]);
  });
});
