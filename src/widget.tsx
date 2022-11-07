import * as React from 'react';

// import { Widget } from '@lumino/widgets';
import { ReactWidget } from '@jupyterlab/apputils';

export type OptionsForm = {
  dropdown_lists: {[key: string]: any},
  resources: any,
  allocations: any,
  documentationhref: string,
  current_config: any
}

/**
 * A Slurm Configurator Widget that wraps a SlurmelComponent.
 */
export class SlurmelWidget extends ReactWidget {
  config_system: OptionsForm;
  available_kernels: any
  slurmelRef: any

  /**
   * Constructs a new SlurmelWidget.
   */
  constructor(config_system: OptionsForm, available_kernels: any) {
    super();
    this.config_system = config_system;
    this.available_kernels = available_kernels;
    this.slurmelRef = React.createRef();
  }

  getValue() {
    // Collect selected config to update slurm-provisioner-kernel
    const state = this.slurmelRef.current.state;
    const kernel: string = state.kernel
    const kernel_argv: Array<string> = this.available_kernels[state.kernel][1]
    const kernel_language: string = this.available_kernels[state.kernel][2]
    let allocation = "";
    let node = "";
    if ( state.allocation === "New" ) {
      allocation = "None";
    } else {
      allocation = state.allocation;
    }
    if ( state.allocation_node === "Any" ) {
      node = "None";
    } else {
      node = state.allocation_node
    }
    const config = {
      allocation,
      node,
      kernel,
      kernel_argv,
      kernel_language,
      project: state.project,
      partition: state.partition,
      nodes: state.nodes,
      gpus: state.gpus,
      runtime: state.runtime,
      name: "custom"
    }

    return config;
  }

  render(): JSX.Element {
    // TODO no config_system no party
    const x = <SlurmelComponents config_system={this.config_system} available_kernels={this.available_kernels} ref={this.slurmelRef}/>;
    return x;
  }
}

/**
 * Contains all elements and logic for the kernel configurator.
 * Only called by SlurmWidget in this file.
 */
class SlurmelComponents extends React.Component<{config_system: any, available_kernels: any}, {[key: string]: any}, any> {
  constructor(props: {config_system: any, available_kernels: any}) {
    super(props);

    // bind onClick / onChange functions
    this.handleDropdownChange = this.handleDropdownChange.bind(this);
    this.handleAllocationChange = this.handleAllocationChange.bind(this);
    this.handleNodeChange = this.handleNodeChange.bind(this);
    this.handleKernelChange = this.handleKernelChange.bind(this);
    this.handleNumberChange = this.handleNumberChange.bind(this);

    // translate current_config from kernel.json to this state
    const current_config_comp = this.get_current_config(props.config_system.current_config);

    // apply default values
    this.state = this.default_values(props, current_config_comp);
  }

  get_current_config(
    current_config: any
  ) {
    let allocation: string = current_config.jobid || "None";
    let allocation_node: string = current_config.node || "None";

    if ( allocation === "None" ) {
      allocation = "";
      allocation_node = "";
    } else {
      if ( allocation_node === "None" ) {
        allocation_node = "";
      }
    }
    let kernel: string = current_config.kernel || "" ;
    let project: string = current_config.project || "";
    let partition: string = current_config.partition || "";
    let nodes: string = current_config.nodes || "";
    let gpus: string = current_config.gpus || "";
    let runtime: string = current_config.runtime || "";
    let reservation: string = current_config.runtime || "";
    return ({
      allocation,
      allocation_node,
      kernel,
      project,
      partition,
      nodes,
      gpus,
      runtime,
      reservation,
    });
  }

  // "gpus": "0",
  // "jobid": "None",
  // "kernel_argv": [
  //     "/home/ubuntu/miniconda3/envs/slurm_provisioner_configurator/bin/python3",
  //     "-m",
  //     "ipykernel_launcher",
  //     "-f",
  //     "{connection_file}"
  // ],
  // "kernel_language": "python",
  // "nodes": "1",
  // "partition": "batch",
  // "project": "cjsc",
  // "reservation": "None",
  // "runtime": "30"

