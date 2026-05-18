import { createPluginHttpClients } from "@buildingai/services";

const { apiHttpClient, consoleHttpClient } = createPluginHttpClients();

export { apiHttpClient, consoleHttpClient };
