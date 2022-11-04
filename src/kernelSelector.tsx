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


import { SlurmelWidget } from './widget'
import { Widget } from '@lumino/widgets';

import { nullTranslator, ITranslator } from '@jupyterlab/translation';
import { slurmelIcon2 } from './icon';
// import { slurmelIcon2 } from './icon';


// export class Title extends React.Component<{}, {isHover: boolean }> {
//     constructor(props: any) {
//         super(props);
//         this.state = { isHover: false }
//     }

//     handleMouseEnter() {
//         this.setState({ isHover: true });
//     };
//     handleMouseLeave() {
//         this.setState({ isHover: false });
//     };

//     render(): JSX.Element {
//         const aStyle = {
//             color: this.state.isHover ? "green" : "#1a0dab"
//         }
//         return <div><span>Configure Slurm Wrapper</span><a style={aStyle} href="google.com">google</a></div>
//     }
// }

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
    return <span style={spanOutStyle}><span>Configure Slurm Wrapper</span><a style={aStyle} href={documentationhref}>Documentation</a></span>
}
export async function getBody(config_system: any, available_kernels: any) {
    let available_kernel_names: any = {};
    for (let key in available_kernels ){
        let kernel: any = available_kernels[key];
        try {
            if ( kernel.metadata["kernel_provisioner"]["provisioner_name"] != "slurm-provisioner" ) {
              available_kernel_names[kernel.name] = [kernel.display_name, kernel.argv, kernel.language];
            }      
        } catch (error) {
              available_kernel_names[kernel.name] = [kernel.display_name, kernel.argv, kernel.language];
        }
    }
    const body = new SlurmelWidget(config_system, available_kernel_names);
    return body
}

export async function handleResult(result: any, sessionContext: any | null) {
    const model = result.value;
    if ( model && (result.button.accept || result.button.save) ){
        await sendPostRequest(model);
    }
    if ( sessionContext ) {
        if (sessionContext.isDisposed || !result.button.accept) {
            return;
        }

        const previous_name = sessionContext._session._kernel._name;
        if (model && previous_name != "slurm-provisioner-kernel" ) {
            await sessionContext.changeKernel(model);
        }
    }
}

function saveButton(options: any = {}) {
    options.save = true;
    return Dialog.createButton(options);
}

export class DialogCustom implements ISessionContext.IDialogs {
    async selectKernel(sessionContext: any, translator: ITranslator) {
        if (sessionContext.isDisposed) {
            return Promise.resolve();
        }
        translator = translator || nullTranslator;
        const trans = translator.load('jupyterlab');
        // If there is no existing kernel, offer the option
        // to keep no kernel.
        let label = trans.__('Cancel');
        if (sessionContext.hasNoKernel) {
            label = sessionContext.kernelDisplayName;
        }
        const buttons = [
            Dialog.cancelButton({ label }),
            saveButton( {label: "Save"}),
            Dialog.okButton({ label: trans.__('(Re)Start') })
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
        await handleResult(result, sessionContext);        
    }
  
    async restart(sessionContext: any, translator: ITranslator) {
        var _a;
        translator = translator || nullTranslator;
        const trans = translator.load('jupyterlab');
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
            title: trans.__('Restart Kernel?'),
            body: trans.__('Do you want to restart the current kernel? All variables will be lost.'),
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
    const translator = props.translator || nullTranslator;
    // const trans = translator.load('jupyterlab');
    const callback = () => {
      void props.dialogs.selectKernel(props.sessionContext, translator);
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
    translator?: ITranslator
  ): Widget {
    const el = apputils.ReactWidget.create(
      <KernelNameComponentCustom
        sessionContext={sessionContext}
        dialogs={dialogs ?? sessionContextDialogs}
        translator={translator}
      />
    );
    el.addClass('jp-KernelName');
    return el;
  }