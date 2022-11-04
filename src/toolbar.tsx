
import { IDisposable, DisposableDelegate } from '@lumino/disposable';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { sendGetRequest } from './handler';

import {
  NotebookPanel,
  INotebookModel,
} from '@jupyterlab/notebook';

import * as React from 'react';
import * as apputils from '@jupyterlab/apputils';

import { AllocationTimer } from './widget';

import { createKernelNameItemCustom, DialogCustom } from './kernelSelector';

export class ToolbarCountdown
  implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel>
{
  /**
   * Create a new extension for the notebook panel widget.
   *
   * @param panel Notebook panel
   * @param context Notebook context
   * @returns Disposable on the added button
   */
  createNew(
    panel: NotebookPanel,
    context: DocumentRegistry.IContext<INotebookModel>,
  ): IDisposable {
    const countdown = new KernelCountdownWidget(panel);
    const x = createKernelNameItemCustom(panel.sessionContext, new DialogCustom());
    panel.toolbar.insertItem(11, 'Slurmel', x);
    panel.toolbar.insertItem(11, 'Countdown', countdown);
    return new DisposableDelegate(() => {
      x.dispose();
      countdown.dispose();
    });
  }
}


class KernelCountdownWidget extends apputils.ReactWidget {
  panel: any;

  constructor(panel: any) {
    super();
    this.panel = panel;
  }

  render() {
    let x = <RemainingTimeComp panel={this.panel} />;
    return x;    
  }
}

class RemainingTimeComp extends React.Component<{panel: NotebookPanel}, {date_show: boolean, date_endtime: any, date_label: string}> {
  constructor(props: any) {
    super(props);
    this.state = {
      date_show: false,
      date_endtime: 0,
      date_label: "Remaining time: "
    }
    this.props.panel.sessionContext.kernelChanged.connect(this._kernelChanged, this);
  }
  
  async _kernelChanged(a: any, b: any) {
    let found_kernel = false;
    if ( b.newValue ) {
      const kernelID = b.newValue._id;
      const config_system = await sendGetRequest();
      for ( let x in config_system.allocations ) {
        if ( (! found_kernel) && config_system.allocations[x].kernel_ids.includes(kernelID) ){
          this.setState({
            date_endtime: config_system.allocations[x].endtime,
            date_show: true,
            date_label: "Remaining time ( allocation " + String(x) + " ): "
          })
          found_kernel = true;
        }
      }
      /**
       * Request - get current slurm_provisioner.json
       * Run through all allocations, find kernel_id in list
       * If there -> show allocID + endtime (tickDown)
       * If not there -> show nothing
       */
    }
    this.setState({date_show: found_kernel});
  }

  render() {
    const timer = <AllocationTimer key_="timer" date_label={this.state.date_label} date_endtime={this.state.date_endtime} date_show={this.state.date_show} />;
    const style = {
      alignSelf: "center"
    };
    return <div style={style}>{timer}</div>;
  }
}
