
/**
  * `file-sources`
  * 
  *   An overlay that allows users to add files to an app
  *   from several different sources. 
  *   
  *   Button press to access native file picker.
  *   Drag and drop zone.
  *   File url input.
  *
  *
  *  Properites:
  *
  *
  *    accept - <String> optional: file type to allow from user. 
  *             Any valid HTML5 input accept string or one of 3 
  *             shorthand values: 'image', 'video' or 'audio'.
  *             ie. 'audio', 'video', 'audio,.jpg', '.doc', ... 
  *             default -> 'image'
  * 
  *
  *    multiple - <Boolean> optional: false -> only accept one file at a time, true -> allow many files at the same time.
  *               default -> false
  *
  *
  *
  *  Events:
  *
  *
  *
  *    'files-received' - Fired after user interacts with renameFileModal and before the file upload process begins.
  *                       detail -> {name, size, type, uid, <, _tempUrl>}
  *                                   name     - 'filename' (name.ext)
  *                                   _tempUrl - window.URL.createObjectURL
  *
  *  
  *
  *  
  *  Methods:
  *
  *
  *    add() - Add one File obj or an array of File objects for upload to Firebase Firestore and Storage.
  *
  *
  *    getData() - Returns file data {[uid]: {coll, doc, ext, field, index, name, path, size, sizeStr, type, uid, _tempUrl <, optimized, original, thumbnail>}, ...}.
  *              
  *
  *    delete(uid) - uid  -> <String> required: file uid to target for delete operation.
  *                            Returns Promise 
  *                            resolves to {coll, doc, ext, field, index, name, path, size, sizeStr, type, uid, _tempUrl <, optimized, original, thumbnail>}.
  *
  *    
  *    deleteAll() - Returns Promise that resolves when deletion finishes.
  *
  *
  *
  *   @customElement
  *   @polymer
  *   @demo demo/index.html
  *
  *
  **/


import {
  AppElement, 
  html
}                   from '@longlost/app-element/app-element.js';
import {
  capitalize,
  compose,
  head,
  map,
  split
}                   from '@longlost/lambda/lambda.js';
import {
  hijackEvent,
  schedule,
  warn
}                   from '@longlost/utils/utils.js';
import path         from 'path'; // webpack includes this by default!
import mime         from 'mime-types';
import descriptions from './mime-descriptions.json';
import services     from '@longlost/services/services.js';
import htmlString   from './file-sources.html';
import '@longlost/app-overlays/app-header-overlay.js';
import '@longlost/app-overlays/app-modal.js';
import '@longlost/app-shared-styles/app-shared-styles.js';
import '@longlost/app-spinner/app-spinner.js';
import '@polymer/paper-button/paper-button.js';
import '@polymer/paper-input/paper-input.js';
import '../shared/file-thumbnail.js';
import './list-icon-button.js';
import './web-file-card.js';
import './device-file-card.js';


const KILOBYTE = 1024;
const MEGABYTE = 1048576;

const EXIF_TAGS = [
  'DateTimeOriginal',   // Date and time string when image was originally created.
  'GPSAltitude',        // Meters.
  'GPSAltitudeRef',     // '0' - above sea level, '1' - below sea level.
  'GPSDateStamp',       // UTC. 'YYYY:MM:DD'.
  'GPSImgDirection',    // 'T' true north, or 'M' for magnetic north.
  'GPSImgDirectionRef', // 0 - 359.99, degrees of rotation from north.
  'GPSLatitude',        // Degrees, minutes, and seconds (ie. With secs - dd/1,mm/1,ss/1, or without secs dd/1,mmmm/100,0/1).
  'GPSLatitudeRef',     // 'N' for north latitudes, 'S' for south latitudes.
  'GPSLongitude',       // Degrees, minutes, and seconds (ie. With secs - dd/1,mm/1,ss/1, or without secs dd/1,mmmm/100,0/1).
  'GPSLongitudeRef',    // 'E' for east longitudes, 'W' for west longitudes.
  'GPSTimeStamp',       // UTC. hour, minute, sec.
  'ImageDescription',   // User generated string for image (ie. 'Company picnic').
  'Orientation'         // One of 8 values, most common are 1, 3, 6 and 8 since other are 'flipped' versions.
];


