import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  ICommandPalette,
} from '@jupyterlab/apputils';

// import { ToolbarKernelButton, ToolbarCountdown } from './toolbar';
import { ToolbarCountdown } from './toolbar';

import {
  Dialog,
  showDialog
} from '@jupyterlab/apputils';
import { getBody, getTitle, handleResult } from './kernelSelector';
import { slurmelIcon } from './icon';
import { sendGetRequest } from './handler';
import { SlurmPanel } from './widgets';


/**
 * The command IDs used by the react-widget plugin
 */

namespace CommandIDs {
  export const slurmUI = 'slurm-config-ui';
  export const dialog = 'open-slurm-config-dialog';
}

/**
 * Initialization data for the slurm-provisioner-configurator extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'slurm-provisioner-configurator',
  autoStart: true,
  requires: [ILayoutRestorer],
  optional: [ICommandPalette],
  activate: activate,
}

/**
 * Activate the JupyterLab extension.
 * 
 * @param app
 * @param palette 
 * @param launcher 
 */
function activate(
  app: JupyterFrontEnd,
  restorer: ILayoutRestorer,
  palette: ICommandPalette | null,
): void {

  const { commands, shell, serviceManager } = app;
  const category = 'Slurm';

  // Load available kernels, excecpt the slurm one, in a list
  const available_kernels = serviceManager.kernelspecs.specs?.kernelspecs;
  let available_kernel_names: any = {};
  for (let key in available_kernels ){
    let kernel: any = available_kernels[key];
    try {
      if ( kernel.metadata["kernel_provisioner"]["provisioner_name"] != "slurm-provisioner" ) {
        available_kernel_names[kernel.display_name] = kernel.argv;
      }      
    } catch (error) {
      available_kernel_names[kernel.display_name] = kernel.argv;
    }
  }
  
  const slurmPanel = new SlurmPanel(commands, available_kernels);
  restorer.add(slurmPanel, 'slurm-config');
  app.shell.add(slurmPanel, 'left', { rank: 501 });
  
  // Add command
  commands.addCommand(CommandIDs.slurmUI, {
    label: (args) => ('Go to slurm wrapper'),
    caption: 'Go to slurm wrapper',
    icon: (args) => slurmelIcon,
    execute: () => {
      try {
        shell.activateById('slurm-wrapper-widget');
      } catch (err) {
        console.error('Fail to open Slurm Wrapper tab.');
      }
    }
  });

  commands.addCommand(CommandIDs.dialog, {
    label: (args) => ('Configure slurm wrapper'),
    caption: 'Configure slurm wrapper',
    icon: (args) => slurmelIcon,
    execute: async () => {
      const buttons = [
        Dialog.cancelButton({ label: 'Cancel' }),
        Dialog.okButton({ label: 'Save' })
      ];

      const config_system = await sendGetRequest('all');
      const body = await getBody(config_system, available_kernels)
      showDialog({
        title: getTitle(config_system.documentationhref),
        body: body,
        buttons: buttons
      }).then((e) => {
        handleResult(e, null, slurmPanel);
      });
    }
  });

  const x = true;

  // Add to Palette
  if (palette && x) {
    [CommandIDs.slurmUI, CommandIDs.dialog].forEach((command) => {
      palette.addItem({ command, category, args: {'isPalette': true} });
    });
  }

  // Add WidgetExtension to Notebook (Toolbar Countdown)
  app.docRegistry.addWidgetExtension('Notebook', new ToolbarCountdown());

}

export default extension;
