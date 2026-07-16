// Thin, hand-written facade over the Orval-generated client. The generated code
// exposes endpoint groups as factory functions (getAuthentication(), getVault(),
// …); this module instantiates them once and re-exports the handful of endpoints
// M2 needs as flat named functions, so feature hooks import `login`/`getVault`
// rather than reaching into the generated tree. Per REACT.md, generated calls are
// used through the data layer (useQuery/useMutation in logic hooks), never from
// JSX. New endpoints get added here as later milestones need them.

import { getAuthentication } from "@/api/generated/authentication/authentication";
import { getDeviceCodes } from "@/api/generated/device-codes/device-codes";
import { getUsers } from "@/api/generated/users/users";
import { getVault as getVaultGroup } from "@/api/generated/vault/vault";

const authApi = getAuthentication();
const deviceCodesApi = getDeviceCodes();
const usersApi = getUsers();
const vaultApi = getVaultGroup();

export const login = authApi.login;
export const refresh = authApi.refresh;
export const exchangeDeviceCode = deviceCodesApi.exchangeDeviceCode;
export const getVault = vaultApi.getVault;
export const getCurrentUser = usersApi.getCurrentUser;