  default_values(
    props: any, {
      resources_editable = true,
      project = "",
      partition = "",
      nodes = "",
      gpus = "",
      runtime = "",
      reservation = "",
      allocation = "",
      kernel = "",
      date_show = false,
      date_endtime = "",
      allocation_node = ""
    } = {}
  ) {
    // setup some default values
    const dl: { [key: string]: any } = props.config_system.dropdown_lists;

    let tmp: any = dl.projects;
    if ( project === "" ) {
      project = tmp.length > 0 ? tmp[0] : "";
    }      
    const projects: Array<string> = tmp.includes(project) ? tmp : [project]

    tmp = dl.partitions[project];
    if ( partition === "" ) {
      partition = tmp && tmp.length > 0 ? tmp[0] : "";
    }
    const partitions: Array<string> = tmp && tmp.includes(partition) ? tmp : [partition];

    const partition_config = props.config_system.resources[partition];
    if ( nodes === "" ) {
      nodes = partition_config && partition_config.nodes ? partition_config.nodes.default : "0";
    }
    const nodes_min: string = partition_config && partition_config.nodes ? partition_config.nodes.minmax[0] : "0";
    const nodes_max: string = partition_config && partition_config.nodes ? partition_config.nodes.minmax[1] : "0";

    if ( gpus === "") {
      gpus = partition_config && partition_config.gpus ? partition_config.gpus.default : "0";
    }
    const gpus_min: string = partition_config && partition_config.gpus ? partition_config.gpus.minmax[0] : "0";
    const gpus_max: string = partition_config && partition_config.gpus ? partition_config.gpus.minmax[1] : "0";

    if ( runtime === "") {
      runtime = partition_config && partition_config.runtime ? partition_config.runtime.default : "0";
    }
    const runtime_min: string = partition_config && partition_config.runtime ? partition_config.runtime.minmax[0] : "0";
    const runtime_max: string = partition_config && partition_config.runtime ? partition_config.runtime.minmax[1] : "0";
    
    if ( reservation === "" ) {
      reservation = "None";
    }
    tmp = dl.reservations;
    const reservations: Array<string> = project in tmp && partition in dl.reservations[project] ? dl.reservations[project][partition] : ["None"];
    console.log(props.config_system.allocations);
    if ( allocation === "" || !(props.config_system.allocations.hasOwnProperty(allocation) ) ) {
      allocation = "New";
    }
    let allocation_names: Array<String> = ["New"];
    for ( let key in props.config_system.allocations ){
      allocation_names.push(key);
    }

    // Node where to start the kernel on
    if ( allocation_node === "" ) {
      allocation_node = "Any";
    }
    let allocation_node_names: Array<String> = ["Any"];
    if ( allocation != "New" ) {      
      let tmp = props.config_system.allocations[allocation];
      if ( tmp.nodelist) {
        allocation_node_names = allocation_node_names.concat(tmp.nodelist);
      }      
    }

    // Kernels the user wants to start
    let kernel_names: Array<String> = [];
    for ( let key in props.available_kernels ) {
      kernel_names.push(key);
    }
    if ( kernel === "" ) {
      kernel = String(kernel_names[0]);
    }

    // show rest time for allocation
    if ( allocation === "New" ){
      date_show = false;
      resources_editable = true;
    } else {
      date_show = true;
      resources_editable = false;
    }
    if ( date_show && date_endtime == "") {
      let tmp = props.config_system.allocations[allocation]
      date_endtime = tmp.endtime;
    }
    return (
      {
        resources_editable,
        project,
        projects,
        partition,
        partitions,
        nodes,
        nodes_min,
        nodes_max,
        gpus,
        gpus_min,
        gpus_max,
        runtime,
        runtime_min,
        runtime_max,
        reservation,
        reservations,
        kernel,
        kernel_names,
        allocation,
        allocation_names,
        date_show,
        date_endtime,
        allocation_node,
        allocation_node_names
      }
    );
  }

