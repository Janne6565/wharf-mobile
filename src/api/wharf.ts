// Thin, hand-written facade over the Orval-generated client. The generated code
// exposes endpoint groups as factory functions (getAuthentication(), getVault(),
// …); this module instantiates them once and re-exports the handful of endpoints
// M2 needs as flat named functions, so feature hooks import `login`/`getVault`
// rather than reaching into the generated tree. Per REACT.md, generated calls are
// used through the data layer (useQuery/useMutation in logic hooks), never from
// JSX. New endpoints get added here as later milestones need them.

import { getAuthentication } from "@/api/generated/authentication/authentication";
import { getDeviceCodes } from "@/api/generated/device-codes/device-codes";
import { getOauth } from "@/api/generated/oauth/oauth";
import { getProjects } from "@/api/generated/projects/projects";
import { getUsers } from "@/api/generated/users/users";
import { getVault as getVaultGroup } from "@/api/generated/vault/vault";

const authApi = getAuthentication();
const deviceCodesApi = getDeviceCodes();
const oauthApi = getOauth();
const projectsApi = getProjects();
const usersApi = getUsers();
const vaultApi = getVaultGroup();

export const login = authApi.login;
export const refresh = authApi.refresh;
export const exchangeDeviceCode = deviceCodesApi.exchangeDeviceCode;
// Enabled OAuth provider slugs — drives which social buttons the sign-in screen
// lets the user tap (the browser device-code flow lives in @/auth/oauthSignIn).
export const listOAuthProviders = oauthApi.listOAuthProviders;
export const getVault = vaultApi.getVault;
export const updateVault = vaultApi.updateVault;
export const getCurrentUser = usersApi.getCurrentUser;

// Projects + identity (M4). Mobile v1 is member-plus and READ-ONLY for project
// vaults, so the vault-rewriting project endpoints (updateProjectVault,
// rotateProject) stay unsurfaced — the mobile boundary excludes DEK rotation and
// member removal/role changes (web + TUI only). Project lifecycle (create/rename/
// delete) and self-leave ARE surfaced (see below).
export const listProjects = projectsApi.listProjects;
export const getProjectVault = projectsApi.getProjectVault;
export const getProject = projectsApi.getProject;
export const updatePublicKey = usersApi.updatePublicKey;
export const getMyInvites = usersApi.getMyInvites;
export const acceptInvite = usersApi.acceptInvite;
export const declineInvite = usersApi.declineInvite;

// Light admin (M5): invite create/revoke and the background finalize-keys pass
// (list members awaiting a key + seal the DEK to each). Rotation/role-change
// remain out of scope by design (see the boundary note above).
export const createInvite = projectsApi.createInvite;
export const revokeInvite = projectsApi.deleteInvite;
export const getPendingKeys = projectsApi.getPendingKeys;
export const submitMemberKey = projectsApi.submitMemberKey;

// Project lifecycle + membership (M6): create a project (owner-wrapped empty
// vault), rename/re-describe it (admin+), delete it (owner only), and leave it
// (non-owner). These stay within the mobile v1 boundary — no DEK rotation, no
// member removal, no role changes.
export const createProject = projectsApi.createProject;
export const updateProject = projectsApi.updateProject;
export const deleteProject = projectsApi.deleteProject;
export const leaveProject = projectsApi.leaveProject;
