"use strict";

// console.log ('Creating bucket...');

const fs = require ('node:fs');

const headers = {
    "Content-Type": "application/json"
};
if (process.env.GORDON_ADMIN_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GORDON_ADMIN_TOKEN}`
}
if (process.env.GORDON_ADMIN_TOKEN_FILE) {
    headers.Authorization = `Bearer ${fs.readFileSync (process.env.GORDON_ADMIN_TOKEN_FILE).toString ()}`
}

let accessKey = undefined;

async function create (bucketName) {
    // this needs to quietly fail so that the logs are not cluttered with nonsense
    try {
        // create a new bucket
        let response = await fetch (`http://${process.env.GORDON_ADMIN_ENDPOINT}/v1/bucket`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify ({
                globalAlias: bucketName
            })
        });
        var bucket = await response.json ();
        if (bucket.code == "BucketAlreadyExists") {
            console.log (bucket.message);
            process.exit (0);
        }
        if (process.argv.includes ("--debug")) {
            console.debug ("bucket:", bucket);
        }
        // create a new key
        if (!process.env.GARAGE_ACCESS_KEY_ID) {
            response = await fetch (`http://${process.env.GORDON_ADMIN_ENDPOINT}/v1/key`, {
                method: "POST",
                headers: headers,
                body: JSON.stringify ({
                    name: `${process.env.GORDON_NEW_BUCKET_NAME}-key`
                })
            });
            accessKey = await response.json ();
            if (process.argv.includes ("--debug")) {
                console.debug ('accessKey:', accessKey);
            }
        }
        // use an existing key
        else {
            response = await fetch (`http://${process.env.GORDON_ADMIN_ENDPOINT}/v1/key?` + new URLSearchParams({
                id: process.env.GARAGE_ACCESS_KEY_ID,
                showSecretKey: "true",
            }).toString());
            accessKey = await response.json ();
            console.debug ('accessKey:', accessKey);
        }

        // allow the key to access the bucket
        response = await fetch (`http://${process.env.GORDON_ADMIN_ENDPOINT}/v1/bucket/allow`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify ({
            bucketId: bucket.id,
            accessKeyId: accessKey.accessKeyId,
            permissions: {
                read: true,
                write: true,
                owner: true
                }
            })
        });
        if (process.argv.includes ("--debug")) {
            console.debug ("response:", response);
        }
    } catch (error) {
        console.error ("Unable to create bucket", process.env.GORDON_NEW_BUCKET_NAME);
        process.exit (1);
    }
    // any good bucket has an id
    if (bucket && bucket.id) {
        console.log ("=====================================================================================");
        // output the required keys
        console.log (" bucket:", bucket.globalAliases[0] || bucket.id);
        console.log (" access_key_id:", accessKey.accessKeyId);
        console.log (" secret_access_key:", accessKey.secretAccessKey);
        console.log ("=====================================================================================");
    } else {
        console.error ("Unable to create bucket", process.env.GORDON_NEW_BUCKET_NAME);
        process.exit (1);
    }
}

create (process.env.GORDON_NEW_BUCKET_NAME);
