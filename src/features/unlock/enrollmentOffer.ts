// The post-unlock biometric enrolment offer (PLAN §B): after a successful
// password unlock, ask once whether to cache the DEK behind Face ID /
// fingerprint. Shown as a native Alert so it survives the navigation away from
// the unlock/sign-in screen that the unlock itself triggers. No-op when the
// device cannot do biometrics or a DEK is already enrolled.

import { Alert } from "react-native";
import { canOfferBiometricEnrollment, enrollBiometricsForSession } from "@/vault/unlock";

export interface EnrollmentCopy {
  readonly title: string;
  readonly body: string;
  readonly accept: string;
  readonly skip: string;
  readonly prompt: string;
}

export async function offerBiometricEnrollment(copy: EnrollmentCopy): Promise<void> {
  if (!(await canOfferBiometricEnrollment())) {
    return;
  }
  Alert.alert(copy.title, copy.body, [
    { text: copy.skip, style: "cancel" },
    { text: copy.accept, onPress: () => void enrollBiometricsForSession(copy.prompt) },
  ]);
}
