
import { IDisposable, DisposableDelegate } from '@lumino/disposable';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { sendGetRequest } from './handler';

import {
  NotebookPanel,
  INotebookModel,
} from '@jupyterlab/notebook';

import * as React from 'react';
import * as apputils from '@jupyterlab/apputils';

import { AllocationTimer } from './widgets';

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
    panel.toolbar.insertItem(11, 'Countdown', countdown);
    return new DisposableDelegate(() => {
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

class RemainingTimeComp extends React.Component<{panel: NotebookPanel}, {date_show: boolean, date_endtime: any, date_label: string, kernel_id: string}> {
  constructor(props: any) {
    super(props);
    this.state = {
      date_show: false,
      date_endtime: 0,
      date_label: "Remaining time: ",
      kernel_id: ""
    }
    this.props.panel.sessionContext.kernelChanged.connect(this._kernelChanged, this);
    this.props.panel.sessionContext.connectionStatusChanged.connect(this._connectionStatusChanged, this);
  }
  
  async _kernelChanged(a: any, b: any) {
    if ( b.newValue ) {
      const kernel_id = b.newValue._id;
      this.setState({kernel_id});
    }
  }

  async _connectionStatusChanged(a: any, b: any) {
    let found_kernel = false;
    if ( a._prevKernelName == "slurm-provisioner-kernel" && b == "connected" ) {
      const kernelID = this.state.kernel_id;
      const config_system = await sendGetRequest('local');
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
    const timer = <AllocationTimer key_="timer" date_label={this.state.date_label} date_endtime={this.state.date_endtime} />;
    const style = {
      alignSelf: "center"
    };
    if (this.state.date_show) {
      return <div style={style}>{timer}</div>;
    } else {
      return null;
    }
   
  }
}
