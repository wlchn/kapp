import { ImmutableMap } from "typings";
import Immutable from "immutable";

export const EXTERNAL_ACCESS_PLUGIN_TYPE = "plugins.core.kapp.dev/v1alpha1.ingress";

export const FOO_PLUGIN_TYPE = "FOO_PLUGIN_TYPE";

export interface ExternalAccessPlugin {
  type: typeof EXTERNAL_ACCESS_PLUGIN_TYPE;
  name: string;
  hosts?: Immutable.List<string>;
  paths?: Immutable.List<string>;
  enableHttp?: boolean;
  enableHttps?: boolean;
  autoHttps?: boolean;
  stripPath?: boolean;
  preserveHost?: boolean;
}

export interface AnotherPlugin {
  type: typeof FOO_PLUGIN_TYPE;
  name: string;
}

export type PluginContent = ExternalAccessPlugin | AnotherPlugin;

export type Plugin = ImmutableMap<PluginContent>;
