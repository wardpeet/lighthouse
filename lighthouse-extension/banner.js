/**
 * @license
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const through = require('through2');

module.exports = function(banner) {
  return through.obj(function(file, enc, cb) {
    if (file.isStream()) {
      const stream = through();
      stream.write(new Buffer(banner));
      // eslint-disable-next-line no-invalid-this
      stream.on('error', this.emit.bind(this, 'error'));
      file.contents = file.contents.pipe(stream);
    } else {
      file.contents = Buffer.concat([new Buffer(banner), file.contents]);
    }

    // eslint-disable-next-line no-invalid-this
    this.push(file);

    cb();
  });
};
