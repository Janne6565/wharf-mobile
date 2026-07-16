// Logic for the pairing-code screen: the phone-side half of the browser OAuth
// flow (and the universal fallback for any signed-in web session). The user
// copies the 8-char code the web app shows and exchanges it for a DIRECT-mode
// session here. t() lives in the hook because it maps API failures to
// translated messages (REACT.md exception).

import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { getHttpStatus } from "@/api/httpError";
import { pairDevice } from "@/auth/pairing";
import { establishSession } from "@/auth/session";
import { formatPairingCode, isCompletePairingCode, rawPairingCode } from "./lib";

export function usePairLogic() {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onChangeCode = useCallback((input: string) => {
    setSubmitError(null);
    setCode(formatPairingCode(input));
  }, []);

  const mutation = useMutation({
    mutationFn: async (rawCode: string) => {
      const session = await pairDevice(rawCode);
      await establishSession(session);
      // No unlock here: a paired session has no password in hand, so the
      // routing guards land on the unlock screen next.
    },
    onError: (error: unknown) => {
      const status = getHttpStatus(error);
      if (status === 429) {
        setSubmitError(t("pair.errors.rateLimited"));
      } else if (status !== undefined) {
        // Any explicit rejection (404/410/422…) means the code is bad/expired.
        setSubmitError(t("pair.errors.invalidCode"));
      } else {
        setSubmitError(t("pair.errors.generic"));
      }
    },
  });

  const onSubmit = useCallback(() => {
    setSubmitError(null);
    mutation.mutate(rawPairingCode(code));
  }, [code, mutation]);

  return {
    code,
    onChangeCode,
    onSubmit,
    canSubmit: isCompletePairingCode(code),
    isSubmitting: mutation.isPending,
    submitError,
  };
}
