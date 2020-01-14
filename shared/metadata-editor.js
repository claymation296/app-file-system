
/**
  * `metadata-editor`
  * 
  *   Display and update file metadata in a shared content section.
  * 	Can edit file 'displayName', 'keywords', 'notes'.
  *
  *
  *
  *  Properites:
  *
  *  
  *    item - <Object> required: File item data object.
  *
  *
  *
  *
  *
  * @customElement
  * @polymer
  * @demo demo/index.html
  *
  **/


import {
  AppElement, 
  html
}                 from '@longlost/app-element/app-element.js';
import {
	compose,
	map,
	split
} 								from '@longlost/lambda/lambda.js';
import htmlString from './metadata-editor.html';
import '@longlost/app-icons/app-icons.js';
import '@longlost/app-shared-styles/app-shared-styles.js';
import '@polymer/iron-icon/iron-icon.js';
import '@polymer/paper-button/paper-button.js';
import '@polymer/paper-input/paper-input.js';
import './file-icons.js';
import './notes-textarea.js';


const normalize 			= x => x.trim().toLowerCase();
const toKeywordsArray = compose(split(' '), map(normalize));


class MetadataEditor extends AppElement {
  static get is() { return 'metadata-editor'; }

  static get template() {
    return html([htmlString]);
  }


  static get properties() {
    return {

    	isImg: Boolean,
      
      // File item object.
      item: Object,

      // State of interaction with inputs.
      _changes: {
      	type: Boolean,
      	value: false
      },

      _displayName: String,

      _notes: String,

      _rawKeywords: String

    };
  }


  static get observers() {
  	return [
  		'__itemChanged(item)'
  	];
  }


  __computeSaveBtnClass(isImg) {
  	return isImg ? 'is-img' : '';
  }


  __itemChanged(item) {
  	if (!item) { return; }

  	const {displayName, keywords, notes} = item;

  	this._displayName = displayName;
  	this._rawKeywords = keywords ? keywords.join(' ') : '';
  	this._notes 			= notes;
  	this._changes 		= false;
  }


  __displayNameInputValueChanged(event) {
    this._displayName = event.detail.value.trim();
    this._changes 		= true;

    // For consumption by parent element.
    this.fire('display-name-changed', {
    	value: this._displayName
    });
  }


  __keywordsInputValueChanged(event) {
    this._rawKeywords = event.detail.value.trim();
    this._changes 		= true;
  }


  __notesChanged(event) {
  	this._notes 	= event.detail.value;
  	this._changes = true;
  }


  async __saveBtnClicked() {
  	try {
  		await this.clicked();

  		const keywords = toKeywordsArray(this._rawKeywords);

  		const item = {
  			...this.item, 
  			displayName: this._displayName, 
  			keywords, 
  			notes: 			 this._notes
  		};

  		this.fire('update-item', {item});
  	}
  	catch (error) {
  		if (error === 'click debounced') { return; }
  		console.error(error);
  	}
  }

}

window.customElements.define(MetadataEditor.is, MetadataEditor);
