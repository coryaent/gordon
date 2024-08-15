"use strict";

console.log ('Creating bucket...');

const headers = {
    "Content-Type": "application/json"
};
if (process.env.GORDON_ADMIN_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GORDON_ADMIN_TOKEN}`
}
if (process.env.GORDON_ADMIN_TOKEN_FILE) {
    headers.Authorization = `Bearer ${fs.readFileSync (process.env.GORDON_ADMIN_TOKEN_FILE).toString ()}`
}

async function create (bucketName) {
    // create a new bucket
    let response = await fetch (`http://${process.env.GORDON_ADMIN_ENDPOINT}/v1/bucket`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify ({
            globalAlias: bucketName
        })
    });
    let bucket = await response.json ();
    if (bucket.code == "BucketAlreadyExists") {
        console.log (bucket.message);
        process.exit (0);
    }
    // console.log ("bucket:", bucket);

    // create a new key
    response = await fetch (`http://${process.env.GORDON_ADMIN_ENDPOINT}/v1/key`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify ({
            name: `${process.env.GORDON_NEW_BUCKET_NAME}-key`
        })
    });
    let accessKey = await response.json ();

    // allow the new key to access the bucket
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

    // output the required keys
    console.log ("bucket:", bucket.globalAliases[0] || bucket.id);
    console.log ("access_key_id:", accessKey.accessKeyId);
    console.log ("secret_access_key:", accessKey.secretAccessKey);
}

create (process.env.GORDON_NEW_BUCKET_NAME);
