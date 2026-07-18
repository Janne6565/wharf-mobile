import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// A minimal, RN-native toast queue (Redux client state per REACT.md — toasts are
// UI state, not server state). Logic hooks dispatch `showToast` after a mutation
// settles; the <ToastHost> component (which owns `t()`) translates the stored key
// and auto-dismisses each entry. Toasts carry an i18n KEY (not a resolved string)
// so hooks stay translation-free and the message follows the active language.

// The union of message keys any caller may raise. Every entry is a valid `t()`
// key, so <ToastHost> translates it without a cast.
export type ToastMessageKey =
  | "toast.inviteSent"
  | "toast.inviteRevoked"
  | "toast.revokeFailed"
  | "toast.acceptFailed"
  | "toast.declineFailed"
  | "toast.projectCreated"
  | "toast.projectCreateFailed"
  | "toast.projectCreateNeedsSync"
  | "toast.projectUpdated"
  | "toast.projectUpdateFailed"
  | "toast.projectDeleted"
  | "toast.projectDeleteFailed"
  | "toast.projectLeft"
  | "toast.projectLeaveFailed"
  | "toast.keyCopied"
  | "toast.biometricsEnabled"
  | "toast.biometricsDisabled"
  | "toast.biometricsFailed";

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  readonly id: number;
  readonly messageKey: ToastMessageKey;
  readonly params?: Record<string, string>;
  readonly kind: ToastKind;
}

interface ToastState {
  toasts: Toast[];
  nextId: number;
}

const initialState: ToastState = {
  toasts: [],
  nextId: 1,
};

interface ShowToastPayload {
  readonly messageKey: ToastMessageKey;
  readonly params?: Record<string, string>;
  readonly kind?: ToastKind;
}

const toastSlice = createSlice({
  name: "toast",
  initialState,
  reducers: {
    showToast(state, action: PayloadAction<ShowToastPayload>) {
      state.toasts.push({
        id: state.nextId,
        messageKey: action.payload.messageKey,
        params: action.payload.params,
        kind: action.payload.kind ?? "info",
      });
      state.nextId += 1;
    },
    dismissToast(state, action: PayloadAction<number>) {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload);
    },
  },
});

export const { showToast, dismissToast } = toastSlice.actions;
export default toastSlice.reducer;
