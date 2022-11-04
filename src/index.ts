import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  ICommandPalette,
} from '@jupyterlab/apputils';

import { ILauncher } from '@jupyterlab/launcher';

import { ITranslator } from '@jupyterlab/translation';

// import { ToolbarKernelButton, ToolbarCountdown } from './toolbar';
import { ToolbarCountdown } from './toolbar';


import {
  Dialog,
  showDialog
} from '@jupyterlab/apputils';
import { getBody, getTitle, handleResult } from './kernelSelector';
import { slurmelIcon } from './icon';
import { sendGetRequest } from './handler';

/**
 * The command IDs used by the react-widget plugin
 */

namespace CommandIDs {
  export const create = 'create-react-widget';
}

/**
 * Initialization data for the slurm-provisioner-configurator extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'slurm-provisioner-configurator',
  autoStart: true,
  requires: [ITranslator],
  optional: [ILauncher, ICommandPalette],
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
  translator: ITranslator,
  launcher: ILauncher | null,
  palette: ICommandPalette | null,
): void {

  const { commands, serviceManager } = app;
  const category = 'Slurm';
  const trans = translator.load('jupyterlab');
  const command = CommandIDs.create

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

  // Add command
  commands.addCommand(command, {
    label: (args) => (args['isPalette'] ? trans.__('Configure slurm wrapper') : trans.__('Configure Slurm Wrapper')),
    caption: trans.__('Configure slurm wrapper'),
    icon: (args) => slurmelIcon,
    // execute: createWidget,
    execute: async () => {
      let label = trans.__('Cancel');
      const buttons = [
          Dialog.cancelButton({ label }),
          Dialog.okButton({ label: 'Save' })
      ];
      // Load available kernels, excecpt the slurm one, in a list
      
      const config_system = await sendGetRequest();
      const body = await getBody(config_system, serviceManager.kernelspecs.specs?.kernelspecs);
      // const title = new Title({});
      showDialog({
        title: getTitle(config_system.documentationhref),
        body: body,
        buttons: buttons,
      }).then((e) => handleResult(e, null));
    }
  });


  const x = true;
  // Add to launcher
  if (launcher && x) {
    launcher.add({
      command: CommandIDs.create,
      category: category,
      rank: 9
    });
  }

  // Add to Palette
  if (palette && x) {
    palette.addItem({ command, category, args: {'isPalette': true} });
  }

  // Add WidgetExtension to Notebook (Toolbar Countdown)
  app.docRegistry.addWidgetExtension('Notebook', new ToolbarCountdown());

}

export default extension;
