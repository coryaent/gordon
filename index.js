"use strict";

if (process.argv.includes ('--init')) {
    require ('./initialization.js');
} else if (process.argv.includes ('--create-bucket')) {
    require ('./createBucket.js');
}
