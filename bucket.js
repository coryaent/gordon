"use strict";

const fs = require("node:fs");

module.exports = {
  createBucket: async function(options) {

    // read admin token if the user passed it as a file
    const adminToken = options.adminToken || fs.readFileSync(options.tokenFile).toString().trim();
    // bail if there is no admin token
    if (!adminToken) {
      console.error('No admin token specified.');
      process.exit(1);
    }

    // http headers
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    };

    // this will be used multiple times, declared here for clarity
    let response;

    // create the bucket
    response = await fetch(`${options.endpoint}/v2/CreateBucket`, {
      'method': 'POST',
      'headers': headers,
      'body': {
        'globalAlias': options.create,
        'localAlias': null
      }
    });

    // hold the resultst
    const bucket = await response.json();

    // important data from the result
    const alias = bucket.globalAliases[0];
    const accessKeyId = bucket.keys[0].accessKeyId;

    // get the secret access key
    response = await fetch(`${options.endpoint}/v2/GetKeyInfo`, {
      'headers': headers,
      'body': {
        'id': accessKeyId
      }
    });

    const keyInfo = await response.json();

    console.log(
      "=====================================================================================",
    );
    // output the required keys
    console.log(" bucket:", alias);
    console.log(" access_key_id:", accessKeyId);
    console.log(" secret_access_key:", keyInfo.secretAccessKey);
    console.log(
      "=====================================================================================",
    );

  },
  deleteBucket: async function(options) {

    // read admin token if the user passed it as a file
    const adminToken = options.adminToken || fs.readFileSync(options.tokenFile).toString().trim();
    // bail if there is no admin token
    if (!adminToken) {
      console.error('No admin token specified.');
      process.exit(1);
    }

    // http headers
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    };


    let response = await fetch(`${options.endpoint}/v2/DeleteBucket`, {
      'method': 'POST',
      'id': options.delete
    });

    switch (response.status) {
      case 200:
        console.log('Bucket has been deleted')
        break;

      case 400:
        console.error('Bucket is not empty');
        break;

      case 404:
        console.error('Bucket not found');
        break;

      case 500:
        console.error('Internal server error')
        break;

      default:
        console.error('Unknown error')
    }
  }
};
