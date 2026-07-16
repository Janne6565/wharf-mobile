// Form state for the invite-member sheet. Owns the react-hook-form + zod email
// field and the completeness gate; the invite mutation itself lives in the
// project-detail logic (the sheet is handed onInvite/saving/error/done as props).
// The sheet closes and resets once the invite succeeds (`done`). t() lives here
// because the hook produces the translated zod validation messages (REACT.md
// exception for hooks that emit their own error strings).

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { EMAIL_PATTERN } from "@/lib/validators";

export interface InviteFormValues {
  email: string;
}

interface UseInviteSheetLogicParams {
  // True once the invite mutation has succeeded: close + reset the form.
  readonly done: boolean;
  // Close the sheet (owned by the parent, which controls visibility).
  readonly onClose: () => void;
  // Reset the parent's mutation state (clears a stale error/done on re-open).
  readonly reset: () => void;
}

export function useInviteSheetLogic({ done, onClose, reset }: UseInviteSheetLogicParams) {
  const { t } = useTranslation();
  const schema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .min(1, t("projectDetail.invite.emailRequired"))
          .regex(EMAIL_PATTERN, t("projectDetail.invite.emailInvalid")),
      }),
    [t],
  );
  const form = useForm<InviteFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
    mode: "onSubmit",
  });

  // On a successful invite the parent flips `done`; clear the field and close.
  useEffect(() => {
    if (done) {
      form.reset({ email: "" });
      onClose();
    }
  }, [done, form, onClose]);

  // Cancel resets both the parent's mutation state and the local field, so the
  // next open starts clean (no stale error banner, no leftover email).
  const close = useCallback(() => {
    reset();
    form.reset({ email: "" });
    onClose();
  }, [reset, form, onClose]);

  // Completeness gate only (REACT.md): disable submit while the field is empty,
  // but let a bad-format email through so zod surfaces the message on submit.
  const email = form.watch("email");
  return { form, close, canSubmit: email.trim().length > 0 };
}
