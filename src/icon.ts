
import slurmelIconNotebookStr from '../style/slurmel-icon.svg';
import slurmelIconNotebookStr2 from '../style/slurmel-icon-notebook.svg';
import { LabIcon } from '@jupyterlab/ui-components';

export const slurmelIcon = new LabIcon({
    name: 'launcher:slurmel',
    svgstr: slurmelIconNotebookStr
});

export const slurmelIcon2 = new LabIcon({
    name: 'launcher:slurmel2',
    svgstr: slurmelIconNotebookStr2
});