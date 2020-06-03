
/**
  * `processing-icon`
  * 
  *  Animated icon that helps illustrate that a file is being processed in the cloud.
  *
  *
  *  properites:
  *
  *  
  *    item - file data object that drives animation timing
  * 
  *
  *
  * @customElement
  * @polymer
  * @demo demo/index.html
  *
  *
  **/

import {
  AppElement, 
  html
}                 from '@longlost/app-element/app-element.js';
import {
  schedule,
  wait
}                 from '@longlost/utils/utils.js';
import {
  allProcessingRan,
  isCloudProcessable
}                 from '../shared/utils.js';
import htmlString from './processing-icon.html';
import '@longlost/app-icons/app-icons.js';
import '@polymer/iron-icon/iron-icon.js';
import '../shared/file-icons.js';


class ProcessingIcon extends AppElement {
  static get is() { return 'processing-icon'; }

  static get template() {
    return html([htmlString]);
  }


  static get properties() {
    return {

      item: Object,

      _animate: {
        type: Boolean,
        value: false,
        computed: '__computeAnimate(item)'
      }

    };
  }


  static get observers() {
    return [
      '__animateChanged(_animate)'
    ];
  }

  // animate from upload through final processing
  __computeAnimate(item) {
    if (!item || 'type' in item === false) { return false; }

    // Animate during image processing as well.
    if (isCloudProcessable(item)) {
      return item.original && !allProcessingRan(item);
    }

    // Other file types don't have futher post-processing
    // so we are done animating.  
    return false;
  }


  __animateChanged(animate) {

    if (animate) {
      this.__startAnimation();
    }
    else {
      this.__stopAnimation();
    }
  }


  async __startAnimation() {
    this.style['display'] = 'block';

    // Wait for <upload-controls> to hide.
    await wait(500); 

    this.style['transform'] = 'scale(1, 1)';
    this.$.gear.classList.add('rotate');
  }


  async __stopAnimation() {
    this.style['transform'] = 'scale(0, 0)';
    this.$.gear.classList.remove('rotate');

    await wait(250);

    this.style['display'] = 'none';
  }

}

window.customElements.define(ProcessingIcon.is, ProcessingIcon);
