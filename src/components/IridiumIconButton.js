import { html } from 'htm/preact';
import icons from '../icons.js';

const IridiumIconButton = ({ name, content = '', style = '', onClick }) =>
  html`<img
    onClick=${onClick}
    src=${icons(name)}
    title=${content}
    style=${`cursor:pointer;width:1rem;height:1rem;margin:4px;${style}`}
  />`;

export default IridiumIconButton;
