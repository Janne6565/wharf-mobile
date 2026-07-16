// Logic for the add/edit host form. The route's optional `hostId` param selects
// the mode: absent → add, present → edit (seeded from the vault slice). Save runs
// the document mutation (addHost / editHost), which re-seals + schedules a push;
// on success we navigate back. t() lives here because the hook maps the mutation's
// typed error codes to translated field/generic messages (REACT.md exception).

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/store/hooks";
import { addHost, editHost } from "@/vault/hostMutations";
import { HostMutationError } from "@/vault/mutate";
import {
  EMPTY_HOST_FORM,
  type HostFormValues,
  hostFormSchema,
  hostToFormValues,
  toHostInput,
} from "./lib";

export function useHostFormLogic() {
  const { t } = useTranslation();
  const router = useRouter();
  const { hostId } = useLocalSearchParams<{ hostId?: string }>();
  const existing = useAppSelector((state) => state.vault.hosts.find((h) => h.id === hostId));
  const isEdit = Boolean(hostId);

  const schema = useMemo(
    () =>
      hostFormSchema({
        nameRequired: t("hostForm.errors.nameRequired"),
        addrRequired: t("hostForm.errors.addrRequired"),
        portRange: t("hostForm.errors.portRange"),
      }),
    [t],
  );
  const form = useForm<HostFormValues>({
    resolver: zodResolver(schema),
    defaultValues: existing ? hostToFormValues(existing) : EMPTY_HOST_FORM,
    mode: "onSubmit",
  });

  const mutation = useMutation({
    mutationFn: async (values: HostFormValues) => {
      const input = toHostInput(values);
      if (isEdit && hostId) {
        await editHost(hostId, input);
      } else {
        await addHost(input);
      }
    },
    onSuccess: () => router.back(),
    onError: (error: unknown) => {
      if (error instanceof HostMutationError && error.code === "name-duplicate") {
        form.setError("name", { message: t("hostForm.errors.nameDuplicate") });
        return;
      }
      if (error instanceof HostMutationError && error.code === "name-required") {
        form.setError("name", { message: t("hostForm.errors.nameRequired") });
        return;
      }
      if (error instanceof HostMutationError && error.code === "addr-required") {
        form.setError("address", { message: t("hostForm.errors.addrRequired") });
        return;
      }
      if (error instanceof HostMutationError && error.code === "port-range") {
        form.setError("port", { message: t("hostForm.errors.portRange") });
        return;
      }
      form.setError("root", { message: t("hostForm.errors.generic") });
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    form.clearErrors("root");
    mutation.mutate(values);
  });

  const cancel = useCallback(() => router.back(), [router]);

  const name = form.watch("name");
  const address = form.watch("address");
  // Completeness gate only — format errors surface on submit (REACT.md).
  const canSubmit = name.trim().length > 0 && address.trim().length > 0;

  return {
    form,
    isEdit,
    onSubmit,
    cancel,
    canSubmit,
    isSaving: mutation.isPending,
    rootError: form.formState.errors.root?.message ?? null,
  };
}