// These helpers used to compute _mimes.
const trim = str => str.trim();
const getAcceptEntries = compose(split(','), map(trim));
const removeWildCards  = compose(split('/*'), head);

// Use arrow function here to block extra arguments 
// that map passes in to the map function.
const getMimeTypes = map(str => removeWildCards(str));

// Create a human-readable file size display string.
const formatFileSize = size => {

  if (size < KILOBYTE) {
    return `${size}bytes`;
  }

  if (size >= KILOBYTE && size < MEGABYTE) {
    return `${Number((size / KILOBYTE).toFixed(1))}KB`;
  } 

  if (size >= MEGABYTE) {
    return `${Number((size / MEGABYTE).toFixed(1))}MB`;
  }
};


const getName = basename => 
  path.basename(basename, path.extname(basename));

// Read all jpg files to extract their exif information.
const addAdditionalData = async files => {
  try { 

    const {default: Worker} = await import('./worker.js');
    const {init, run}       = await import('@longlost/worker/worker.runner.js');

    await init(Worker);

    const promises = files.map(file => {

      // Send jpg files to worker to read 
      // exif data and get a uid.
      if (file.type.includes('jpg') || file.type.includes('jpeg')) {
        return run('getUidAndTags', file, EXIF_TAGS);
      }

      // Don't send file to worker, just get a uid.
      return run('getUidAndTags'); 
    });
    
    const data = await Promise.all(promises);

    return files.map((file, index) => {
      const {tags, uid} = data[index];

      if (file.type.includes('image') || file.type.includes('video')) { 
        file._tempUrl = window.URL.createObjectURL(file);
      }
      else {
        file._tempUrl = null; // Firestore does not accept undefined vals;
      }
    
      file.basename  = file.name;
      file.exif      = tags ? tags : null; // Firestore does not accept undefined vals;
      file.ext       = path.extname(file.name);
      file.index     = index;
      file.sizeStr   = formatFileSize(file.size);
      file.timestamp = Date.now();
      file.uid       = uid;

      return file;
    });
  }
  catch (error) {
    console.error(error);
    return files;
  }
};


class FileSources extends AppElement {
  static get is() { return 'file-sources'; }

  static get template() {
    return html([htmlString]);
  }


  static get properties() {
    return {

      // Any valid HTML5 input accept string or
      // one of 3 shorthand values: 'image', 'video' or 'audio'.
      accept: String,

      // Same as Firestore collection save location.
      coll: String,

      // Used for <list-icon-button> calculation and animations.
      // Object form of database items.
      data: Object,

      // Set to true to hide the add and delete dropzones.
      hideDropzone: Boolean,

      list: String, // 'files' or 'photos'.

      maxfiles: Number,

      maxsize: Number,

      // One file upload or multiple files.
      multiple: Boolean,

      unit: String, // 'B', 'kB', 'MB' or 'GB'

      // Human-readable string of acceptable file types
      // displayed at top of card as a hint for user.
      _acceptableTypes: {
        type: String,
        computed: '__computeAcceptableTypes(_mimes)'
      },

      _files: Object,

      _filesToRename: Array,

      // Using maxsize and unit to calculate the total allowed bytes
      // any one file can have.
      _maxbytes: {
        type: Number,
        computed: '__computeMaxBytes(maxsize, unit)'
      },    

      // This array containes mime types (ie. 'image/jpeg').
      // It us used to check against fetch response 'content-type' in order
      // to be sure we are only loading the desired types of files.
      _mimes: {
        type: Array,
        computed: '__computeMimeTypes(accept)'
      },

      // Cached rename modal input values.
      _newDisplayNames: {
        type: Object,
        value: () => ({})
      }

    };
  }


