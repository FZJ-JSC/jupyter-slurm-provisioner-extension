import { sendPostRequest } from './handler';

import * as React from 'react';


import { SlurmConfigWidget, SlurmPanel } from './widgets'
// import { slurmelIcon2 } from './icon';


export function getTitle(documentationhref: string) {
  const spanOutStyle = {
    display: "flex",
    width: "100%",
    justifyContent: "space-between"
  }
  const aStyle = {
    color: "#1a0dab",
    textDecoration: "underline"
  }
  return (
    <span style={spanOutStyle}>
      <span>Configure Slurm Wrapper</span>
      <a style={aStyle} href={documentationhref} target='_blank'>Documentation</a>
    </span>
  )
}

export async function getBody(config_system: any, available_kernels: any) {
  let available_kernel_names: any = {};
  for (let key in available_kernels) {
    let kernel: any = available_kernels[key];
    try {
      if (kernel.metadata["kernel_provisioner"]["provisioner_name"] != "slurm-provisioner") {
        available_kernel_names[kernel.name] = [kernel.display_name, kernel.argv, kernel.language];
      }
    } catch (error) {
      available_kernel_names[kernel.name] = [kernel.display_name, kernel.argv, kernel.language];
    }
  }
  const body = new SlurmConfigWidget(config_system, available_kernel_names);
  return body;
}

export async function handleResult(result: any, sessionContext: any | null, slurmPanel: SlurmPanel) {
  const model = result.value;
  if (model && (result.button.accept)) {
    await sendPostRequest(model);
  }
  if (sessionContext) {
    if (sessionContext.isDisposed) {
      return;
    }

    let previous_name = '';
    if (sessionContext._session) {
      previous_name = sessionContext._session._kernel._name;
    }
    if (model && previous_name != "slurm-provisioner-kernel") {
      await sessionContext.changeKernel(model);
    }
  }
  // Update info in side panel
  slurmPanel.update();
}