  handleAllocationChange(key: string, value: string) {
    if ( value == "New" ) {
      if ( this.state.allocation != value ) {
        // do not change kernel, but anything else to default
        this.setState(this.default_values(this.props, { kernel: this.state.kernel } ));
      }
    } else {
      // Pre existing allocation. Do not allow changes to resources and set them to
      // previous used values
      const config: any = this.props.config_system.allocations[value].config;
      const project: any = config.project;
      const partition: any = config.partition;
      const gpus = config.gpus ? config.gpus : "";
      const nodes = config.nodes ? config.nodes : "";
      const runtime = config.runtime ? config.runtime : "";
      const reservation: any = config.reservation;
      const date_endtime: string = this.props.config_system.allocations[value].endtime;
      this.setState(
        this.default_values(
          this.props,
          {
            resources_editable: false,
            project,
            partition,
            nodes,
            gpus,
            runtime,
            reservation,
            allocation: value,
            allocation_node: "Any",
            kernel: this.state.kernel,
            date_show: true,
            date_endtime
          }
        )
      );
    }
  }

  handleNodeChange(key: string, allocation_node: string) {
    this.setState({allocation_node});
  }

  handleKernelChange(key: string, kernel: string) {
    this.setState({kernel})
  }
  /**
   * Handle changes in all Dropdown menus
   * @param key key of the dropdown which has changed
   * @param value new value
   */
  handleDropdownChange(key: string, value: string) {
    // this.state.key will be updated after this function. So we have to track
    // new actual new values manually.

    const dl = this.props.config_system.dropdown_lists;
    let project = this.state.project;
    let partition = this.state.partition;
    if ( key === "partitions" ) {
      partition = value;
      
      // Update the chosen partition
      this.setState({ partition });
    } else if ( key === "projects" ) {
      project = value;

      // Update the chosen project
      this.setState({ project });
      
      const partitions = dl.partitions[project];
      partition = partitions[0];
      // Update the partition dropdown menu
      this.setState({ 
        partition,
        partitions
      });
    }

    if ( key === "reservations" ){
      // Update selected reservation
      this.setState({ reservation: value });
    } else {
      // Update Resources, this will update nodes, gpus, runtime and reservation while keeping the given parameters
      this.setState(
        this.default_values(
          this.props,
          {
            project,
            partition, 
            allocation: this.state.allocation,
            kernel: this.state.kernel,
            date_show: this.state.date_show,
            date_endtime: this.state.date_endtime
          }
        )
      );
    }
  }

  /**
   * Checks if new value for number-input field is valide
   * @param value new value for input field
   * @returns 
   */
  validateNumber(value: string) {
    try {
      if ( isNaN( parseInt(value) ) ){
        console.log("Only positive numbers are allowed in nodes field.");
        return false;
      }
      else if (value.includes(".") ){
        console.log("Only positive numbers are allowed in nodes field.");
        return false;
      }
    } catch(e) {
      console.log("Only positive numbers are allowed in nodes field.");
      return false;
    }
    return true;
  }

  /**
   * Handle changes in all number-input fields
   * @param key key of the input field which has changed
   * @param value new value
   */
  handleNumberChange(key: string, value: string) {
    // if ( ! this.validateNumber(value) ) {
    //   return;
    // }
    const partition = this.state.partition;
    let max: string = "0";

    if ( key === "runtime" ) {
      max = this.props.config_system.resources[partition].runtime.minmax[1];
    } else if ( key == "nodes" ) {
      max = this.props.config_system.resources[partition].nodes.minmax[1];
    } else if ( key == "gpus" ) {
      max = this.props.config_system.resources[partition].gpus.minmax[1];
    } else {
      console.log("Unsupported key: " + key);
      return;
    }
    if ( parseInt(value) > parseInt(max) ) {
      value = max.toString();
    }
    this.setState(
      {
        [key]: value
      }
    );
  }

