import { sendGetRequest, sendPostRequest } from './handler';

import * as React from 'react';
import * as apputils from '@jupyterlab/apputils';

import {
  Dialog,
  ISessionContext,
  showDialog,
  sessionContextDialogs,
  UseSignal,
  ToolbarButtonComponent
} from '@jupyterlab/apputils';


import { SlurmConfigWidget, SlurmPanel } from './widgets'
import { Widget } from '@lumino/widgets';

import { slurmelIcon2 } from './icon';
// import { slurmelIcon2 } from './icon';

const acceptLabel = '(Re)Start';


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
    if (sessionContext.isDisposed || !(result.button.label == acceptLabel)) {
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

function saveButton(options: any = {}) {
  options.save = true;
  return Dialog.createButton(options);
}

export class DialogCustom implements ISessionContext.IDialogs {
  private _slurmPanel : SlurmPanel;

  constructor(slurmPanel: SlurmPanel) {
    // handleResult needs to call slurmPanel.update()
    this._slurmPanel = slurmPanel;
  }

  async selectKernel(sessionContext: any) {
    if (sessionContext.isDisposed) {
      return Promise.resolve();
    }
    // If there is no existing kernel, offer the option
    // to keep no kernel.
    let label = 'Cancel';
    if (sessionContext.hasNoKernel) {
      label = sessionContext.kernelDisplayName;
    }
    const buttons = [
      Dialog.cancelButton({ label }),
      saveButton({ label: "Save" }),
      Dialog.okButton({ label: acceptLabel })
    ];
    // Load available kernels, excecpt the slurm one, in a list

    const config_system = await sendGetRequest();

    const body = await getBody(config_system, sessionContext.specsManager.specs?.kernelspecs);
    const dialog = new Dialog({
      title: getTitle(config_system.documentationhref),
      body: body,
      buttons
    });
    const result: any = await dialog.launch();
    await handleResult(result, sessionContext, this._slurmPanel);
  }

  async restart(sessionContext: any) {
    var _a;
    await sessionContext.initialize();
    if (sessionContext.isDisposed) {
      throw new Error('session already disposed');
    }
    const kernel = (_a = sessionContext.session) === null || _a === void 0 ? void 0 : _a.kernel;
    if (!kernel && sessionContext.prevKernelName) {
      await sessionContext.changeKernel({
        name: sessionContext.prevKernelName
      });
      return true;
    }
    // Bail if there is no previous kernel to start.
    if (!kernel) {
      throw new Error('No kernel to restart');
    }
    const restartBtn = Dialog.warnButton({ label: 'Restart' });
    const result = await showDialog({
      title: 'Restart Kernel?',
      body: 'Do you want to restart the current kernel? All variables will be lost.',
      buttons: [Dialog.cancelButton(), restartBtn]
    });
    if (kernel.isDisposed) {
      return false;
    }

    if (result.button.accept) {
      await sessionContext.restartKernel();
      return true;
    }
    return false;
  }
}


function KernelNameComponentCustom(
  props: any
): any {
  // const trans = translator.load('jupyterlab');
  const callback = () => {
    void props.dialogs.selectKernel(props.sessionContext);
  };
  const TOOLBAR_KERNEL_NAME_CLASS = 'jp-Toolbar-kernelName';
  const label = "Configure Slurm Wrapper";


  return (
    <UseSignal
      signal={props.sessionContext.kernelChanged}
      initialSender={props.sessionContext}
    >
      {sessionContext => (
        <ToolbarButtonComponent
          className={TOOLBAR_KERNEL_NAME_CLASS}
          onClick={callback}
          // tooltip={trans.__('Configure wrapper')}
          label={label}
          icon={slurmelIcon2}
        />
      )}
    </UseSignal>
  );
}

export function createKernelNameItemCustom(
  sessionContext: ISessionContext,
  dialogs?: ISessionContext.IDialogs,
): Widget {
  const el = apputils.ReactWidget.create(
    <KernelNameComponentCustom
      sessionContext={sessionContext}
      dialogs={dialogs ?? sessionContextDialogs}
    />
  );
  el.addClass('jp-KernelName');
  return el;
}