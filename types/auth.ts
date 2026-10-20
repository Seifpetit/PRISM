export type WorkspaceRole = "visitor" | "admin";

export interface AuthUser {
  id: string;
  displayName: string;
  email: string;
}

export interface AuthWorkspace {
  id: string;
  name: string;
  role: WorkspaceRole;
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  user: AuthUser;
  workspace: AuthWorkspace;
}

export interface WorkspaceMember {
  user: AuthUser;
  role: WorkspaceRole;
  createdAt: string;
}