  /**
   * Renders all components for the slurm configurator widget
   * @returns JSX.Element containing all html elements + logic
   */
  render(): JSX.Element {
    const allocations = <DropdownComponent label="Select allocation for slurm wrapper" key_="allocations" selected={this.state.allocation} values={this.state.allocation_names} onValueChange={this.handleAllocationChange} editable={true} available_kernels={{}} />;
    const allocnodes = <DropdownComponent label="Select node for slurm wrapper" key_="allocations_nodes" selected={this.state.allocation_node} values={this.state.allocation_node_names} onValueChange={this.handleNodeChange} editable={true} available_kernels={{}} />;
    const kernels = <DropdownComponent label="Select kernel for slurm wrapper" key_="kernels" selected={this.state.kernel} values={this.state.kernel_names} onValueChange={this.handleKernelChange} editable={true} available_kernels={this.props.available_kernels} />;
    const projects = <DropdownComponent label="Select project for slurm wrapper" key_="projects" selected={this.state.project} values={this.state.projects} onValueChange={this.handleDropdownChange} editable={this.state.resources_editable} available_kernels={{}} />;
    const partitions = <DropdownComponent label="Select partition for slurm wrapper" key_="partitions" selected={this.state.partition} values={this.state.partitions} onValueChange={this.handleDropdownChange} editable={this.state.resources_editable} available_kernels={{}} />;
    const reservations = <DropdownComponent label="Select reservation for slurm wrapper" key_="reservations" selected={this.state.reservation} values={this.state.reservations} onValueChange={this.handleDropdownChange} editable={this.state.resources_editable} available_kernels={{}} />;
    const nodes = <InputNumberComponent label="Nodes" key_="nodes" value={this.state.nodes} min={this.state.nodes_min} max={this.state.nodes_max} onValueChange={this.handleNumberChange} editable={this.state.resources_editable} />;
    const gpus = <InputNumberComponent label="GPUs" key_="gpus" value={this.state.gpus} min={this.state.gpus_min} max={this.state.gpus_max} onValueChange={this.handleNumberChange} editable={this.state.resources_editable} />;
    const runtime = <InputNumberComponent label="Runtime (min)" key_="runtime" value={this.state.runtime} min={this.state.runtime_min} max={this.state.runtime_max} onValueChange={this.handleNumberChange} editable={this.state.resources_editable} />;
    const timer = <AllocationTimer key_="timer" date_label="Time left: " date_endtime={this.state.date_endtime} date_show={this.state.date_show} />;

    const spanStyle = {
      minWidth: '450px',
      overflow: 'auto'
    }
    if ( ! this.state.date_show ) {
      return (
        <span style={spanStyle}>
          {allocations}
          {kernels}
          {projects}
          {partitions}
          {nodes}
          {gpus}
          {runtime}
          {reservations}
        </span>
      )
    }
    return (
      <span style={spanStyle}>
        {timer}
        {allocations}
        {allocnodes}
        {kernels}
        {projects}
        {partitions}
        {nodes}
        {gpus}
        {runtime}
        {reservations}
      </span>
    );
  }
}

export class AllocationTimer extends React.Component<{key_: string, date_label: string, date_endtime: any, date_show: boolean}, {distance: string, hours: string, minutes: string, seconds: string}> {
  timerID: any;

  constructor(props: any) {
    super(props);
    this.state = this.get_time_values();
  }
  componentDidMount() {
    this.timerID = setInterval(
      () => this.tick(),
      1000
    );
  }

  componentWillUnmount() {
    clearInterval(this.timerID);
  }

  get_time_values() {    
    const now = Math.floor(new Date().getTime() / 1000);

    // Find the distance between now and the count down date
    const distance = Math.floor(this.props.date_endtime / 1) - now;
  
    // Time calculations for days, hours, minutes and seconds
    const hours = String(Math.floor((distance % (60 * 60 * 24)) / (60 * 60)));
    const minutes = String(Math.floor((distance % (60 * 60)) / (60)));
    const seconds = String(Math.floor((distance % (60))));
    return {
      distance: String(distance),
      hours,
      minutes,
      seconds
    };
  }

