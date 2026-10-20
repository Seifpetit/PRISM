import {
  deleteIntegrationConnection,
  getIntegrationCredentials,
  listIntegrationConnections,
} from "../database/integration-connections-repository.mjs";
import { uninstallShopifyApp } from "./shopify.mjs";
import { revokeGoogleDriveToken } from "./google-drive.mjs";

const PROVIDERS = new Set(["shopify", "meta-ads", "google-drive", "converty"]);

export function isDisconnectableProvider(id) {
  return PROVIDERS.has(id);
}

/**
 * Removes this workspace's saved connection(s) for a provider. The local token is always deleted.
 * For Shopify the app is also uninstalled on the store (best effort): if Shopify can't be reached the
 * connection is still removed here, and the result says the uninstall needs doing in the store admin.
 * Other workspaces' connections are never touched.
 */
export async function disconnectIntegration(workspaceId, id) {
  if (!isDisconnectableProvider(id)) throw new Error(`Unknown integration: ${id}`);

  const connections = listIntegrationConnections(workspaceId, id);
  if (!connections.length) {
    return {
      id,
      disconnected: false,
      remoteRevoked: null,
      message: "There was no saved connection to remove.",
    };
  }

  let remoteRevoked = id === "shopify" || id === "google-drive" ? true : null;
  let remoteProblem = null;
  for (const connection of connections) {
    if (id === "shopify") {
      const credentials = getIntegrationCredentials(workspaceId, id, {
        externalAccountId: connection.externalAccountId,
      });
      const outcome = await uninstallShopifyApp({
        domain: connection.externalAccountId,
        token: credentials.accessToken,
      });
      if (!outcome.ok) {
        remoteRevoked = false;
        remoteProblem = outcome.message;
      }
    }
    if (id === "google-drive") {
      const outcome = await revokeGoogleDriveToken(workspaceId);
      if (!outcome.ok) {
        remoteRevoked = false;
        remoteProblem = outcome.message;
      }
    }
    deleteIntegrationConnection(workspaceId, id, connection.externalAccountId);
  }

  const stores = connections.map((connection) => connection.externalAccountId).join(", ");
  let message;
  if (id === "shopify") {
    message = remoteRevoked
      ? `Disconnected. PRISM removed its access and uninstalled the app from ${stores}.`
      : `Disconnected from PRISM. Shopify didn't confirm the uninstall (${remoteProblem}). ` +
        `To be sure, remove the app in your store admin under Settings → Apps.`;
  } else if (id === "google-drive") {
    message = remoteRevoked
      ? "Disconnected. PRISM deleted the saved token and revoked it with Google."
      : `Disconnected from PRISM. Google didn't confirm the revoke (${remoteProblem}). ` +
        "To be sure, remove PRISM in your Google Account's third-party access settings.";
  } else if (id === "converty") {
    message =
      "Disconnected. PRISM deleted the saved tokens. Converty has no revoke call, so to remove the app's access entirely, remove it in Converty under Integrations → Apps.";
  } else {
    message =
      "Disconnected. PRISM deleted the saved token. It stays valid on Meta's side until you revoke it in Meta Business Settings.";
  }
  return { id, disconnected: true, remoteRevoked, message };
}