  static get observers() {
    return [
      '__filesChanged(_files)'
    ];
  }


  __computeAcceptableTypes(mimes) {
    if (!mimes) { return ''; }

    const description = mimes.reduce((accum, m) => {
      const desc = descriptions[m];

      if (desc) {
        accum = accum ? `${accum}, ${desc}` : desc;
      }
      
      return accum;
    }, '');

    return `${capitalize(description)}.`;
  }


  __computeMaxBytes(maxsize, unit) {
    if (!maxsize || !unit) { return; }

    const mulipliers = {
      'b':  0,
      'kb': 1,
      'mb': 2,
      'gb': 3
    };

    const muliplier = mulipliers[unit.toLowerCase()];

    return maxsize * muliplier * 1024;
  }


  __computeMimeTypes(accept) {
    if (!accept) { return; }

    // The comma seperated accept entries.
    const entries = getAcceptEntries(accept);

    // Use the 'mime-types' library to lookup the 
    // corresponding header content-type strings
    // that align with the accept string.
    const types = entries.map(mime.contentType);

    // Take out wild cards. (ie. 'image/*' -> 'image')
    const mimes = getMimeTypes(types);

    return mimes;
  }


  __computeRenameModalHeading(files) {
    if (!Array.isArray(files)) { return ''; }

    return files.length > 1 ? 'Rename Files' : 'Rename File';
  }


  __computeRenameModalPural(files) {    
    if (!Array.isArray(files)) { return ''; }

    return files.length > 1 ? 'these files' : 'this file';
  }


  __computePlaceholderName(name) {
    return getName(name);
  }


  __filesChanged(files) {
    if (!files) { return; }

    this.$.deviceFileCard.clearFeedback();
    this.fire('files-changed', {value: files});
  }