  tick() {
    this.setState(this.get_time_values());
  }

  render() {
    const labelStyle = {
      display: 'flex'
    };
    let spanStyle = {
      alignSelf: 'center',
      flex: '8 1 0',
      color: 'black'
    };
    if ( parseInt(this.state.distance) < 300 ) {
      spanStyle.color = "red"
    }
    const minutes_ = "0" + this.state.minutes
    const minutes = minutes_.substring(minutes_.length-2);
    const seconds_ = "0" + this.state.seconds
    const seconds = seconds_.substring(seconds_.length-2);
    if ( this.props?.date_show ) {
      return (
        <div>
          <div className='lm-Widget p-Widget jp-Dialog-body'>
            <label style={labelStyle}>
              <span style={spanStyle}>
                {this.props.date_label}{this.state.hours}:{minutes}:{seconds}
              </span>
              {/* <input style={inputStyle} className='jp-mod-styled' type="number" disabled={!this.props.editable} key={this.props.key_} id={this.props.key_} name={this.props.key_} value={this.props.value} min={this.props.min} max={this.props.max} onChange={this.handleChange}/> */}
            </label>
          </div>
        </div>
      );
    } else {
      return null;
    }
  }
}


/**
 * Component class for all <select> elements
 */
class DropdownComponent extends React.Component<{label: string, key_: string, selected: any, values: Array<string>, onValueChange: any, editable: Boolean, available_kernels: any} > {
  constructor(props: any) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(e: any) {
    this.props.onValueChange(this.props.key_, e.target.value);
  }

  render() {
    if ( this.props.key_ === "reservations" && this.props.values.length < 2) {
      // If there's only "None" as reservation we don't have to show it.
      return null;
    }
    const selected = this.props.selected;
    const values = this.props.values;
    let valuesReact = {}
    if ( this.props.key_ === "kernels" ){
      valuesReact = values.map(
        x => 
        {
          if (x === selected){
            return <option value={x} selected>{this.props.available_kernels[x][0]}</option>;
          } else {
            return <option value={x}>{this.props.available_kernels[x][0]}</option>;
          }
        }
      )
    } else {
      valuesReact = values.map(
        x => 
        {
          if (x === selected){
            return <option selected>{x}</option>;
          } else {
            return <option>{x}</option>;
          }
        }
      )
    }
    
    return (
      <div>
        <div className='lm-Widget p-Widget jp-Dialog-body'>
          <label>
            {this.props.label} :
          </label>
          <div className='jp-select-wrapper'>
            <select className='jp-mod-styled' key={this.props.key_} disabled={!this.props.editable} name={this.props.key_} onChange={this.handleChange}>{valuesReact}</select>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Component class for all <input type="number"> elements
 */
class InputNumberComponent extends React.Component<{label: string, key_: string, value: string, min: string, max: string, onValueChange: any, editable: boolean}, {values: Array<string>} > {
  constructor(props: any) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(e: any) {    
    this.props.onValueChange(this.props.key_, e.target.value);
  }

  render() {
    const inputStyle = {
      marginLeft: '20px',
      maxWidth: '100px',
    };
    const labelStyle = {
      display: 'flex'
    };
    const spanStyle = {
      alignSelf: 'center',
      flex: '8 1 0'
    };
    if ( this.props.key_ === "gpus" && this.props.value === "0" ) {
      return null;
    }
    return (
      <div>
        <div className='lm-Widget p-Widget jp-Dialog-body'>
          <label style={labelStyle}>
            <span style={spanStyle}>{this.props.label} [{this.props.min}-{this.props.max}]: </span>
            <input style={inputStyle} className='jp-mod-styled' type="number" disabled={!this.props.editable} key={this.props.key_} id={this.props.key_} name={this.props.key_} value={this.props.value} min={this.props.min} max={this.props.max} onChange={this.handleChange}/>
          </label>
        </div>
      </div>
    );
  }
}
