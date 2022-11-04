import { URLExt } from '@jupyterlab/coreutils';

import { ServerConnection } from '@jupyterlab/services';

import { OptionsForm } from './widget';

/**
 * Call the API extension
 *
 * @param endPoint API REST end point for the extension
 * @param init Initial values for the request
 * @returns The response body interpreted as JSON
 */
export async function requestAPI<T>(
  endPoint = '',
  init: RequestInit = {}
): Promise<T> {
  // Make request to Jupyter API
  const settings = ServerConnection.makeSettings();
  const requestUrl = URLExt.join(
    settings.baseUrl,
    'slurm-provisioner', // API Namespace
    endPoint
  );

  let response: Response;
  try {
    response = await ServerConnection.makeRequest(requestUrl, init, settings);
  } catch (error: any) {
    throw new ServerConnection.NetworkError(error);
  }

  let data: any = await response.text();

  if (data.length > 0) {
    try {
      data = JSON.parse(data);
    } catch (error) {
      console.log('Not a JSON response body.', response);
    }
  }

  if (!response.ok) {
    throw new ServerConnection.ResponseError(response, data.message || data);
  }

  return data;
}

export async function sendPostRequest(config: any) {
  let new_config: {} = {
      jobid: String(config.allocation || "None"),
      node: String(config.node || "None"),
      kernel: config.kernel,
      kernel_argv: config.kernel_argv,
      kernel_language: config.kernel_language,
      project: String(config.project),
      partition: String(config.partition),
      nodes: String(config.nodes),
      gpus: String(config.gpus || 0),
      runtime: String(config.runtime),
      reservation: String(config.reservation || "None")
  }
  await requestAPI<any>('configure', {
    body: JSON.stringify(new_config),
    method: "POST"
  }).catch(reason => {
    console.error(
      `Slurm-Provisioner: Could not save slurm-provisioner.\n${reason}`
    );
  });
}

export async function sendGetRequest(): Promise<OptionsForm> {
  let config_system: OptionsForm = {
    dropdown_lists: {},
    resources: {},
    allocations: {},
    documentationhref: "",
    current_config: {}
  }
  await requestAPI<any>('configure').then(data => {
    config_system = data;
  }).catch(reason => {
    console.error(
      `Slurm-Configurator: Could not receive OptionsForm for user.\n${reason}`
      );
    });
  return config_system;
}
