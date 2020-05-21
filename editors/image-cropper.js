

/**
  * `image-cropper`
  * 
  *   
  *   Crop, rotate and zoom an imput image.
  *
  *
  *
  *  Properites:
  *
  *
  *     item - Required. Image file db object.    
  *
  *
  *
  *  Events:
  *
  *
  *   
  *  
  *  Methods:
  *
  *
  *    
  *
  *
  *   @customElement
  *   @polymer
  *   @demo demo/index.html
  *
  **/


import {AppElement, html}     from '@longlost/app-element/app-element.js';
import {ImageEditorItemMixin} from './image-editor-item-mixin.js';
import {wait, warn}           from '@longlost/utils/utils.js';
import htmlString             from './image-cropper.html';
import '@polymer/iron-a11y-keys/iron-a11y-keys.js';
import '@polymer/iron-icon/iron-icon.js';
import '@polymer/iron-selector/iron-selector.js';
import '@polymer/paper-button/paper-button.js';
import '@polymer/paper-icon-button/paper-icon-button.js';
import './image-editor-icons.js';
import './image-editor-item.js';
import './crop-wrapper.js';
import './rotation-slider.js';


// String --> Number/undefined
// A helper function that converts
// an aspect dom element name
// to the appropriate number form
// for crop-wrapper.
const getRatio = name => {
  switch (name) {
    case 'free':
      return undefined;
    case '16:9':
      return 16 / 9;
    case '4:3':
      return 4 / 3;
    case 'square':
      return 1;
    case '2:3':
      return 2 / 3;
    default:
      return undefined;
  }
};



class ImageCropper extends ImageEditorItemMixin(AppElement) {
  static get is() { return 'image-cropper'; }

  static get template() {
    return html([htmlString]);
  }


  static get properties() {
    return {

      _cropBtnDisabled: {
        type: Boolean,
        value: true
      },

      // From rotation buttons.
      _degrees: {
        type: Number,
        value: 0
      },

      // From rotation slider.
      _fineDegrees: {
        type: Number,
        value: 0
      },

      _selectedAspect: {
        type: String,
        value: 'free'
      },

      _selectedFlips: {
        type: Array,
        value: () => ([])
      },

      _selectedShape: {
        type: String,
        value: 'square'
      },

      _type: {
        type: String,
        value: 'cropped',
        readOnly: true
      }

    };
  }


  connectedCallback() {
    super.connectedCallback();

    this.$.a11y.target = document.body;
  }


  __a11yKeysPressed(event) {

    const {key} = event.detail.keyboardEvent;

    switch (key) {
      case 'ArrowDown':
        this.$.down.click();
        break;
      case 'ArrowLeft':
        this.$.left.click();
        break;
      case 'ArrowRight':
        this.$.right.click();
        break;
      case 'ArrowUp':
        this.$.up.click();
        break;
      default:
        break;
    }
  }


  async __btnClicked(fn, ...args) {
    try {

      if (!this.$.cropper.isReady) { return; }

      await this.clicked(100);

      this._cropBtnDisabled = false;

      const callback = this.$.cropper[fn];

      return callback.bind(this.$.cropper)(...args);
    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error);
      return warn('Oops! That did not work right.');
    }
  }


  __zoomInClicked() {
    this.__btnClicked('zoom', 0.1);
  }


  __zoomOutClicked() {
    this.__btnClicked('zoom', -0.1);
  }


  __flipHorzClicked() {
    this.__btnClicked('flipHorz');
  }


  __flipVertClicked() {
    this.__btnClicked('flipVert');
  }


  __squareClicked() {
    this._selectedShape = 'square';
    this.__btnClicked('setRound', false);
  }


  __circleClicked() {   
    this._selectedShape = 'circle';
    this.__btnClicked('setRound', true);
  }


  __aspectRatioSelected(event) {
    if (!this.$.cropper.isReady) { return; }

    const {value: name} = event.detail;

    this._cropBtnDisabled = false;
    this._selectedAspect  = name;
    this.$.cropper.setAspectRatio(getRatio(name));
  }


  __fineDegreesChanged(event) {
    if (!this.$.cropper.isReady) { return; }

    this._cropBtnDisabled = false;
    this._fineDegrees     = event.detail.value;

    this.$.cropper.rotateTo(this._degrees + this._fineDegrees);
  }

  
  __rotateLeftClicked() {

    this._degrees -= 45;

    this.__btnClicked('rotateTo', this._degrees + this._fineDegrees);
  }


  async __centerSliderClicked() {
    try {
      await this.clicked();

      this.$.slider.center();
    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error); 
    }
  }

  
  __rotateRightClicked() {

    this._degrees += 45;

    this.__btnClicked('rotateTo', this._degrees + this._fineDegrees);
  }


  __resetClicked() {
    this.__reset();
  }


  __upClicked() {
    this.__btnClicked('move', 0, -10);
  }


  __leftClicked() {
    this.__btnClicked('move', -10, 0);
  }


  __rightClicked() {
    this.__btnClicked('move', 10, 0);
  }


  __downClicked() {
    this.__btnClicked('move', 0, 10);
  }


  async __cropClicked() {
    const [file] = await Promise.all([
      this.__btnClicked('getCrop'),
      wait(2000)
    ]);

    this.fire('image-cropper-cropped', {value: file});

    this.$.item.hideSpinner();
  }


  __reset() {
    this._degrees         = 0;
    this._fineDegrees     = 0;
    this._cropBtnDisabled = true;
    this._selectedAspect  = 'free';
    this._selectedFlips   = [];
    this._selectedShape   = 'square';
    this.$.slider.center();
    this.__btnClicked('reset');
  }

}

window.customElements.define(ImageCropper.is, ImageCropper);