  async __listBtnClicked() {
    try {
      await this.clicked();
      this.fire('open-list');
    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error);
    }
  }


  async __uploadFile(file) {

    let controlsCallback;

    const {basename, displayName, ext, uid} = file;

    const controlsPromise = new Promise(resolve => {
      controlsCallback = resolve;
    });

    const doneCallback = data => {
      const {path, url} = data;

      this.fire('upload-complete', {
        original: url,
        path,
        uid
      });
    };

    const errorCallback = error => {
      
      if (error.code_ && error.code_ === 'storage/canceled') {

        this.fire('upload-progress-updated', {
          progress: 0, 
          state:   'Canceled', 
          uid
        });

        return;
      }

      if (error.code_ && error.code_ === 'storage/unknown') {

        this.fire('upload-progress-updated', {
          progress: 0, 
          state:   'Error', 
          uid
        });

        warn('An error occured while uploading your file.');
        return;
      }

      console.error('Upload error: ', error.code_);
    };

    const stateChangedCallback = data => {
      const {progress, state} = data;

      this.fire('upload-progress-updated', {
        progress, 
        state: capitalize(state), 
        uid
      });
    };

    const metadata = {

      // Force 'original' file link to be 
      // downloadable when used in an anchor tag.
      // ie. <a download href="http://original-file-url.ext">Download Me</a>.
      contentDisposition: `attachment; filename="${displayName}${ext}"`,

      // 'metadata.customMetadata' in client sdk, 
      // 'metadata.metadata' in cloud functions.
      customMetadata: {uid}
    }; 

    const path = `${this.coll}/${uid}/${basename}`;

    await services.fileUpload({
      controlsCallback:     controlsCallback,
      doneCallback:         doneCallback,
      errorCallback:        errorCallback, 
      file,
      metadata,
      path,
      stateChangedCallback: stateChangedCallback
    });

    file.controls = await controlsPromise;

    return file;
  }

  // Start File upload to storage.
  // Add upload controls and 
  // state for <upload-controls> UI.
  __uploadNewFiles(files) {
    return files.map(file => this.__uploadFile(file));
  }


  async __addNewFiles(files) {

    const uploadingFiles = await Promise.all(this.__uploadNewFiles(files));

    const newFiles = uploadingFiles.reduce((accum, file) => {
      accum[file.uid] = file;
      return accum;
    }, {});

    this._files = this._files ? {...this._files, ...newFiles} : newFiles;
  }


  __renameInputChanged(event) {
    hijackEvent(event);
    
    const {value}     = event.detail;
    const {uid}       = event.model.file;
    const displayName = value.trim();

    // Don't save empty name values, 
    // use file name instead.
    if (!displayName) {
      delete this._newDisplayNames[uid];
    }
    else {
      this._newDisplayNames[uid] = displayName;
    }
  }


  async __resetRenameFilesModal() {
    await schedule();       
    await this.$.renameFilesModal.close();
    this._filesToRename   = undefined;
    this._newDisplayNames = {};
  }


  async __saveNamesButtonClicked(event) {
    try {
      hijackEvent(event);

      await this.clicked();

      const renamedFiles = this._filesToRename.map(file => {

        // Use user edits from modal input.
        if (this._newDisplayNames[file.uid]) {

          // Cannot use object spread notation on object-like File.
          file.displayName = this._newDisplayNames[file.uid];
        }

        // Fallback to existing filename if user has
        // not provided an alternative.
        else {
          file.displayName = getName(file.name);
        }
        return file;
      });

      this.__addNewFiles(renamedFiles);
      await this.__resetRenameFilesModal();
    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error);
      warn('An error occured while adding files.');
    }
  }


  async __dismissRenameFilesModalButtonClicked(event) {
    try {
      hijackEvent(event);

      await this.clicked();

      const files = this._filesToRename.map(file => {
        file.displayName = getName(file.name);
        return file;
      });

      this.__addNewFiles(files);
      await this.__resetRenameFilesModal();
    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error);
      warn('An error occured while adding files.');
    }
  }


  async __filesAdded(files) {
    try {
      await this.$.spinner.show('Reading files.');

      // Drives modal repeater.
      this._filesToRename = await addAdditionalData(files);

      this.$.deviceFileCard.clearFeedback();
      await schedule();
      await this.$.renameFilesModal.open();
    }
    catch (error) {
      console.error(error);
      await warn('An error occured while gathering your files.');
    }
    finally {
      this.$.spinner.hide();
    }  
  }


  __webFileAdded(event) {
    hijackEvent(event);

    this.__filesAdded([event.detail.file]);
  }


  __deviceFilesAdded(event) {    
    hijackEvent(event);

    this.__filesAdded(event.detail.files);
  }


  async __showFeedback(type) {
    this.$.deviceFileCard.createFeedback(type);
    await warn('Could not add those files.');
    return this.$.spinner.hide();
  }


  __handleMultipleFiles(files) {
    const array = [...files];

    if (this.maxfiles && Object.keys(this._files).length + array.length > this.maxfiles) {
      this.__showFeedback('tooMany');
    }
    else if (array.some(file => this._maxbytes && file.size > this._maxbytes)) {
      this.__showFeedback('tooLarge');
    }
    else {
      this.__filesAdded(array);
    }
  }


  __handleSingleFile(file) {

    if (this._maxbytes && file.size > this._maxbytes) {
      this.__showFeedback('tooLarge');
    }
    else {
      this.__filesAdded([file]);
    }
  }

  
  addFiles(files) {
    
    if (this.multiple) {
      this.__handleMultipleFiles(files);
    }
    else if (files.length === 1) {
      this.__handleSingleFile(files[0]);
    }
    else {
      this.__showFeedback('single');
    }
  }
  

  delete(uid) {
    if (!this._files || !this._files[uid]) { return; }
    
    delete this._files[uid];
  }


  open() {
    return this.$.overlay.open();
  }

}

window.customElements.define(FileSources.is, FileSources);
